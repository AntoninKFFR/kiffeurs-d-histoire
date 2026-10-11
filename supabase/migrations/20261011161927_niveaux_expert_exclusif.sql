-- Expert exclusif. PRÉPARÉE UNIQUEMENT : autorisation de production distincte requise.
-- Aucun contenu, niveau éditorial, association, table ou signature historique modifié.
-- p_expert_only obligatoire distingue les nouvelles surcharges dans PostgREST.
-- Les permissions, budgets, instantanés, score, périodes et déduplication sont conservés.
-- Les limites d'inférence des agrégats existants restent celles de docs/audit-decompte-93.md.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Projection privée : réutilise l'union, les retraits et les précisions historiques.
create function histoire.solo_candidates(
  p_expert_only boolean, p_niveau integer, p_pack_id text, p_tag_id text, p_year_min integer, p_year_max integer,
  p_level_id text, p_chapter_ids text[], p_difficulty text
) returns table(id text, title text, image_path text, start_year integer, start_month integer,
  start_day integer, description text)
language sql stable security invoker set search_path = '' as $$
  select c.* from histoire.solo_candidates(p_niveau,p_pack_id,p_tag_id,p_year_min,p_year_max,p_level_id,p_chapter_ids,p_difficulty) c
  join histoire.events e on e.id=c.id
  where p_expert_only is false or (p_expert_only is true and e.niveau=3)
$$;

create function histoire.available_questions(
  p_expert_only boolean, p_niveau integer default null, p_pack_id text default null, p_tag_id text default null,
  p_year_min integer default null, p_year_max integer default null,
  p_level_id text default null, p_chapter_ids text[] default null, p_direction text default 'date'
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_expert_only is null or (p_expert_only and p_niveau is distinct from 3)
    or (p_niveau is not null and p_niveau not between 1 and 3)
    or p_direction is null or p_direction not in ('date', 'inverse')
    or p_year_min = 0 or p_year_max = 0 or p_year_min > p_year_max then
    raise exception using errcode = '22023', message = 'Paramètres de partie invalides';
  end if;
  return (with candidates as materialized (
    select * from histoire.solo_candidates(p_expert_only, p_niveau, p_pack_id, p_tag_id, p_year_min,
      p_year_max, p_level_id, p_chapter_ids, 'YEAR')
  ) select jsonb_build_object(
    'YEAR', case when p_direction = 'date' then count(*) else count(distinct start_year) end,
    'MONTH', case when p_direction = 'date' then count(*) filter (where start_month is not null)
      else count(distinct (start_year, start_month)) filter (where start_month is not null) end,
    'DAY', case when p_direction = 'date' then count(*) filter (where start_month is not null and start_day is not null)
      else count(distinct (start_year, start_month, start_day)) filter (where start_month is not null and start_day is not null) end
  ) from candidates);
end;
$$;

create function histoire.playable_packs(p_expert_only boolean, p_niveau integer default 3,
  p_direction text default 'date',p_pack_id text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_expert_only is null or (p_expert_only and p_niveau is distinct from 3)
    or p_niveau is null or p_niveau not between 1 and 3
    or p_direction is null or p_direction not in ('date','inverse') then
    raise exception using errcode = '22023', message = 'Paramètres invalides';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'titre',p.title,'description',coalesce(p.description,''),'parent_id',p.parent_id,
    'comptes',histoire.available_questions(p_expert_only=>p_expert_only,p_niveau=>p_niveau,p_pack_id=>p.id,p_direction=>p_direction),
    'b',bounds.b) order by p.position nulls last,p.title,p.id),'[]'::jsonb)
    from histoire.packs p cross join lateral (
      select case when count(*) = 0 then null else jsonb_build_array(
        least(2000,greatest(-3500,floor((min(case when c.start_year < 0 then c.start_year + 1 else c.start_year end)-10)/10.0)*10)),
        greatest(-3470,least(2030,ceil((max(case when c.start_year < 0 then c.start_year + 1 else c.start_year end)+11)/10.0)*10))) end as b
      from histoire.solo_candidates(p_expert_only,p_niveau,p.id,null,null,null,null,null,'YEAR') c
    ) bounds where p.active and (p_pack_id is null or p.id = p_pack_id));
end;
$$;

create function histoire.start_game(
  p_expert_only boolean,
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
  if p_expert_only is null or (p_expert_only and (p_niveau is distinct from 3 or p_level_id is not null or p_chapter_ids is not null))
    or p_periodes is null
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
    from histoire.solo_candidates(p_expert_only, p_niveau, p_pack_id, p_tag_id, p_year_min,
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
        'difficulty', p_difficulty, 'direction', p_direction, 'niveau', p_niveau, 'expertOnly', p_expert_only,
        'questionCount', p_question_count, 'packId', p_pack_id, 'tagId', p_tag_id,
        'yearMin', p_year_min, 'yearMax', p_year_max, 'levelId', p_level_id, 'chapterIds', p_chapter_ids,
        'periods', p_periodes)),
      'mode', case when p_level_id is not null or cardinality(p_chapter_ids) > 0 then 'solo_scolaire' else 'solo_libre' end,
      'niveau', p_niveau, 'expertOnly', p_expert_only,
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

create function histoire.start_mystery_game(
  p_expert_only boolean,
  p_periodes boolean,
  p_token text default null, p_niveau integer default 3,
  p_difficulty text default 'YEAR', p_question_count integer default 10,
  p_direction text default 'date', p_pack_id text default null, p_tag_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  eligible jsonb;
  winner jsonb;
  game jsonb;
begin
  if p_expert_only is null or (p_expert_only and p_niveau is distinct from 3)
    or p_periodes is null or p_niveau is null or p_niveau not between 1 and 3
    or p_difficulty is null or p_difficulty not in ('YEAR','MONTH','DAY')
    or p_question_count is null or p_question_count not in (0,5,10,20)
    or p_direction is null or p_direction not in ('date','inverse')
    or (p_pack_id is not null and p_tag_id is not null)
    or (auth.uid() is null and (p_token is null or p_token !~ '^[a-f0-9]{64}$')) then
    raise exception using errcode = '22023', message = 'Paramètres de partie invalides';
  end if;
  with candidates as materialized (
    select id,start_year,start_month,start_day
    from histoire.solo_candidates(p_expert_only,p_niveau,null,null,null,null,null,null,p_difficulty)
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
  game := histoire.start_game(p_expert_only=>p_expert_only,p_periodes=>p_periodes,p_niveau=>p_niveau,p_token=>p_token,
    p_pack_id=>case when winner->>'mode' = 'pack' then winner->>'id' end,
    p_tag_id=>case when winner->>'mode' = 'theme' then winner->>'id' end,
    p_difficulty=>p_difficulty,p_question_count=>p_question_count,p_direction=>p_direction);
  update histoire.games set context = jsonb_set(context, '{replay_filters}',
    context->'replay_filters' || jsonb_build_object('mystery',true,'mysteryLabel',winner->>'titre'))
    where id = (game->>'game_id')::uuid;
  return game || jsonb_build_object('mystery',jsonb_build_object('winner',winner,'candidates',eligible));
end;
$$;

revoke all on function histoire.solo_candidates(boolean,integer,text,text,integer,integer,text,text[],text) from public,anon,authenticated;

revoke all on function histoire.available_questions(boolean,integer,text,text,integer,integer,text,text[],text) from public,anon,authenticated;
grant execute on function histoire.available_questions(boolean,integer,text,text,integer,integer,text,text[],text) to anon,authenticated;
revoke all on function histoire.playable_packs(boolean,integer,text,text) from public,anon,authenticated;
grant execute on function histoire.playable_packs(boolean,integer,text,text) to anon,authenticated;
revoke all on function histoire.start_game(boolean,boolean,integer,text,text,text,integer,integer,text,text[],text,integer,text) from public,anon,authenticated;
grant execute on function histoire.start_game(boolean,boolean,integer,text,text,text,integer,integer,text,text[],text,integer,text) to anon,authenticated;
revoke all on function histoire.start_mystery_game(boolean,boolean,text,integer,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function histoire.start_mystery_game(boolean,boolean,text,integer,text,integer,text,text,text) to anon,authenticated;
insert into histoire.migrations_appliquees(version,nom) values ('20261011161927','niveaux_expert_exclusif');
notify pgrst, 'reload schema';
commit;
