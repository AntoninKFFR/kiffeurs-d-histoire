-- #94 : questions « période ». Le joueur place le début ET la fin d'un événement qui dure.
-- Schéma histoire uniquement. Aucune suppression : les anciennes signatures restent en place
-- (sans question période), les nouvelles demandent explicitement p_periodes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- 1. Une période se joue seulement si elle dure au moins une unité de la précision choisie :
-- un an en Année, un mois en Mois, un jour en Jour (années négatives = av. J.-C., sans année 0).
create function histoire.periode_jouable(
  p_start_year integer, p_start_month integer, p_start_day integer,
  p_end_year integer, p_end_month integer, p_end_day integer, p_difficulty text
) returns boolean language sql immutable security invoker set search_path = '' as $$
  select coalesce(p_start_year is not null and p_end_year is not null and case p_difficulty
    when 'YEAR' then p_end_year > p_start_year
    when 'MONTH' then p_start_month is not null and p_end_month is not null
      and (p_end_year, p_end_month) > (p_start_year, p_start_month)
    when 'DAY' then p_start_month is not null and p_end_month is not null
      and p_start_day is not null and p_end_day is not null
      and (p_end_year, p_end_month, p_end_day) > (p_start_year, p_start_month, p_start_day)
    else false end, false)
$$;
revoke all on function histoire.periode_jouable(integer,integer,integer,integer,integer,integer,text)
  from public, anon, authenticated;

-- Marquage « question période possible », privé (event_answers reste fermée aux rôles API) :
-- une fin connue qui tombe après le début, au moins à l'une des trois précisions.
alter table histoire.event_answers add column periode_possible boolean not null default false;
update histoire.event_answers set periode_possible = true
where histoire.periode_jouable(start_year, start_month, start_day, end_year, end_month, end_day, 'YEAR')
  or histoire.periode_jouable(start_year, start_month, start_day, end_year, end_month, end_day, 'MONTH')
  or histoire.periode_jouable(start_year, start_month, start_day, end_year, end_month, end_day, 'DAY');

-- Un événement ajouté plus tard (import) est marqué selon la même règle. L'import n'écrit pas
-- cette colonne : une mise à jour ultérieure ne remet jamais le marquage en cause.
-- Definer : l'import (service_role) n'a aucun droit direct sur les fonctions internes.
create function histoire.marquer_periode_possible() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.periode_possible := new.periode_possible
    or histoire.periode_jouable(new.start_year, new.start_month, new.start_day, new.end_year, new.end_month, new.end_day, 'YEAR')
    or histoire.periode_jouable(new.start_year, new.start_month, new.start_day, new.end_year, new.end_month, new.end_day, 'MONTH')
    or histoire.periode_jouable(new.start_year, new.start_month, new.start_day, new.end_year, new.end_month, new.end_day, 'DAY');
  return new;
end;
$$;
revoke all on function histoire.marquer_periode_possible() from public, anon, authenticated;
create trigger marquer_periode_possible before insert on histoire.event_answers
  for each row execute function histoire.marquer_periode_possible();

-- 2. Questions de partie : la fin attendue et la fin répondue, privées comme le reste.
alter table histoire.game_questions
  add column periode boolean not null default false,
  add column expected_end_year integer,
  add column expected_end_month integer,
  add column expected_end_day integer,
  add column answer_end_year integer,
  add column answer_end_month integer,
  add column answer_end_day integer,
  add column end_gap integer,
  add column start_accuracy numeric check (start_accuracy between 0 and 100),
  add column end_accuracy numeric check (end_accuracy between 0 and 100),
  add constraint game_questions_periode_fin check (not periode or expected_end_year is not null);

-- Contrôle commun d'une date répondue (mêmes règles que submit_answer).
create function histoire.verifier_date_reponse(p_year integer, p_month integer, p_day integer, p_difficulty text)
returns void language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_year is null or p_year = 0 or p_year not between -10000000 and 10000000
    or (p_month is not null and p_month not between 1 and 12)
    or (p_day is not null and (p_month is null or p_day not between 1 and 31))
    or (p_difficulty in ('MONTH', 'DAY') and p_month is null)
    or (p_difficulty = 'DAY' and p_day is null)
  then raise exception using errcode = '22023', message = 'Date invalide'; end if;
  if p_day is not null then perform make_date(p_year, p_month, p_day); end if;
end;
$$;
revoke all on function histoire.verifier_date_reponse(integer,integer,integer,text) from public, anon, authenticated;

-- 3. Lancement avec l'option « questions période ». p_periodes est obligatoire et sans défaut :
-- les appels existants (sans lui) restent sur les anciennes signatures, sans question période,
-- et un ancien écran encore ouvert ne reçoit jamais une question qu'il ne sait pas afficher.
-- p_niveau null = aucun filtre de niveau (mode scolaire), comme l'ancienne signature sans niveau.
create function histoire.start_game(
  p_periodes boolean,
  p_niveau integer default null,
  p_token text default null,
  p_pack_id text default null,
  p_tag_id text default null,
  p_year_min integer default null,
  p_year_max integer default null,
  p_level_id text default null,
  p_chapter_ids text[] default null,
  p_difficulty text default 'YEAR',
  p_question_count integer default 10,
  p_direction text default 'date'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g histoire.games;
  picked jsonb;
  wanted integer;
  player_id uuid := auth.uid();
begin
  if p_periodes is null
    or (p_niveau is not null and p_niveau not between 1 and 3)
    or p_direction is null or p_direction not in ('date', 'inverse')
    or p_difficulty is null or p_difficulty not in ('YEAR', 'MONTH', 'DAY')
    or p_question_count is null or p_question_count not between 0 and 100
    or p_year_min = 0 or p_year_max = 0 or p_year_min > p_year_max
    or (player_id is null and (p_token is null or p_token !~ '^[a-f0-9]{64}$'))
    or (p_tag_id is not null and not exists (
      select 1 from histoire.tags where id = p_tag_id and active and tag_type <> 'CENTURY'))
  then
    raise exception using errcode = '22023', message = 'Paramètres de partie invalides';
  end if;

  wanted := case when p_question_count = 0 then 100 else p_question_count end;
  -- Tirage, choix des périodes et instantané dans la même requête (même lecture que #93).
  with candidates as (
    select e.id, e.title, e.image_path, e.start_year, e.start_month, e.start_day, e.description,
      a.end_year, a.end_month::integer as end_month, a.end_day::integer as end_day,
      coalesce(a.periode_possible, false) and histoire.periode_jouable(e.start_year, e.start_month,
        e.start_day, a.end_year, a.end_month, a.end_day, p_difficulty) as periode_ok,
      row_number() over (
      partition by
        case when p_direction = 'date' then e.id end,
        e.start_year,
        case when p_direction = 'inverse' and p_difficulty in ('MONTH','DAY') then e.start_month end,
        case when p_direction = 'inverse' and p_difficulty = 'DAY' then e.start_day end
      order by random()
    ) as date_rank
    from histoire.solo_candidates(p_niveau, p_pack_id, p_tag_id, p_year_min,
      p_year_max, p_level_id, p_chapter_ids, p_difficulty) e
    left join histoire.event_answers a on a.event_id = e.id
  ), pool as materialized (
    select * from candidates where date_rank = 1
  ), taille as materialized (
    select least(wanted, count(*))::integer as n from pool
  ), cible as materialized (
    -- Au plus une question sur cinq (2 sur 10), au moins une dès 5 questions si possible.
    select case when p_periodes and p_direction = 'date' and n >= 5
      then 1 + floor(random() * floor(n / 5.0))::integer else 0 end as k from taille
  ), periodes as materialized (
    select p.*, true as periode from pool p where p.periode_ok
    order by random() limit (select k from cible)
  ), autres as (
    select p.*, false as periode from pool p
    where not exists (select 1 from periodes x where x.id = p.id)
    order by random() limit (select n from taille) - (select count(*) from periodes)
  )
  select jsonb_agg(to_jsonb(selected) order by random()) into picked from (
    select * from periodes union all select * from autres
  ) selected;
  if coalesce(jsonb_array_length(picked), 0) = 0
    or (p_question_count > 0 and jsonb_array_length(picked) < p_question_count) then
    raise exception using errcode = '22023', message = 'Pas assez de questions pour ces filtres';
  end if;

  wanted := jsonb_array_length(picked);
  insert into histoire.games(user_id, anonymous_token_hash, difficulty, question_count, direction, context)
  values (player_id, case when player_id is null then sha256(convert_to(p_token, 'UTF8')) end,
    p_difficulty, wanted, p_direction,
    jsonb_build_object(
      'replay_filters', jsonb_strip_nulls(jsonb_build_object(
        'difficulty', p_difficulty, 'direction', p_direction, 'niveau', p_niveau,
        'questionCount', p_question_count, 'packId', p_pack_id, 'tagId', p_tag_id,
        'yearMin', p_year_min, 'yearMax', p_year_max, 'levelId', p_level_id, 'chapterIds', p_chapter_ids,
        'periods', p_periodes)),
      'mode', case when p_level_id is not null or cardinality(p_chapter_ids) > 0 then 'solo_scolaire' else 'solo_libre' end,
      'niveau', p_niveau,
      'level', (select name from histoire.levels where id = p_level_id),
      'pack', (select jsonb_build_object('key', id, 'label', title) from histoire.packs where id = p_pack_id),
      'theme', (select jsonb_build_object('key', id, 'label', name) from histoire.tags where id = p_tag_id),
      'chapters', coalesce((select jsonb_agg(jsonb_build_object('key', c.id, 'label', c.title, 'level', l.name) order by c.id)
        from histoire.chapters c join histoire.levels l on l.id = c.level_id
        where c.id = any(p_chapter_ids) and (p_level_id is null or c.level_id = p_level_id)), '[]'::jsonb)
    )) returning * into g;
  insert into histoire.game_questions(game_id, event_id, position, difficulty, title, image_path,
    expected_year, expected_month, expected_day, correction_description,
    periode, expected_end_year, expected_end_month, expected_end_day)
  select g.id, chosen.event->>'id', chosen.position, p_difficulty,
    chosen.event->>'title', chosen.event->>'image_path',
    (chosen.event->>'start_year')::integer, (chosen.event->>'start_month')::integer,
    (chosen.event->>'start_day')::integer, chosen.event->>'description',
    (chosen.event->>'periode')::boolean,
    case when (chosen.event->>'periode')::boolean then (chosen.event->>'end_year')::integer end,
    case when (chosen.event->>'periode')::boolean then (chosen.event->>'end_month')::integer end,
    case when (chosen.event->>'periode')::boolean then (chosen.event->>'end_day')::integer end
  from jsonb_array_elements(picked) with ordinality chosen(event, position);
  return jsonb_build_object('game_id', g.id, 'question_count', g.question_count,
    'difficulty', g.difficulty, 'direction', g.direction, 'state', g.state, 'anonymous', player_id is null);
end;
$$;
revoke all on function histoire.start_game(boolean,integer,text,text,text,integer,integer,text,text[],text,integer,text)
  from public, anon, authenticated;
grant execute on function histoire.start_game(boolean,integer,text,text,text,integer,integer,text,text[],text,integer,text)
  to anon, authenticated;

-- Roulette mystère avec l'option : même tirage du thème que #95/#89, puis la nouvelle signature.
create function histoire.start_mystery_game(
  p_periodes boolean,
  p_token text default null, p_niveau integer default 1,
  p_difficulty text default 'YEAR', p_question_count integer default 10,
  p_direction text default 'date', p_pack_id text default null, p_tag_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  eligible jsonb;
  winner jsonb;
  game jsonb;
begin
  if p_periodes is null or p_niveau is null or p_niveau not between 1 and 3
    or p_difficulty is null or p_difficulty not in ('YEAR','MONTH','DAY')
    or p_question_count is null or p_question_count not in (0,5,10,20)
    or p_direction is null or p_direction not in ('date','inverse')
    or (p_pack_id is not null and p_tag_id is not null)
    or (auth.uid() is null and (p_token is null or p_token !~ '^[a-f0-9]{64}$')) then
    raise exception using errcode = '22023', message = 'Paramètres de partie invalides';
  end if;
  with candidates as materialized (
    select id,start_year,start_month,start_day
    from histoire.solo_candidates(p_niveau,null,null,null,null,null,null,p_difficulty)
  ), memberships as (
    select 'pack'::text as mode, p.id, p.title as titre,
      c.id as event_id, c.start_year, c.start_month, c.start_day
    from histoire.packs p
      cross join lateral histoire.pack_scope_events(p.id) scope
      join candidates c on c.id = scope.event_id
    where p.active
    union all
    select 'theme', t.id, t.name, c.id, c.start_year, c.start_month, c.start_day
    from candidates c join histoire.event_tags et on et.event_id = c.id
      join histoire.tags t on t.id = et.tag_id and t.active and t.tag_type = 'SEMANTIC_TOPIC'
  ), counts as (
    select mode,id,titre,
      case when p_direction = 'date' then count(distinct event_id)
        else count(distinct (start_year,
          case when p_difficulty in ('MONTH','DAY') then start_month end,
          case when p_difficulty = 'DAY' then start_day end)) end as n
    from memberships group by mode,id,titre
  )
  select jsonb_agg(jsonb_build_object('mode',mode,'id',id,'titre',titre) order by mode,id)
    into eligible from counts where n >= case when p_question_count = 0 then 1 else p_question_count end;
  select x into winner from jsonb_array_elements(coalesce(eligible,'[]'::jsonb)) as items(x)
    where (p_pack_id is null or (x->>'mode' = 'pack' and x->>'id' = p_pack_id))
      and (p_tag_id is null or (x->>'mode' = 'theme' and x->>'id' = p_tag_id))
    order by random() limit 1;
  if winner is null then
    raise exception using errcode = '22023', message = 'Pas assez de questions pour ces filtres';
  end if;
  game := histoire.start_game(p_periodes=>p_periodes,p_niveau=>p_niveau,p_token=>p_token,
    p_pack_id=>case when winner->>'mode' = 'pack' then winner->>'id' end,
    p_tag_id=>case when winner->>'mode' = 'theme' then winner->>'id' end,
    p_difficulty=>p_difficulty,p_question_count=>p_question_count,p_direction=>p_direction);
  update histoire.games set context = jsonb_set(context, '{replay_filters}',
    context->'replay_filters' || jsonb_build_object('mystery',true,'mysteryLabel',winner->>'titre'))
    where id = (game->>'game_id')::uuid;
  return game || jsonb_build_object('mystery',jsonb_build_object('winner',winner,'candidates',eligible));
end;
$$;
revoke all on function histoire.start_mystery_game(boolean,text,integer,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function histoire.start_mystery_game(boolean,text,integer,text,integer,text,text,text) to anon,authenticated;

-- 4. Question active : une seule clé en plus, « periode », et seulement pour une question période.
-- Ni la date de début ni celle de fin ne sont envoyées avant la réponse.
create or replace function histoire.next_question(p_game_id uuid, p_token text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g histoire.games := histoire.lock_solo_game(p_game_id, p_token);
  q histoire.game_questions;
  duration numeric;
  server_time timestamptz;
  payload jsonb;
begin
  if g.state = 'finished' then return null; end if;
  select * into q from histoire.game_questions
    where game_id = g.id and answered_at is null order by position limit 1;
  if not found then return null; end if;
  if q.asked_at is null then
    select timer_seconds into strict duration from histoire.scoring_settings;
    server_time := clock_timestamp();
    update histoire.game_questions set asked_at = server_time, timer_seconds = duration,
      deadline = server_time + duration * interval '1 second'
    where id = q.id returning * into q;
  end if;
  payload := jsonb_build_object('question_id', q.id, 'position', q.position,
    'difficulty', q.difficulty, 'question_count', g.question_count, 'asked_at', q.asked_at, 'deadline', q.deadline,
    'server_time', clock_timestamp());
  if g.direction = 'inverse' then
    -- Aucune illustration autorisée explicitement dans le PRD inverse.
    return payload || histoire.question_date(q.expected_year, q.expected_month, q.expected_day, q.difficulty);
  end if;
  return payload || jsonb_build_object(
    -- Titre rédigé pour la question quand il existe ; sinon chiffres, mois et siècles masqués.
    'title', coalesce((select s.display_title from histoire.game_question_editorial_snapshots s where s.question_id = q.id), histoire.mask_question_title(q.title)),
    'image_path', case when q.image_path = q.event_id || '.svg' then q.image_path end)
    || case when q.periode then jsonb_build_object('periode', true) else '{}'::jsonb end;
end;
$$;

-- 5. Réponse à une date : une question période ne s'y répond pas (sauf constat d'expiration, à 0).
create or replace function histoire.submit_answer(
  p_game_id uuid, p_question_id uuid,
  p_year integer default null, p_month integer default null, p_day integer default null,
  p_token text default null, p_answer_text text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g histoire.games := histoire.lock_solo_game(p_game_id, p_token);
  q histoire.game_questions;
  r record;
  server_time timestamptz;
  elapsed numeric;
  current_duration numeric;
  timed_out boolean;
  accepted boolean;
  precision_value numeric;
  points_value integer;
  payload jsonb;
begin
  select * into q from histoire.game_questions where id = p_question_id and game_id = g.id;
  if not found or q.asked_at is null or q.answered_at is not null or g.state <> 'playing'
    or exists (select 1 from histoire.game_questions where game_id = g.id
      and position < q.position and answered_at is null) then
    raise exception using errcode = '22023', message = 'Question inactive ou déjà répondue';
  end if;
  server_time := clock_timestamp();
  timed_out := server_time > q.deadline;
  select timer_seconds into strict current_duration from histoire.scoring_settings;
  elapsed := extract(epoch from (server_time - q.asked_at)) / q.timer_seconds * current_duration;

  if g.direction = 'inverse' then
    if p_year is not null or p_month is not null or p_day is not null
      or char_length(p_answer_text) > 1000
      or (not timed_out and (p_answer_text is null or histoire.normalize_answer(p_answer_text) = '')) then
      raise exception using errcode = '22023', message = 'Réponse invalide';
    end if;
    -- Seuls les libellés figés de la question active privée sont comparés.
    accepted := false;
    if not timed_out then
      select coalesce(bool_or(
        histoire.normalize_answer(label) = histoire.normalize_answer(p_answer_text)
        or extensions.similarity(histoire.normalize_answer(label), histoire.normalize_answer(p_answer_text)) >= 0.75
      ),false) into accepted
      from histoire.game_question_editorial_snapshots s
        cross join lateral unnest(s.accepted_labels) labels(label)
      where s.question_id = q.id;
    end if;
    precision_value := case when accepted then 100 else 0 end;
    points_value := case when timed_out then 0 else histoire.score_points(precision_value, elapsed) end;
    update histoire.game_questions set answered_at = server_time, answer_text = p_answer_text,
      expired = timed_out, gap = null, unit = q.difficulty, accuracy = precision_value,
      points = least(100, greatest(0, points_value))
    where id = q.id returning * into q;
  else
    if p_answer_text is not null or (q.periode and not timed_out) then
      raise exception using errcode = '22023', message = 'Réponse invalide';
    end if;
    if not timed_out then
      perform histoire.verifier_date_reponse(p_year, p_month, p_day, q.difficulty);
    end if;
    select * into r from histoire.score_answer(
      case when timed_out then null else p_year end, p_month, p_day,
      q.expected_year, q.expected_month, q.expected_day, q.difficulty, elapsed);
    update histoire.game_questions set answered_at = server_time,
      answer_year = p_year, answer_month = p_month, answer_day = p_day,
      expired = timed_out, gap = r.gap, unit = r.unit, accuracy = r.accuracy,
      points = least(100, greatest(0, r.points)),
      start_accuracy = case when q.periode then 0 end, end_accuracy = case when q.periode then 0 end
    where id = q.id returning * into q;
  end if;
  payload := jsonb_build_object('question_id', q.id,
    'correct_date', jsonb_build_object('year', q.expected_year, 'month', q.expected_month, 'day', q.expected_day),
    'gap', q.gap, 'unit', q.unit, 'accuracy', q.accuracy, 'points', q.points,
    'expired', q.expired, 'description', q.correction_description);
  if g.direction = 'inverse' then
    payload := payload || jsonb_build_object('direction', g.direction, 'title', q.title, 'correct', accepted);
  end if;
  if q.periode then
    payload := payload || histoire.correction_periode(q);
  end if;
  return payload;
end;
$$;

-- Clés de correction propres à une question période, après la réponse uniquement.
create function histoire.correction_periode(q histoire.game_questions)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('periode', true,
    'correct_end_date', jsonb_build_object('year', q.expected_end_year, 'month', q.expected_end_month, 'day', q.expected_end_day),
    'end_gap', q.end_gap, 'start_accuracy', q.start_accuracy, 'end_accuracy', q.end_accuracy)
$$;
revoke all on function histoire.correction_periode(histoire.game_questions) from public, anon, authenticated;

-- 6. Réponse à une question période : deux dates, la fin jamais avant le début.
-- Score = moyenne des scores du début et de la fin, chacun avec la formule de #12 et le même chrono.
create function histoire.submit_period_answer(
  p_game_id uuid, p_question_id uuid,
  p_start_year integer default null, p_start_month integer default null, p_start_day integer default null,
  p_end_year integer default null, p_end_month integer default null, p_end_day integer default null,
  p_token text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g histoire.games := histoire.lock_solo_game(p_game_id, p_token);
  q histoire.game_questions;
  debut record;
  fin record;
  server_time timestamptz;
  elapsed numeric;
  current_duration numeric;
  timed_out boolean;
  inverse boolean;
begin
  select * into q from histoire.game_questions where id = p_question_id and game_id = g.id;
  if not found or q.asked_at is null or q.answered_at is not null or g.state <> 'playing'
    or not q.periode or g.direction <> 'date'
    or exists (select 1 from histoire.game_questions where game_id = g.id
      and position < q.position and answered_at is null) then
    raise exception using errcode = '22023', message = 'Question inactive ou déjà répondue';
  end if;
  server_time := clock_timestamp();
  timed_out := server_time > q.deadline;
  select timer_seconds into strict current_duration from histoire.scoring_settings;
  elapsed := extract(epoch from (server_time - q.asked_at)) / q.timer_seconds * current_duration;

  if not timed_out then
    perform histoire.verifier_date_reponse(p_start_year, p_start_month, p_start_day, q.difficulty);
    perform histoire.verifier_date_reponse(p_end_year, p_end_month, p_end_day, q.difficulty);
    -- Comparaison à la précision jouée (années négatives = av. J.-C., l'ordre numérique tient).
    inverse := case q.difficulty
      when 'YEAR' then p_end_year < p_start_year
      when 'MONTH' then (p_end_year, p_end_month) < (p_start_year, p_start_month)
      else (p_end_year, p_end_month, p_end_day) < (p_start_year, p_start_month, p_start_day) end;
    if inverse then
      raise exception using errcode = '22023', message = 'La fin ne peut pas précéder le début';
    end if;
  end if;
  select * into debut from histoire.score_answer(
    case when timed_out then null else p_start_year end, p_start_month, p_start_day,
    q.expected_year, q.expected_month, q.expected_day, q.difficulty, elapsed);
  select * into fin from histoire.score_answer(
    case when timed_out then null else p_end_year end, p_end_month, p_end_day,
    q.expected_end_year, q.expected_end_month, q.expected_end_day, q.difficulty, elapsed);
  update histoire.game_questions set answered_at = server_time,
    answer_year = p_start_year, answer_month = p_start_month, answer_day = p_start_day,
    answer_end_year = p_end_year, answer_end_month = p_end_month, answer_end_day = p_end_day,
    expired = timed_out, gap = debut.gap, end_gap = fin.gap, unit = debut.unit,
    start_accuracy = debut.accuracy, end_accuracy = fin.accuracy,
    accuracy = round((debut.accuracy + fin.accuracy) / 2, 2),
    points = least(100, greatest(0, round((debut.points + fin.points) / 2.0)::integer))
  where id = q.id returning * into q;
  return jsonb_build_object('question_id', q.id,
    'correct_date', jsonb_build_object('year', q.expected_year, 'month', q.expected_month, 'day', q.expected_day),
    'gap', q.gap, 'unit', q.unit, 'accuracy', q.accuracy, 'points', q.points,
    'expired', q.expired, 'description', q.correction_description) || histoire.correction_periode(q);
end;
$$;
revoke all on function histoire.submit_period_answer(uuid,uuid,integer,integer,integer,integer,integer,integer,text)
  from public, anon, authenticated;
grant execute on function histoire.submit_period_answer(uuid,uuid,integer,integer,integer,integer,integer,integer,text)
  to anon, authenticated;

-- 7. Bilan : la fin répondue et la fin attendue s'ajoutent aux questions période.
create or replace function histoire.finish_game(p_game_id uuid, p_token text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g histoire.games := histoire.lock_solo_game(p_game_id, p_token);
  recap jsonb;
begin
  if exists (select 1 from histoire.game_questions where game_id = g.id and answered_at is null) then
    raise exception using errcode = '22023', message = 'Il reste des questions sans réponse';
  end if;
  if g.state <> 'finished' then
    update histoire.games set state = 'finished', finished_at = clock_timestamp(),
      average_accuracy = (select round(avg(accuracy), 2) from histoire.game_questions where game_id = g.id),
      total_points = (select sum(points) from histoire.game_questions where game_id = g.id)
    where id = g.id returning * into g;
  end if;
  select jsonb_agg(jsonb_build_object('question_id', q.id, 'position', q.position,
    'title', q.title, 'answer', case when g.direction = 'inverse' then to_jsonb(q.answer_text)
      else jsonb_build_object('year', q.answer_year, 'month', q.answer_month, 'day', q.answer_day) end,
    'correct_date', jsonb_build_object('year', q.expected_year, 'month', q.expected_month, 'day', q.expected_day),
    'description', q.correction_description, 'gap', q.gap, 'unit', q.unit,
    'accuracy', q.accuracy, 'points', q.points, 'expired', q.expired)
    || case when g.direction = 'inverse' then jsonb_build_object('direction', g.direction, 'correct', q.accuracy = 100)
      else '{}'::jsonb end
    || case when q.periode then histoire.correction_periode(q) || jsonb_build_object('answer_end',
      jsonb_build_object('year', q.answer_end_year, 'month', q.answer_end_month, 'day', q.answer_end_day))
      else '{}'::jsonb end order by q.position)
  into recap from histoire.game_questions q where q.game_id = g.id;
  return jsonb_build_object('game_id', g.id, 'state', g.state, 'question_count', g.question_count,
    'direction', g.direction, 'average_accuracy', g.average_accuracy, 'total_points', g.total_points, 'questions', recap,
    -- La partie est terminée et lock_solo_game a contrôlé son propriétaire/jeton.
    'replay_filters', case when g.context->>'origin' = 'test_chapitre' then
      jsonb_build_object('chapterTest', true, 'difficulty', g.difficulty,
        'chapterIds', jsonb_build_array(g.context->'chapters'->0->>'key'))
      else g.context->'replay_filters' end);
end;
$$;

-- CREATE OR REPLACE conserve les ACL ; les rappeler explicitement.
revoke all on function histoire.next_question(uuid,text),
  histoire.submit_answer(uuid,uuid,integer,integer,integer,text,text),
  histoire.finish_game(uuid,text) from public,anon,authenticated;
grant execute on function histoire.next_question(uuid,text),
  histoire.submit_answer(uuid,uuid,integer,integer,integer,text,text),
  histoire.finish_game(uuid,text) to anon,authenticated;
insert into histoire.migrations_appliquees(version, nom) values ('20261011083000', 'questions_periode');
notify pgrst, 'reload schema';
commit;
