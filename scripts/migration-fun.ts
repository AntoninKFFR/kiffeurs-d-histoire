// Prépare une migration relisible. N'exécute aucun SQL ; publication après validation de #91.
import { writeFileSync } from 'node:fs';
import manifeste from '../content/fun/manifeste.json';
import type { EvenementFun } from './preparer-fun';
const cible=process.argv[2];
if(!/^supabase\/migrations\/\d{14}_packs_fun\.sql$/.test(cible??''))throw new Error('Indiquer le fichier créé par npm run db:new -- packs_fun');
const version=cible.match(/\d{14}/)![0];
const sql=(v:unknown):string=>v==null?'null':typeof v==='boolean'||typeof v==='number'?String(v):`'${String(v).replaceAll("'","''")}'`;
const nouveaux=manifeste.events.filter(e=>e.nouveau), anciens=manifeste.events.filter(e=>!e.nouveau);
const contenu=sql(`{\n"packs":${JSON.stringify(manifeste.packs)},\n"events":[\n${manifeste.events.map(e=>JSON.stringify(e)).join(',\n')}\n],\n"associations":[\n${manifeste.associations.map(a=>JSON.stringify(a)).join(',\n')}\n]}`);
writeFileSync(cible,`-- #91 : PROPOSITION NON APPLIQUÉE. Validation éditoriale de la liste #91 avant KFFR.
-- Généré par scripts/migration-fun.ts ; six nouveaux packs, données histoire uniquement.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table histoire.events, histoire.event_answers, histoire.packs, histoire.pack_events in share row exclusive mode;
do $fun$
declare
  contenu jsonb := ${contenu}::jsonb;
  v_event jsonb;
  v_pack jsonb;
  v_nombre int;
begin
  -- Rejouer ne réintroduit aucun retrait et ne réécrit aucune correction après publication.
  if exists(select 1 from histoire.migrations_appliquees where version=${sql(version)}) then return; end if;
  if not exists(select 1 from histoire.events) then
    raise notice 'Packs fun différés : importer le corpus local puis rejouer cette migration de données';
    return;
  end if;
  select count(*) into v_nombre from jsonb_array_elements(contenu->'events') v
    join histoire.events e on e.id=v->>'id' where not (v->>'nouveau')::boolean;
  if v_nombre<>${anciens.length} then raise exception 'Packs fun : corpus existant incomplet (%/${anciens.length})',v_nombre; end if;
  -- Refuser les dérives de datation/jouabilité ; ne jamais écraser des réponses déjà publiées.
  if exists(select 1 from jsonb_array_elements(contenu->'events') v
    join histoire.events e on e.id=v->>'id' left join histoire.event_answers a on a.event_id=e.id
    where not (v->>'nouveau')::boolean and (not e.playable or e.playable_mode is distinct from v->>'playable_mode'
      or e.precision is distinct from v->>'precision' or e.date_status is distinct from v->>'date_status'
      or row(a.start_year,a.start_month,a.start_day,a.end_year,a.end_month,a.end_day) is distinct from
      row((v->>'start_year')::int,(v->>'start_month')::smallint,(v->>'start_day')::smallint,
          (v->>'end_year')::int,(v->>'end_month')::smallint,(v->>'end_day')::smallint))) then
    raise exception 'Packs fun : une date ou sa jouabilité a changé depuis le relevé ; refaire la relecture';
  end if;
  if exists(select 1 from jsonb_array_elements(contenu->'events') v join histoire.events e on e.id=v->>'id'
    where (v->>'nouveau')::boolean) then raise exception 'Packs fun : identifiant événement déjà occupé'; end if;
  if exists(select 1 from jsonb_array_elements(contenu->'packs') v join histoire.packs p on p.id=v->>'id' or p.slug=v->>'slug') then
    raise exception 'Packs fun : identifiant ou slug de pack déjà occupé';
  end if;
  for v_event in select v from jsonb_array_elements(contenu->'events') v where (v->>'nouveau')::boolean loop
    insert into histoire.events(id,title,titre_question,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau,source_status)
    values(v_event->>'id',v_event->>'title',null,'POINT',v_event->>'precision','EXACT',true,v_event->>'playable_mode',3,
      (v_event->>'difficulty')::smallint,(v_event->>'niveau')::smallint,'SUPPORTED_B');
    insert into histoire.event_answers(event_id,start_year,start_month,start_day,date_text,description,notes)
    values(v_event->>'id',(v_event->>'start_year')::int,(v_event->>'start_month')::smallint,(v_event->>'start_day')::smallint,
      v_event->>'date_text',v_event->>'description','Sources #91 : '||(v_event->'sources')::text||' ; '||(v_event->>'preuve'));
    insert into histoire.event_aliases(event_id,alias)
      select v_event->>'id',alias from (select v_event->>'title' as alias union select jsonb_array_elements_text(v_event->'alias')) a;
  end loop;
  for v_pack in select v from jsonb_array_elements(contenu->'packs') v loop
    insert into histoire.packs(id,slug,title,description,target_size,position)
    values(v_pack->>'id',v_pack->>'slug',v_pack->>'title',v_pack->>'description',(v_pack->'n'->2->>'YEAR')::int,(v_pack->>'position')::smallint);
  end loop;
  insert into histoire.pack_events(pack_id,event_id,position)
    select v->>'pack_id',v->>'event_id',(v->>'position')::int from jsonb_array_elements(contenu->'associations') v;
  insert into histoire.migrations_appliquees(version,nom) values(${sql(version)},'packs_fun');
end $fun$;
commit;
`);
// Simulation des seuls événements réemployés sur un Postgres jetable, jamais sur KFFR.
// L'upsert local réaligne les quelques événements du seed sur le relevé audité.
const colonnes=['id','title','titre_question','event_type','precision','date_status','playable','playable_mode','importance','difficulty','niveau','source_status'] as const;
const reponses=['start_year','start_month','start_day','end_year','end_month','end_day','date_text','description'] as const;
writeFileSync('supabase/fixtures/fun_existants.sql',`-- LOCAL/CI EXCLUSIVEMENT : 101 événements réemployés, sans joueurs ni comptes.
insert into histoire.events(${colonnes.join(',')}) values
${anciens.map(e=>`(${colonnes.map(c=>sql(e[c as keyof EvenementFun])).join(',')})`).join(',\n')}
on conflict(id) do update set ${colonnes.filter(c=>c!=='id').map(c=>`${c}=excluded.${c}`).join(',')};
insert into histoire.event_answers(event_id,${reponses.join(',')}) values
${anciens.map(e=>`(${[sql(e.id),...reponses.map(c=>sql(e[c]))].join(',')})`).join(',\n')}
on conflict(event_id) do update set ${reponses.map(c=>`${c}=excluded.${c}`).join(',')};
`);
console.log(`${cible} : ${nouveaux.length} ajouts, ${anciens.length} existants, ${manifeste.associations.length} associations. Aucune application.`);
