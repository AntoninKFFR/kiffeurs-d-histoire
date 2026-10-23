-- #144 : vote des joueurs et Thème Mystère en Convivial. Schéma histoire exclusivement (rien dans public ni auth).
-- Vote : trois contenus tirés dans les catégories cochées par l'hôte, 15 s pour voter (votes visibles, on peut
-- changer d'avis), clos plus tôt si tout le monde a voté ; en cas d'égalité, la roulette tranche.
-- Mystère : la roulette tire un contenu des catégories cochées, le même pour tout le salon (tiré par le serveur).
begin;

alter table histoire.parties_multi drop constraint parties_multi_etat_check;
alter table histoire.parties_multi add constraint parties_multi_etat_check check (etat in ('vote', 'en_cours', 'terminee'));
alter table histoire.parties_multi
  add column propositions jsonb,
  add column vote_fin timestamptz,
  -- Roulette : {candidats, gagnant, fin}. Le gagnant est fixé par le serveur avant que la roulette tourne.
  add column tirage jsonb;

create table histoire.parties_multi_votes (
  partie_id uuid not null references histoire.parties_multi(id) on delete cascade,
  membre_id uuid not null references histoire.salon_membres(id) on delete cascade,
  choix smallint not null check (choix between 0 and 2),
  vote_le timestamptz not null default clock_timestamp(),
  primary key (partie_id, membre_id)
);
alter table histoire.parties_multi_votes enable row level security;
revoke all on histoire.parties_multi_votes from public, anon, authenticated;

-- Durées du choix du contenu (une seule source, lue aussi par l'écran via etat_partie).
create function histoire.durees_choix_multi(out vote interval, out roulette interval)
language sql immutable set search_path = '' as $$
  select interval '15 seconds', interval '6 seconds'
$$;

-- Contenus jouables des catégories demandées : ceux qui ont assez de questions pour la partie.
-- Périodes : mêmes bornes et mêmes noms que src/lib/solo/periodes.ts.
create function histoire.contenus_multi(p_categories text[], p_precision text, p_n integer)
returns table(type text, id text, titre text)
language sql stable security definer set search_path = '' as $$
  with candidates as materialized (
    select x.id, x.start_year from histoire.solo_candidates(false, null, null, null, null, null, null, null, p_precision) x
  )
  select 'pack'::text, p.id, p.title from histoire.packs p
    cross join lateral histoire.pack_scope_events(p.id) scope join candidates x on x.id = scope.event_id
    where 'pack' = any(p_categories) and p.active group by p.id, p.title having count(distinct x.id) >= p_n
  union all
  select 'periode', v.id, v.nom from (values
      ('antiquite', 'Antiquité', null::integer, 476), ('moyen-age', 'Moyen Âge', 476, 1492),
      ('epoque-moderne', 'Époque moderne', 1492, 1789), ('xixe', 'XIXe siècle', 1789, 1914),
      ('guerres-mondiales', 'Guerres mondiales', 1914, 1945), ('depuis-1945', 'Depuis 1945', 1945, null::integer)
    ) v(id, nom, de, a)
    join candidates x on (v.de is null or x.start_year >= v.de) and (v.a is null or x.start_year <= v.a)
    where 'periode' = any(p_categories) group by v.id, v.nom having count(*) >= p_n
  union all
  select 'theme', t.id, t.name from candidates x join histoire.event_tags et on et.event_id = x.id
    join histoire.tags t on t.id = et.tag_id and t.active and t.tag_type = 'SEMANTIC_TOPIC'
    where 'theme' = any(p_categories) group by t.id, t.name having count(distinct x.id) >= p_n
$$;

-- Tire les questions d'une partie dans le contenu choisi ; la première est posée à `p_debut`.
-- Tirage du solo (toutes les questions, tous niveaux) : au plus une question période sur cinq.
create function histoire.tirer_questions_partie(p_partie_id uuid, p_debut timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p histoire.parties_multi;
  r jsonb;
  c jsonb;
  v_pack text;
  v_tag text;
  v_min integer;
  v_max integer;
  v_precision text;
  n integer;
  picked jsonb;
  duree interval;
begin
  select * into p from histoire.parties_multi where id = p_partie_id;
  r := p.reglages;
  c := p.contenu;
  v_precision := r->>'precision';
  n := (r->>'questions')::integer;
  case c->>'type'
    when 'pack' then v_pack := c->>'id';
    when 'theme' then v_tag := c->>'id';
    when 'periode' then select de, a into v_min, v_max from histoire.bornes_periode_multi(c->>'id');
    else null;
  end case;

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

  select make_interval(secs => timer_seconds) into duree from histoire.scoring_settings;
  insert into histoire.parties_multi_questions(partie_id, position, event_id, precision, title, image_path,
    expected_year, expected_month, expected_day, description,
    periode, expected_end_year, expected_end_month, expected_end_day, posee_le, limite_le)
  select p.id, x.position, x.e->>'id', v_precision, x.e->>'title', x.e->>'image_path',
    (x.e->>'start_year')::integer, (x.e->>'start_month')::integer, (x.e->>'start_day')::integer, x.e->>'description',
    (x.e->>'periode')::boolean,
    case when (x.e->>'periode')::boolean then (x.e->>'end_year')::integer end,
    case when (x.e->>'periode')::boolean then (x.e->>'end_month')::integer end,
    case when (x.e->>'periode')::boolean then (x.e->>'end_day')::integer end,
    case when x.position = 1 then p_debut end, case when x.position = 1 then p_debut + duree end
  from jsonb_array_elements(picked) with ordinality x(e, position);
end;
$$;

-- Roulette tirée par le serveur parmi `p_candidats` (jsonb array) : le gagnant et une bande d'au plus 12 cartes.
create function histoire.roulette_multi(p_candidats jsonb, p_fin timestamptz) returns jsonb
language sql volatile set search_path = '' as $$
  with g as (select e as gagnant from jsonb_array_elements(p_candidats) e order by random() limit 1)
  select jsonb_build_object('gagnant', g.gagnant, 'fin', p_fin,
    'candidats', (select jsonb_agg(e order by random()) from (
      select e from jsonb_array_elements(p_candidats) e order by e = g.gagnant desc, random() limit 12) t))
  from g
$$;

-- L'hôte lance la partie avec les réglages du salon. Les joueurs encore « en attente » sont acceptés :
-- l'hôte a pu les refuser avant de lancer.
create or replace function histoire.lancer_partie(p_salon_id uuid, p_jeton text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s histoire.salons;
  m histoire.salon_membres;
  r jsonb;
  c jsonb;
  cats text[];
  v_contenu jsonb := jsonb_build_object('type', 'tout', 'titre', 'Toute l''Histoire');
  v_tirage jsonb;
  v_propositions jsonb;
  v_min integer;
  v_max integer;
  n integer;
  p histoire.parties_multi;
  t0 timestamptz := clock_timestamp();
  debut timestamptz := t0 + (histoire.durees_partie_multi()).decompte;
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
  n := (r->>'questions')::integer;
  select array_agg(e) into cats from jsonb_array_elements_text(c->'categories') e;
  if c->>'choix' = 'vote' then
    -- Trois propositions : une par catégorie cochée d'abord, puis le reste au hasard.
    select jsonb_agg(jsonb_build_object('type', type, 'id', id, 'titre', titre)
        order by array_position(array['pack', 'periode', 'theme'], type), titre) into v_propositions
      from (select x.*, row_number() over (partition by x.type order by random()) rang
        from histoire.contenus_multi(cats, r->>'precision', n) x order by rang, random() limit 3) t;
    if coalesce(jsonb_array_length(v_propositions), 0) < 2 then
      raise exception using errcode = '22023', message = 'Pas assez de contenus à proposer : coche une autre catégorie';
    end if;
  elsif c->>'choix' = 'mystere' then
    select histoire.roulette_multi(jsonb_agg(jsonb_build_object('type', type, 'id', id, 'titre', titre)),
        t0 + (histoire.durees_choix_multi()).roulette) into v_tirage
      from histoire.contenus_multi(cats, r->>'precision', n);
    if v_tirage is null then
      raise exception using errcode = '22023', message = 'Pas assez de questions pour ces filtres';
    end if;
    v_contenu := (v_tirage->'gagnant') || jsonb_build_object('mystere', true);
    debut := debut + (histoire.durees_choix_multi()).roulette;
  elsif jsonb_typeof(c->'cible') = 'object' then
    case c->'cible'->>'type'
      when 'pack' then
        v_contenu := (select jsonb_build_object('type', 'pack', 'id', id, 'titre', title) from histoire.packs
          where id = c->'cible'->>'id' and active);
      when 'theme' then
        v_contenu := (select jsonb_build_object('type', 'theme', 'id', id, 'titre', name) from histoire.tags
          where id = c->'cible'->>'id' and active and tag_type <> 'CENTURY');
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

  update histoire.salon_membres set en_attente = false where salon_id = s.id and en_attente;
  insert into histoire.parties_multi(salon_id, numero, reglages, contenu, etat, propositions, vote_fin, tirage)
    values (s.id, coalesce((select max(numero) from histoire.parties_multi where salon_id = s.id), 0) + 1, r,
      case when v_propositions is null then v_contenu else '{}'::jsonb end,
      case when v_propositions is null then 'en_cours' else 'vote' end,
      v_propositions,
      case when v_propositions is not null then t0 + (histoire.durees_choix_multi()).vote end,
      v_tirage)
    returning * into p;
  -- Vote : les questions seront tirées à la clôture du vote (avancer_partie).
  if v_propositions is null then
    perform histoire.tirer_questions_partie(p.id, debut);
  end if;
  update histoire.salons set etat = 'partie', version = version + 1, activite_le = clock_timestamp() where id = s.id;
  return jsonb_build_object('partie_id', p.id, 'numero', p.numero);
end;
$$;

-- Fait avancer la partie jusqu'à maintenant. Vote : clos à la fin du chrono ou quand tous les joueurs ont voté ;
-- le contenu le plus choisi l'emporte, la roulette tranche une égalité. Puis les questions, comme avant (#140).
create or replace function histoire.avancer_partie(p_partie_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p histoire.parties_multi;
  q histoire.parties_multi_questions;
  maintenant timestamptz := clock_timestamp();
  joueurs integer;
  repondu integer;
  fin timestamptz;
  duree interval;
  gagnants jsonb;
  v_tirage jsonb;
  debut timestamptz;
begin
  select * into p from histoire.parties_multi where id = p_partie_id;
  if p.etat = 'vote' then
    select count(*) into joueurs from histoire.salon_membres where salon_id = p.salon_id and not en_attente;
    select count(*) into repondu from histoire.parties_multi_votes v
      join histoire.salon_membres x on x.id = v.membre_id and not x.en_attente where v.partie_id = p.id;
    if maintenant < p.vote_fin and repondu < joueurs then return; end if;
    fin := least(maintenant, p.vote_fin);
    with t as (
      select i, prop, (select count(*) from histoire.parties_multi_votes v
          join histoire.salon_membres x on x.id = v.membre_id and not x.en_attente
          where v.partie_id = p.id and v.choix = i - 1) as voix
        from jsonb_array_elements(p.propositions) with ordinality e(prop, i)
    )
    select jsonb_agg(prop order by i) into gagnants from t where voix = (select max(voix) from t);
    debut := fin + (histoire.durees_partie_multi()).decompte;
    if jsonb_array_length(gagnants) > 1 then
      v_tirage := histoire.roulette_multi(gagnants, fin + (histoire.durees_choix_multi()).roulette);
      debut := debut + (histoire.durees_choix_multi()).roulette;
    end if;
    update histoire.parties_multi
      set etat = 'en_cours', tirage = v_tirage, contenu = coalesce(v_tirage->'gagnant', gagnants->0)
      where id = p.id;
    begin
      perform histoire.tirer_questions_partie(p.id, debut);
    exception when sqlstate '22023' then
      -- Le contenu n'a plus assez de questions (catalogue modifié entre-temps) : retour au salon.
      update histoire.parties_multi set etat = 'terminee', termine_le = fin where id = p.id;
      update histoire.salons set etat = 'attente', version = version + 1, activite_le = maintenant where id = p.salon_id;
      return;
    end;
    select * into p from histoire.parties_multi where id = p.id;
  end if;
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
      perform histoire.compter_partie_multi(p.id);
      update histoire.salons set etat = 'attente', version = version + 1, activite_le = maintenant where id = p.salon_id;
      exit;
    end if;
  end loop;
end;
$$;

-- Vote d'un joueur (0, 1 ou 2) : on peut changer d'avis tant que le vote est ouvert.
create function histoire.voter_partie(p_salon_id uuid, p_choix integer, p_jeton text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
  p histoire.parties_multi;
begin
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  if m.en_attente then
    raise exception using errcode = '42501', message = 'Tu joueras à la prochaine partie';
  end if;
  select * into p from histoire.parties_multi where salon_id = p_salon_id order by numero desc limit 1 for update;
  if found then
    perform histoire.avancer_partie(p.id);
    select * into p from histoire.parties_multi where id = p.id;
  end if;
  if not found or p.etat <> 'vote' then
    raise exception using errcode = '55000', message = 'Le vote est terminé';
  end if;
  if p_choix is null or p_choix < 0 or p_choix >= jsonb_array_length(p.propositions) then
    raise exception using errcode = '22023', message = 'Choix invalide';
  end if;
  insert into histoire.parties_multi_votes(partie_id, membre_id, choix) values (p.id, m.id, p_choix)
    on conflict (partie_id, membre_id) do update set choix = excluded.choix, vote_le = clock_timestamp();
  perform histoire.avancer_partie(p.id);
  update histoire.salons set activite_le = clock_timestamp() where id = p_salon_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- État de la partie : celui de #140, plus le vote en cours (propositions, fin, votes de chacun : ils sont
-- visibles) et la roulette (candidats, gagnant, fin).
create or replace function histoire.etat_partie(p_salon_id uuid, p_jeton text default null) returns jsonb
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
      'total', coalesce(nullif((select count(*) from histoire.parties_multi_questions where partie_id = p.id), 0),
        (p.reglages->>'questions')::integer),
      'duree_question', (select timer_seconds from histoire.scoring_settings),
      'duree_revelation', extract(epoch from (histoire.durees_partie_multi()).revelation),
      'categories', p.reglages->'contenu'->'categories'),
    'heure_serveur', histoire.heure_serveur(),
    'moi', m.id,
    'je_joue', not m.en_attente,
    'vote', case when p.etat = 'vote' then jsonb_build_object('propositions', p.propositions, 'fin', p.vote_fin,
      'duree', extract(epoch from (histoire.durees_choix_multi()).vote),
      'votes', coalesce((select jsonb_agg(jsonb_build_object('membre_id', v.membre_id, 'choix', v.choix) order by v.vote_le)
        from histoire.parties_multi_votes v where v.partie_id = p.id), '[]'::jsonb)) end,
    'tirage', p.tirage,
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

revoke all on function histoire.durees_choix_multi(), histoire.contenus_multi(text[], text, integer),
  histoire.tirer_questions_partie(uuid, timestamptz), histoire.roulette_multi(jsonb, timestamptz),
  histoire.voter_partie(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function histoire.voter_partie(uuid, integer, text) to anon, authenticated;

insert into histoire.migrations_appliquees(version, nom) values ('20261023090000', 'vote_mystere');
notify pgrst, 'reload schema';
commit;
