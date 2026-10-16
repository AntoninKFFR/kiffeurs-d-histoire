import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import lot from '../content/enrichissement-v12/a0.json';
import {MIGRATION_A0,sqlA0} from '../scripts/enrichissement-a0';

it('reproduit exactement les dix liens du dossier relu sans toucher aux sélections contractuelles',()=>{
 expect(lot.associations).toHaveLength(10);
 expect(new Set(lot.associations.map(a=>a.pack_id+'|'+a.event_id)).size).toBe(10);
 expect(lot.associations.filter(a=>a.pack_id==='COL-0067').map(a=>a.event_id)).toEqual(['EVT-0446','EVT-0682','EVT-0686']);
 for(const a of lot.associations){
  expect(a.snapshot.id).toBe(a.event_id);expect(a.snapshot.niveau).toBe(1);
  expect(a.snapshot.packs).not.toContain(a.pack_id);
  expect(['COL-0059','COL-0060','COL-0077']).not.toContain(a.pack_id);
  expect(a.verified_sources.length).toBeGreaterThan(0);
  for(const s of a.verified_sources){expect(new URL(s.url).protocol).toBe('https:');expect(s.evidence).toBeTruthy();}
 }
 expect(lot.associations.find(a=>a.event_id==='EVT-0414')?.snapshot).toMatchObject({date_status:'APPROXIMATE',precision:'YEAR',start_month:null,start_day:null});
});
it('garde un SQL déterministe, uniquement des insertions de liens et marqueurs privés',()=>{
 const sql=readFileSync(MIGRATION_A0,'utf8').replaceAll('\r\n','\n');
 expect(sql).toBe(sqlA0());
 const executable=sql.replace(/^\s*--.*$/gm,'').replace(/'(?:[^']|'')*'/g,"''");
 expect(executable).not.toMatch(/\b(public|auth|private|supabase_migrations)\./);
 expect(executable).not.toMatch(/\b(update|delete|truncate|drop|alter|create|grant|revoke)\s/i);
 expect([...executable.matchAll(/insert into\s+([\w.]+)/gi)].map(m=>m[1])).toEqual([
  'histoire.pack_events','histoire.admin_pack_additions','histoire.migrations_appliquees']);
});
