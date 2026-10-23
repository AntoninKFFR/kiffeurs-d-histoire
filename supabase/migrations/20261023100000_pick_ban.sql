-- #145 : 1 contre 1 avec pick & ban. Schéma histoire exclusivement (rien dans public ni auth).
-- Sept propositions tirées dans les catégories cochées par l'hôte ; les deux joueurs bannissent à tour de rôle
-- (10 s par tour, ban au hasard par le serveur si le temps est écoulé) jusqu'à ce qu'il en reste une, qui est jouée.
-- L'hôte peut aussi choisir directement le contenu, ou passer par le Mystère. La partie suit les règles du Convivial.
begin;

alter table histoire.parties_multi drop constraint parties_multi_etat_check;
alter table histoire.parties_multi add constraint parties_multi_etat_check
  check (etat in ('vote', 'pick_ban', 'en_cours', 'terminee'));
alter table histoire.parties_multi
  -- Les deux joueurs dans l'ordre des tours (tiré au sort) ; le premier tour commence à pick_debut.
  add column pick_ordre uuid[],
  add column pick_debut timestamptz;

create table histoire.parties_multi_bans (
  partie_id uuid not null references histoire.parties_multi(id) on delete cascade,
  tour smallint not null check (tour between 0 and 5),
  membre_id uuid,
  choix smallint not null check (choix between 0 and 6),
  -- Temps écoulé : le serveur a banni au hasard.
  hasard boolean not null default false,
  banni_le timestamptz not null default clock_timestamp(),
  primary key (partie_id, tour),
  unique (partie_id, choix)
);
alter table histoire.parties_multi_bans enable row level security;
revoke all on histoire.parties_multi_bans from public, anon, authenticated;

-- Durée d'un tour de pick & ban.
create function histoire.durees_pick_ban() returns interval
language sql immutable set search_path = '' as $$
  select interval '10 seconds'
$$;

-- L'hôte lance la partie avec les réglages du salon (Convivial ou 1 contre 1).
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
  v_ordre uuid[];
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
  elsif c->>'choix' = 'pick_ban' then
    -- Sept propositions variées : les catégories cochées à tour de rôle, au hasard dans chacune.
    select jsonb_agg(jsonb_build_object('type', type, 'id', id, 'titre', titre) order by rang, ordre) into v_propositions
      from (select x.*, row_number() over (partition by x.type order by random()) rang, random() ordre
        from histoire.contenus_multi(cats, r->>'precision', n) x order by rang, random() limit 7) t;
    if coalesce(jsonb_array_length(v_propositions), 0) < 2 then
      raise exception using errcode = '22023', message = 'Pas assez de contenus à proposer : coche une autre catégorie';
    end if;
    -- Qui bannit en premier : tiré au sort.
    select array_agg(id order by random()) into v_ordre from histoire.salon_membres where salon_id = s.id;
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
  insert into histoire.parties_multi(salon_id, numero, reglages, contenu, etat, propositions, vote_fin, tirage,
      pick_ordre, pick_debut)
    values (s.id, coalesce((select max(numero) from histoire.parties_multi where salon_id = s.id), 0) + 1, r,
      case when v_propositions is null then v_contenu else '{}'::jsonb end,
      case when v_ordre is not null then 'pick_ban' when v_propositions is null then 'en_cours' else 'vote' end,
      v_propositions,
      case when v_propositions is not null and v_ordre is null then t0 + (histoire.durees_choix_multi()).vote end,
      v_tirage, v_ordre, case when v_ordre is not null then t0 end)
    returning * into p;
  -- Vote, pick & ban : les questions seront tirées une fois le contenu choisi (avancer_partie).
  if v_propositions is null then
    perform histoire.tirer_questions_partie(p.id, debut);
  end if;
  update histoire.salons set etat = 'partie', version = version + 1, activite_le = clock_timestamp() where id = s.id;
  return jsonb_build_object('partie_id', p.id, 'numero', p.numero);
end;
$$;


-- Fait avancer la partie jusqu'à maintenant : pick & ban (bans au hasard pour les tours échus), vote, questions.
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
  k integer;
  dernier timestamptz;
  reste integer;
begin
  select * into p from histoire.parties_multi where id = p_partie_id;
  if p.etat = 'pick_ban' then
    -- Un ban par tour, chacun son tour ; à la fin du temps, le serveur bannit au hasard pour le joueur.
    loop
      select count(*), max(banni_le) into k, dernier from histoire.parties_multi_bans where partie_id = p.id;
      exit when k >= jsonb_array_length(p.propositions) - 1;
      debut := coalesce(dernier, p.pick_debut) + histoire.durees_pick_ban();
      exit when maintenant < debut;
      insert into histoire.parties_multi_bans(partie_id, tour, membre_id, choix, hasard, banni_le)
        select p.id, k, p.pick_ordre[k % 2 + 1], i, true, debut
        from generate_series(0, jsonb_array_length(p.propositions) - 1) i
        where i not in (select b.choix from histoire.parties_multi_bans b where b.partie_id = p.id)
        order by random() limit 1;
    end loop;
    if k < jsonb_array_length(p.propositions) - 1 then return; end if;
    select i into reste from generate_series(0, jsonb_array_length(p.propositions) - 1) i
      where i not in (select b.choix from histoire.parties_multi_bans b where b.partie_id = p.id);
    update histoire.parties_multi set etat = 'en_cours', contenu = p.propositions->reste where id = p.id;
    begin
      perform histoire.tirer_questions_partie(p.id, dernier + (histoire.durees_partie_multi()).decompte);
    exception when sqlstate '22023' then
      update histoire.parties_multi set etat = 'terminee', termine_le = dernier where id = p.id;
      update histoire.salons set etat = 'attente', version = version + 1, activite_le = maintenant where id = p.salon_id;
      return;
    end;
    select * into p from histoire.parties_multi where id = p.id;
  end if;
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


-- Ban du joueur dont c'est le tour (index de la proposition, 0 à 6).
create function histoire.bannir_partie(p_salon_id uuid, p_choix integer, p_jeton text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
  p histoire.parties_multi;
  k integer;
begin
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  select * into p from histoire.parties_multi where salon_id = p_salon_id order by numero desc limit 1 for update;
  if found then
    perform histoire.avancer_partie(p.id);
    select * into p from histoire.parties_multi where id = p.id;
  end if;
  if not found or p.etat <> 'pick_ban' then
    raise exception using errcode = '55000', message = 'Le pick & ban est terminé';
  end if;
  select count(*) into k from histoire.parties_multi_bans where partie_id = p.id;
  if p.pick_ordre[k % 2 + 1] is distinct from m.id then
    raise exception using errcode = '55000', message = 'Ce n''est pas ton tour';
  end if;
  if p_choix is null or p_choix < 0 or p_choix >= jsonb_array_length(p.propositions)
    or exists (select 1 from histoire.parties_multi_bans where partie_id = p.id and choix = p_choix) then
    raise exception using errcode = '22023', message = 'Choix invalide';
  end if;
  insert into histoire.parties_multi_bans(partie_id, tour, membre_id, choix) values (p.id, k, m.id, p_choix);
  perform histoire.avancer_partie(p.id);
  update histoire.salons set activite_le = clock_timestamp() where id = p_salon_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- État de la partie : celui de #144, plus le pick & ban (propositions, ordre des joueurs, bans, fin du tour).
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
    -- Pick & ban : gardé après le dernier ban, pour montrer le contenu retenu jusqu'à la première question.
    'pick_ban', case when p.pick_ordre is not null then (
      select jsonb_build_object('propositions', p.propositions, 'ordre', to_jsonb(p.pick_ordre),
        'duree', extract(epoch from histoire.durees_pick_ban()),
        'bans', coalesce(jsonb_agg(jsonb_build_object('tour', b.tour, 'membre_id', b.membre_id, 'choix', b.choix,
          'hasard', b.hasard) order by b.tour) filter (where b.tour is not null), '[]'::jsonb),
        'tour_fin', case when p.etat = 'pick_ban' then coalesce(max(b.banni_le), p.pick_debut) + histoire.durees_pick_ban() end)
      from histoire.parties_multi_bans b where b.partie_id = p.id) end,
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


revoke all on function histoire.durees_pick_ban(), histoire.bannir_partie(uuid, integer, text) from public, anon, authenticated;
grant execute on function histoire.bannir_partie(uuid, integer, text) to anon, authenticated;

insert into histoire.migrations_appliquees(version, nom) values ('20261023100000', 'pick_ban');
notify pgrst, 'reload schema';
commit;
