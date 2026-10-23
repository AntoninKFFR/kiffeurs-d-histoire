-- Vote et Thème Mystère (#144) : propositions des catégories cochées, votes visibles et modifiables, clôture
-- quand tout le monde a voté ou à la fin du chrono, égalité tranchée par la roulette ; Mystère tiré par le serveur.
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
create function pg_temp.jeton() returns text language sql as $$ select valeur->>'jeton' from t where cle = 'invite' $$;
create function pg_temp.partie() returns histoire.parties_multi language sql security definer as $$
  select * from histoire.parties_multi where salon_id = pg_temp.salon() order by numero desc limit 1 $$;
create function pg_temp.reglages(contenu jsonb) returns void language sql security definer as $$
  update histoire.salons set reglages = jsonb_set(reglages, '{contenu}', reglages->'contenu' || contenu) where id = pg_temp.salon() $$;
-- Termine la partie en cours (toutes les questions échues).
create function pg_temp.finir() returns void language plpgsql security definer as $$
declare n integer; begin
  for n in 1..5 loop
    update histoire.parties_multi_questions set posee_le = clock_timestamp() - interval '40 seconds',
      limite_le = clock_timestamp() - interval '10 seconds' where partie_id = (pg_temp.partie()).id and position = n and revelee_le is null;
    perform histoire.avancer_partie((pg_temp.partie()).id);
  end loop;
end $$;
create function pg_temp.echoir_vote() returns void language sql security definer as $$
  update histoire.parties_multi set vote_fin = clock_timestamp() - interval '1 second' where id = (pg_temp.partie()).id $$;
grant execute on function pg_temp.salon(), pg_temp.jeton() to anon, authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000060';
insert into t values ('salon', histoire.creer_salon('convivial', 'prive', 4, '{"questions": 5}'::jsonb));
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000061';
select histoire.rejoindre_salon_par_lien(pg_temp.salon());
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
insert into t select 'invite', histoire.rejoindre_salon_par_lien(pg_temp.salon(), 'Lulu');
reset role;

-- 1. Vote : trois propositions, une par catégorie cochée.
select pg_temp.reglages('{"choix": "vote", "categories": ["pack", "periode", "theme"]}');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000060';
select histoire.lancer_partie(pg_temp.salon());
insert into t select 'vote', histoire.etat_partie(pg_temp.salon());
select pg_temp.verifier((select valeur->'partie'->>'etat' = 'vote' and valeur->'question' = 'null'::jsonb
  and valeur->'prochaine' = 'null'::jsonb and valeur->'partie'->>'total' = '5'
  and (select array_agg(e->>'type' order by e->>'type') from jsonb_array_elements(valeur->'vote'->'propositions') e) = array['pack', 'periode', 'theme']
  and jsonb_array_length(valeur->'vote'->'votes') = 0 and (valeur->'vote'->>'duree')::numeric = 15
  and (valeur->'vote'->>'fin')::timestamptz between clock_timestamp() + interval '14 seconds' and clock_timestamp() + interval '16 seconds'
  from t where cle = 'vote'), 'vote ouvert : trois propositions, 15 s');
select pg_temp.verifier(histoire.etat_salon(pg_temp.salon())->'salon'->>'etat' = 'partie', 'salon en partie pendant le vote');
select pg_temp.refuser(format('select histoire.voter_partie(%L, 3)', pg_temp.salon()), '22023');
select histoire.voter_partie(pg_temp.salon(), 0);
select histoire.voter_partie(pg_temp.salon(), 1);
reset role;
-- Les votes ne se lisent que par etat_partie.
set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.refuser('select * from histoire.parties_multi_votes', '42501');
select histoire.voter_partie(pg_temp.salon(), 1, pg_temp.jeton());
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000061';
insert into t select 'vote2', histoire.etat_partie(pg_temp.salon());
select pg_temp.verifier((select valeur->'partie'->>'etat' = 'vote' and jsonb_array_length(valeur->'vote'->'votes') = 2
  and (select count(*) from jsonb_array_elements(valeur->'vote'->'votes') v where v->>'choix' = '1') = 2
  from t where cle = 'vote2'), 'votes visibles, l''hôte a changé d''avis');
-- Dernier vote : clôture immédiate, la proposition 1 l'emporte (3 voix contre 0), sans roulette.
select histoire.voter_partie(pg_temp.salon(), 2);
insert into t select 'joue', histoire.etat_partie(pg_temp.salon());
select pg_temp.verifier((select valeur->'partie'->>'etat' = 'en_cours' and valeur->'tirage' = 'null'::jsonb
  and valeur->'vote' = 'null'::jsonb and valeur->'partie'->'contenu' = (select valeur->'vote'->'propositions'->1 from t where cle = 'vote')
  and valeur->'prochaine'->>'position' = '1'
  and (valeur->'prochaine'->>'posee_le')::timestamptz between clock_timestamp() + interval '2 seconds' and clock_timestamp() + interval '4 seconds'
  from t where cle = 'joue'), 'vote clos dès que tout le monde a voté : la majorité l''emporte');
select pg_temp.refuser(format('select histoire.voter_partie(%L, 0)', pg_temp.salon()), '55000');
reset role;
select pg_temp.verifier((select count(*) = 5 from histoire.parties_multi_questions where partie_id = (pg_temp.partie()).id), 'questions tirées à la clôture');
select pg_temp.finir();

-- 2. Égalité (une voix partout, l'invité ne vote pas) à la fin du chrono : la roulette tranche entre les ex æquo.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000060';
select histoire.lancer_partie(pg_temp.salon());
select histoire.voter_partie(pg_temp.salon(), 0);
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000061';
select histoire.voter_partie(pg_temp.salon(), 2);
select pg_temp.verifier(histoire.etat_partie(pg_temp.salon())->'partie'->>'etat' = 'vote', 'vote ouvert tant que l''invité n''a pas voté');
reset role;
select pg_temp.echoir_vote();
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000061';
insert into t select 'egalite', histoire.etat_partie(pg_temp.salon());
select pg_temp.verifier((select valeur->'partie'->>'etat' = 'en_cours'
  and jsonb_array_length(valeur->'tirage'->'candidats') = 2
  and valeur->'partie'->'contenu' = valeur->'tirage'->'gagnant'
  and (valeur->'prochaine'->>'posee_le')::timestamptz >= (valeur->'tirage'->>'fin')::timestamptz + interval '3 seconds'
  from t where cle = 'egalite'), 'égalité : roulette entre les ex æquo, puis le décompte');
reset role;
select pg_temp.verifier((select p.contenu = p.tirage->'gagnant' and exists (select 1 from jsonb_array_elements(p.propositions) e
  where e = p.tirage->'gagnant') and not exists (select 1 from jsonb_array_elements(p.tirage->'candidats') c
  where c not in (p.propositions->0, p.propositions->2)) from pg_temp.partie() p), 'candidats = les deux ex æquo');
select pg_temp.finir();

-- 3. Personne ne vote : les trois propositions à égalité.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000060';
select histoire.lancer_partie(pg_temp.salon());
reset role;
select pg_temp.echoir_vote();
select histoire.avancer_partie((pg_temp.partie()).id);
select pg_temp.verifier((select etat = 'en_cours' and jsonb_array_length(tirage->'candidats') = 3 from pg_temp.partie()),
  'aucun vote : roulette entre les trois');
select pg_temp.finir();

-- 4. Mystère : tiré par le serveur dans les catégories cochées, le même pour tout le salon.
select pg_temp.reglages('{"choix": "mystere", "categories": ["periode"]}');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000060';
select histoire.lancer_partie(pg_temp.salon());
insert into t select 'mystere', histoire.etat_partie(pg_temp.salon());
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
insert into t select 'mystere_invite', histoire.etat_partie(pg_temp.salon(), pg_temp.jeton());
reset role;
select pg_temp.verifier((select valeur->'partie'->>'etat' = 'en_cours' and valeur->'tirage'->'gagnant'->>'type' = 'periode'
  and (select bool_and(c->>'type' = 'periode') from jsonb_array_elements(valeur->'tirage'->'candidats') c)
  and jsonb_array_length(valeur->'tirage'->'candidats') between 1 and 6
  and valeur->'partie'->'contenu'->>'id' = valeur->'tirage'->'gagnant'->>'id'
  and valeur->'partie'->'contenu'->>'mystere' = 'true'
  and (valeur->'prochaine'->>'posee_le')::timestamptz >= (valeur->'tirage'->>'fin')::timestamptz + interval '3 seconds'
  and (valeur->'tirage'->>'fin')::timestamptz between clock_timestamp() + interval '5 seconds' and clock_timestamp() + interval '7 seconds'
  from t where cle = 'mystere'), 'Mystère : une période, roulette de 6 s puis décompte');
select pg_temp.verifier((select a.valeur->'tirage' = b.valeur->'tirage' from t a, t b where a.cle = 'mystere' and b.cle = 'mystere_invite'),
  'même tirage pour tout le salon');
select pg_temp.verifier((select bool_and((b.de is null or q.expected_year >= b.de) and (b.a is null or q.expected_year <= b.a))
  from histoire.parties_multi_questions q, pg_temp.partie() p, histoire.bornes_periode_multi(p.contenu->>'id') b
  where q.partie_id = p.id), 'questions dans la période tirée');
rollback;
