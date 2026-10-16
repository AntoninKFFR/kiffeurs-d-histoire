-- LOCAL/CI uniquement, après la fixture et la migration fun. Jamais KFFR.
\ir ../../fixtures/enrichissement_massif.sql
\ir appliquer-test.sql
begin;
create function pg_temp.verifier_massif(condition boolean,message text) returns void language plpgsql as $$
begin if condition is not true then raise exception 'ÉCHEC Massif : %',message; end if; end $$;
-- Préconditions : aucun refus ne peut laisser un ajout partiel.
do $$ begin
 begin
  update histoire.packs set active=false where id='COL-0114';
  perform pg_temp.appliquer_massif();raise exception 'Pack inactif accepté';
 exception when raise_exception then if sqlerrm not like 'Massif : pack cible%' then raise; end if; end;
 begin
  insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
   values('EVT-2500','Identifiant déjà occupé','POINT','YEAR','EXACT',true,'YEAR',3,3,2);
  perform pg_temp.appliquer_massif();raise exception 'Collision acceptée';
 exception when raise_exception then if sqlerrm not like 'Massif : identifiant%' then raise; end if; end;
 begin
  insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
   values('EVT-990001','NAISSANCE DE NAPOLÉON BONAPARTE À AJACCIO','POINT','YEAR','EXACT',true,'YEAR',3,3,2);
  perform pg_temp.appliquer_massif();raise exception 'Doublon accepté';
 exception when raise_exception then if sqlerrm not like 'Massif : doublon%' then raise; end if; end;
 begin
  insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
   values('EVT-990001','Naissance de Napoléon Bonaparte à Ajaccio en Corse','POINT','DAY','EXACT',true,'DAY',3,3,2);
  insert into histoire.event_answers(event_id,start_year,start_month,start_day) values('EVT-990001',1769,8,15);
  perform pg_temp.appliquer_massif();raise exception 'Quasi-doublon accepté';
 exception when raise_exception then if sqlerrm not like 'Massif : doublon%' then raise; end if; end;
 begin
  update histoire.events set title='Titre corrigé après le relevé' where id='EVT-0018';
  perform pg_temp.appliquer_massif();raise exception 'Correction remplacée';
 exception when raise_exception then if sqlerrm not like 'Massif : événement, date ou correction%' then raise; end if; end;
end $$;
insert into histoire.players(id) values('00000000-0000-0000-0000-000000000024') on conflict do nothing;
insert into histoire.admins(user_id) values('00000000-0000-0000-0000-000000000024') on conflict do nothing;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
select histoire.admin_create_event('b1000000-0000-4000-8000-000000000122','COL-0115',
 '{"title":"Inauguration fictive de la bibliothèque des tests","description":"Une question fictive conservée avec ses références documentaires privées.","niveau":3,"kind":"event","date_status":"EXACT","start_year":1501,"sources":["Document de fixture Massif, page 122"]}');
create temporary table massif_ids as select 'EVT-'||i id from generate_series(2500,2659) i;
create temporary table massif_reuses(pack_id text,event_id text);
insert into massif_reuses values ('COL-0074','EVT-0018'),('COL-0074','EVT-0949'),('COL-0117','EVT-0545'),('COL-0076','EVT-0545'),('COL-0117','EVT-0787'),('COL-0117','EVT-1038'),('COL-0117','EVT-0998');
create function pg_temp.empreintes_massif() returns jsonb language plpgsql as $$
declare t record;empreinte text;filtre text;resultat jsonb:='{}';begin
 for t in select tablename from pg_tables where schemaname='histoire' order by tablename loop
  filtre:=case when t.tablename='events' then ' where x.id not in (select id from massif_ids)'
    when t.tablename in ('pack_events','admin_pack_additions') then ' where x.event_id not in (select id from massif_ids) and not exists(select 1 from massif_reuses r where r.pack_id=x.pack_id and r.event_id=x.event_id)'
    when t.tablename in ('event_answers','event_aliases') then ' where x.event_id not in (select id from massif_ids)'
    when t.tablename='migrations_appliquees' then ' where x.version<>''20261016124921''' else '' end;
  execute format('select md5(coalesce(string_agg(to_jsonb(x)::text,chr(10) order by to_jsonb(x)::text),'''')) from histoire.%I x',t.tablename)||filtre into empreinte;
  resultat:=resultat||jsonb_build_object(t.tablename,empreinte);
 end loop;return resultat;
end $$;
create temporary table massif_avant as select pg_temp.empreintes_massif() empreintes,
 (select count(*) from histoire.events) total,(select count(*) from histoire.events where niveau=1) debutants,
 (histoire.available_questions(p_niveau=>1,p_pack_id=>'COL-0115')->>'YEAR')::int pop_solo,
 (histoire.available_questions(p_niveau=>1,p_pack_id=>'COL-0115',p_direction=>'inverse')->>'YEAR')::int pop_inverse;
commit;
\ir ../../migrations/20261016124921_enrichissement_v12_massif.sql
\ir ../../migrations/20261016124921_enrichissement_v12_massif.sql
begin;
select pg_temp.verifier_massif((select empreintes=pg_temp.empreintes_massif() from massif_avant),'toutes les lignes antérieures de toutes les tables histoire, audits et joueurs inchangées');
select pg_temp.verifier_massif((select count(*)=(select total+160 from massif_avant) from histoire.events),'160 événements nouveaux sans doublon');
select pg_temp.verifier_massif((select count(*)=(select debutants+128 from massif_avant) from histoire.events where niveau=1),'128 nouveaux Débutant');
select pg_temp.verifier_massif((select count(*)=511 from histoire.pack_events where event_id in(select id from massif_ids)),'511 associations');
select pg_temp.verifier_massif((select count(*)=511 from histoire.admin_pack_additions where event_id in(select id from massif_ids)),'511 associations protégées au réimport');
select pg_temp.verifier_massif(not exists(select 1 from histoire.pack_events where event_id in(select id from massif_ids) and pack_id in('COL-0059','COL-0060','COL-0077')),'contrats 50/100/expert conservés');
select pg_temp.verifier_massif((select count(*)=1 from histoire.migrations_appliquees where version='20261016124921'),'registre unique');
select pg_temp.verifier_massif((select count(*)=160 from histoire.event_answers where event_id in(select id from massif_ids) and length(description)>40 and notes like 'Sources V1.2 Massif #122 : %'),'descriptions et preuves privées');
select pg_temp.verifier_massif(not exists(select 1 from massif_ids i where not exists(select 1 from histoire.event_aliases a where a.event_id=i.id)),'alias pour chaque événement');
select pg_temp.verifier_massif((select count(*)=7 from massif_reuses r join histoire.pack_events p using(pack_id,event_id)),'sept réemplois présents');
select pg_temp.verifier_massif((select count(*)=7 from massif_reuses r join histoire.admin_pack_additions p using(pack_id,event_id)),'sept réemplois protégés');
select pg_temp.verifier_massif((select count(*)=2 from histoire.events e join histoire.event_answers a on a.event_id=e.id where e.id in ('EVT-2572','EVT-2573') and e.precision='MONTH' and a.start_day is null),'divergences de jour : mois conservé');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000024';
do $$ declare
 v_pack text;v_cohorte record;v_sens text;v_precision text;v_longueur integer;
 v_disponibles integer;v_compte integer;v_jeu jsonb;v_question jsonb;
begin
 foreach v_pack in array array['COL-0061','COL-0062','COL-0067','COL-0069','COL-0070','COL-0071','COL-0072','COL-0073','COL-0074','COL-0075','COL-0076','COL-0078','COL-0079','COL-0080','COL-0081','COL-0082','COL-0105','COL-0106','COL-0107','COL-0108','COL-0109','COL-0110','COL-0111','COL-0112','COL-0113','COL-0114','COL-0115','COL-0116','COL-0117'] loop
  for v_cohorte in select * from (values(1,false),(2,false),(3,true),(3,false)) c(niveau,expert) loop
   foreach v_sens in array array['date','inverse'] loop
    foreach v_precision in array array['YEAR','MONTH','DAY'] loop
     select case when v_sens='date' then count(*) else count(distinct(c.start_year,
       case when v_precision<>'YEAR' then c.start_month end,case when v_precision='DAY' then c.start_day end)) end
       into v_disponibles from histoire.solo_candidates(v_cohorte.expert,v_cohorte.niveau,v_pack,null,null,null,null,null,v_precision) c;
     v_compte:=(histoire.available_questions(p_expert_only=>v_cohorte.expert,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,p_direction=>v_sens)->>v_precision)::integer;
     perform pg_temp.verifier_massif(v_compte=v_disponibles,'compte réel Massif : '||v_pack);
     if v_precision=(case when v_sens='inverse' then 'DAY' else 'YEAR' end) then
     foreach v_longueur in array array[5,10,20,0] loop
      if v_disponibles>=(case when v_longueur=0 then 1 else v_longueur end) then
       v_jeu:=histoire.start_game(p_expert_only=>v_cohorte.expert,p_periodes=>true,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,p_difficulty=>v_precision,p_question_count=>v_longueur,p_direction=>v_sens);
       perform pg_temp.verifier_massif((select count(*)=case when v_longueur=0 then least(100,v_disponibles) else v_longueur end from histoire.game_questions where game_id=(v_jeu->>'game_id')::uuid),'longueur réelle');
       perform pg_temp.verifier_massif(not exists(select 1 from histoire.game_questions q join histoire.events e on e.id=q.event_id where q.game_id=(v_jeu->>'game_id')::uuid and
         (e.niveau>v_cohorte.niveau or (v_cohorte.expert and e.niveau<>3) or not exists(select 1 from histoire.pack_scope_events(v_pack) s where s.event_id=e.id))),'cohorte et périmètre');
       if v_sens='inverse' then
        perform pg_temp.verifier_massif((select count(*)=count(distinct(q.expected_year,case when v_precision<>'YEAR' then q.expected_month end,case when v_precision='DAY' then q.expected_day end)) from histoire.game_questions q where q.game_id=(v_jeu->>'game_id')::uuid),'dates inversées distinctes');
       end if;
       v_question:=histoire.next_question((v_jeu->>'game_id')::uuid,null);
       perform pg_temp.verifier_massif(not v_question ? 'event_id' and not v_question ? 'aliases' and not v_question ? 'expected_year' and not v_question ? 'notes','réponses et sources privées');
       perform pg_temp.verifier_massif(case when v_sens='date' then not v_question ? 'date' else not v_question ? 'title' end,'projection avant correction');
       delete from histoire.games where id=(v_jeu->>'game_id')::uuid;
       v_jeu:=histoire.start_mystery_game(p_expert_only=>v_cohorte.expert,p_periodes=>true,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,p_difficulty=>v_precision,p_question_count=>v_longueur,p_direction=>v_sens);
       perform pg_temp.verifier_massif(v_jeu->'mystery'->'winner'->>'id'=v_pack,'Mystère éligible');
       delete from histoire.games where id=(v_jeu->>'game_id')::uuid;
      else
       begin
        perform histoire.start_game(p_expert_only=>v_cohorte.expert,p_periodes=>true,p_niveau=>v_cohorte.niveau,p_pack_id=>v_pack,p_difficulty=>v_precision,p_question_count=>v_longueur,p_direction=>v_sens);
        raise exception 'Longueur insuffisante acceptée';
       exception when invalid_parameter_value then null; end;
      end if;
     end loop;
     end if;
    end loop;
   end loop;
  end loop;
 end loop;
end $$;
-- Priorité du retrait du parent, même si un enfant actif conserve le nouveau lien.
insert into histoire.packs(id,slug,title,parent_id) values('Massif-ENFANT','massif-enfant','Enfant Massif','COL-0061');
insert into histoire.pack_events(pack_id,event_id,position) values('Massif-ENFANT','EVT-2500',1);
select histoire.admin_remove_pack_event('COL-0061','EVT-2500','Fixture retrait parent Massif');
select pg_temp.verifier_massif(not exists(select 1 from histoire.pack_scope_events('COL-0061') where event_id='EVT-2500'),'parent exclut un événement retiré');
select pg_temp.verifier_massif(exists(select 1 from histoire.pack_scope_events('Massif-ENFANT') where event_id='EVT-2500'),'enfant directement accessible');
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
select histoire.admin_edit_event('COL-0061','EVT-2500','Titre relu après Massif',2,'Relecture Massif locale');
select histoire.admin_remove_pack_event('COL-0061','EVT-2500','Retrait après Massif');
create temporary table massif_correction as select to_jsonb(e) evenement,to_jsonb(a) reponse
 from histoire.events e join histoire.event_answers a on a.event_id=e.id where e.id='EVT-2500';
commit;
\ir ../../migrations/20261016124921_enrichissement_v12_massif.sql
begin;
select pg_temp.verifier_massif((select to_jsonb(e)=c.evenement and to_jsonb(a)=c.reponse from histoire.events e join histoire.event_answers a on a.event_id=e.id cross join massif_correction c where e.id='EVT-2500'),'répétition conserve correction et sources');
select pg_temp.verifier_massif((select removed from histoire.pack_event_status where pack_id='COL-0061' and event_id='EVT-2500'),'répétition conserve retrait');
rollback;
