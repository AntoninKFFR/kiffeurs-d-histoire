// #126 : génère le lot éditorial soumis dans #122, sans connexion à une base.
import {writeFileSync,mkdirSync} from 'node:fs';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import lot from '../content/enrichissement-v12/a1.json';
export const MIGRATION_A1='supabase/migrations/20261016095716_enrichissement_v12_a1.sql';
const quote=(v:unknown)=>v==null?'null':"'"+String(v).replaceAll("'","''")+"'";
export function blocA1(version=basename(MIGRATION_A1).slice(0,14)):string{
 assert(/^\d{14}$/.test(version));
 assert.equal(lot.events.length,42);
 assert.equal(new Set(lot.events.map(e=>e.id)).size,42);
 assert(lot.events.every(e=>e.packs.every(p=>lot.packs.some(x=>x.id===p)&&!['COL-0059','COL-0060','COL-0077'].includes(p))));
 return `do $a1$
declare
  contenu constant jsonb := ${quote(JSON.stringify(lot))}::jsonb;
  ev jsonb;
begin
  if exists(select 1 from histoire.migrations_appliquees where version='${version}') then return; end if;
  if not exists(select 1 from histoire.events) then
    raise notice 'A1 différé : importer le corpus local puis rejouer la migration'; return;
  end if;
  if not exists(select 1 from histoire.migrations_appliquees where version='20261015120156')
    or not exists(select 1 from histoire.migrations_appliquees where version='20261015201336') then
    raise exception 'A1 : packs fun #91 et administration #120 requis';
  end if;
  if exists(select 1 from jsonb_array_elements(contenu->'packs') x left join histoire.packs p on p.id=x->>'id'
    where p.id is null or not p.active or p.slug is distinct from x->>'slug' or p.parent_id is distinct from x->>'parent_id') then
    raise exception 'A1 : pack cible absent ou modifié ; refaire audit et relecture';
  end if;
  if exists(select 1 from jsonb_array_elements(contenu->'events') x join histoire.events e on e.id=x->>'id') then
    raise exception 'A1 : identifiant événement déjà occupé ; aucun remplacement autorisé';
  end if;
  -- Même normalisation que #120, seuil conservateur 0,6 pour une même date.
  -- Une nouvelle création ou un quasi-doublon impose une relecture ; jamais d’écrasement.
  if exists(select 1 from jsonb_array_elements(contenu->'events') x cross join histoire.events e
    left join histoire.event_answers a on a.event_id=e.id
    where histoire.normalize_answer(e.title)=histoire.normalize_answer(x->>'title')
      or (row(a.start_year,a.start_month,a.start_day,a.end_year,a.end_month,a.end_day)
        is not distinct from row((x->>'start_year')::integer,(x->>'start_month')::smallint,(x->>'start_day')::smallint,
          null::integer,null::smallint,null::smallint)
        and extensions.similarity(histoire.normalize_answer(e.title),histoire.normalize_answer(x->>'title'))>=0.6)) then
    raise exception 'A1 : doublon ou proximité à relire ; refaire audit et relecture';
  end if;
  for ev in select x from jsonb_array_elements(contenu->'events') x loop
    insert into histoire.events(id,title,titre_question,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau,source_status)
      values(ev->>'id',ev->>'title',null,'POINT',ev->>'precision',ev->>'date_status',true,ev->>'precision',3,
        case when (ev->>'niveau')::integer=1 then 2 else 3 end,(ev->>'niveau')::smallint,'SUPPORTED_B');
    insert into histoire.event_answers(event_id,start_year,start_month,start_day,date_text,description,notes)
      values(ev->>'id',(ev->>'start_year')::integer,(ev->>'start_month')::smallint,(ev->>'start_day')::smallint,
        concat(ev->>'start_year',case when ev->>'start_month' is not null then '-'||lpad(ev->>'start_month',2,'0') else '' end,
          case when ev->>'start_day' is not null then '-'||lpad(ev->>'start_day',2,'0') else '' end),ev->>'description',
        'Sources V1.2 A1 #126 : '||(ev->'sources')::text||' ; territoire : '||coalesce(ev->>'territory','sans objet')||' ; niveau : '||(ev->>'level_reason'));
    insert into histoire.event_aliases(event_id,alias)
      select ev->>'id',alias from (select ev->>'title' alias union select jsonb_array_elements_text(ev->'aliases')) a;
  end loop;
  -- Ajouter en fin de pack sans déplacer une association antérieure.
  with liens as (
    select e->>'id' event_id,p.pack_id,ordinalite from jsonb_array_elements(contenu->'events') with ordinality v(e,ordinalite)
      cross join lateral jsonb_array_elements_text(e->'packs') p(pack_id)
  )
  insert into histoire.pack_events(pack_id,event_id,position)
    select pack_id,event_id,((select coalesce(max(pe.position),0) from histoire.pack_events pe where pe.pack_id=l.pack_id)
      +row_number() over(partition by pack_id order by ordinalite))::integer from liens l;
  -- Le v18 préserve ces liens vers les packs existants via le mécanisme #120.
  insert into histoire.admin_pack_additions(pack_id,event_id)
    select p.pack_id,e->>'id' from jsonb_array_elements(contenu->'events') e
      cross join lateral jsonb_array_elements_text(e->'packs') p(pack_id);
  insert into histoire.migrations_appliquees(version,nom) values('${version}','enrichissement_v12_a1');
end $a1$;`;
}
export function sqlA1(){
 return `-- #126 / #122 : PROPOSITION NON VALIDÉE. GO explicite A1 avant KFFR.
-- Généré par scripts/enrichissement-a1.ts ; 42 événements et 86 liens nouveaux.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Même ordre que la création #120, avant les verrous de contenu.
select pg_advisory_xact_lock(120,1);
lock table histoire.events,histoire.event_answers,histoire.event_aliases,histoire.packs,
  histoire.pack_events,histoire.pack_event_status,histoire.admin_pack_additions in share row exclusive mode;
${blocA1()}
commit;
`;
}
export function genererA1(){
 writeFileSync(MIGRATION_A1,sqlA1());
 mkdirSync('supabase/tests/enrichissement_a1',{recursive:true});
 writeFileSync('supabase/tests/enrichissement_a1/appliquer-test.sql',
 'create function pg_temp.appliquer_a1() returns void language plpgsql as $test_a1$ begin execute $sql_a1$'+blocA1()+'$sql_a1$; end $test_a1$;\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 genererA1();console.log('A1 généré, aucune connexion ni publication.');
}
