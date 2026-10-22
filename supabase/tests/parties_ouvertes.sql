-- Parties ouvertes (#137) : comptes seulement, salons privés absents, entrée pendant une partie.
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

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
insert into t values ('ouvert', histoire.creer_salon('convivial', 'ouvert', 4));
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
insert into t values ('prive', histoire.creer_salon('convivial', 'prive'));
insert into t values ('liste', histoire.parties_ouvertes());
select pg_temp.verifier((select jsonb_array_length(valeur) = 1 and valeur->0->>'id' = (select valeur->>'salon_id' from t where cle = 'ouvert')
  from t where cle = 'liste'), 'seul le salon ouvert est listé');
select pg_temp.verifier((select valeur->0->>'joueurs' = '1' and valeur->0->>'max_joueurs' = '4' and valeur->0->>'etat' = 'attente'
  and not (valeur->0 ? 'code') and (valeur->0->>'moi')::boolean = false from t where cle = 'liste'), 'résumé sans code');
reset role;

-- Invité : refusé.
set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.refuser('select histoire.parties_ouvertes()', '42501');
reset role;

-- Partie en cours : le salon reste listé et on peut y entrer pour attendre la suivante.
update histoire.salons set etat = 'partie' where id = (select (valeur->>'salon_id')::uuid from t where cle = 'ouvert');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
select pg_temp.verifier((select histoire.parties_ouvertes()->0->>'etat' = 'partie'), 'partie en cours affichée');
insert into t select 'entree', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'ouvert'));
select pg_temp.verifier((select histoire.parties_ouvertes()->0->>'joueurs' = '2' and (histoire.parties_ouvertes()->0->>'moi')::boolean), 'entré pour attendre');
select pg_temp.verifier((select (histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'ouvert'))->'membres'->1->>'en_attente')::boolean), 'arrivé pendant la partie : en attente');
-- Seul l'hôte accepte.
select pg_temp.refuser(format('select histoire.accepter_membre(%L, %L)', (select valeur->>'salon_id' from t where cle = 'ouvert'), (select valeur->>'membre_id' from t where cle = 'entree')), '42501');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
select pg_temp.verifier((select (histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'ouvert'))->'membres'->0->>'en_attente')::boolean = false), 'hôte jamais en attente');
select histoire.accepter_membre((select (valeur->>'salon_id')::uuid from t where cle = 'ouvert'), (select (valeur->>'membre_id')::uuid from t where cle = 'entree'));
select pg_temp.verifier((select (histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'ouvert'))->'membres'->1->>'en_attente')::boolean = false), 'accepté par l''hôte');
reset role;
-- Salon complet : refusé.
update histoire.salons set max_joueurs = 2 where id = (select (valeur->>'salon_id')::uuid from t where cle = 'ouvert');
set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.refuser(format('select histoire.rejoindre_salon_par_lien(%L, %L)', (select valeur->>'salon_id' from t where cle = 'ouvert'), 'Gaston'), '55000');
reset role;
update histoire.salons set max_joueurs = 4 where id = (select (valeur->>'salon_id')::uuid from t where cle = 'ouvert');

-- Exclu : le salon disparaît de sa liste.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
select histoire.expulser_membre((select (valeur->>'salon_id')::uuid from t where cle = 'ouvert'), (select (valeur->>'membre_id')::uuid from t where cle = 'entree'));
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000025';
select pg_temp.verifier((select jsonb_array_length(histoire.parties_ouvertes()) = 0), 'salon caché à un exclu');
reset role;
rollback;
