-- #140 : partie Convivial synchronisée. Schéma histoire exclusivement (rien dans public ni auth).
-- Le serveur arbitre tout : tirage, horaires des questions, réponses horodatées, score (même formule qu'en solo).
-- Pas de planificateur : chaque appel (état, réponse) fait avancer la partie jusqu'à l'instant présent.
-- Déroulé d'une question : posée (30 s) → close quand tous ont validé ou à la limite → révélation (8 s)
-- → question suivante. Mode chrono : après la première réponse, il reste 10 s aux autres.
begin;

alter table histoire.parties_multi
  add column contenu jsonb not null default '{}'::jsonb;

alter table histoire.parties_multi_questions
  add column periode boolean not null default false,
  add column expected_end_year integer,
  add column expected_end_month integer,
  add column expected_end_day integer,
  add column description text,
  add constraint parties_multi_questions_periode_check check (not periode or expected_end_year is not null);

alter table histoire.parties_multi_reponses
  add column answer_end_year integer,
  add column answer_end_month integer,
  add column answer_end_day integer,
  add column ecart_fin integer,
  add column unite text check (unite in ('YEAR', 'MONTH', 'DAY'));

create index parties_multi_salon_idx on histoire.parties_multi(salon_id, numero desc);

-- Durées de la partie (une seule source, lue aussi par l'écran via etat_partie).
create function histoire.durees_partie_multi(out decompte interval, out revelation interval, out chrono_rapide interval)
language sql immutable set search_path = '' as $$
  select interval '3 seconds', interval '8 seconds', interval '10 seconds'
$$;

-- Périodes du choix direct (mêmes bornes que src/lib/solo/periodes.ts, sur l'année de début).
create function histoire.bornes_periode_multi(p_id text, out de integer, out a integer)
language sql immutable set search_path = '' as $$
  select v.de, v.a from (values
    ('antiquite', null::integer, 476), ('moyen-age', 476, 1492), ('epoque-moderne', 1492, 1789),
    ('xixe', 1789, 1914), ('guerres-mondiales', 1914, 1945), ('depuis-1945', 1945, null::integer)
  ) v(id, de, a) where v.id = p_id
$$;

-- Fait avancer la partie jusqu'à maintenant : clôt la question en cours si tous ont validé ou si le temps
-- est écoulé, pose la suivante après la révélation, et termine la partie après la dernière.
-- Joueurs = membres présents dans le salon et acceptés (un joueur arrivé en cours de partie attend).
create function histoire.avancer_partie(p_partie_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p histoire.parties_multi;
  q histoire.parties_multi_questions;
  maintenant timestamptz := clock_timestamp();
  joueurs integer;
  repondu integer;
  fin timestamptz;
  duree interval;
begin
  select * into p from histoire.parties_multi where id = p_partie_id;
  if p.etat <> 'en_cours' then return; end if;
  select make_interval(secs => timer_seconds) into duree from histoire.scoring_settings;
  loop
    select * into q from histoire.parties_multi_questions
      where partie_id = p.id and posee_le is not null and revelee_le is null order by position limit 1;
    exit when not found or maintenant < q.posee_le;
    select count(*) into joueurs from histoire.salon_membres where salon_id = p.salon_id and not en_attente;
    select count(*) into repondu from histoire.parties_multi_reponses r
      join histoire.salon_membres x on x.id = r.membre_id and not x.en_attente where r.question_id = q.id;
    exit when maintenant <= q.limite_le and repondu < joueurs;
    fin := least(maintenant, q.limite_le);
    update histoire.parties_multi_questions set revelee_le = fin where id = q.id;
    update histoire.parties_multi_questions
      set posee_le = fin + (histoire.durees_partie_multi()).revelation,
          limite_le = fin + (histoire.durees_partie_multi()).revelation + duree
      where partie_id = p.id and position = q.position + 1;
    if not found then
      update histoire.parties_multi set etat = 'terminee', termine_le = fin where id = p.id;
      update histoire.salons set etat = 'attente', version = version + 1, activite_le = maintenant where id = p.salon_id;
      exit;
    end if;
  end loop;
end;
$$;

-- L'hôte lance la partie avec les réglages du salon. Les joueurs encore « en attente » sont acceptés :
-- l'hôte a pu les refuser avant de lancer.
create function histoire.lancer_partie(p_salon_id uuid, p_jeton text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s histoire.salons;
  m histoire.salon_membres;
  r jsonb;
  c jsonb;
  v_pack text;
  v_tag text;
  v_min integer;
  v_max integer;
  v_contenu jsonb := jsonb_build_object('type', 'tout', 'titre', 'Toute l''Histoire');
  v_precision text;
  n integer;
  picked jsonb;
  winner jsonb;
  p histoire.parties_multi;
  debut timestamptz;
  duree interval;
begin
  select * into s from histoire.salons where id = p_salon_id for update;
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  if not m.est_hote then
    raise exception using errcode = '42501', message = 'Seul l''hôte lance la partie';
  end if;
  if s.mode <> 'convivial' then
    raise exception using errcode = '22023', message = 'Le 1 contre 1 arrive bientôt';
  end if;
  if s.etat <> 'attente' then
    raise exception using errcode = '55000', message = 'Une partie est déjà en cours';
  end if;
  perform histoire.retirer_absents(s.id);
  if (select count(*) from histoire.salon_membres where salon_id = s.id) < 2 then
    raise exception using errcode = '22023', message = 'Il faut au moins 2 joueurs';
  end if;

  r := s.reglages;
  c := r->'contenu';
  v_precision := r->>'precision';
  n := (r->>'questions')::integer;
  if c->>'choix' = 'vote' then
    raise exception using errcode = '22023', message = 'Le vote des joueurs arrive bientôt : choisis le contenu ou le Thème Mystère';
  elsif c->>'choix' = 'mystere' then
    -- Même tirage que le Thème Mystère du solo : un pack ou un thème qui a assez de questions.
    with candidates as materialized (
      select id from histoire.solo_candidates(false, null, null, null, null, null, null, null, v_precision)
    ), eligibles as (
      select 'pack'::text as type, p.id, p.title as titre from histoire.packs p
        cross join lateral histoire.pack_scope_events(p.id) scope join candidates x on x.id = scope.event_id
        where p.active group by p.id, p.title having count(distinct x.id) >= n
      union all
      select 'theme', t.id, t.name from candidates x join histoire.event_tags et on et.event_id = x.id
        join histoire.tags t on t.id = et.tag_id and t.active and t.tag_type = 'SEMANTIC_TOPIC'
        group by t.id, t.name having count(distinct x.id) >= n
    )
    select jsonb_build_object('type', type, 'id', id, 'titre', titre) into winner from eligibles order by random() limit 1;
    if winner is null then
      raise exception using errcode = '22023', message = 'Pas assez de questions pour ces filtres';
    end if;
    v_contenu := winner || jsonb_build_object('mystere', true);
    if winner->>'type' = 'pack' then v_pack := winner->>'id'; else v_tag := winner->>'id'; end if;
  elsif jsonb_typeof(c->'cible') = 'object' then
    case c->'cible'->>'type'
      when 'pack' then
        v_pack := c->'cible'->>'id';
        v_contenu := (select jsonb_build_object('type', 'pack', 'id', id, 'titre', title) from histoire.packs where id = v_pack and active);
      when 'theme' then
        v_tag := c->'cible'->>'id';
        v_contenu := (select jsonb_build_object('type', 'theme', 'id', id, 'titre', name) from histoire.tags
          where id = v_tag and active and tag_type <> 'CENTURY');
      else
        select de, a into v_min, v_max from histoire.bornes_periode_multi(c->'cible'->>'id');
        if v_min is null and v_max is null then v_contenu := null; else
          v_contenu := jsonb_build_object('type', 'periode', 'id', c->'cible'->>'id');
        end if;
    end case;
    if v_contenu is null then
      raise exception using errcode = '22023', message = 'Ce contenu n''est plus disponible : choisis-en un autre';
    end if;
  end if;

  -- Tirage du solo (toutes les questions, tous niveaux) : au plus une question période sur cinq.
  with pool as materialized (
    select e.id, e.title, e.image_path, e.start_year, e.start_month, e.start_day, e.description,
      a.end_year, a.end_month::integer as end_month, a.end_day::integer as end_day,
      coalesce(a.periode_possible, false) and histoire.periode_jouable(e.start_year, e.start_month,
        e.start_day, a.end_year, a.end_month, a.end_day, v_precision) as periode_ok
    from histoire.solo_candidates(false, null, v_pack, v_tag, v_min, v_max, null, null, v_precision) e
    left join histoire.event_answers a on a.event_id = e.id
  ), cible as materialized (
    select case when (r->>'questions_periode')::boolean and n >= 5
      then 1 + floor(random() * floor(n / 5.0))::integer else 0 end as k
  ), periodes as materialized (
    select x.*, true as periode from pool x where x.periode_ok order by random() limit (select k from cible)
  ), autres as (
    select x.*, false as periode from pool x where not exists (select 1 from periodes y where y.id = x.id)
    order by random() limit n - (select count(*) from periodes)
  )
  select jsonb_agg(to_jsonb(choisi) order by random()) into picked
    from (select * from periodes union all select * from autres) choisi;
  if coalesce(jsonb_array_length(picked), 0) < n then
    raise exception using errcode = '22023', message = 'Pas assez de questions pour ces filtres';
  end if;

  update histoire.salon_membres set en_attente = false where salon_id = s.id and en_attente;
  insert into histoire.parties_multi(salon_id, numero, reglages, contenu)
    values (s.id, coalesce((select max(numero) from histoire.parties_multi where salon_id = s.id), 0) + 1, r, v_contenu)
    returning * into p;
  select make_interval(secs => timer_seconds) into duree from histoire.scoring_settings;
  debut := clock_timestamp() + (histoire.durees_partie_multi()).decompte;
  insert into histoire.parties_multi_questions(partie_id, position, event_id, precision, title, image_path,
    expected_year, expected_month, expected_day, description,
    periode, expected_end_year, expected_end_month, expected_end_day, posee_le, limite_le)
  select p.id, x.position, x.e->>'id', v_precision, x.e->>'title', x.e->>'image_path',
    (x.e->>'start_year')::integer, (x.e->>'start_month')::integer, (x.e->>'start_day')::integer, x.e->>'description',
    (x.e->>'periode')::boolean,
    case when (x.e->>'periode')::boolean then (x.e->>'end_year')::integer end,
    case when (x.e->>'periode')::boolean then (x.e->>'end_month')::integer end,
    case when (x.e->>'periode')::boolean then (x.e->>'end_day')::integer end,
    case when x.position = 1 then debut end, case when x.position = 1 then debut + duree end
  from jsonb_array_elements(picked) with ordinality x(e, position);
  update histoire.salons set etat = 'partie', version = version + 1, activite_le = clock_timestamp() where id = s.id;
  return jsonb_build_object('partie_id', p.id, 'numero', p.numero);
end;
$$;

-- Ce que voit un membre : la question en cours (sans réponse tant qu'elle n'est pas close), qui a validé,
-- les scores des questions déjà révélées. Après la révélation : la bonne réponse et les réponses de tous.
create function histoire.etat_partie(p_salon_id uuid, p_jeton text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
  p histoire.parties_multi;
  q histoire.parties_multi_questions;
  prochaine histoire.parties_multi_questions;
  maintenant timestamptz;
  question jsonb;
begin
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  select * into p from histoire.parties_multi where salon_id = p_salon_id order by numero desc limit 1 for update;
  if not found then return null; end if;
  perform histoire.avancer_partie(p.id);
  select * into p from histoire.parties_multi where id = p.id;
  maintenant := clock_timestamp();
  select * into q from histoire.parties_multi_questions
    where partie_id = p.id and posee_le <= maintenant order by position desc limit 1;
  select * into prochaine from histoire.parties_multi_questions
    where partie_id = p.id and posee_le > maintenant order by position limit 1;
  if q.id is not null then
    question := jsonb_build_object('id', q.id, 'position', q.position, 'titre', q.title, 'image_path', q.image_path,
      'periode', q.periode, 'posee_le', q.posee_le, 'limite_le', q.limite_le, 'revelee_le', q.revelee_le,
      'ont_valide', coalesce((select jsonb_agg(r.membre_id order by r.recue_le) from histoire.parties_multi_reponses r
        where r.question_id = q.id), '[]'::jsonb));
    -- Bonne réponse et réponses de tous : seulement une fois la question close.
    if q.revelee_le is not null then
      question := question || jsonb_build_object(
        'correction', jsonb_strip_nulls(jsonb_build_object(
          'debut', jsonb_build_object('year', q.expected_year, 'month', q.expected_month, 'day', q.expected_day),
          'fin', case when q.periode then jsonb_build_object('year', q.expected_end_year, 'month', q.expected_end_month, 'day', q.expected_end_day) end,
          'description', q.description)),
        'reponses', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('membre_id', r.membre_id,
            'debut', jsonb_build_object('year', r.answer_year, 'month', r.answer_month, 'day', r.answer_day),
            'fin', case when q.periode then jsonb_build_object('year', r.answer_end_year, 'month', r.answer_end_month, 'day', r.answer_end_day) end,
            'ecart', r.ecart, 'ecart_fin', r.ecart_fin, 'unite', r.unite, 'points', r.points)) order by r.recue_le)
          from histoire.parties_multi_reponses r where r.question_id = q.id), '[]'::jsonb));
    end if;
  end if;
  return jsonb_build_object(
    'partie', jsonb_build_object('id', p.id, 'numero', p.numero, 'etat', p.etat, 'contenu', p.contenu,
      'precision', p.reglages->>'precision', 'mode_chrono', coalesce((p.reglages->>'mode_chrono')::boolean, false),
      'total', (select count(*) from histoire.parties_multi_questions where partie_id = p.id),
      'duree_question', (select timer_seconds from histoire.scoring_settings),
      'duree_revelation', extract(epoch from (histoire.durees_partie_multi()).revelation)),
    'heure_serveur', histoire.heure_serveur(),
    'moi', m.id,
    'je_joue', not m.en_attente,
    'question', question,
    'prochaine', case when prochaine.id is not null then
      jsonb_build_object('position', prochaine.position, 'posee_le', prochaine.posee_le) end,
    -- Points des seules questions révélées : rien ne trahit la question en cours.
    'scores', coalesce((select jsonb_agg(jsonb_build_object('membre_id', x.id, 'points', coalesce(t.points, 0)) order by x.ordre)
      from histoire.salon_membres x
      left join (select r.membre_id, sum(r.points)::integer as points from histoire.parties_multi_reponses r
        join histoire.parties_multi_questions y on y.id = r.question_id
        where y.partie_id = p.id and y.revelee_le is not null group by r.membre_id) t on t.membre_id = x.id
      where x.salon_id = p_salon_id and not x.en_attente), '[]'::jsonb));
end;
$$;

-- Réponse d'un joueur, horodatée par le serveur. Refusée hors du temps de la question.
-- Question période : début et fin, notés séparément puis moyennés, comme en solo.
create function histoire.repondre_partie(
  p_salon_id uuid, p_question_id uuid,
  p_annee integer, p_mois integer default null, p_jour integer default null,
  p_annee_fin integer default null, p_mois_fin integer default null, p_jour_fin integer default null,
  p_jeton text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
  p histoire.parties_multi;
  q histoire.parties_multi_questions;
  debut record;
  fin record;
  maintenant timestamptz;
  ecoule numeric;
  inverse boolean;
begin
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  if m.en_attente then
    raise exception using errcode = '42501', message = 'Tu joueras à la prochaine partie';
  end if;
  select * into p from histoire.parties_multi where salon_id = p_salon_id and etat = 'en_cours'
    order by numero desc limit 1 for update;
  if not found then
    raise exception using errcode = '55000', message = 'La partie est terminée';
  end if;
  perform histoire.avancer_partie(p.id);
  select * into q from histoire.parties_multi_questions where id = p_question_id and partie_id = p.id;
  maintenant := clock_timestamp();
  if not found or q.posee_le is null or maintenant < q.posee_le then
    raise exception using errcode = '22023', message = 'Question inactive';
  end if;
  if q.revelee_le is not null or maintenant > q.limite_le then
    raise exception using errcode = '55000', message = 'Temps écoulé';
  end if;
  if exists (select 1 from histoire.parties_multi_reponses where question_id = q.id and membre_id = m.id) then
    raise exception using errcode = '22023', message = 'Réponse déjà envoyée';
  end if;
  perform histoire.verifier_date_reponse(p_annee, p_mois, p_jour, q.precision);
  if q.periode then
    perform histoire.verifier_date_reponse(p_annee_fin, p_mois_fin, p_jour_fin, q.precision);
    inverse := case q.precision
      when 'YEAR' then p_annee_fin < p_annee
      when 'MONTH' then (p_annee_fin, p_mois_fin) < (p_annee, p_mois)
      else (p_annee_fin, p_mois_fin, p_jour_fin) < (p_annee, p_mois, p_jour) end;
    if inverse then
      raise exception using errcode = '22023', message = 'La fin ne peut pas précéder le début';
    end if;
  elsif p_annee_fin is not null or p_mois_fin is not null or p_jour_fin is not null then
    raise exception using errcode = '22023', message = 'Réponse invalide';
  end if;

  -- Même formule qu'en solo : le temps compte depuis l'instant où la question est posée.
  ecoule := extract(epoch from (maintenant - q.posee_le));
  select * into debut from histoire.score_answer(p_annee, p_mois, p_jour,
    q.expected_year, q.expected_month, q.expected_day, q.precision, ecoule);
  -- Hors période, la fin est notée « sans réponse » (écart nul, 0 point) et n'entre pas dans le score.
  select * into fin from histoire.score_answer(case when q.periode then p_annee_fin end, p_mois_fin, p_jour_fin,
    coalesce(q.expected_end_year, q.expected_year), q.expected_end_month, q.expected_end_day, q.precision, ecoule);
  insert into histoire.parties_multi_reponses(question_id, membre_id, answer_year, answer_month, answer_day,
    answer_end_year, answer_end_month, answer_end_day, recue_le, ecart, ecart_fin, unite, precision_pct, points)
  values (q.id, m.id, p_annee, p_mois, p_jour,
    case when q.periode then p_annee_fin end, case when q.periode then p_mois_fin end, case when q.periode then p_jour_fin end,
    maintenant, debut.gap, fin.gap, debut.unit,
    case when q.periode then round((debut.accuracy + fin.accuracy) / 2, 2) else debut.accuracy end,
    least(100, greatest(0, case when q.periode then round((debut.points + fin.points) / 2.0)::integer else debut.points end)));

  -- Mode chrono : la première réponse laisse 10 s aux autres.
  if coalesce((p.reglages->>'mode_chrono')::boolean, false) then
    update histoire.parties_multi_questions
      set limite_le = least(limite_le, maintenant + (histoire.durees_partie_multi()).chrono_rapide)
      where id = q.id;
  end if;
  perform histoire.avancer_partie(p.id);
  update histoire.salons set activite_le = maintenant where id = p_salon_id;
  return jsonb_build_object('recue_le', maintenant);
end;
$$;

revoke all on function histoire.durees_partie_multi(), histoire.bornes_periode_multi(text),
  histoire.avancer_partie(uuid), histoire.lancer_partie(uuid, text), histoire.etat_partie(uuid, text),
  histoire.repondre_partie(uuid, uuid, integer, integer, integer, integer, integer, integer, text)
  from public, anon, authenticated;
grant execute on function histoire.lancer_partie(uuid, text), histoire.etat_partie(uuid, text),
  histoire.repondre_partie(uuid, uuid, integer, integer, integer, integer, integer, integer, text)
  to anon, authenticated;

insert into histoire.migrations_appliquees(version, nom) values ('20261022140000', 'partie_convivial');
notify pgrst, 'reload schema';
commit;
