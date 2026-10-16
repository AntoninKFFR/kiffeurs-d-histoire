import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import lot from '../content/enrichissement-v12/a1.json';
import {MIGRATION_A1,sqlA1} from '../scripts/enrichissement-a1';
import {verifierReservationsEnrichissement} from '../scripts/import-enrichissement-v12';
it('conserve les précisions sourcées, territoires et niveaux individuels des 42 propositions',()=>{
 expect(lot.events).toHaveLength(42);
 expect(lot.events.filter(e=>e.niveau===1)).toHaveLength(40);
 expect(lot.events.filter(e=>e.niveau===2).map(e=>e.proposal_id)).toEqual(['A1-021','A1-022']);
 expect(new Set(lot.events.map(e=>e.id)).size).toBe(42);
 expect(new Set(lot.events.map(e=>e.title)).size).toBe(42);
 expect(lot.events.reduce((n,e)=>n+e.packs.length,0)).toBe(86);
 for(const e of lot.events){
  expect(e.sources.length).toBeGreaterThan(0);expect(e.description.length).toBeGreaterThan(40);expect(e.level_reason).toBeTruthy();
  for(const s of e.sources){expect(new URL(s.url).protocol).toBe('https:');expect(s.evidence).toBeTruthy();}
  expect(e.packs.every(p=>!['COL-0059','COL-0060','COL-0077'].includes(p))).toBe(true);
  expect(e.precision).toBe(e.start_day!=null?'DAY':e.start_month!=null?'MONTH':'YEAR');
  if(e.kind==='cinema'){expect(e.territory).toBeTruthy();expect(e.title).toContain('('+e.territory+')');}
 }
 for(const code of ['A1-016','A1-027','A1-036'])expect(lot.events.find(e=>e.proposal_id===code)?.precision).toBe('YEAR');
 expect(lot.events.find(e=>e.proposal_id==='A1-006')).toMatchObject({precision:'MONTH',start_month:12,start_day:null});
});
it('réserve tous les identifiants avant un import, même si le reste du dataset est inédit',()=>{
 expect(()=>verifierReservationsEnrichissement([{event_id:'EVT-0001'},{event_id:'EVT-2500'}])).not.toThrow();
 for(const e of lot.events)expect(()=>verifierReservationsEnrichissement([{event_id:e.id}])).toThrow(/réservés au lot V1.2 A1/);
});
it('génère uniquement de nouveaux événements, réponses privées et liens, sans DDL ni UPDATE',()=>{
 const sql=readFileSync(MIGRATION_A1,'utf8');expect(sql).toBe(sqlA1());
 const executable=sql.replace(/^\s*--.*$/gm,'').replace(/'(?:[^']|'')*'/g,"''");
 expect(executable).not.toMatch(/\b(public|auth|private|supabase_migrations)\./);
 expect(executable).not.toMatch(/\b(update|delete|truncate|drop|alter|create|grant|revoke)\s/i);
 expect([...executable.matchAll(/insert into\s+([\w.]+)/gi)].map(m=>m[1])).toEqual([
  'histoire.events','histoire.event_answers','histoire.event_aliases','histoire.pack_events','histoire.admin_pack_additions','histoire.migrations_appliquees']);
});
