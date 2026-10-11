-- #90 : corpus réel de la fixture Sport ; LOCAL/CI seulement, tout est annulé.
begin;
set local request.jwt.claim.sub = '';
create function pg_temp.verifier(condition boolean, description text) returns void language plpgsql as $$ begin
  if condition is not true then raise exception 'ÉCHEC Sport : %', description; end if;
end $$;
create function pg_temp.refuser(query text, expected_state text) returns void language plpgsql as $$ begin
  begin execute query; exception when others then if sqlstate=expected_state then return; end if; raise; end;
  raise exception 'Requête acceptée : %', query;
end $$;
select pg_temp.verifier((select count(*)=7 from histoire.packs where id between 'COL-0105' and 'COL-0111'),'sept packs installés');
select pg_temp.verifier((select count(*)=794 from histoire.pack_events where pack_id between 'COL-0105' and 'COL-0111'),'associations idempotentes');
select pg_temp.verifier(histoire.available_questions(p_pack_id=>'COL-0105')='{"YEAR":397,"MONTH":29,"DAY":29}'::jsonb,'union classique exacte');
select pg_temp.verifier(histoire.available_questions(p_pack_id=>'COL-0105',p_direction=>'inverse')='{"YEAR":131,"MONTH":28,"DAY":29}'::jsonb,'inverse déduplique les dates');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0105',p_niveau=>1)->>'YEAR')::int=5,'cinq Débutant');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0105',p_niveau=>2)->>'YEAR')::int=28,'28 jusqu’à Intermédiaire, propositions non appliquées');
do $$ declare niveau int; g jsonb; begin
  foreach niveau in array array[1,2] loop
    g := histoire.start_game(p_niveau=>niveau,p_token=>repeat('7',64),p_pack_id=>'COL-0105',p_question_count=>0);
    perform pg_temp.verifier((g->>'question_count')::int=case when niveau=1 then 5 else 28 end,'Tout respecte le niveau');
    perform pg_temp.verifier(not exists(select 1 from histoire.game_questions q join histoire.events e on e.id=q.event_id
      where q.game_id=(g->>'game_id')::uuid and e.niveau>niveau),'aucune question au-dessus du niveau choisi');
  end loop;
end $$;
do $$ declare p record; g jsonb; q jsonb; sens text; precision text; longueur int; n int; disponible int;
begin
  for p in select * from (values ('COL-0105',397),('COL-0106',49),('COL-0107',86),
    ('COL-0108',57),('COL-0109',91),('COL-0110',60),('COL-0111',54)) v(id,n) loop
    perform pg_temp.verifier((histoire.available_questions(p_pack_id=>p.id)->>'YEAR')::int=p.n,'compte enfant '||p.id);
    foreach sens in array array['date','inverse'] loop
      foreach precision in array array['YEAR','MONTH','DAY'] loop
        disponible := (histoire.available_questions(p_pack_id=>p.id,p_direction=>sens)->>precision)::int;
        foreach longueur in array array[5,10,20,0] loop
          if disponible=0 or (longueur>0 and disponible<longueur) then
            perform pg_temp.refuser(format('select histoire.start_game(p_niveau=>3,p_token=>%L,p_pack_id=>%L,p_direction=>%L,p_difficulty=>%L,p_question_count=>%s)',repeat('9',64),p.id,sens,precision,longueur),'22023');
            continue;
          end if;
          g := histoire.start_game(p_niveau=>3,p_token=>repeat('9',64),p_pack_id=>p.id,p_direction=>sens,p_difficulty=>precision,p_question_count=>longueur);
          n := case when longueur=0 then least(100,disponible) else longueur end;
          perform pg_temp.verifier((g->>'question_count')::int=n,'longueur 5/10/20/Tout et plafond 100');
          perform pg_temp.verifier((select count(distinct event_id)=n from histoire.game_questions where game_id=(g->>'game_id')::uuid),'pas de doublon');
          perform pg_temp.verifier(not exists(select 1 from histoire.game_questions q where game_id=(g->>'game_id')::uuid
            and not exists(select 1 from histoire.pack_scope_events(p.id) s where s.event_id=q.event_id)),'périmètre du sous-pack');
          perform pg_temp.verifier((select context->'replay_filters'->>'packId'=p.id from histoire.games where id=(g->>'game_id')::uuid),'replay conserve le choix');
          q := histoire.next_question((g->>'game_id')::uuid,repeat('9',64));
          perform pg_temp.verifier(not q ? 'event_id' and not q ? 'aliases' and not q ? 'expected_year','pas de réponse privée');
          if sens='date' then perform pg_temp.verifier(not q ? 'date','date cachée avant correction');
          else perform pg_temp.verifier(not q ? 'title','événement caché en inverse'); end if;
        end loop;
      end loop;
    end loop;
    g := histoire.start_mystery_game(p_token=>repeat('8',64),p_niveau=>3,p_pack_id=>p.id,p_question_count=>5);
    perform pg_temp.verifier(g->'mystery'->'winner'->>'id'=p.id,'thème mystère parent et chaque enfant');
  end loop;
end $$;

-- Le parent a son inventaire complet : retirer l’enfant ne retire pas l’association parent.
insert into histoire.players(id) values ('00000000-0000-0000-0000-000000000090');
insert into histoire.admins(user_id) values ('00000000-0000-0000-0000-000000000090');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000090';
select histoire.admin_remove_pack_event('COL-0106','EVT-0941','Fixture Sport');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0106')->>'YEAR')::int=48,'retrait enfant');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0105')->>'YEAR')::int=397,'association parent indépendante');
select histoire.admin_remove_pack_event('COL-0105','EVT-0941','Fixture Sport');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0105')->>'YEAR')::int=396,'retrait parent masque toute union');
select histoire.admin_restore_pack_event('COL-0106','EVT-0941');
select histoire.admin_restore_pack_event('COL-0105','EVT-0941');
select histoire.admin_edit_event('COL-0106','EVT-0941','Victoire française corrigée',2,'Fixture Sport');
update histoire.events set title='Titre dataset',niveau=3 where id='EVT-0941';
select pg_temp.verifier((select title='Victoire française corrigée' and niveau=2 from histoire.events where id='EVT-0941'),'réimport préserve surcharge globale');
select pg_temp.verifier(jsonb_array_length(histoire.admin_event_history('EVT-0941'))=1,'historique global conservé');
select pg_temp.verifier((select count(*)=4 from histoire.pack_event_audit where event_id='EVT-0941'),'historique retraits/remises');
select pg_temp.verifier(exists(select 1 from jsonb_array_elements(histoire.admin_list_packs()) p
  where p->>'id'='COL-0105' and (p->>'total')::int=397 and (p->>'scope_playable')::int=397),'administration et inventaire Sport');
set local request.jwt.claim.sub = '';
set local role anon;
select pg_temp.refuser('select * from histoire.event_answers','42501');
select pg_temp.refuser('select histoire.admin_list_packs()','42501');
select pg_temp.verifier(exists(select 1 from jsonb_array_elements(histoire.playable_packs(3)) p where p->>'id'='COL-0105'),'Sport dans catalogue vivant');
reset role;
rollback;
