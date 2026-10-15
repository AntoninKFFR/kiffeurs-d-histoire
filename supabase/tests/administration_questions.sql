-- #120 : uniquement simulateur LOCAL/CI, transaction intégralement annulée.
begin;
create function pg_temp.verifier(ok boolean,label text) returns void language plpgsql as $$ begin
  if ok is not true then raise exception 'ÉCHEC : %',label; end if;
end $$;
create function pg_temp.refuser(q text,code text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then if sqlstate=code then return; end if; raise; end;
  raise exception 'Acceptation inattendue : %',q;
end $$;
insert into histoire.players(id) values('00000000-0000-0000-0000-000000000024'),('00000000-0000-0000-0000-000000000025') on conflict do nothing;
insert into histoire.admins(user_id) values('00000000-0000-0000-0000-000000000024');
insert into histoire.packs(id,slug,title) values('A120','a120','Parent création'),('B120','b120','Enfant création');
update histoire.packs set parent_id='A120' where id='B120';
insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
select 'EVT-'||(120000+i),'Question recherchée '||lpad(i::text,2,'0'),'POINT','YEAR','EXACT',true,'YEAR',1,1,1 from generate_series(1,25) i;
insert into histoire.event_answers(event_id,start_year) select 'EVT-'||(120000+i),1000+i from generate_series(1,25) i;
create temp table new_events(id text);
grant all on new_events to authenticated;

set local role anon;
select pg_temp.refuser('select histoire.admin_access()','42501');
select pg_temp.refuser('select histoire.admin_search_events(''B120'')','42501');
select pg_temp.refuser('select histoire.admin_add_pack_events(''B120'',array[''EVT-120001''])','42501');
select pg_temp.refuser('select histoire.admin_create_event(gen_random_uuid(),''B120'',''{}'')','42501');
select pg_temp.refuser('select histoire.admin_content_history(''EVT-120001'')','42501');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='';
select pg_temp.verifier(not histoire.admin_access(),'pas de session');
select pg_temp.refuser('select histoire.admin_search_events(''B120'')','42501');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000025';
select pg_temp.verifier(not histoire.admin_access(),'joueur sans accès');
select pg_temp.refuser('select histoire.admin_search_events(''B120'')','42501');
select pg_temp.refuser('select histoire.admin_add_pack_events(''B120'',array[''EVT-120001''])','42501');
select pg_temp.refuser('select histoire.admin_create_event(gen_random_uuid(),''B120'',''{}'')','42501');
select pg_temp.refuser('select histoire.admin_content_history(''EVT-120001'')','42501');
select pg_temp.refuser('select * from histoire.admin_event_creations','42501');
select pg_temp.refuser('select * from histoire.admin_pack_additions','42501');
select pg_temp.refuser('select * from histoire.admin_content_audit','42501');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
select pg_temp.verifier(histoire.admin_access(),'admin reconnu');
do $$ declare r jsonb; e jsonb; eid text; request uuid:=gen_random_uuid(); n integer; g jsonb; q jsonb; begin
  r:=histoire.admin_search_events('B120','Question recherchée');
  perform pg_temp.verifier(jsonb_array_length(r->'items')=20 and (r->>'has_more')::boolean,'première page limitée');
  r:=histoire.admin_search_events('B120','Question recherchée',null,null,null,1);
  perform pg_temp.verifier(jsonb_array_length(r->'items')=5 and not (r->>'has_more')::boolean,'seconde page');
  r:=histoire.admin_search_events('B120','recherchee',1,1005,1008);
  perform pg_temp.verifier(jsonb_array_length(r->'items')=4,'titre sans accents, période et niveau');
  perform pg_temp.refuser('select histoire.admin_search_events(''B120'','''',null,0,null)','22023');
  perform pg_temp.refuser('select histoire.admin_add_pack_events(''B120'',array[''EVT-120001'',''inconnu''])','22023');
  r:=histoire.admin_add_pack_events('B120',array['EVT-120001','EVT-120001','EVT-120002']);
  perform pg_temp.verifier(r->>'added'='2','ajout multiple dédupliqué');
  perform pg_temp.verifier(histoire.admin_add_pack_events('B120',array['EVT-120001'])->>'changed'='false','retry ajout sans audit');
  perform histoire.admin_remove_pack_event('B120','EVT-120001','Test historique');
  r:=histoire.admin_search_events('B120','Question recherchée 01');
  perform pg_temp.verifier(r->'items'->0->>'associated'='true' and r->'items'->0->>'removed'='true','retrait signalé');
  r:=histoire.admin_add_pack_events('B120',array['EVT-120001']);
  perform pg_temp.verifier(r->>'restored'='1','réintégration');
  perform pg_temp.verifier(histoire.available_questions(p_pack_id=>'A120')->>'YEAR'='2','union parent disponible immédiatement');

  e:='{"title":"Question manuelle antique unique","description":"Description sourcée pédagogique.","niveau":1,"kind":"event","territory":"","date_status":"CONVENTIONAL","start_year":-44,"start_month":null,"start_day":null,"end_year":null,"end_month":null,"end_day":null,"date_text":"","sources":["Référence documentaire, ouvrage témoin, p. 45","https://example.org/source"]}';
  r:=histoire.admin_create_event(request,'B120',e); eid:=r->>'event_id';
  insert into new_events values(eid);
  perform pg_temp.verifier(eid ~ '^EVT-[0-9]+$' and eid::text>='EVT-900000000000','identifiant compatible réservé');
  perform pg_temp.verifier(histoire.admin_create_event(request,'B120',e)->>'event_id'=eid,'retry création identique');
  perform pg_temp.refuser(format('select histoire.admin_create_event(%L,''B120'',%L)',request,e||'{"title":"Autre saisie"}'::jsonb),'22023');
  perform pg_temp.refuser(format('select histoire.admin_create_event(gen_random_uuid(),''B120'',%L)',e),'23505');
  r:=histoire.admin_content_history(eid);
  perform pg_temp.verifier(jsonb_array_length(r->'creation'->'sources')=2 and jsonb_array_length(r->'operations')=2,'sources et audit création/rattachement');
  perform pg_temp.verifier(histoire.available_questions(p_pack_id=>'B120')->>'YEAR'='3' and histoire.available_questions(p_pack_id=>'B120')->>'DAY'='0','aucune précision inventée');
  -- Ajout d'un mois, d'un jour et de périodes, à cheval sur notre ère.
  for n in 1..5 loop
    e:=e || jsonb_build_object('title','Création précision '||n,'start_year',2000+n,
      'start_month',case when n in (1,2,4,5) then 2 end,'start_day',case when n in (2,4) then 28 end,
      'end_year',case when n>=3 then 2010 end,'end_month',case when n in (4,5) then 3 end,'end_day',case when n=4 then 1 end);
    r:=histoire.admin_create_event(gen_random_uuid(),'B120',e); insert into new_events values(r->>'event_id');
  end loop;
  e:=e || '{"title":"Période antique de part et autre","start_year":-5,"start_month":null,"start_day":null,"end_year":5,"end_month":null,"end_day":null}'::jsonb;
  r:=histoire.admin_create_event(gen_random_uuid(),'B120',e); insert into new_events values(r->>'event_id');
  e:=e || '{"title":"Période textuelle sans précision inventée","start_year":null,"end_year":null,"date_text":"Antiquité, datation discutée","date_status":"DISPUTED"}'::jsonb;
  r:=histoire.admin_create_event(gen_random_uuid(),'B120',e); insert into new_events values(r->>'event_id');
  e:=e || '{"title":"Sortie film territoire explicite","start_year":1999,"kind":"film","territory":"France"}'::jsonb;
  r:=histoire.admin_create_event(gen_random_uuid(),'B120',e); insert into new_events values(r->>'event_id');
  -- Partie et replay : les moteurs existants figent titres, réponses et filtres.
  foreach eid in array array['date','inverse'] loop
    g:=histoire.start_game(p_expert_only=>false,p_periodes=>true,p_niveau=>3,p_pack_id=>'B120',p_question_count=>5,p_direction=>eid);
    q:=histoire.next_question((g->>'game_id')::uuid);
    perform pg_temp.verifier(q is not null and not (q ? 'expected_year') and not(q ? 'description'),'partie sans fuite');
  end loop;
  perform histoire.start_mystery_game(p_pack_id=>'B120',p_niveau=>3,p_question_count=>5);
  -- Toute erreur, même à la dernière étape (pack inexistant), annule événement + réponse + sources.
  e:=e || '{"title":"Création atomique impossible","kind":"event","territory":"","start_year":-5,"end_year":5}'::jsonb;
  perform pg_temp.refuser(format('select histoire.admin_create_event(gen_random_uuid(),''ABSENT'',%L)',e),'22023');
  foreach r in array array['{"start_year":0}'::jsonb,'{"start_year":2001,"start_month":2,"start_day":29}',
    '{"start_year":2000,"start_month":13}','{"start_year":2000,"start_month":null,"start_day":3}',
    '{"start_year":100,"end_year":50}','{"sources":[]}','{"sources":[""]}','{"kind":"film","territory":""}'] loop
    perform pg_temp.refuser(format('select histoire.admin_create_event(gen_random_uuid(),''B120'',%L)',e||r),
      case when r='{"start_year":2001,"start_month":2,"start_day":29}'::jsonb then '22008' else '22023' end);
  end loop;
end $$;
reset role;
select pg_temp.verifier(not exists(select 1 from histoire.events where title='Création atomique impossible'),'aucun orphelin');
select pg_temp.verifier((select count(*)=9 from histoire.admin_event_creations),'neuf créations complètes');
select pg_temp.verifier((select count(*)=2 from histoire.pack_event_audit where pack_id='B120'),'historique retrait/réintégration préservé');
select pg_temp.verifier((select count(*)=1 from histoire.admin_content_audit where event_id='EVT-120001' and operation='ajouter'),'ajout sans double audit');
select pg_temp.verifier((select bool_and(a.periode_possible) from histoire.event_answers a join histoire.events e on e.id=a.event_id where e.title like 'Période antique%'),'périodes marquées');
-- Même l'admin ne peut lire les sources/dates directement ou modifier l'audit.
set local role authenticated;
select pg_temp.refuser('select * from histoire.admin_event_creations','42501');
select pg_temp.refuser('select * from histoire.event_answers','42501');
select pg_temp.refuser('delete from histoire.admin_content_audit','42501');
reset role;
rollback;
