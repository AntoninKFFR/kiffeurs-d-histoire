-- Fin de partie (#143) : bilan après la fin seulement, compteurs multi du profil (parties, victoires).
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
create function pg_temp.salon() returns uuid language sql as $$ select (valeur->>'salon_id')::uuid from t where cle = 'salon' $$;
create function pg_temp.partie() returns uuid language sql security definer as $$
  select id from histoire.parties_multi where salon_id = pg_temp.salon() order by numero desc limit 1 $$;
create function pg_temp.q(n integer) returns histoire.parties_multi_questions language sql security definer as $$
  select * from histoire.parties_multi_questions where partie_id = pg_temp.partie() and position = n $$;
-- Pose la question n maintenant ; ou fait passer toutes les questions restantes.
create function pg_temp.poser(n integer) returns void language sql as $$
  update histoire.parties_multi_questions set posee_le = clock_timestamp() - interval '1 second',
    limite_le = clock_timestamp() + interval '29 seconds' where partie_id = pg_temp.partie() and position = n $$;
create function pg_temp.finir() returns void language plpgsql as $$
declare n integer; begin
  for n in 1..5 loop
    update histoire.parties_multi_questions set posee_le = clock_timestamp() - interval '40 seconds',
      limite_le = clock_timestamp() - interval '10 seconds' where partie_id = pg_temp.partie() and position = n and revelee_le is null;
    perform histoire.avancer_partie(pg_temp.partie());
  end loop;
end $$;

grant execute on function pg_temp.salon() to anon, authenticated;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000050';
insert into t values ('salon', histoire.creer_salon('convivial', 'prive', 4, '{"questions": 5}'::jsonb));
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000051';
select histoire.rejoindre_salon_par_lien(pg_temp.salon());
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
insert into t select 'invite', histoire.rejoindre_salon_par_lien(pg_temp.salon(), 'Lulu');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000050';
select histoire.lancer_partie(pg_temp.salon());
select pg_temp.verifier(histoire.bilan_partie(pg_temp.salon()) is null, 'pas de bilan pendant la partie');
select pg_temp.verifier(histoire.mes_stats_multi() = '{"parties": 0, "victoires": 0}', 'compteurs à zéro');
reset role;

-- Question 1 : l'hôte juste, le second compte loin, l'invité ne répond pas.
select pg_temp.poser(1);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000050';
select histoire.repondre_partie(pg_temp.salon(), (pg_temp.q(1)).id, (pg_temp.q(1)).expected_year);
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000051';
select histoire.repondre_partie(pg_temp.salon(), (pg_temp.q(1)).id, (pg_temp.q(1)).expected_year + 40);
reset role;
select pg_temp.finir();

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000050';
insert into t select 'bilan', histoire.bilan_partie(pg_temp.salon());
select pg_temp.verifier((select jsonb_array_length(valeur->'questions') = 5 and jsonb_array_length(valeur->'scores') = 3
  and jsonb_array_length(valeur->'questions'->0->'reponses') = 2
  and (valeur->'questions'->0->'reponses'->0->>'secondes')::numeric between 0 and 60
  and (valeur->'questions'->0->'correction'->'debut'->>'year')::integer = (pg_temp.q(1)).expected_year
  from t where cle = 'bilan'), 'bilan complet après la fin');
select pg_temp.verifier(histoire.mes_stats_multi() = '{"parties": 1, "victoires": 1}', 'hôte : 1 partie, 1 victoire');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000051';
select pg_temp.verifier(histoire.mes_stats_multi() = '{"parties": 1, "victoires": 0}', 'second : 1 partie, 0 victoire');
reset role;
-- L'invité voit le bilan ; il n'a pas de compteurs.
set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.verifier(histoire.bilan_partie(pg_temp.salon(), (select valeur->>'jeton' from t where cle = 'invite')) is not null, 'bilan pour l''invité');
select pg_temp.refuser('select histoire.mes_stats_multi()', '42501');
reset role;

-- Relance dans le même salon, mêmes joueurs : personne ne marque, personne ne gagne.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000050';
select histoire.lancer_partie(pg_temp.salon());
reset role;
select pg_temp.finir();
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000050';
select pg_temp.verifier(histoire.mes_stats_multi() = '{"parties": 2, "victoires": 1}', 'relance comptée, sans victoire à 0 point');
select pg_temp.verifier((histoire.bilan_partie(pg_temp.salon())->'partie'->>'numero')::integer = 2, 'bilan de la dernière partie');
reset role;
-- Statistiques solo inchangées : aucune partie solo pour ces comptes.
select pg_temp.verifier(not exists (select 1 from histoire.games where user_id in
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000051')), 'statistiques solo inchangées');
rollback;
