-- LOCAL/CI, après les tests existants : ne jamais exécuter contre KFFR.
\ir ../../fixtures/fun_existants.sql
create temporary table fun_packs_avant as select p.*, (select jsonb_agg(to_jsonb(pe) order by pe.event_id)
  from histoire.pack_events pe where pe.pack_id=p.id) as contenu from histoire.packs p;
create temporary table fun_events_avant as select * from histoire.events;
create temporary table fun_answers_avant as select * from histoire.event_answers;
\ir ../../migrations/20261015120156_packs_fun.sql
\ir ../../migrations/20261015120156_packs_fun.sql
begin;
create function pg_temp.verifier(condition boolean, description text) returns void language plpgsql as $$ begin
  if condition is not true then raise exception 'ÉCHEC fun : %', description; end if;
end $$;
select pg_temp.verifier((select count(*)=6 from histoire.packs where id between 'COL-0112' and 'COL-0117'),'six packs');
select pg_temp.verifier((select count(*)=210 from histoire.pack_events where pack_id between 'COL-0112' and 'COL-0117'),'210 associations sans doublon');
select pg_temp.verifier((select count(*)=104 from histoire.events where id between 'EVT-2100' and 'EVT-2203'),'104 ajouts');
select pg_temp.verifier(not exists(select 1 from fun_packs_avant a where not exists(select 1 from histoire.packs p
  where p.id=a.id and to_jsonb(a)-'contenu'=to_jsonb(p) and a.contenu is not distinct from
  (select jsonb_agg(to_jsonb(pe) order by pe.event_id) from histoire.pack_events pe where pe.pack_id=p.id))),'tous les anciens packs inchangés');
select pg_temp.verifier(not exists(select 1 from fun_events_avant a join histoire.events e using(id) where to_jsonb(a)<>to_jsonb(e)),'aucun ancien événement réécrit');
select pg_temp.verifier(not exists(select 1 from fun_answers_avant a join histoire.event_answers e using(event_id) where to_jsonb(a)<>to_jsonb(e)),'aucune ancienne réponse réécrite');
select pg_temp.verifier(not exists(select 1 from histoire.pack_events f join histoire.pack_events p using(event_id)
  where f.pack_id='COL-0114' and p.pack_id='COL-0115'),'cinéma séparé de Pop culture');
do $$ declare v_pack record; v_jeu jsonb; v_q jsonb; v_sens text; begin
  for v_pack in select * from (values ('COL-0112',35),('COL-0113',30),('COL-0114',50),('COL-0115',35),('COL-0116',30),('COL-0117',30)) p(id,n) loop
    perform pg_temp.verifier((histoire.available_questions(p_pack_id=>v_pack.id)->>'YEAR')::int=v_pack.n,'compte exact '||v_pack.id);
    perform pg_temp.verifier((histoire.available_questions(p_pack_id=>v_pack.id,p_niveau=>2)->>'YEAR')::int>=10,'partie Intermédiaire possible');
    foreach v_sens in array array['date','inverse'] loop
      v_jeu:=histoire.start_game(p_token=>repeat('f',64),p_pack_id=>v_pack.id,p_niveau=>2,p_question_count=>10,
        p_direction=>v_sens,p_difficulty=>case when v_sens='inverse' then 'DAY' else 'YEAR' end);
      perform pg_temp.verifier((select count(*)=10 from histoire.game_questions where game_id=(v_jeu->>'game_id')::uuid),'dix questions réelles');
      perform pg_temp.verifier(not exists(select 1 from histoire.game_questions q where q.game_id=(v_jeu->>'game_id')::uuid
        and not exists(select 1 from histoire.pack_events p where p.pack_id=v_pack.id and p.event_id=q.event_id)),'tirage dans le bon pack');
      v_q:=histoire.next_question((v_jeu->>'game_id')::uuid,repeat('f',64));
      perform pg_temp.verifier(not v_q ? 'event_id' and not v_q ? 'aliases' and not v_q ? 'expected_year','aucune réponse privée');
      if v_sens='date' then perform pg_temp.verifier(not v_q ? 'date','date masquée avant réponse');
      else perform pg_temp.verifier(not v_q ? 'title','titre masqué en inverse'); end if;
    end loop;
    v_jeu:=histoire.start_mystery_game(p_token=>repeat('e',64),p_pack_id=>v_pack.id,p_niveau=>2,p_question_count=>5);
    perform pg_temp.verifier(v_jeu->'mystery'->'winner'->>'id'=v_pack.id,'roulette compatible');
  end loop;
end $$;
select pg_temp.verifier(not exists(select 1 from histoire.events e join histoire.event_answers a on a.event_id=e.id
  where e.id between 'EVT-2100' and 'EVT-2203' and (a.description is null or a.notes not like 'Sources #91 : %')),'descriptions et sources privées persistées');
insert into histoire.players(id) values ('00000000-0000-0000-0000-000000000024') on conflict do nothing;
insert into histoire.admins(user_id) values ('00000000-0000-0000-0000-000000000024') on conflict do nothing;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
set local role authenticated;
select histoire.admin_remove_pack_event('COL-0113','EVT-2100','Relecture fun locale');
select histoire.admin_edit_event('COL-0113','EVT-2100','Slinky relu',1,'Correction locale');
reset role;
commit;
-- La répétition ne doit réintroduire ni l'association retirée ni les valeurs proposées.
\ir ../../migrations/20261015120156_packs_fun.sql
begin;
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0113')->>'YEAR')::int=29,'retrait admin conservé');
select pg_temp.verifier((select title='Slinky relu' and niveau=1 from histoire.events where id='EVT-2100'),'correction conservée');
select pg_temp.verifier((select count(*)=1 from histoire.pack_event_audit where event_id='EVT-2100'),'audit retrait conservé');
select pg_temp.verifier((select count(*)=1 from histoire.event_editorial_audit where event_id='EVT-2100'),'audit correction conservé');
set local role anon;
do $$ begin
  begin perform 1 from histoire.event_answers; raise exception 'Réponses publiques'; exception when insufficient_privilege then null; end;
  begin perform 1 from histoire.event_aliases; raise exception 'Alias publics'; exception when insufficient_privilege then null; end;
  perform pg_temp.verifier(exists(select 1 from jsonb_array_elements(histoire.playable_packs(2)) p where p->>'id'='COL-0114'),'films visibles anonymement');
end $$;
reset role;
rollback;
