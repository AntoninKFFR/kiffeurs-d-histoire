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
select pg_temp.verifier(not exists (
  select 1 from (values ('COL-0105','sport'),('COL-0106','sport-football'),('COL-0107','sport-tennis'),
    ('COL-0108','sport-jeux-olympiques'),('COL-0109','sport-cyclisme'),('COL-0110','sport-mecanique'),
    ('COL-0111','sport-autres-exploits')) attendu(id,slug)
  left join histoire.packs p on p.id=attendu.id where p.slug is distinct from attendu.slug
),'chaque identifiant Sport correspond à son slug');
select pg_temp.verifier((select count(*)=794 from histoire.pack_events where pack_id between 'COL-0105' and 'COL-0111'),'associations idempotentes');
select pg_temp.verifier(histoire.available_questions(p_pack_id=>'COL-0105')='{"YEAR":397,"MONTH":29,"DAY":29}'::jsonb,'union classique exacte');
select pg_temp.verifier(histoire.available_questions(p_pack_id=>'COL-0105',p_direction=>'inverse')='{"YEAR":131,"MONTH":28,"DAY":29}'::jsonb,'inverse déduplique les dates');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0105',p_niveau=>1)->>'YEAR')::int=5,'cinq Débutant');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0105',p_niveau=>2)->>'YEAR')::int=28,'28 jusqu’à Intermédiaire, propositions non appliquées');
do $$ declare v_niveau int; v_partie jsonb; begin
  foreach v_niveau in array array[1,2] loop
    v_partie := histoire.start_game(p_niveau=>v_niveau,p_token=>repeat('7',64),p_pack_id=>'COL-0105',p_question_count=>0);
    perform pg_temp.verifier((v_partie->>'question_count')::int=case when v_niveau=1 then 5 else 28 end,'Tout respecte le niveau');
    perform pg_temp.verifier(not exists(select 1 from histoire.game_questions q join histoire.events e on e.id=q.event_id
      where q.game_id=(v_partie->>'game_id')::uuid and e.niveau>v_niveau),'aucune question au-dessus du niveau choisi');
  end loop;
end $$;
-- Préfixer les variables : éviter aussi les collisions avec les alias q et la colonne n du VALUES.
do $$ declare v_pack record; v_partie jsonb; v_question jsonb; v_sens text; v_precision text; v_longueur int; v_nombre int; v_disponible int;
begin
  for v_pack in select * from (values ('COL-0105',397),('COL-0106',49),('COL-0107',86),
    ('COL-0108',57),('COL-0109',91),('COL-0110',60),('COL-0111',54)) v(id,n) loop
    perform pg_temp.verifier((histoire.available_questions(p_pack_id=>v_pack.id)->>'YEAR')::int=v_pack.n,'compte enfant '||v_pack.id);
    foreach v_sens in array array['date','inverse'] loop
      foreach v_precision in array array['YEAR','MONTH','DAY'] loop
        v_disponible := (histoire.available_questions(p_pack_id=>v_pack.id,p_direction=>v_sens)->>v_precision)::int;
        foreach v_longueur in array array[5,10,20,0] loop
          if v_disponible=0 or (v_longueur>0 and v_disponible<v_longueur) then
            perform pg_temp.refuser(format('select histoire.start_game(p_niveau=>3,p_token=>%L,p_pack_id=>%L,p_direction=>%L,p_difficulty=>%L,p_question_count=>%s)',repeat('9',64),v_pack.id,v_sens,v_precision,v_longueur),'22023');
            continue;
          end if;
          v_partie := histoire.start_game(p_niveau=>3,p_token=>repeat('9',64),p_pack_id=>v_pack.id,p_direction=>v_sens,p_difficulty=>v_precision,p_question_count=>v_longueur);
          v_nombre := case when v_longueur=0 then least(100,v_disponible) else v_longueur end;
          perform pg_temp.verifier((v_partie->>'question_count')::int=v_nombre,'longueur 5/10/20/Tout et plafond 100');
          perform pg_temp.verifier((select count(distinct q.event_id)=v_nombre from histoire.game_questions q where q.game_id=(v_partie->>'game_id')::uuid),'pas de doublon');
          perform pg_temp.verifier(not exists(select 1 from histoire.game_questions q where q.game_id=(v_partie->>'game_id')::uuid
            and not exists(select 1 from histoire.pack_scope_events(v_pack.id) s where s.event_id=q.event_id)),'périmètre du sous-pack');
          perform pg_temp.verifier((select g.context->'replay_filters'->>'packId'=v_pack.id from histoire.games g where g.id=(v_partie->>'game_id')::uuid),'replay conserve le choix');
          v_question := histoire.next_question((v_partie->>'game_id')::uuid,repeat('9',64));
          perform pg_temp.verifier(not v_question ? 'event_id' and not v_question ? 'aliases' and not v_question ? 'expected_year','pas de réponse privée');
          if v_sens='date' then perform pg_temp.verifier(not v_question ? 'date','date cachée avant correction');
          else perform pg_temp.verifier(not v_question ? 'title','événement caché en inverse'); end if;
        end loop;
      end loop;
    end loop;
    v_partie := histoire.start_mystery_game(p_token=>repeat('8',64),p_niveau=>3,p_pack_id=>v_pack.id,p_question_count=>5);
    perform pg_temp.verifier(v_partie->'mystery'->'winner'->>'id'=v_pack.id,'thème mystère parent et chaque enfant');
  end loop;
end $$;

-- Le parent a son inventaire complet : retirer l’enfant ne retire pas l’association parent.
-- kffr_profiles.sql est chargé avant les migrations/tests par tests-sql.sh.
-- Réutiliser ses faux comptes Auth, comme les tests #89/#104 ; ne créer aucun utilisateur.
select pg_temp.verifier((select count(*)=2 from auth.users where id in (
  '00000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000025'
)),'faux comptes Auth de la fixture locale présents');
insert into histoire.players(id) values ('00000000-0000-0000-0000-000000000024'),
  ('00000000-0000-0000-0000-000000000025') on conflict (id) do nothing;
insert into histoire.admins(user_id) values ('00000000-0000-0000-0000-000000000024') on conflict (user_id) do nothing;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
set local role authenticated;
select histoire.admin_remove_pack_event('COL-0106','EVT-0941','Fixture Sport');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0106')->>'YEAR')::int=48,'retrait enfant');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0105')->>'YEAR')::int=397,'association parent indépendante');
select histoire.admin_remove_pack_event('COL-0105','EVT-0941','Fixture Sport');
select pg_temp.verifier((histoire.available_questions(p_pack_id=>'COL-0105')->>'YEAR')::int=396,'retrait parent masque toute union');
select histoire.admin_restore_pack_event('COL-0106','EVT-0941');
select histoire.admin_restore_pack_event('COL-0105','EVT-0941');
select histoire.admin_edit_event('COL-0106','EVT-0941','Victoire française corrigée',2,'Fixture Sport');
select pg_temp.verifier(jsonb_array_length(histoire.admin_event_history('EVT-0941'))=1,'historique lisible par administrateur authentifié');
reset role;
-- Simuler une écriture d’import privilégiée, hors des droits du joueur.
update histoire.events set title='Titre dataset',niveau=3 where id='EVT-0941';
select pg_temp.verifier((select title='Victoire française corrigée' and niveau=2 from histoire.events where id='EVT-0941'),'réimport préserve surcharge globale');
select pg_temp.verifier(jsonb_array_length(histoire.admin_event_history('EVT-0941'))=1,'historique global conservé');
select pg_temp.verifier((select count(*)=4 from histoire.pack_event_audit where event_id='EVT-0941'),'historique retraits/remises');
select pg_temp.verifier((select bool_and(admin_id='00000000-0000-0000-0000-000000000024'::uuid)
  from histoire.pack_event_audit where event_id='EVT-0941'),'retraits/remises attribués au faux administrateur');
select pg_temp.verifier(exists(select 1 from jsonb_array_elements(histoire.admin_list_packs()) p
  where p->>'id'='COL-0105' and (p->>'total')::int=397 and (p->>'scope_playable')::int=397),'administration et inventaire Sport');
set local request.jwt.claim.sub = '';
set local role anon;
select pg_temp.refuser('select * from histoire.event_answers','42501');
select pg_temp.refuser('select * from histoire.event_aliases','42501');
select pg_temp.refuser('select histoire.admin_list_packs()','42501');
select pg_temp.verifier(exists(select 1 from jsonb_array_elements(histoire.playable_packs(3)) p where p->>'id'='COL-0105'),'Sport dans catalogue vivant');
reset role;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
set local role authenticated;
select pg_temp.refuser('select histoire.admin_list_packs()','42501');
select pg_temp.refuser($q$select histoire.admin_remove_pack_event('COL-0106','EVT-0941')$q$,'42501');
select pg_temp.refuser($q$select histoire.admin_restore_pack_event('COL-0106','EVT-0941')$q$,'42501');
select pg_temp.refuser($q$select histoire.admin_edit_event('COL-0106','EVT-0941','Titre interdit',1)$q$,'42501');
select pg_temp.refuser($q$select histoire.admin_event_history('EVT-0941')$q$,'42501');
reset role;
set local request.jwt.claim.sub = '';
rollback;
