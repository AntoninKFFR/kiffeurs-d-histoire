-- LOCAL/CI après fun/scenario.sql. Ne jamais lancer sur KFFR.
\ir ../../fixtures/enrichissement_a0.sql
\ir appliquer-test.sql
begin;
create function pg_temp.verifier_a0(condition boolean,message text) returns void language plpgsql as $$
begin if condition is not true then raise exception 'ÉCHEC A0 : %',message; end if; end $$;
-- Le même bloc de la migration doit refuser un corpus partiel sans mutation.
do $$ begin
  begin
    delete from histoire.events where id='EVT-0686';
    perform pg_temp.appliquer_a0();
    raise exception 'Absence de refus du corpus partiel';
  exception when raise_exception then
    if sqlerrm not like 'A0 : corpus partiel%' then raise; end if;
  end;
  begin
    update histoire.event_answers set start_year=1813 where event_id='EVT-0686';
    perform pg_temp.appliquer_a0();
    raise exception 'Absence de refus de la dérive';
  exception when raise_exception then
    if sqlerrm not like 'A0 : événement%' then raise; end if;
  end;
  begin
    update histoire.packs set active=false where id='COL-0067';
    perform pg_temp.appliquer_a0();
    raise exception 'Absence de refus du pack inactif';
  exception when raise_exception then
    if sqlerrm not like 'A0 : pack cible%' then raise; end if;
  end;
end $$;
-- Un retrait et une position décidés avant le lot doivent survivre au premier passage.
insert into histoire.players(id) values('00000000-0000-0000-0000-000000000024') on conflict do nothing;
insert into histoire.admins(user_id) values('00000000-0000-0000-0000-000000000024') on conflict do nothing;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
select histoire.admin_add_pack_events('COL-0112',array['EVT-0286']);
update histoire.pack_events set position=777 where pack_id='COL-0112' and event_id='EVT-0286';
select histoire.admin_remove_pack_event('COL-0112','EVT-0286','Retrait antérieur à A0');
select histoire.admin_create_event('a0000000-0000-4000-8000-000000000124','COL-0067',
  '{"title":"Création manuelle locale conservée par A0","description":"Une question fictive de fixture avec une référence documentaire privée.","niveau":2,"kind":"event","date_status":"EXACT","start_year":1808,"sources":["Document de fixture A0, page 124"]}');
create function pg_temp.empreintes_a0() returns jsonb language plpgsql as $$
declare t record; empreinte text; resultat jsonb:='{}'; begin
  for t in select tablename from pg_tables where schemaname='histoire'
    and tablename not in ('pack_events','admin_pack_additions','migrations_appliquees') order by tablename loop
    execute format('select md5(coalesce(string_agg(to_jsonb(x)::text,chr(10) order by to_jsonb(x)::text),'''')) from histoire.%I x',t.tablename) into empreinte;
    resultat:=resultat||jsonb_build_object(t.tablename,empreinte);
  end loop;
  return resultat;
end $$;
create temporary table a0_avant as select pg_temp.empreintes_a0() empreintes;
create temporary table a0_liens_avant as select * from histoire.pack_events;
commit;
\ir ../../migrations/20261015222704_enrichissement_v12_a0.sql
\ir ../../migrations/20261015222704_enrichissement_v12_a0.sql
begin;
select pg_temp.verifier_a0((select empreintes=pg_temp.empreintes_a0() from a0_avant),'toutes les autres tables histoire, sources manuelles et données joueurs strictement conservées');
select pg_temp.verifier_a0(not exists(select 1 from a0_liens_avant a where not exists(select 1 from histoire.pack_events p where to_jsonb(p)=to_jsonb(a))),'anciens liens et positions intacts');
select pg_temp.verifier_a0((select count(*)=10 from histoire.admin_pack_additions a join (values
('COL-0112','EVT-0008'),('COL-0112','EVT-0414'),('COL-0112','EVT-0713'),('COL-0112','EVT-0286'),('COL-0112','EVT-0289'),
('COL-0115','EVT-0990'),('COL-0074','EVT-0018'),('COL-0067','EVT-0446'),('COL-0067','EVT-0682'),('COL-0067','EVT-0686')) v(pack_id,event_id) using(pack_id,event_id)),'les dix liens sont protégés du réimport');
select pg_temp.verifier_a0((select count(*)=1 from histoire.migrations_appliquees where version='20261015222704'),'une seule version');
select pg_temp.verifier_a0((select removed from histoire.pack_event_status where pack_id='COL-0112' and event_id='EVT-0286'),'retrait conservé au premier passage');
select pg_temp.verifier_a0((select position=777 from histoire.pack_events where pack_id='COL-0112' and event_id='EVT-0286'),'position manuelle conservée');
select pg_temp.verifier_a0(not exists(select 1 from histoire.pack_scope_events('COL-0112') where event_id='EVT-0286'),'retrait réellement exclu de l’union');
-- Jouer tous les réglages possibles ; refuser ceux qui restent mathématiquement impossibles.
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
do $$ declare
 v_pack text; v_cohorte record; v_sens text; v_precision text; v_longueur integer;
 v_disponibles integer; v_candidats integer; v_compte integer; v_jeu jsonb; v_question jsonb;
begin
 foreach v_pack in array array['COL-0067','COL-0074','COL-0112','COL-0115'] loop
  for v_cohorte in select * from (values (1,false),(2,false),(3,true),(3,false)) c(niveau,expert) loop
   foreach v_sens in array array['date','inverse'] loop
    foreach v_precision in array array['YEAR','MONTH','DAY'] loop
     select count(*),case when v_sens='date' then count(*) else count(distinct
       (c.start_year,case when v_precision<>'YEAR' then c.start_month end,case when v_precision='DAY' then c.start_day end)) end
       into v_candidats,v_disponibles
       from histoire.solo_candidates(v_cohorte.expert,v_cohorte.niveau,v_pack,null,null,null,null,null,v_precision) c;
     v_compte:=(histoire.available_questions(p_expert_only=>v_cohorte.expert,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,p_direction=>v_sens)->>v_precision)::integer;
     perform pg_temp.verifier_a0(v_compte=v_disponibles,'compte exact après A0 : '||v_pack);
     foreach v_longueur in array array[5,10,20,0] loop
      if v_disponibles>=(case when v_longueur=0 then 1 else v_longueur end) then
       v_jeu:=histoire.start_game(p_expert_only=>v_cohorte.expert,p_periodes=>true,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,
         p_difficulty=>v_precision,p_question_count=>v_longueur,p_direction=>v_sens);
       perform pg_temp.verifier_a0((select count(*)=case when v_longueur=0 then least(100,v_disponibles) else v_longueur end
         from histoire.game_questions where game_id=(v_jeu->>'game_id')::uuid),'longueur réelle');
       perform pg_temp.verifier_a0(not exists(select 1 from histoire.game_questions q join histoire.events e on e.id=q.event_id
         where q.game_id=(v_jeu->>'game_id')::uuid and
         (e.niveau>v_cohorte.niveau or (v_cohorte.expert and e.niveau<>3)
          or not exists(select 1 from histoire.pack_scope_events(v_pack) s where s.event_id=e.id))),'niveau et périmètre exacts');
       if v_sens='inverse' then
        perform pg_temp.verifier_a0((select count(*)=count(distinct
          (q.expected_year,case when v_precision<>'YEAR' then q.expected_month end,case when v_precision='DAY' then q.expected_day end))
          from histoire.game_questions q where q.game_id=(v_jeu->>'game_id')::uuid),'dates inversées distinctes');
       end if;
       v_question:=histoire.next_question((v_jeu->>'game_id')::uuid,null);
       perform pg_temp.verifier_a0(not v_question ? 'event_id' and not v_question ? 'aliases' and not v_question ? 'expected_year','réponses privées');
       perform pg_temp.verifier_a0(case when v_sens='date' then not v_question ? 'date' else not v_question ? 'title' end,'projection avant correction');
       delete from histoire.games where id=(v_jeu->>'game_id')::uuid;
       v_jeu:=histoire.start_mystery_game(p_expert_only=>v_cohorte.expert,p_periodes=>true,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,
         p_difficulty=>v_precision,p_question_count=>v_longueur,p_direction=>v_sens);
       perform pg_temp.verifier_a0(v_jeu->'mystery'->'winner'->>'id'=v_pack,'Mystère éligible');
       delete from histoire.games where id=(v_jeu->>'game_id')::uuid;
      else
       begin
        perform histoire.start_game(p_expert_only=>v_cohorte.expert,p_periodes=>true,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,
          p_difficulty=>v_precision,p_question_count=>v_longueur,p_direction=>v_sens);
        raise exception 'Longueur insuffisante acceptée';
       exception when invalid_parameter_value then null; end;
      end if;
     end loop;
    end loop;
   end loop;
  end loop;
 end loop;
end $$;
-- Sous-pack réel de fixture : le retrait du parent masque son union, pas l’enfant.
insert into histoire.packs(id,slug,title,parent_id) values('A0-ENFANT','a0-enfant','Enfant A0','COL-0112');
insert into histoire.pack_events(pack_id,event_id,position) values('A0-ENFANT','EVT-0286',1);
select pg_temp.verifier_a0(not exists(select 1 from histoire.pack_scope_events('COL-0112') where event_id='EVT-0286'),'retrait parent prioritaire sur enfant');
select pg_temp.verifier_a0(exists(select 1 from histoire.pack_scope_events('A0-ENFANT') where event_id='EVT-0286'),'enfant directement jouable');
set local role anon;
do $$ begin
 begin perform 1 from histoire.event_answers; raise exception 'réponses publiques'; exception when insufficient_privilege then null; end;
 begin perform 1 from histoire.event_aliases; raise exception 'alias publics'; exception when insufficient_privilege then null; end;
 begin perform 1 from histoire.admin_pack_additions; raise exception 'marqueurs publics'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
begin;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
select histoire.admin_edit_event('COL-0067','EVT-0682','Titre relu après A0',2,'Relecture locale après publication simulée');
select histoire.admin_remove_pack_event('COL-0067','EVT-0682','Retrait après A0');
create temporary table a0_apres_correction as select pg_temp.empreintes_a0() empreintes;
commit;
\ir ../../migrations/20261015222704_enrichissement_v12_a0.sql
begin;
select pg_temp.verifier_a0((select empreintes=pg_temp.empreintes_a0() from a0_apres_correction),'rejouer après correction/retrait ne réécrit rien');
rollback;
