-- LOCAL/CI exclusivement : fixtures Sport réelles, aucune donnée persistée.
begin;
set local request.jwt.claim.sub = '';
create function pg_temp.verifier(condition boolean, description text) returns void language plpgsql as $$ begin
  if condition is not true then raise exception 'ÉCHEC Expert : %', description; end if;
end $$;
create function pg_temp.refuser(query text, expected_state text) returns void language plpgsql as $$ begin
  begin execute query; exception when others then if sqlstate=expected_state then return; end if; raise; end;
  raise exception 'Requête acceptée : %', query;
end $$;

select pg_temp.verifier((histoire.available_questions(p_niveau=>3,p_pack_id=>'COL-0105')->>'YEAR')::int=397,'ancien niveau 3 = tous');
select pg_temp.verifier((histoire.available_questions(p_expert_only=>true,p_niveau=>3,p_pack_id=>'COL-0105')->>'YEAR')::int=369,'Expert Sport = 369');
select pg_temp.verifier(histoire.available_questions(p_expert_only=>false,p_niveau=>3,p_pack_id=>'COL-0105')=histoire.available_questions(p_niveau=>3,p_pack_id=>'COL-0105'),'indicateur false cumulatif');

-- Tous les packs Sport, les quatre choix, les trois précisions, les deux sens, 5/10/20/Tout.
do $$ declare v_pack record; v_mode record; v_sens text; v_precision text; v_longueur int;
  v_comptes jsonb; v_n int; v_game jsonb; v_question jsonb; v_scope jsonb; v_mystere jsonb;
begin
  for v_pack in select id from histoire.packs where id between 'COL-0105' and 'COL-0111' loop
    for v_mode in select * from (values (1,false),(2,false),(3,true),(3,false)) m(niveau,expert) loop
      foreach v_sens in array array['date','inverse'] loop
        v_comptes := histoire.available_questions(p_expert_only=>v_mode.expert,p_niveau=>v_mode.niveau,p_pack_id=>v_pack.id,p_direction=>v_sens);
        v_scope := histoire.playable_packs(p_expert_only=>v_mode.expert,p_niveau=>v_mode.niveau,p_pack_id=>v_pack.id,p_direction=>v_sens);
        perform pg_temp.verifier(v_scope->0->'comptes'=v_comptes,'catalogue vivant et décompte identiques');
        foreach v_precision in array array['YEAR','MONTH','DAY'] loop
          v_n := (v_comptes->>v_precision)::int;
          perform pg_temp.verifier(v_n=(select case when v_sens='date' then count(*) else count(distinct (c.start_year,
            case when v_precision in ('MONTH','DAY') then c.start_month end,case when v_precision='DAY' then c.start_day end)) end
            from histoire.solo_candidates(v_mode.expert,v_mode.niveau,v_pack.id,null,null,null,null,null,v_precision) c),
            'décompte depuis les vrais candidats après filtre');
          foreach v_longueur in array array[5,10,20,0] loop
            if v_n=0 or (v_longueur>0 and v_n<v_longueur) then
              perform pg_temp.refuser(format('select histoire.start_game(p_expert_only=>%L,p_periodes=>true,p_niveau=>%s,p_token=>%L,p_pack_id=>%L,p_direction=>%L,p_difficulty=>%L,p_question_count=>%s)',v_mode.expert,v_mode.niveau,repeat('e',64),v_pack.id,v_sens,v_precision,v_longueur),'22023');
              continue;
            end if;
            v_game := histoire.start_game(p_expert_only=>v_mode.expert,p_periodes=>true,p_niveau=>v_mode.niveau,p_token=>repeat('e',64),
              p_pack_id=>v_pack.id,p_direction=>v_sens,p_difficulty=>v_precision,p_question_count=>v_longueur);
            perform pg_temp.verifier((v_game->>'question_count')::int=case when v_longueur=0 then least(100,v_n) else v_longueur end,'longueur et plafond');
            perform pg_temp.verifier(not exists(select 1 from histoire.game_questions q join histoire.events e on e.id=q.event_id
              where q.game_id=(v_game->>'game_id')::uuid and (e.niveau>v_mode.niveau or (v_mode.expert and e.niveau<>3))),'aucun niveau 1/2 en Expert');
            perform pg_temp.verifier(not exists(select 1 from histoire.game_questions q where q.game_id=(v_game->>'game_id')::uuid
              and not exists(select 1 from histoire.pack_scope_events(v_pack.id) s where s.event_id=q.event_id)),'parent/enfant exact');
            perform pg_temp.verifier((select (context->'replay_filters'->>'expertOnly')::boolean=v_mode.expert
              and (context->'replay_filters'->>'niveau')::int=v_mode.niveau and context->'replay_filters'->>'packId'=v_pack.id
              from histoire.games where id=(v_game->>'game_id')::uuid),'instantané exact pour bilan et Rejouer');
            if v_sens='inverse' then
              perform pg_temp.verifier((select count(*)=count(distinct (expected_year,
                case when v_precision in ('MONTH','DAY') then expected_month end,case when v_precision='DAY' then expected_day end))
                from histoire.game_questions where game_id=(v_game->>'game_id')::uuid),'dates distinctes après filtre');
              perform pg_temp.verifier(not exists(select 1 from histoire.game_questions where game_id=(v_game->>'game_id')::uuid and periode),'inverse sans période');
            end if;
            v_question := histoire.next_question((v_game->>'game_id')::uuid,repeat('e',64));
            perform pg_temp.verifier(not v_question ? 'event_id' and not v_question ? 'expected_year' and not v_question ? 'correct_end_date' and not v_question ? 'aliases','réponses privées');
            delete from histoire.games where id=(v_game->>'game_id')::uuid;
          end loop;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;

-- Fixture distincte : même date à deux niveaux. Soustraire les comptes cumulatifs serait faux.
insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,source_status,niveau)
values ('EVT-9901','Fixture facile','POINT','DAY','EXACT',true,'DAY',2,1,'SUPPORTED_B',1),
 ('EVT-9903','Fixture Expert période','PERIOD','DAY_RANGE','EXACT',true,'RANGE',2,4,'SUPPORTED_B',3);
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day)
values ('EVT-9901',1111,1,1,null,null,null),('EVT-9903',1111,1,1,1120,1,1);
insert into histoire.tags(id,slug,name,tag_type,active) values ('TAG-9901','fixture-expert','Fixture Expert','SEMANTIC_TOPIC',true);
insert into histoire.event_tags(event_id,tag_id) values ('EVT-9901','TAG-9901'),('EVT-9903','TAG-9901');
select pg_temp.verifier((histoire.available_questions(p_niveau=>3,p_tag_id=>'TAG-9901',p_direction=>'inverse')->>'DAY')::int=1,'total distinct = 1');
select pg_temp.verifier((histoire.available_questions(p_niveau=>2,p_tag_id=>'TAG-9901',p_direction=>'inverse')->>'DAY')::int=1,'facile distinct = 1');
select pg_temp.verifier((histoire.available_questions(p_expert_only=>true,p_niveau=>3,p_tag_id=>'TAG-9901',p_direction=>'inverse')->>'DAY')::int=1,'Expert distinct = 1, pas total moins facile');
select pg_temp.verifier((histoire.available_questions(p_expert_only=>true,p_niveau=>3,p_tag_id=>'TAG-9901',p_year_min=>1100,p_year_max=>1200)->>'YEAR')::int=1,'thème et période historique');

insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,source_status,niveau)
select 'EVT-'||n,'Fixture Expert '||n,'POINT','DAY','EXACT',true,'DAY',2,4,'SUPPORTED_B',3 from generate_series(9904,9907) n;
insert into histoire.event_answers(event_id,start_year,start_month,start_day)
select 'EVT-'||n,1112+n-9904,1,1 from generate_series(9904,9907) n;
insert into histoire.event_tags(event_id,tag_id) select 'EVT-'||n,'TAG-9901' from generate_series(9904,9907) n;
do $$ declare v_game jsonb; v_coupe jsonb; v_question jsonb; begin
  v_game := histoire.start_game(p_expert_only=>true,p_periodes=>true,p_niveau=>3,p_token=>repeat('a',64),p_tag_id=>'TAG-9901',p_question_count=>5);
  perform pg_temp.verifier((select count(*)=1 from histoire.game_questions where game_id=(v_game->>'game_id')::uuid and periode),'période automatique Expert');
  v_coupe := histoire.start_game(p_expert_only=>true,p_periodes=>false,p_niveau=>3,p_token=>repeat('a',64),p_tag_id=>'TAG-9901',p_question_count=>5);
  perform pg_temp.verifier(not exists(select 1 from histoire.game_questions where game_id=(v_coupe->>'game_id')::uuid and periode),'relance historique périodes coupées');
  perform pg_temp.refuser(format('select histoire.next_question(%L,%L)',v_game->>'game_id',repeat('f',64)),'42501');
  delete from histoire.games where id in ((v_game->>'game_id')::uuid,(v_coupe->>'game_id')::uuid);
end $$;

-- Roulette et Rejouer le gagnant : exactement une partie, mêmes filtres et niveaux exclusifs.
do $$ declare v_sens text; v_longueur int; v_game jsonb; v_replay jsonb; v_before int; v_filter jsonb; v_bilan jsonb; v_question jsonb;
begin
  foreach v_sens in array array['date','inverse'] loop
    foreach v_longueur in array array[5,10,20,0] loop
      select count(*) into v_before from histoire.games;
      v_game := histoire.start_mystery_game(p_expert_only=>true,p_periodes=>true,p_niveau=>3,p_token=>repeat('b',64),p_direction=>v_sens,p_pack_id=>'COL-0105',p_question_count=>v_longueur);
      perform pg_temp.verifier((select count(*)=v_before+1 from histoire.games),'roulette = une création');
      perform pg_temp.verifier(not exists(select 1 from histoire.game_questions q join histoire.events e on e.id=q.event_id where q.game_id=(v_game->>'game_id')::uuid and e.niveau<>3),'roulette Expert exclusive');
      select context->'replay_filters' into v_filter from histoire.games where id=(v_game->>'game_id')::uuid;
      perform pg_temp.verifier(v_filter->>'expertOnly'='true' and v_filter->>'mystery'='true','gagnant enregistre Expert');
      loop
        v_question := histoire.next_question((v_game->>'game_id')::uuid,repeat('b',64));
        exit when v_question is null;
        if v_sens='inverse' then perform histoire.submit_answer((v_game->>'game_id')::uuid,(v_question->>'question_id')::uuid,p_answer_text=>'Réponse fixture',p_token=>repeat('b',64));
        elsif v_question ? 'periode' then perform histoire.submit_period_answer((v_game->>'game_id')::uuid,(v_question->>'question_id')::uuid,1900,null,null,2000,null,null,repeat('b',64));
        else perform histoire.submit_answer((v_game->>'game_id')::uuid,(v_question->>'question_id')::uuid,1900,p_token=>repeat('b',64)); end if;
      end loop;
      v_bilan := histoire.finish_game((v_game->>'game_id')::uuid,repeat('b',64));
      perform pg_temp.verifier(v_bilan->'replay_filters'=v_filter,'bilan conserve le filtre exact');
      v_replay := histoire.start_mystery_game(p_expert_only=>(v_filter->>'expertOnly')::boolean,p_periodes=>true,p_niveau=>3,p_token=>repeat('c',64),p_direction=>v_sens,p_pack_id=>v_filter->>'packId',p_question_count=>v_longueur);
      perform pg_temp.verifier(v_replay->'mystery'->'winner'=v_game->'mystery'->'winner','Rejouer ce thème');
      delete from histoire.games where id in ((v_game->>'game_id')::uuid,(v_replay->>'game_id')::uuid);
    end loop;
  end loop;
end $$;

-- Les contrôles d'accès et les signatures antérieures ne changent pas.
select pg_temp.verifier(not has_function_privilege('anon','histoire.solo_candidates(boolean,integer,text,text,integer,integer,text,text[],text)','EXECUTE'),'candidats privés');
select pg_temp.verifier(not has_table_privilege('anon','histoire.event_answers','SELECT') and not has_table_privilege('authenticated','histoire.event_aliases','SELECT'),'réponses inaccessibles');
select pg_temp.refuser('select histoire.available_questions(p_expert_only=>true,p_niveau=>2)','22023');
select pg_temp.refuser('select histoire.start_game(p_expert_only=>true,p_periodes=>true,p_niveau=>1,p_token=>repeat(''a'',64))','22023');
select pg_temp.refuser('select histoire.start_game(p_expert_only=>true,p_periodes=>true,p_niveau=>3,p_token=>''invalide'')','22023');
set local role anon;
select pg_temp.verifier((histoire.available_questions(p_expert_only=>true,p_niveau=>3,p_pack_id=>'COL-0105')->>'YEAR')::int=369,'RPC accessible à anon sans réponse');
reset role;
rollback;
