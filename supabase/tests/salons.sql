-- Salons multijoueur (#133). Tests exclusivement locaux/CI : comptes fictifs du simulateur.
begin;
create function pg_temp.verifier(condition boolean, description text) returns void
language plpgsql as $$ begin
  if condition is not true then raise exception 'ÉCHEC : %', description; end if;
end $$;
create function pg_temp.refuser(query text, expected_state text) returns void
language plpgsql as $$ begin
  begin
    execute query;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'ÉCHEC : requête acceptée : %', query;
end $$;
create temp table t(cle text primary key, valeur jsonb);
grant all on t to anon, authenticated;

-- Code JJ/MM/AAAA : lecture stricte et tirage hors dates interdites.
select pg_temp.verifier(histoire.lire_code_salon('14/07/1789') = date '1789-07-14', 'code lu');
select pg_temp.verifier(histoire.lire_code_salon(' 3.2.1515 ') = date '1515-02-03', 'séparateurs tolérés');
select pg_temp.verifier(histoire.lire_code_salon('31/02/2020') is null, 'faux jour refusé');
select pg_temp.verifier(histoire.lire_code_salon('1789-07-14') is null, 'format ISO refusé');
select pg_temp.verifier(histoire.format_code_salon(date '1066-10-04') = '04/10/1066', 'format JJ/MM/AAAA');
select pg_temp.verifier(
  (select bool_and(d between date '1000-01-01' and date '2025-12-31' and not d = any(histoire.codes_salon_interdits()))
   from (select histoire.tirer_code_salon() d from generate_series(1, 3000)) x),
  'codes tirés valides et hors dates trop connues');

-- 1. Un compte crée un salon Convivial.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
insert into t values ('a', histoire.creer_salon('convivial', 'prive', null, '{"questions": 5}'));
select pg_temp.verifier((select valeur->>'code' ~ '^\d{2}/\d{2}/\d{4}$' and not valeur ? 'jeton' from t where cle = 'a'), 'code JJ/MM/AAAA sans jeton');
select pg_temp.refuser('select * from histoire.salons', '42501');
select pg_temp.refuser('select * from histoire.salon_membres', '42501');
select pg_temp.refuser('select * from histoire.parties_multi_questions', '42501');
select pg_temp.refuser('select histoire.retirer_membre(gen_random_uuid())', '42501');
select pg_temp.refuser($$select histoire.creer_salon('convivial', 'prive', 11)$$, '22023');
select pg_temp.refuser($$select histoire.creer_salon('convivial', 'prive', 8, '{"questions": 7}')$$, '22023');
select pg_temp.refuser($$select histoire.creer_salon('convivial', 'prive', 8, '{"triche": true}')$$, '22023');
select pg_temp.refuser($$select histoire.creer_salon('convivial', 'prive', 8, '{"contenu": {"choix": "pick_ban"}}')$$, '22023');
select pg_temp.verifier((select (histoire.etat_salon((valeur->>'salon_id')::uuid)->'salon'->'reglages') =
  '{"questions": 5, "precision": "YEAR", "questions_periode": false, "mode_visible": false, "mode_chrono": false,
    "contenu": {"choix": "direct", "categories": ["pack"], "cible": null}}'::jsonb from t where cle = 'a'), 'réglages par défaut complétés');

-- 2. Invités : pseudo obligatoire et unique dans le salon ; anon ne crée pas de salon.
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
set local request.headers = '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}';
select pg_temp.refuser($$select histoire.creer_salon()$$, '42501');
select pg_temp.refuser('select * from histoire.salons', '42501');
insert into t select 'g1', histoire.rejoindre_salon((select valeur->>'code' from t where cle = 'a'), 'Clément');
select pg_temp.verifier((select valeur->>'jeton' ~ '^[a-f0-9]{64}$' from t where cle = 'g1'), 'jeton invité');
select pg_temp.refuser(format('select histoire.rejoindre_salon(%L, %L)', (select valeur->>'code' from t where cle = 'a'), 'clément'), '22023');
select pg_temp.refuser(format('select histoire.rejoindre_salon(%L, %L)', (select valeur->>'code' from t where cle = 'a'), 'x'), '22023');
select pg_temp.refuser(format('select histoire.etat_salon(%L)', (select valeur->>'salon_id' from t where cle = 'a')), '42501');
select pg_temp.refuser(format('select histoire.etat_salon(%L, %L)', (select valeur->>'salon_id' from t where cle = 'a'), repeat('a', 64)), '42501');

-- 3. Anti-devinette : un code faux est compté, le 21e essai en 10 minutes est refusé.
select pg_temp.verifier(histoire.rejoindre_salon('31/02/2020', 'Sarah') = '{"erreur": "code_inconnu"}', 'code faux sans exception');
do $$ begin
  for i in 2..20 loop perform histoire.rejoindre_salon('01/01/0999', 'Sarah'); end loop;
end $$;
select pg_temp.refuser(format('select histoire.rejoindre_salon(%L, %L)', (select valeur->>'code' from t where cle = 'a'), 'Sarah'), '53400');
set local request.headers = '{"x-forwarded-for": "198.51.100.9"}';
insert into t select 'g2', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'a'), 'Sarah');

-- 4. Un second compte rejoint par le lien ; l'état ne montre ni jeton ni compte.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
insert into t select 'b', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'a'));
insert into t select 'etat', histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'));
select pg_temp.verifier((select jsonb_array_length(valeur->'membres') = 4 and valeur->'membres'->0->>'est_hote' = 'true'
  and valeur->'membres'->1->>'pseudo' = 'Clément' and valeur->'membres'->1->>'invite' = 'true'
  and valeur::text !~ 'jeton|user_id|00000000-0000-0000-0000-00000000002' from t where cle = 'etat'), 'membres ordonnés, rien de secret');
select pg_temp.verifier((select (valeur->>'membre_id') = (histoire.rejoindre_salon_par_lien((valeur->>'salon_id')::uuid)->>'membre_id') from t where cle = 'b'), 'rejoindre deux fois ne duplique pas');

-- 5. Réglages : l'hôte seul ; le salon ne descend pas sous le nombre de présents.
select pg_temp.refuser(format($$select histoire.modifier_salon(%L, null, '{"questions": 20}')$$, (select valeur->>'salon_id' from t where cle = 'a')), '42501');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
select pg_temp.verifier((select histoire.modifier_salon((valeur->>'salon_id')::uuid, null,
  '{"mode_visible": true, "contenu": {"choix": "vote", "categories": ["pack", "theme"]}}', 'ouvert')->'salon'->'reglages'->>'mode_visible' = 'true'
  from t where cle = 'a'), 'l''hôte change les réglages');
select pg_temp.verifier((select r->>'questions' = '5' and r->'contenu'->>'choix' = 'vote' from
  (select histoire.etat_salon((valeur->>'salon_id')::uuid)->'salon'->'reglages' r from t where cle = 'a') x), 'fusion des réglages');
select pg_temp.refuser(format('select histoire.modifier_salon(%L, null, null, null, 3)', (select valeur->>'salon_id' from t where cle = 'a')), '22023');
select pg_temp.refuser(format($$select histoire.modifier_salon(%L, null, '{"contenu": {"categories": ["pack", "pack"]}}')$$, (select valeur->>'salon_id' from t where cle = 'a')), '22023');
select pg_temp.refuser(format($$select histoire.modifier_salon(%L, null, '{"contenu": {"cible": {"type": "pack"}}}')$$, (select valeur->>'salon_id' from t where cle = 'a')), '22023');

-- 6. L'hôte part : la couronne va au joueur arrivé juste après (ici l'invité Clément).
select histoire.quitter_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'));
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
insert into t select 'etat2', histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'), (select valeur->>'jeton' from t where cle = 'g1'));
select pg_temp.verifier((select valeur->'membres'->0->>'pseudo' = 'Clément' and valeur->'membres'->0->>'est_hote' = 'true'
  and jsonb_array_length(valeur->'membres') = 3 from t where cle = 'etat2'), 'couronne transmise');

-- 7. Le nouvel hôte expulse le compte B, qui ne peut plus revenir.
select histoire.expulser_membre((select (valeur->>'salon_id')::uuid from t where cle = 'a'),
  (select (valeur->>'membre_id')::uuid from t where cle = 'b'), (select valeur->>'jeton' from t where cle = 'g1'));
select pg_temp.refuser(format('select histoire.expulser_membre(%L, %L, %L)', (select valeur->>'salon_id' from t where cle = 'a'),
  (select valeur->>'membre_id' from t where cle = 'g1'), (select valeur->>'jeton' from t where cle = 'g2')), '42501');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
select pg_temp.refuser(format('select histoire.rejoindre_salon_par_lien(%L)', (select valeur->>'salon_id' from t where cle = 'a')), '42501');

-- 8. 1 contre 1 : deux places, pas d'invité, et un compte n'est que dans un salon à la fois.
insert into t select 'duel', histoire.creer_salon('un_contre_un', 'prive', 8);
select pg_temp.verifier((select histoire.etat_salon((valeur->>'salon_id')::uuid)->'salon'->>'max_joueurs' = '2'
  and histoire.etat_salon((valeur->>'salon_id')::uuid)->'salon'->'reglages'->'contenu'->>'choix' = 'pick_ban' from t where cle = 'duel'), '1 contre 1 à deux, pick & ban par défaut');
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.refuser(format('select histoire.rejoindre_salon_par_lien(%L, %L)', (select valeur->>'salon_id' from t where cle = 'duel'), 'Invité'), '42501');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
insert into t select 'b2', histoire.creer_salon();
reset role;
select pg_temp.verifier(not exists (select 1 from histoire.salons where id = (select (valeur->>'salon_id')::uuid from t where cle = 'duel')),
  'changer de salon ferme le salon laissé vide');

-- 9. Les derniers partent : salon supprimé, code libéré et réutilisable.
set local role anon;
set local request.jwt.claim.sub = '';
select histoire.quitter_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'), (select valeur->>'jeton' from t where cle = 'g1'));
select histoire.quitter_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'), (select valeur->>'jeton' from t where cle = 'g2'));
reset role;
select pg_temp.verifier(not exists (select 1 from histoire.salons where id = (select (valeur->>'salon_id')::uuid from t where cle = 'a'))
  and not exists (select 1 from histoire.salon_exclus where salon_id = (select (valeur->>'salon_id')::uuid from t where cle = 'a')), 'salon vide supprimé');
insert into histoire.salons(code, mode, max_joueurs, reglages, cree_par)
  select histoire.lire_code_salon(valeur->>'code'), 'convivial', 8, '{}', gen_random_uuid() from t where cle = 'a';
select pg_temp.refuser(format($$insert into histoire.salons(code, mode, max_joueurs, reglages, cree_par) values (%L, 'convivial', 8, '{}', gen_random_uuid())$$,
  (select histoire.lire_code_salon(valeur->>'code') from t where cle = 'a')), '23505');

-- 10. Purge des salons inactifs depuis plus de 2 heures.
update histoire.salons set activite_le = clock_timestamp() - interval '3 hours'
  where id = (select (valeur->>'salon_id')::uuid from t where cle = 'b2');
select histoire.purger_salons();
select pg_temp.verifier(not exists (select 1 from histoire.salon_membres where user_id = '00000000-0000-0000-0000-000000000025'), 'salon inactif purgé');

-- 11. Réponses : aucune colonne de partie lisible par les rôles API.
select pg_temp.verifier(not has_table_privilege('anon', 'histoire.parties_multi_questions', 'select')
  and not has_table_privilege('authenticated', 'histoire.parties_multi_questions', 'select')
  and not has_table_privilege('authenticated', 'histoire.parties_multi_reponses', 'select')
  and not has_function_privilege('anon', 'histoire.creer_salon(text, text, integer, jsonb)', 'execute'),
  'tables de partie fermées');
rollback;
