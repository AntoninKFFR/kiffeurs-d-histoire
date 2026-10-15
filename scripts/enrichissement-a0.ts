// Lot A0 #124 : SQL déterministe et fixtures locales depuis la proposition #122.
// Ne se connecte jamais à une base ; publication KFFR soumise au GO explicite.
import {writeFileSync} from 'node:fs';
import {basename} from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import lot from '../content/enrichissement-v12/a0.json';
export const MIGRATION_A0='supabase/migrations/20261015222704_enrichissement_v12_a0.sql';
const quote=(value:unknown)=>value==null?'null':"'"+String(value).replaceAll("'","''")+"'";
export function blocA0(version=basename(MIGRATION_A0).slice(0,14)):string{
 assert(/^\d{14}$/.test(version));
 assert.equal(lot.associations.length,10);
 assert.equal(new Set(lot.associations.map(a=>a.pack_id+'|'+a.event_id)).size,10);
 assert(lot.associations.every(a=>!['COL-0059','COL-0060','COL-0077'].includes(a.pack_id)));
 const data=quote(JSON.stringify({associations:lot.associations,packs:lot.packs}));
 return `do $a0$
declare
  manifeste constant jsonb := ${data}::jsonb;
  presents integer;
begin
  if exists(select 1 from histoire.migrations_appliquees where version='${version}') then return; end if;
  if not exists(select 1 from histoire.events) then
    raise notice 'A0 différé : importer le corpus local puis rejouer la migration';
    return;
  end if;
  if not exists(select 1 from histoire.migrations_appliquees where version='20261015201336') then
    raise exception 'A0 : administration #120 requise';
  end if;
  select count(*) into presents from jsonb_array_elements(manifeste->'associations') a
    join histoire.events e on e.id=a->>'event_id';
  if presents<>10 then raise exception 'A0 : corpus partiel (%/10) ; refaire audit et relecture',presents; end if;
  if exists(select 1 from jsonb_array_elements(manifeste->'packs') x
    left join histoire.packs p on p.id=x->>'id'
    where p.id is null or not p.active or p.slug is distinct from x->>'slug'
      or p.parent_id is distinct from x->>'parent_id') then
    raise exception 'A0 : pack cible absent ou modifié ; refaire audit et relecture';
  end if;
  -- Les modifications éditoriales antérieures ne sont jamais remplacées :
  -- une dérive depuis le dossier relu exige un nouvel audit avant insertion.
  if exists(select 1 from jsonb_array_elements(manifeste->'associations') x
    join histoire.events e on e.id=x->>'event_id'
    left join histoire.event_answers a on a.event_id=e.id
    where jsonb_build_object(
      'id',e.id,'title',e.title,'titre_question',e.titre_question,'niveau',e.niveau,
      'precision',e.precision,'playable',e.playable,'playable_mode',e.playable_mode,
      'date_status',e.date_status,'start_year',a.start_year,'start_month',a.start_month,'start_day',a.start_day,
      'end_year',a.end_year,'end_month',a.end_month,'end_day',a.end_day,'description',a.description)
      is distinct from ((x->'snapshot')-'packs'-'topics')) then
    raise exception 'A0 : événement, date ou correction modifié depuis le relevé ; refaire audit et relecture';
  end if;
  -- Ajouter à la suite sans déplacer les liens déjà ajoutés manuellement.
  with manquants as (
    select x->>'pack_id' pack_id,x->>'event_id' event_id,
      row_number() over(partition by x->>'pack_id' order by ordinalite) rang
    from jsonb_array_elements(manifeste->'associations') with ordinality a(x,ordinalite)
    where not exists(select 1 from histoire.pack_events pe where pe.pack_id=x->>'pack_id' and pe.event_id=x->>'event_id')
  )
  insert into histoire.pack_events(pack_id,event_id,position)
    select m.pack_id,m.event_id,((select coalesce(max(pe.position),0) from histoire.pack_events pe where pe.pack_id=m.pack_id)+m.rang)::integer
    from manquants m on conflict(pack_id,event_id) do nothing;
  -- Ce marqueur privé protège aussi les rattachements éditoriaux d'un import v18.
  -- Aucun faux auteur ni audit d'action administrateur n'est fabriqué.
  insert into histoire.admin_pack_additions(pack_id,event_id)
    select x->>'pack_id',x->>'event_id' from jsonb_array_elements(manifeste->'associations') x
    on conflict(pack_id,event_id) do nothing;
  -- Ne toucher ni pack_event_status, ni ses audits : un retrait reste retiré.
  insert into histoire.migrations_appliquees(version,nom)
    values('${version}','enrichissement_v12_a0');
end $a0$;`;
}
export function sqlA0():string{
 return `-- #124 / #122 : PROPOSITION NON VALIDÉE. GO explicite avant KFFR.
-- Généré par scripts/enrichissement-a0.ts. Dix liens, aucun événement réécrit.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table histoire.packs,histoire.events,histoire.event_answers in share mode;
lock table histoire.pack_events,histoire.pack_event_status,histoire.admin_pack_additions in share row exclusive mode;
${blocA0()}
commit;
`;
}
export function fixtureA0():string{
 const statements=lot.associations.map(a=>{
 const e=a.snapshot;
 return `insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values(${[e.id,e.title,e.titre_question,e.precision,e.date_status,e.playable,e.playable_mode,e.niveau,'POINT',3,3,'SUPPORTED_B'].map(quote).join(',')}) on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values(${[e.id,e.start_year,e.start_month,e.start_day,e.end_year,e.end_month,e.end_day,e.description].map(quote).join(',')}) on conflict(event_id) do nothing;`;
 });
 // Dans le scénario autonome, les quatre packs ciblés doivent exister.
 // Les packs déjà installés par le corpus fun restent inchangés.
 return '-- LOCAL/CI exclusivement : relevé des dix événements existants ; jamais KFFR.\n'+
 lot.packs.map(p=>`insert into histoire.packs(id,slug,title,parent_id,active) values(${quote(p.id)},${quote(p.slug)},${quote(p.slug)},null,true) on conflict(id) do nothing;`).join('\n')+'\n'+statements.join('\n')+'\n';
}
export function genererA0(){
 writeFileSync(MIGRATION_A0,sqlA0());
 writeFileSync('supabase/fixtures/enrichissement_a0.sql',fixtureA0());
 // Appelle le même bloc métier que la migration réelle, dans des sous-transactions
 // pour prouver les refus sans corrompre la fixture. Aucun helper en production.
 writeFileSync('supabase/tests/enrichissement_a0/appliquer-test.sql',
 'create function pg_temp.appliquer_a0() returns void language plpgsql as $test_a0$ begin execute $sql_a0$'+blocA0()+'$sql_a0$; end $test_a0$;\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 genererA0();console.log('A0 : migration et fixtures générées, aucune connexion.');
}
