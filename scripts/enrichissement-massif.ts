// #122 : génère le lot éditorial soumis dans #122, sans connexion à une base.
import {writeFileSync,mkdirSync} from 'node:fs';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import lot from '../content/enrichissement-v12/massif.json';
export const MIGRATION_MASSIF='supabase/migrations/20261016124921_enrichissement_v12_massif.sql';
const quote=(v:unknown)=>v==null?'null':"'"+String(v).replaceAll("'","''")+"'";
export function blocMassif(version=basename(MIGRATION_MASSIF).slice(0,14)):string{
 assert(/^\d{14}$/.test(version));
 assert.equal(lot.events.length,160);
 assert.equal(new Set(lot.events.map(e=>e.id)).size,160);
 assert.equal(new Set(lot.associations.map(a=>a.pack_id+'|'+a.event_id)).size,7);
 assert(lot.events.every(e=>e.packs.every(p=>lot.packs.some(x=>x.id===p)&&!['COL-0059','COL-0060','COL-0077'].includes(p))));
 return `do $massif$
declare
  contenu constant jsonb := ${quote(JSON.stringify(lot))}::jsonb;
  ev jsonb;
begin
  if exists(select 1 from histoire.migrations_appliquees where version='${version}') then return; end if;
  if not exists(select 1 from histoire.events) then
    raise notice 'Massif différé : importer le corpus local puis rejouer la migration'; return;
  end if;
  if not exists(select 1 from histoire.migrations_appliquees where version='20261015120156')
    or not exists(select 1 from histoire.migrations_appliquees where version='20261015201336') then
    raise exception 'Massif : packs fun #91 et administration #120 requis';
  end if;
  if exists(select 1 from jsonb_array_elements(contenu->'packs') x left join histoire.packs p on p.id=x->>'id'
    where p.id is null or not p.active or p.slug is distinct from x->>'slug' or p.parent_id is distinct from x->>'parent_id') then
    raise exception 'Massif : pack cible absent ou modifié ; refaire audit et relecture';
  end if;
  if exists(select 1 from jsonb_array_elements(contenu->'events') x join histoire.events e on e.id=x->>'id') then
    raise exception 'Massif : identifiant événement déjà occupé ; aucun remplacement autorisé';
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
    raise exception 'Massif : doublon ou proximité à relire ; refaire audit et relecture';
  end if;
  if exists(select 1 from jsonb_array_elements(contenu->'associations') x left join histoire.events e on e.id=x->>'event_id' where e.id is null) then
    raise exception 'Massif : événement à réutiliser absent';
  end if;
  -- Les modifications éditoriales antérieures ne sont jamais remplacées :
  -- une dérive depuis le dossier relu exige un nouvel audit avant insertion.
  if exists(select 1 from jsonb_array_elements(contenu->'associations') x
    join histoire.events e on e.id=x->>'event_id'
    left join histoire.event_answers a on a.event_id=e.id
    where jsonb_build_object(
      'id',e.id,'title',e.title,'titre_question',e.titre_question,'niveau',e.niveau,
      'precision',e.precision,'playable',e.playable,'playable_mode',e.playable_mode,
      'date_status',e.date_status,'start_year',a.start_year,'start_month',a.start_month,'start_day',a.start_day,
      'end_year',a.end_year,'end_month',a.end_month,'end_day',a.end_day,'description',a.description)
      is distinct from ((x->'snapshot')-'packs'-'topics')) then
    raise exception 'Massif : événement, date ou correction modifié depuis le relevé ; refaire audit et relecture';
  end if;
  for ev in select x from jsonb_array_elements(contenu->'events') x loop
    insert into histoire.events(id,title,titre_question,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau,source_status)
      values(ev->>'id',ev->>'title',null,'POINT',ev->>'precision',ev->>'date_status',true,ev->>'precision',3,
        case (ev->>'niveau')::integer when 1 then 2 when 2 then 3 else 5 end,(ev->>'niveau')::smallint,'SUPPORTED_B');
    insert into histoire.event_answers(event_id,start_year,start_month,start_day,date_text,description,notes)
      values(ev->>'id',(ev->>'start_year')::integer,(ev->>'start_month')::smallint,(ev->>'start_day')::smallint,
        concat(ev->>'start_year',case when ev->>'start_month' is not null then '-'||lpad(ev->>'start_month',2,'0') else '' end,
          case when ev->>'start_day' is not null then '-'||lpad(ev->>'start_day',2,'0') else '' end),ev->>'description',
        'Sources V1.2 Massif #122 : '||(ev->'sources')::text||' ; territoire : '||coalesce(ev->>'territory','sans objet')||' ; niveau : '||(ev->>'level_reason'));
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
  -- Réemplois A0 : ajouts seulement, jamais réécriture d’un événement existant.
  with manquants as (
    select x->>'pack_id' pack_id,x->>'event_id' event_id,
      row_number() over(partition by x->>'pack_id' order by ordinalite) rang
    from jsonb_array_elements(contenu->'associations') with ordinality a(x,ordinalite)
    where not exists(select 1 from histoire.pack_events pe where pe.pack_id=x->>'pack_id' and pe.event_id=x->>'event_id')
  )
  insert into histoire.pack_events(pack_id,event_id,position)
    select m.pack_id,m.event_id,((select coalesce(max(pe.position),0) from histoire.pack_events pe where pe.pack_id=m.pack_id)+m.rang)::integer
    from manquants m on conflict(pack_id,event_id) do nothing;
  insert into histoire.admin_pack_additions(pack_id,event_id)
    select x->>'pack_id',x->>'event_id' from jsonb_array_elements(contenu->'associations') x on conflict(pack_id,event_id) do nothing;
  insert into histoire.migrations_appliquees(version,nom) values('${version}','enrichissement_v12_massif');
end $massif$;`;
}
export function sqlMassif(){
 return `-- #122 : RELAIS CHATGPT : ne pas appliquer par Codex. Audit et GO avant KFFR.
-- Généré par scripts/enrichissement-massif.ts ; 160 événements, 511 liens nouveaux et 7 réemplois.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Même ordre que la création #120, avant les verrous de contenu.
select pg_advisory_xact_lock(120,1);
lock table histoire.events,histoire.event_answers,histoire.event_aliases,histoire.packs,
  histoire.pack_events,histoire.pack_event_status,histoire.admin_pack_additions in share row exclusive mode;
${blocMassif()}
commit;
`;
}
export function genererMassif(){
 writeFileSync(MIGRATION_MASSIF,sqlMassif());
 mkdirSync('supabase/tests/enrichissement_massif',{recursive:true});
 writeFileSync('supabase/tests/enrichissement_massif/appliquer-test.sql',
 'create function pg_temp.appliquer_massif() returns void language plpgsql as $test_massif$ begin execute $sql_massif$'+blocMassif()+'$sql_massif$; end $test_massif$;\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 genererMassif();console.log('Massif généré, aucune connexion ni publication.');
}
