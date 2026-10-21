import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import lot from '../content/enrichissement-v12/massif2.json';
import {MIGRATION_MASSIF2,sqlMassif2} from '../scripts/enrichissement-massif2';
import {verifierReservationsEnrichissement} from '../scripts/import-enrichissement-v12';
import {lireCsv} from '../scripts/csv';
import fun from '../content/fun/manifeste.json';
import a1 from '../content/enrichissement-v12/a1.json';
import precedent from '../content/enrichissement-v12/massif.json';

it('conserve 151 nouveautés distinctes en trois groupes et trois rattachements existants',()=>{
 expect(lot.events).toHaveLength(151);
 expect(new Set(lot.events.map(e=>e.id)).size).toBe(151);
 expect(new Set(lot.events.map(e=>e.title)).size).toBe(151);
 expect([1,2,3].map(n=>lot.events.filter(e=>e.niveau===n).length)).toEqual([122,27,2]);
 expect(lot.events.reduce((n,e)=>n+e.packs.length,0)).toBe(513);
 expect(lot.associations).toHaveLength(3);
 for(const e of lot.events){
  expect(e.description.length).toBeGreaterThan(40);expect(e.level_reason).toBeTruthy();
  expect(e.sources.length).toBeGreaterThan(0);
  for(const s of e.sources){expect(new URL(s.url).protocol).toBe('https:');expect(s.evidence).toBeTruthy();}
  expect(e.packs.every(p=>lot.packs.some(x=>x.id===p)&&!['COL-0059','COL-0060','COL-0077'].includes(p))).toBe(true);
  expect(new Set(e.packs).size).toBe(e.packs.length);
  expect(e.precision).toBe(e.start_day!=null?'DAY':e.start_month!=null?'MONTH':'YEAR');
  expect(e.start_year).not.toBe(0);
  if(e.start_month!=null)expect(e.start_month).toBeGreaterThanOrEqual(1);
  if(e.start_month!=null)expect(e.start_month).toBeLessThanOrEqual(12);
  if(e.start_day!=null){
   const date=new Date(Date.UTC(e.start_year,e.start_month!-1,e.start_day));
   expect(date.getUTCMonth()+1).toBe(e.start_month);expect(date.getUTCDate()).toBe(e.start_day);
  }
  if(e.kind==='cinema'){expect(e.territory).not.toBe('sans objet');expect(e.title).toContain('('+e.territory+')');}
 }
 expect(lot.events.filter(e=>e.date_status!=='EXACT').map(e=>e.date_status).sort()).toEqual([]);
});
it('réserve chaque identifiant et produit un SQL limité aux ajouts histoire',()=>{
 for(const e of lot.events)expect(()=>verifierReservationsEnrichissement([{event_id:e.id}])).toThrow(/réservés au lot V1.2 Massif2/);
 expect(()=>verifierReservationsEnrichissement([{event_id:'EVT-2400'}])).not.toThrow();
 const sql=readFileSync(MIGRATION_MASSIF2,'utf8').replaceAll('\r\n','\n');expect(sql).toBe(sqlMassif2());
 const executable=sql.replace(/^\s*--.*$/gm,'').replace(/'(?:[^']|'')*'/g,"''");
 expect(executable).not.toMatch(/\b(public|auth|private|supabase_migrations)\./);
 expect(executable).not.toMatch(/\b(update|delete|truncate|drop|alter|create|grant|revoke)\s/i);
 expect([...executable.matchAll(/insert into\s+([\w.]+)/gi)].every(m=>m[1].startsWith('histoire.'))).toBe(true);
 expect(executable).toContain('jsonb_build_object');
});
it('ne réintroduit aucun titre ni alias existant dans le v18, les packs fun et A1',()=>{
 const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const anciens=new Map<string,string>();
 const ajoute=(id:string,labels:string[])=>{for(const label of labels)if(label.trim())anciens.set(norm(label),id);};
 for(const e of lireCsv('content/dataset-v18/kiffeurs-events-v18.csv'))ajoute(e.event_id,[e.title_canonical,...e.aliases.split(';')]);
 for(const e of lireCsv('content/dataset-v18/kiffeurs-alias-additions-v18.csv'))ajoute(e.event_id,e.aliases_added.split(';'));
 for(const e of fun.events)ajoute(e.id,[e.title,...e.alias]);
 for(const e of a1.events)ajoute(e.id,[e.title,...e.aliases]);
 for(const e of precedent.events)ajoute(e.id,[e.title,...e.aliases]);
 const collisions=[];
 for(const e of lot.events)for(const label of [e.title,...e.aliases]){
  const old=anciens.get(norm(label));if(old&&old!==e.id)collisions.push({id:e.id,old,label});
  ajoute(e.id,[label]);
 }
 expect(collisions).toEqual([]);
});
