import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { expect,it } from 'vitest';
import fun from '../content/fun/manifeste.json';
import catalogue from '../src/lib/solo/catalogue.json';
import { lireCsv } from '../scripts/csv';
import { verifierReservationsFun } from '../scripts/import-fun';
import { estPackFun } from '../src/lib/solo/packs-fun';
it('offre six packs cohérents, 210 associations, 205 événements et 104 ajouts sourcés',()=>{
  expect(fun.packs.map(p=>p.n[2].YEAR)).toEqual([35,30,50,35,30,30]);
  expect(fun.associations).toHaveLength(210);
  expect(new Set(fun.events.map(e=>e.id)).size).toBe(205);
  expect(fun.events.filter(e=>e.nouveau)).toHaveLength(104);
  expect(new Set(fun.associations.map(a=>a.pack_id+'\0'+a.event_id)).size).toBe(210);
  for(const e of fun.events){
    expect(e.sources.every(s=>new URL(s).protocol==='https:')).toBe(true);
    expect(e.sources.length).toBeGreaterThan(0);
    expect([1,2,3]).toContain(e.niveau);
    expect(e.start_year).not.toBe(0);
    if(e.start_day!==null){
      // Date civile sans année 0 ; les dates anciennes restent dans le modèle du corpus.
      expect(e.start_month).not.toBeNull();
      expect(e.start_day).toBeLessThanOrEqual(new Date(Date.UTC(e.start_year,e.start_month!,0)).getUTCDate());
    }
    if(e.nouveau){expect(e.description).toBeTruthy();expect(e.preuve).toBeTruthy();}
  }
  for(const p of fun.packs){
    expect(p.n[1].YEAR).toBeGreaterThanOrEqual(10);
    expect(estPackFun(p.id)).toBe(true);
    expect(catalogue.packs.find(c=>c.id===p.id)?.n).toEqual(p.n);
  }
  expect(lireCsv('content/fun/inventaire.csv')).toHaveLength(210);
});
it('sépare les films de Pop culture et conserve les précisions réellement sourcées',()=>{
  const films=fun.associations.filter(a=>a.pack_id==='COL-0114').map(a=>a.event_id);
  const pop=fun.associations.filter(a=>a.pack_id==='COL-0115').map(a=>a.event_id);
  expect(films.some(id=>pop.includes(id))).toBe(false);
  expect(fun.packs.find(p=>p.id==='COL-0114')!.inverse[1].DAY).toBe(12);
  const nouveaux=fun.events.filter(e=>e.nouveau);
  expect(nouveaux.filter(e=>e.sources[0].includes('catalog.afi.com')).every(e=>e.precision==='YEAR'&&e.start_day===null)).toBe(true);
  expect(nouveaux.filter(e=>films.includes(e.id)).every(e=>/\((États-Unis|France|Japon)\)$/.test(e.title))).toBe(true);
  expect(fun.events.some(e=>['EVT-0893','EVT-0928'].includes(e.id))).toBe(false);
  expect(new Set(nouveaux.map(e=>e.title+'\0'+e.start_year)).size).toBe(nouveaux.length);
});
it('préserve exactement les 31 packs publiés et ne met à jour aucune donnée existante en SQL',()=>{
  const avant=JSON.parse(execFileSync('git',['show','1a073fc:src/lib/solo/catalogue.json'],{encoding:'utf8'})) as typeof catalogue;
  expect(catalogue.packs.filter(p=>!estPackFun(p.id))).toEqual(avant.packs);
  const migration=readFileSync('supabase/migrations/20261015120156_packs_fun.sql','utf8');
  const executable=migration.replace(/^\s*--.*$/gm,'').replace(/'(?:[^']|'')*'/g,"''");
  expect(executable).not.toMatch(/\b(public|auth|private|supabase_migrations)\./);
  expect(executable).not.toMatch(/\b(update|delete|truncate|drop|alter|create|grant|revoke)\s/i);
  expect(migration).toContain('lock_timeout');
  expect(migration).toContain('histoire.migrations_appliquees');
  expect(migration).toContain('une date ou sa jouabilité a changé');
});
it('refuse les collisions d’import avant toute écriture',()=>{
  const anciens=lireCsv('content/dataset-v18/kiffeurs-ready-collections-v18.csv').map(p=>({collection_id:p.collection_id,slug:p.slug}));
  const events=lireCsv('content/dataset-v18/kiffeurs-events-v18.csv').map(e=>({event_id:e.event_id}));
  expect(()=>verifierReservationsFun(anciens,events)).not.toThrow();
  expect(()=>verifierReservationsFun([...anciens,{collection_id:'COL-0112',slug:'autre'}],events)).toThrow('réservés');
  expect(()=>verifierReservationsFun([...anciens,{collection_id:'AUTRE',slug:'fun-films-cultes'}],events)).toThrow('réservés');
  expect(()=>verifierReservationsFun(anciens,[...events,{event_id:'EVT-2100'}])).toThrow('réservés');
});
