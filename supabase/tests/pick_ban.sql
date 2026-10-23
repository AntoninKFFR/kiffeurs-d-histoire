-- 1 contre 1 avec pick & ban (#145) : sept propositions, un ban chacun son tour, ban au hasard quand le temps est
-- écoulé, la dernière proposition est jouée ; le même pick & ban pour les deux joueurs.
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
create function pg_temp.partie() returns histoire.parties_multi language sql security definer as $$
  select * from histoire.parties_multi where salon_id = pg_temp.salon() order by numero desc limit 1 $$;
create function pg_temp.reglages(contenu jsonb) returns void language sql security definer as $$
  update histoire.salons set reglages = jsonb_set(reglages, '{contenu}', reglages->'contenu' || contenu) where id = pg_temp.salon() $$;
-- Le joueur dont c'est le tour (sub du JWT), d'après l'ordre tiré au lancement.
create function pg_temp.joueur(tour integer) returns text language sql security definer as $$
  select coalesce(m.user_id::text, '') from histoire.salon_membres m
  where m.id = (pg_temp.partie()).pick_ordre[tour % 2 + 1] $$;
create function pg_temp.reculer(secondes integer) returns void language sql security definer as $$
  update histoire.parties_multi set pick_debut = pick_debut - make_interval(secs => secondes) where id = (pg_temp.partie()).id;
  update histoire.parties_multi_bans set banni_le = banni_le - make_interval(secs => secondes) where partie_id = (pg_temp.partie()).id $$;
create function pg_temp.finir() returns void language plpgsql security definer as $$
declare n integer; begin
  for n in 1..5 loop
    update histoire.parties_multi_questions set posee_le = clock_timestamp() - interval '40 seconds',
      limite_le = clock_timestamp() - interval '10 seconds' where partie_id = (pg_temp.partie()).id and position = n and revelee_le is null;
    perform histoire.avancer_partie((pg_temp.partie()).id);
  end loop;
end $$;
grant execute on function pg_temp.salon() to anon, authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000070';
insert into t values ('salon', histoire.creer_salon('un_contre_un', 'prive', 2, '{"questions": 5}'::jsonb));
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000071';
select histoire.rejoindre_salon_par_lien(pg_temp.salon());
reset role;

-- 1. Lancement : sept propositions variées (périodes et thèmes ; moins si le catalogue n'en a pas sept), personne
-- n'a encore banni.
select pg_temp.reglages('{"choix": "pick_ban", "categories": ["periode", "theme"]}');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000070';
select histoire.lancer_partie(pg_temp.salon());
insert into t select 'hote', histoire.etat_partie(pg_temp.salon());
reset role;
select pg_temp.verifier((select valeur->'partie'->>'etat' = 'pick_ban' and valeur->'question' = 'null'::jsonb
  and jsonb_array_length(valeur->'pick_ban'->'propositions') = least(7, (select count(*) from histoire.contenus_multi(array['periode', 'theme'], 'YEAR', 5)))
  and jsonb_array_length(valeur->'pick_ban'->'propositions') >= 4
  and (select count(distinct e->>'type') from jsonb_array_elements(valeur->'pick_ban'->'propositions') e) = 2
  and (select count(distinct e->>'id') from jsonb_array_elements(valeur->'pick_ban'->'propositions') e) = jsonb_array_length(valeur->'pick_ban'->'propositions')
  and jsonb_array_length(valeur->'pick_ban'->'ordre') = 2 and jsonb_array_length(valeur->'pick_ban'->'bans') = 0
  and (valeur->'pick_ban'->>'duree')::numeric = 10
  and (valeur->'pick_ban'->>'tour_fin')::timestamptz between clock_timestamp() + interval '9 seconds' and clock_timestamp() + interval '11 seconds'
  from t where cle = 'hote'), 'pick & ban ouvert : 7 propositions variées, 10 s par tour');
select pg_temp.verifier(histoire.etat_salon(pg_temp.salon())->'salon'->>'etat' = 'partie', 'salon en partie pendant le pick & ban');

-- 2. Chacun son tour.
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.joueur(1), true);
select pg_temp.refuser(format('select histoire.bannir_partie(%L, 0)', pg_temp.salon()), '55000');
select set_config('request.jwt.claim.sub', pg_temp.joueur(0), true);
select pg_temp.refuser(format('select histoire.bannir_partie(%L, 7)', pg_temp.salon()), '22023');
select histoire.bannir_partie(pg_temp.salon(), 0);
select pg_temp.refuser(format('select histoire.bannir_partie(%L, 1)', pg_temp.salon()), '55000');
select set_config('request.jwt.claim.sub', pg_temp.joueur(1), true);
select pg_temp.refuser(format('select histoire.bannir_partie(%L, 0)', pg_temp.salon()), '22023');
select histoire.bannir_partie(pg_temp.salon(), 1);
insert into t select 'invite', histoire.etat_partie(pg_temp.salon());
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000070';
insert into t select 'hote2', histoire.etat_partie(pg_temp.salon());
reset role;
select pg_temp.verifier((select a.valeur->'pick_ban' = b.valeur->'pick_ban' and jsonb_array_length(a.valeur->'pick_ban'->'bans') = 2
  and (select bool_and(not (x->>'hasard')::boolean) from jsonb_array_elements(a.valeur->'pick_ban'->'bans') x)
  from t a, t b where a.cle = 'invite' and b.cle = 'hote2'), 'même pick & ban chez les deux joueurs');

-- 3. Temps écoulé : le serveur bannit au hasard, tour après tour, puis joue la dernière proposition.
select pg_temp.reculer(60);
select histoire.avancer_partie((pg_temp.partie()).id);
select pg_temp.verifier((select count(*) = n - 1 and count(*) filter (where hasard) = n - 3 and count(distinct choix) = n - 1
  from histoire.parties_multi_bans, (select jsonb_array_length(propositions) n from pg_temp.partie()) x
  where partie_id = (pg_temp.partie()).id group by n), 'bans au hasard pour les tours échus');
select pg_temp.verifier((select p.etat = 'en_cours' and p.contenu = p.propositions->(select i from generate_series(0, jsonb_array_length(p.propositions) - 1) i
    where i not in (select choix from histoire.parties_multi_bans where partie_id = p.id))
  and (select count(*) from histoire.parties_multi_questions where partie_id = p.id) = 5
  from pg_temp.partie() p), 'la proposition restante est jouée');
select pg_temp.verifier((select (q.posee_le - b.dernier) = interval '3 seconds' from histoire.parties_multi_questions q,
  (select max(banni_le) dernier from histoire.parties_multi_bans where partie_id = (pg_temp.partie()).id) b
  where q.partie_id = (pg_temp.partie()).id and q.position = 1), 'décompte de 3 s après le dernier ban');
select pg_temp.finir();
select pg_temp.verifier((pg_temp.partie()).etat = 'terminee', 'partie complète jusqu''à la fin');

-- 4. En 1 contre 1, l'hôte peut aussi choisir directement, ou passer par le Mystère ; le vote reste au Convivial.
select pg_temp.reglages('{"choix": "mystere", "categories": ["periode"]}');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000070';
select histoire.lancer_partie(pg_temp.salon());
reset role;
select pg_temp.verifier((select etat = 'en_cours' and tirage is not null and pick_ordre is null from pg_temp.partie()), 'Mystère en 1 contre 1');
select pg_temp.finir();
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000070';
select pg_temp.refuser(format('select histoire.modifier_salon(%L, null, %L::jsonb)', pg_temp.salon(), '{"contenu": {"choix": "vote"}}'), '22023');
reset role;
rollback;
