-- Partie Convivial (#140) : lancement par l'hôte, réponses horodatées, clôture, mode chrono, score du solo,
-- aucune réponse lisible avant la clôture, joueur arrivé en cours de partie, fin de partie.
-- Le temps est simulé en déplaçant les horaires des questions (en superutilisateur).
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
-- Pose la question n maintenant (ou à un instant donné), comme si le décompte était passé.
create function pg_temp.poser(n integer, depuis interval default interval '1 second', duree interval default interval '30 seconds') returns void
language sql as $$
  update histoire.parties_multi_questions set posee_le = clock_timestamp() - depuis, limite_le = clock_timestamp() - depuis + duree
  where position = n and partie_id = (select (valeur->>'partie_id')::uuid from t where cle = 'partie')
$$;
create function pg_temp.q(n integer) returns histoire.parties_multi_questions
language sql security definer as $$
  select * from histoire.parties_multi_questions
  where position = n and partie_id = (select (valeur->>'partie_id')::uuid from t where cle = 'partie')
$$;

-- L'hôte crée un salon de 5 questions, précision Année.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
insert into t values ('salon', histoire.creer_salon('convivial', 'prive', 4,
  '{"questions": 5, "precision": "YEAR", "questions_periode": false}'::jsonb));
-- Seul, il ne peut pas lancer.
select pg_temp.refuser(format('select histoire.lancer_partie(%L)', (select valeur->>'salon_id' from t where cle = 'salon')), '22023');
reset role;

-- Un invité entre par le lien.
set local role anon;
set local request.jwt.claim.sub = '';
insert into t select 'invite', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'salon'), 'Lulu');
-- Il n'est pas l'hôte : il ne lance pas.
select pg_temp.refuser(format('select histoire.lancer_partie(%L, %L)', (select valeur->>'salon_id' from t where cle = 'salon'),
  (select valeur->>'jeton' from t where cle = 'invite')), '42501');
-- Pas de partie : état vide.
select pg_temp.verifier(histoire.etat_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'),
  (select valeur->>'jeton' from t where cle = 'invite')) is null, 'pas de partie avant le lancement');
reset role;

-- Le vote n'est pas encore jouable.
update histoire.salons set reglages = jsonb_set(reglages, '{contenu,choix}', '"vote"') where id = (select (valeur->>'salon_id')::uuid from t where cle = 'salon');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
select pg_temp.refuser(format('select histoire.lancer_partie(%L)', (select valeur->>'salon_id' from t where cle = 'salon')), '22023');
reset role;
update histoire.salons set reglages = jsonb_set(reglages, '{contenu,choix}', '"direct"') where id = (select (valeur->>'salon_id')::uuid from t where cle = 'salon');

-- Lancement.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
insert into t select 'partie', histoire.lancer_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'));
select pg_temp.verifier((select histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'salon'))->'salon'->>'etat' = 'partie'), 'salon en partie');
select pg_temp.refuser(format('select histoire.lancer_partie(%L)', (select valeur->>'salon_id' from t where cle = 'salon')), '55000');
-- Décompte : la question 1 n'est pas encore visible.
insert into t select 'etat0', histoire.etat_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'));
select pg_temp.verifier((select valeur->'question' = 'null'::jsonb and valeur->'prochaine'->>'position' = '1'
  and valeur->'partie'->>'total' = '5' and valeur->'partie'->>'precision' = 'YEAR' from t where cle = 'etat0'), 'décompte avant la question 1');
-- Trop tôt pour répondre.
select pg_temp.refuser(format('select histoire.repondre_partie(%L, %L, 1800)', (select valeur->>'salon_id' from t where cle = 'salon'),
  (select (pg_temp.q(1)).id)), '22023');
reset role;

select pg_temp.verifier((select count(*) = 5 and count(distinct event_id) = 5 and bool_and(precision = 'YEAR') from histoire.parties_multi_questions
  where partie_id = (select (valeur->>'partie_id')::uuid from t where cle = 'partie')), '5 questions distinctes, précision Année');
select pg_temp.poser(1);

-- L'hôte répond juste : mêmes points que le solo pour la même réponse au même instant.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
select histoire.repondre_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'), (pg_temp.q(1)).id, (pg_temp.q(1)).expected_year);
select pg_temp.refuser(format('select histoire.repondre_partie(%L, %L, 1800)', (select valeur->>'salon_id' from t where cle = 'salon'),
  (select (pg_temp.q(1)).id)), '22023');
reset role;
select pg_temp.verifier((select r.points = (select s.points from histoire.score_answer(q.expected_year, null, null, q.expected_year,
    q.expected_month, q.expected_day, 'YEAR', extract(epoch from r.recue_le - q.posee_le)) s) and r.points > 70
  from histoire.parties_multi_reponses r join histoire.parties_multi_questions q on q.id = r.question_id
  where q.id = (pg_temp.q(1)).id), 'score identique au solo');

-- L'invité voit que l'hôte a validé, mais ni la réponse, ni la bonne date, ni les points.
set local role anon;
set local request.jwt.claim.sub = '';
insert into t select 'etat1', histoire.etat_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'), (select valeur->>'jeton' from t where cle = 'invite'));
select pg_temp.verifier((select jsonb_array_length(valeur->'question'->'ont_valide') = 1 and not (valeur->'question' ? 'correction')
  and not (valeur->'question' ? 'reponses') and valeur->'question'->'revelee_le' = 'null'::jsonb
  and (select bool_and((x->>'points')::integer = 0) from jsonb_array_elements(valeur->'scores') x)
  and position(((pg_temp.q(1)).expected_year)::text in (valeur->'question')::text) = 0
  from t where cle = 'etat1'), 'rien de lisible avant la clôture');
-- Réponse mal formée refusée ; réponse de fin hors question période refusée.
select pg_temp.refuser(format('select histoire.repondre_partie(%L, %L, 0, p_jeton => %L)', (select valeur->>'salon_id' from t where cle = 'salon'),
  (select (pg_temp.q(1)).id), (select valeur->>'jeton' from t where cle = 'invite')), '22023');
select pg_temp.refuser(format('select histoire.repondre_partie(%L, %L, 1800, p_annee_fin => 1801, p_jeton => %L)', (select valeur->>'salon_id' from t where cle = 'salon'),
  (select (pg_temp.q(1)).id), (select valeur->>'jeton' from t where cle = 'invite')), '22023');
-- L'invité répond : tous ont validé, la question se clôt aussitôt.
select histoire.repondre_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'), (pg_temp.q(1)).id, (pg_temp.q(1)).expected_year + 30,
  p_jeton => (select valeur->>'jeton' from t where cle = 'invite'));
insert into t select 'etat2', histoire.etat_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'), (select valeur->>'jeton' from t where cle = 'invite'));
select pg_temp.verifier((select valeur->'question'->'revelee_le' <> 'null'::jsonb
  and (valeur->'question'->'correction'->'debut'->>'year')::integer = (pg_temp.q(1)).expected_year
  and jsonb_array_length(valeur->'question'->'reponses') = 2
  and valeur->'prochaine'->>'position' = '2'
  and (select sum((x->>'points')::integer) > 0 from jsonb_array_elements(valeur->'scores') x)
  from t where cle = 'etat2'), 'clôture dès que tous ont validé : correction, réponses et scores');
reset role;
select pg_temp.verifier((select (pg_temp.q(2)).posee_le - (pg_temp.q(1)).revelee_le = interval '8 seconds'
  and (pg_temp.q(2)).limite_le - (pg_temp.q(2)).posee_le = interval '30 seconds'), 'question 2 posée après 8 s de révélation');

-- Un compte arrive pendant la partie : il attend, ne répond pas, et ne bloque pas la clôture.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000041';
insert into t select 'retard', histoire.rejoindre_salon_par_lien((select (valeur->>'salon_id')::uuid from t where cle = 'salon'));
reset role;
select pg_temp.poser(2, interval '40 seconds');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000041';
select pg_temp.refuser(format('select histoire.repondre_partie(%L, %L, 1800)', (select valeur->>'salon_id' from t where cle = 'salon'),
  (select (pg_temp.q(2)).id)), '42501');
select pg_temp.verifier((select (histoire.etat_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'))->>'je_joue')::boolean = false), 'arrivé en cours : ne joue pas');
reset role;

-- Question 2 : la limite est passée. Réponse refusée, question close, personne ne marque.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
select pg_temp.refuser(format('select histoire.repondre_partie(%L, %L, 1800)', (select valeur->>'salon_id' from t where cle = 'salon'),
  (select (pg_temp.q(2)).id)), '55000');
reset role;
select pg_temp.verifier((pg_temp.q(2)).revelee_le = (pg_temp.q(2)).limite_le, 'close à la limite');
select pg_temp.verifier(not exists (select 1 from histoire.parties_multi_reponses where question_id = (pg_temp.q(2)).id), 'joueur absent : 0 point');

-- Question 3 en mode chrono : la première réponse laisse 10 s aux autres.
update histoire.parties_multi set reglages = jsonb_set(reglages, '{mode_chrono}', 'true')
  where id = (select (valeur->>'partie_id')::uuid from t where cle = 'partie');
select pg_temp.poser(3);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
select histoire.repondre_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'), (pg_temp.q(3)).id, 1500);
reset role;
select pg_temp.verifier((select (pg_temp.q(3)).limite_le = r.recue_le + interval '10 seconds' from histoire.parties_multi_reponses r
  where r.question_id = (pg_temp.q(3)).id), 'mode chrono : 10 s après la première réponse');
select pg_temp.poser(3, interval '31 seconds', interval '30 seconds');

-- Question 4 en question période : la fin ne précède pas le début ; score = moyenne début et fin.
update histoire.parties_multi_questions set periode = true, expected_end_year = expected_year + 6
  where id = (pg_temp.q(4)).id;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
select histoire.etat_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'));
reset role;
select pg_temp.poser(4);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
select pg_temp.verifier((select (histoire.etat_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'))->'question'->>'periode')::boolean), 'question période annoncée');
select pg_temp.refuser(format('select histoire.repondre_partie(%L, %L, 1800)', (select valeur->>'salon_id' from t where cle = 'salon'),
  (select (pg_temp.q(4)).id)), '22023');
select pg_temp.refuser(format('select histoire.repondre_partie(%L, %L, 1800, p_annee_fin => 1790)', (select valeur->>'salon_id' from t where cle = 'salon'),
  (select (pg_temp.q(4)).id)), '22023');
select histoire.repondre_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'), (pg_temp.q(4)).id,
  (pg_temp.q(4)).expected_year, p_annee_fin => (pg_temp.q(4)).expected_year);
reset role;
select pg_temp.verifier((select r.ecart = 0 and r.ecart_fin = 6 and r.points < 100 and r.points > 0
  from histoire.parties_multi_reponses r where r.question_id = (pg_temp.q(4)).id), 'période notée au début et à la fin');

-- Fin : la dernière question passe, la partie se termine et le salon revient en attente.
select pg_temp.poser(4, interval '40 seconds');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
select histoire.etat_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'));
reset role;
select pg_temp.poser(5, interval '40 seconds');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
insert into t select 'fin', histoire.etat_partie((select (valeur->>'salon_id')::uuid from t where cle = 'salon'));
select pg_temp.verifier((select valeur->'partie'->>'etat' = 'terminee' and valeur->'question'->>'position' = '5'
  and valeur->'prochaine' = 'null'::jsonb and jsonb_array_length(valeur->'scores') = 2 from t where cle = 'fin'), 'partie terminée');
select pg_temp.verifier((select histoire.etat_salon((select (valeur->>'salon_id')::uuid from t where cle = 'salon'))->'salon'->>'etat' = 'attente'), 'salon revenu en attente');
reset role;

-- Les tables restent fermées au navigateur.
set local role anon;
select pg_temp.refuser('select * from histoire.parties_multi_questions', '42501');
reset role;
rollback;
