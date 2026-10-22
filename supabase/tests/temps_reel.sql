-- Temps réel des salons (#135) : battement, absents retirés, heure serveur, capacité.
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

select pg_temp.verifier(abs(histoire.heure_serveur() - (extract(epoch from clock_timestamp()) * 1000)::bigint) < 1000, 'heure serveur en ms');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
insert into t values ('a', histoire.creer_salon());
select pg_temp.refuser(format('select histoire.retirer_absents(%L)', (select valeur->>'salon_id' from t where cle = 'a')), '42501');
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
insert into t select 'g', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'a'), 'Lulu');
select pg_temp.verifier((select (histoire.battement_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'), valeur->>'jeton')->>'version')::integer >= 2 from t where cle = 'g'), 'battement invité');

-- Coupure de 10 s : la place est gardée.
reset role;
update histoire.salon_membres set vu_le = clock_timestamp() - interval '10 seconds' where id = (select (valeur->>'membre_id')::uuid from t where cle = 'g');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
select histoire.battement_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'));
select pg_temp.verifier((select jsonb_array_length(histoire.etat_salon((valeur->>'salon_id')::uuid)->'membres') = 2 from t where cle = 'a'), 'coupure de 10 s sans perte de place');

-- Absent depuis 40 s : retiré au battement suivant d'un autre membre.
reset role;
update histoire.salon_membres set vu_le = clock_timestamp() - interval '40 seconds' where id = (select (valeur->>'membre_id')::uuid from t where cle = 'g');
set local role authenticated;
select histoire.battement_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'));
select pg_temp.verifier((select jsonb_array_length(histoire.etat_salon((valeur->>'salon_id')::uuid)->'membres') = 1 from t where cle = 'a'), 'absent retiré après 30 s');
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.refuser(format('select histoire.battement_salon(%L, %L)', (select valeur->>'salon_id' from t where cle = 'a'), (select valeur->>'jeton' from t where cle = 'g')), '42501');

-- L'hôte absent perd la couronne au profit du suivant.
insert into t select 'g2', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'a'), 'Sarah');
reset role;
update histoire.salon_membres set vu_le = clock_timestamp() - interval '40 seconds' where id = (select (valeur->>'membre_id')::uuid from t where cle = 'a');
set local role anon;
set local request.jwt.claim.sub = '';
select histoire.battement_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'), (select valeur->>'jeton' from t where cle = 'g2'));
select pg_temp.verifier((select (histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'a'), valeur->>'jeton')->'membres'->0->>'est_hote')::boolean from t where cle = 'g2'), 'couronne transmise après absence');

-- Capacité : les nouveaux salons sont refusés avant les arrivées dans un salon existant.
reset role;
update histoire.limites_temps_reel set max_connexions = 2, reserve_salons = 1;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
select pg_temp.refuser('select histoire.creer_salon()', '53400');
insert into t select 'b', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'a'));
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.refuser(format('select histoire.rejoindre_salon_par_lien(%L, %L)', (select valeur->>'salon_id' from t where cle = 'a'), 'Clément'), '53400');
reset role;
select pg_temp.verifier(not has_table_privilege('anon', 'histoire.limites_temps_reel', 'select'), 'limites privées');
rollback;
