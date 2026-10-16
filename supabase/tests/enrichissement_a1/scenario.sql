-- LOCAL/CI uniquement, après la fixture et la migration fun. Jamais KFFR.
\ir ../../fixtures/enrichissement_a1.sql
\ir appliquer-test.sql
begin;
create function pg_temp.verifier_a1(condition boolean,message text) returns void language plpgsql as $$
begin if condition is not true then raise exception 'ÉCHEC A1 : %',message; end if; end $$;
-- Préconditions : aucun refus ne peut laisser un ajout partiel.
do $$ begin
 begin
  update histoire.packs set active=false where id='COL-0114';
  perform pg_temp.appliquer_a1();raise exception 'Pack inactif accepté';
 exception when raise_exception then if sqlerrm not like 'A1 : pack cible%' then raise; end if; end;
 begin
  insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
   values('EVT-2300','Identifiant déjà occupé','POINT','YEAR','EXACT',true,'YEAR',3,3,2);
  perform pg_temp.appliquer_a1();raise exception 'Collision acceptée';
 exception when raise_exception then if sqlerrm not like 'A1 : identifiant%' then raise; end if; end;
 begin
  insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
   values('EVT-990001','SORTIE DE BIENVENUE CHEZ LES CH’TIS (FRANCE, SORTIE NATIONALE)','POINT','YEAR','EXACT',true,'YEAR',3,3,2);
  perform pg_temp.appliquer_a1();raise exception 'Doublon accepté';
 exception when raise_exception then if sqlerrm not like 'A1 : doublon%' then raise; end if; end;
 begin
  insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
   values('EVT-990001','Sortie de Bienvenue chez les Ch’tis (France, sortie nationale) en salles','POINT','DAY','EXACT',true,'DAY',3,3,2);
  insert into histoire.event_answers(event_id,start_year,start_month,start_day) values('EVT-990001',2008,2,27);
  perform pg_temp.appliquer_a1();raise exception 'Quasi-doublon accepté';
 exception when raise_exception then if sqlerrm not like 'A1 : doublon%' then raise; end if; end;
end $$;
insert into histoire.players(id) values('00000000-0000-0000-0000-000000000024') on conflict do nothing;
insert into histoire.admins(user_id) values('00000000-0000-0000-0000-000000000024') on conflict do nothing;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
select histoire.admin_create_event('a1000000-0000-4000-8000-000000000126','COL-0115',
 '{"title":"Création manuelle locale avant A1","description":"Une question fictive conservée avec ses références documentaires privées.","niveau":3,"kind":"event","date_status":"EXACT","start_year":1901,"sources":["Document de fixture A1, page 126"]}');
create temporary table a1_ids as select 'EVT-'||i id from generate_series(2300,2341) i;
create function pg_temp.empreintes_a1() returns jsonb language plpgsql as $$
declare t record;empreinte text;filtre text;resultat jsonb:='{}';begin
 for t in select tablename from pg_tables where schemaname='histoire' order by tablename loop
  filtre:=case when t.tablename='events' then ' where x.id not in (select id from a1_ids)'
    when t.tablename in ('event_answers','event_aliases','pack_events','admin_pack_additions') then ' where x.event_id not in (select id from a1_ids)'
    when t.tablename='migrations_appliquees' then ' where x.version<>''20261016095716''' else '' end;
  execute format('select md5(coalesce(string_agg(to_jsonb(x)::text,chr(10) order by to_jsonb(x)::text),'''')) from histoire.%I x',t.tablename)||filtre into empreinte;
  resultat:=resultat||jsonb_build_object(t.tablename,empreinte);
 end loop;return resultat;
end $$;
create temporary table a1_avant as select pg_temp.empreintes_a1() empreintes,
 (select count(*) from histoire.events) total,(select count(*) from histoire.events where niveau=1) debutants,
 (histoire.available_questions(p_niveau=>1,p_pack_id=>'COL-0115')->>'YEAR')::int pop_solo,
 (histoire.available_questions(p_niveau=>1,p_pack_id=>'COL-0115',p_direction=>'inverse')->>'YEAR')::int pop_inverse;
commit;
\ir ../../migrations/20261016095716_enrichissement_v12_a1.sql
\ir ../../migrations/20261016095716_enrichissement_v12_a1.sql
begin;
select pg_temp.verifier_a1((select empreintes=pg_temp.empreintes_a1() from a1_avant),'toutes les lignes antérieures de toutes les tables histoire, audits et joueurs inchangées');
select pg_temp.verifier_a1((select count(*)=(select total+42 from a1_avant) from histoire.events),'42 événements nouveaux sans doublon');
select pg_temp.verifier_a1((select count(*)=(select debutants+40 from a1_avant) from histoire.events where niveau=1),'40 nouveaux Débutant');
select pg_temp.verifier_a1((select count(*)=86 from histoire.pack_events where event_id in(select id from a1_ids)),'86 associations');
select pg_temp.verifier_a1((select count(*)=86 from histoire.admin_pack_additions where event_id in(select id from a1_ids)),'86 associations protégées au réimport');
select pg_temp.verifier_a1(not exists(select 1 from histoire.pack_events where event_id in(select id from a1_ids) and pack_id in('COL-0059','COL-0060','COL-0077')),'contrats 50/100/expert conservés');
select pg_temp.verifier_a1((select count(*)=1 from histoire.migrations_appliquees where version='20261016095716'),'registre unique');
select pg_temp.verifier_a1((select count(*)=42 from histoire.event_answers where event_id in(select id from a1_ids) and length(description)>40 and notes like 'Sources V1.2 A1 #126 : %'),'descriptions et preuves privées');
select pg_temp.verifier_a1(not exists(select 1 from a1_ids i where not exists(select 1 from histoire.event_aliases a where a.event_id=i.id)),'alias pour chaque événement');
select pg_temp.verifier_a1((select precision='MONTH' and a.start_year=1966 and a.start_month=12 and a.start_day is null from histoire.events e join histoire.event_answers a on a.event_id=e.id where e.id='EVT-2305'),'Grande Vadrouille sans jour inventé');
select pg_temp.verifier_a1((select count(*)=3 from histoire.events e join histoire.event_answers a on a.event_id=e.id where e.id in('EVT-2315','EVT-2326','EVT-2335') and precision='YEAR' and a.start_month is null and a.start_day is null),'Disney/Lucky Luke/Wannabe à l’année');
select pg_temp.verifier_a1((histoire.available_questions(p_niveau=>1,p_pack_id=>'COL-0114')->>'YEAR')::int=21,'Films Débutant année 21');
select pg_temp.verifier_a1((histoire.available_questions(p_niveau=>1,p_pack_id=>'COL-0114',p_direction=>'inverse')->>'YEAR')::int=16,'Films Inversé année 16, sans années inventées');
select pg_temp.verifier_a1((histoire.available_questions(p_niveau=>1,p_pack_id=>'COL-0115')->>'YEAR')::int=(select pop_solo+20 from a1_avant),'Pop gagne 20 Débutant, avec ou sans A0');
select pg_temp.verifier_a1((histoire.available_questions(p_niveau=>1,p_pack_id=>'COL-0115',p_direction=>'inverse')->>'YEAR')::int=(select pop_inverse+19 from a1_avant),'Pop gagne 19 années distinctes, avec ou sans A0');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
do $$ declare
 v_pack text;v_cohorte record;v_sens text;v_precision text;v_longueur integer;
 v_disponibles integer;v_compte integer;v_jeu jsonb;v_question jsonb;
begin
 foreach v_pack in array array['COL-0061','COL-0062','COL-0082','COL-0113','COL-0114','COL-0115'] loop
  for v_cohorte in select * from (values(1,false),(2,false),(3,true),(3,false)) c(niveau,expert) loop
   foreach v_sens in array array['date','inverse'] loop
    foreach v_precision in array array['YEAR','MONTH','DAY'] loop
     select case when v_sens='date' then count(*) else count(distinct(c.start_year,
       case when v_precision<>'YEAR' then c.start_month end,case when v_precision='DAY' then c.start_day end)) end
       into v_disponibles from histoire.solo_candidates(v_cohorte.expert,v_cohorte.niveau,v_pack,null,null,null,null,null,v_precision) c;
     v_compte:=(histoire.available_questions(p_expert_only=>v_cohorte.expert,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,p_direction=>v_sens)->>v_precision)::integer;
     perform pg_temp.verifier_a1(v_compte=v_disponibles,'compte réel A1 : '||v_pack);
     foreach v_longueur in array array[5,10,20,0] loop
      if v_disponibles>=(case when v_longueur=0 then 1 else v_longueur end) then
       v_jeu:=histoire.start_game(p_expert_only=>v_cohorte.expert,p_periodes=>true,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,p_difficulty=>v_precision,p_question_count=>v_longueur,p_direction=>v_sens);
       perform pg_temp.verifier_a1((select count(*)=case when v_longueur=0 then least(100,v_disponibles) else v_longueur end from histoire.game_questions where game_id=(v_jeu->>'game_id')::uuid),'longueur réelle');
       perform pg_temp.verifier_a1(not exists(select 1 from histoire.game_questions q join histoire.events e on e.id=q.event_id where q.game_id=(v_jeu->>'game_id')::uuid and
         (e.niveau>v_cohorte.niveau or (v_cohorte.expert and e.niveau<>3) or not exists(select 1 from histoire.pack_scope_events(v_pack) s where s.event_id=e.id))),'cohorte et périmètre');
       if v_sens='inverse' then
        perform pg_temp.verifier_a1((select count(*)=count(distinct(q.expected_year,case when v_precision<>'YEAR' then q.expected_month end,case when v_precision='DAY' then q.expected_day end)) from histoire.game_questions q where q.game_id=(v_jeu->>'game_id')::uuid),'dates inversées distinctes');
       end if;
       v_question:=histoire.next_question((v_jeu->>'game_id')::uuid,null);
       perform pg_temp.verifier_a1(not v_question ? 'event_id' and not v_question ? 'aliases' and not v_question ? 'expected_year' and not v_question ? 'notes','réponses et sources privées');
       perform pg_temp.verifier_a1(case when v_sens='date' then not v_question ? 'date' else not v_question ? 'title' end,'projection avant correction');
       delete from histoire.games where id=(v_jeu->>'game_id')::uuid;
       v_jeu:=histoire.start_mystery_game(p_expert_only=>v_cohorte.expert,p_periodes=>true,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,p_difficulty=>v_precision,p_question_count=>v_longueur,p_direction=>v_sens);
       perform pg_temp.verifier_a1(v_jeu->'mystery'->'winner'->>'id'=v_pack,'Mystère éligible');
       delete from histoire.games where id=(v_jeu->>'game_id')::uuid;
      else
       begin
        perform histoire.start_game(p_expert_only=>v_cohorte.expert,p_periodes=>true,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,p_difficulty=>v_precision,p_question_count=>v_longueur,p_direction=>v_sens);
        raise exception 'Longueur insuffisante acceptée';
       exception when invalid_parameter_value then null; end;
      end if;
     end loop;
    end loop;
   end loop;
  end loop;
 end loop;
end $$;
-- Priorité du retrait du parent, même si un enfant actif conserve le nouveau lien.
insert into histoire.packs(id,slug,title,parent_id) values('A1-ENFANT','a1-enfant','Enfant A1','COL-0114');
insert into histoire.pack_events(pack_id,event_id,position) values('A1-ENFANT','EVT-2300',1);
select histoire.admin_remove_pack_event('COL-0114','EVT-2300','Fixture retrait parent A1');
select pg_temp.verifier_a1(not exists(select 1 from histoire.pack_scope_events('COL-0114') where event_id='EVT-2300'),'parent exclut un événement retiré');
select pg_temp.verifier_a1(exists(select 1 from histoire.pack_scope_events('A1-ENFANT') where event_id='EVT-2300'),'enfant directement accessible');
set local role anon;
do $$ begin
 begin perform 1 from histoire.event_answers;raise exception 'réponses publiques';exception when insufficient_privilege then null;end;
 begin perform 1 from histoire.event_aliases;raise exception 'alias publics';exception when insufficient_privilege then null;end;
 begin perform 1 from histoire.admin_pack_additions;raise exception 'marqueurs publics';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform 1 from histoire.event_answers;raise exception 'réponses publiques';exception when insufficient_privilege then null;end;
 begin perform 1 from histoire.event_aliases;raise exception 'alias publics';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
begin;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
select histoire.admin_edit_event('COL-0114','EVT-2300','Titre relu après A1',2,'Relecture A1 locale');
select histoire.admin_remove_pack_event('COL-0114','EVT-2300','Retrait après A1');
create temporary table a1_correction as select to_jsonb(e) evenement,to_jsonb(a) reponse
 from histoire.events e join histoire.event_answers a on a.event_id=e.id where e.id='EVT-2300';
commit;
\ir ../../migrations/20261016095716_enrichissement_v12_a1.sql
begin;
select pg_temp.verifier_a1((select to_jsonb(e)=c.evenement and to_jsonb(a)=c.reponse from histoire.events e join histoire.event_answers a on a.event_id=e.id cross join a1_correction c where e.id='EVT-2300'),'répétition conserve correction et sources');
select pg_temp.verifier_a1((select removed from histoire.pack_event_status where pack_id='COL-0114' and event_id='EVT-2300'),'répétition conserve retrait');
rollback;
