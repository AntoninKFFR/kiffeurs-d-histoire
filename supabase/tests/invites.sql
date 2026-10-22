-- Invités sans compte (#134) : pseudo, jeton qui expire, usurpation impossible, refus hors code/lien.
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
insert into t values ('comptes', to_jsonb((select count(*) from auth.users)));

-- Règles de pseudo.
select pg_temp.verifier(histoire.refus_pseudo_invite('Clément') is null, 'pseudo normal accepté');
select pg_temp.verifier(histoire.refus_pseudo_invite('Jean-Mi 13') is null, 'tiret, espace et chiffres acceptés');
select pg_temp.verifier(histoire.refus_pseudo_invite('Hercule') is null, '« cul » dans un mot accepté');
select pg_temp.verifier(histoire.refus_pseudo_invite('Conrad') is null, '« con » dans un mot accepté');
select pg_temp.verifier(histoire.refus_pseudo_invite('Al') is not null, 'moins de 3 caractères refusé');
select pg_temp.verifier(histoire.refus_pseudo_invite('Abcdefghijklmnopq') is not null, 'plus de 16 caractères refusé');
select pg_temp.verifier(histoire.refus_pseudo_invite('<script>') is not null, 'caractères spéciaux refusés');
select pg_temp.verifier(histoire.refus_pseudo_invite('C0NN4RD') is not null, 'grossièreté déguisée refusée');
select pg_temp.verifier(histoire.refus_pseudo_invite('gros pd') is not null, 'mot court grossier refusé');
select pg_temp.verifier(histoire.refus_pseudo_invite('Enculé') is not null, 'grossièreté accentuée refusée');
select pg_temp.verifier(histoire.refus_pseudo_invite('Admin') is not null, 'nom réservé refusé');
select pg_temp.verifier(histoire.refus_pseudo_invite('Hôte du salon') is not null, 'se faire passer pour l''hôte refusé');

-- Un salon Convivial et un salon 1 contre 1.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
insert into t values ('a', histoire.creer_salon());
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
insert into t values ('duel', histoire.creer_salon('un_contre_un'));
reset role;

set local role anon;
set local request.jwt.claim.sub = '';
-- Par code et par lien, avec un pseudo nettoyé (espaces en trop).
insert into t select 'g1', histoire.rejoindre_salon((select valeur->>'code' from t where cle = 'a'), '  Clément   B ');
insert into t select 'g2', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'a'), 'Sarah');
select pg_temp.verifier((select valeur->>'jeton' ~ '^[a-f0-9]{64}$' from t where cle = 'g1'), 'jeton secret rendu à l''invité');
select pg_temp.verifier((select valeur->'membres'->1->>'pseudo' = 'Clément B' and (valeur->'membres'->1->>'invite')::boolean
  from (select histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'), (select valeur->>'jeton' from t where cle = 'g1')) as valeur) x),
  'invité marqué et pseudo nettoyé');
select pg_temp.refuser(format('select histoire.rejoindre_salon(%L, %L)', (select valeur->>'code' from t where cle = 'a'), 'Salope'), '22023');
select pg_temp.refuser(format('select histoire.rejoindre_salon(%L, %L)', (select valeur->>'code' from t where cle = 'a'), 'sarah'), '22023');

-- Refusé : 1 contre 1, création de salon.
select pg_temp.refuser(format('select histoire.rejoindre_salon(%L, %L)', (select valeur->>'code' from t where cle = 'duel'), 'Paulo'), '42501');
select pg_temp.refuser('select histoire.creer_salon()', '42501');

-- Usurpation : sans jeton, avec un jeton inventé, ou avec le jeton d'un autre salon.
select pg_temp.refuser(format('select histoire.etat_salon(%L)', (select valeur->>'salon_id' from t where cle = 'a')), '42501');
select pg_temp.refuser(format('select histoire.etat_salon(%L, %L)', (select valeur->>'salon_id' from t where cle = 'a'), repeat('a', 64)), '42501');
select pg_temp.refuser(format('select histoire.quitter_salon(%L, %L)', (select valeur->>'salon_id' from t where cle = 'duel'), (select valeur->>'jeton' from t where cle = 'g1')), '42501');
-- Un invité n'est jamais hôte : il ne peut pas expulser.
select pg_temp.refuser(format('select histoire.expulser_membre(%L, %L, %L)', (select valeur->>'salon_id' from t where cle = 'a'),
  (select valeur->>'membre_id' from t where cle = 'g2'), (select valeur->>'jeton' from t where cle = 'g1')), '42501');
-- L'état du salon ne montre aucun jeton.
select pg_temp.verifier((select histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'), valeur->>'jeton')::text !~ '[a-f0-9]{64}' from t where cle = 'g1'),
  'aucun jeton dans l''état du salon');

-- Jeton expiré (24 h) : refusé.
reset role;
update histoire.salon_membres set jeton_expire_le = clock_timestamp() - interval '1 second' where id = (select (valeur->>'membre_id')::uuid from t where cle = 'g2');
set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.refuser(format('select histoire.etat_salon(%L, %L)', (select valeur->>'salon_id' from t where cle = 'a'), (select valeur->>'jeton' from t where cle = 'g2')), '42501');
reset role;
select pg_temp.verifier((select jeton_expire_le between clock_timestamp() + interval '23 hours' and clock_timestamp() + interval '24 hours'
  from histoire.salon_membres where id = (select (valeur->>'membre_id')::uuid from t where cle = 'g1')), 'jeton valable 24 h');

-- Un compte qui ouvre un lien entre avec son pseudo KFFR, sans jeton.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
insert into t select 'c', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'a'), 'Pseudo ignoré');
select pg_temp.verifier((select not valeur ? 'jeton' from t where cle = 'c'), 'compte sans jeton');
select pg_temp.verifier((select not exists (select 1 from jsonb_array_elements(histoire.etat_salon((valeur->>'salon_id')::uuid)->'membres') x
  where x->>'pseudo' = 'Pseudo ignoré') from t where cle = 'a'), 'pseudo du compte, pas celui fourni');
reset role;

-- Aucun compte créé.
select pg_temp.verifier((select count(*) = (select valeur::bigint from t where cle = 'comptes') from auth.users), 'aucun compte créé');
rollback;
