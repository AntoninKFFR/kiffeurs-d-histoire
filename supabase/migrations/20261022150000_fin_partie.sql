-- #143 : fin de partie. Schéma histoire exclusivement (rien dans public ni auth).
-- Bilan de la partie terminée (podium, coup de maître, plus gros raté) et compteurs multi du profil
-- (parties jouées, victoires), à part des statistiques solo qui ne changent pas.
begin;

-- Compteurs du profil : comptes seulement (un invité n'a pas de profil).
create table histoire.stats_multi (
  user_id uuid primary key,
  parties integer not null default 0 check (parties >= 0),
  victoires integer not null default 0 check (victoires between 0 and parties),
  maj_le timestamptz not null default clock_timestamp()
);
alter table histoire.stats_multi enable row level security;
revoke all on histoire.stats_multi from public, anon, authenticated;

-- Appelée une seule fois, quand la partie passe à « terminée » : +1 partie pour chaque compte qui l'a jouée,
-- +1 victoire pour le ou les premiers (ex æquo compris), s'ils ont marqué.
create function histoire.compter_partie_multi(p_partie_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p histoire.parties_multi;
begin
  select * into p from histoire.parties_multi where id = p_partie_id;
  with joueurs as (
    select x.user_id, coalesce(sum(r.points), 0) as points
    from histoire.salon_membres x
    left join histoire.parties_multi_reponses r on r.membre_id = x.id
      and r.question_id in (select id from histoire.parties_multi_questions where partie_id = p.id)
    where x.salon_id = p.salon_id and not x.en_attente and x.arrive_le <= p.commence_le and x.user_id is not null
    group by x.user_id
  ), meilleur as (
    -- Les invités comptent pour savoir qui gagne, même sans profil.
    select max(t.points) as points from (
      select coalesce(sum(r.points), 0) as points from histoire.salon_membres x
      left join histoire.parties_multi_reponses r on r.membre_id = x.id
        and r.question_id in (select id from histoire.parties_multi_questions where partie_id = p.id)
      where x.salon_id = p.salon_id and not x.en_attente and x.arrive_le <= p.commence_le group by x.id) t
  )
  insert into histoire.stats_multi as s (user_id, parties, victoires)
  select j.user_id, 1, case when j.points > 0 and j.points = m.points then 1 else 0 end from joueurs j, meilleur m
  on conflict (user_id) do update set parties = s.parties + 1, victoires = s.victoires + excluded.victoires,
    maj_le = clock_timestamp();
end;
$$;

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
      perform histoire.compter_partie_multi(p.id);
      update histoire.salons set etat = 'attente', version = version + 1, activite_le = maintenant where id = p.salon_id;
      exit;
    end if;
  end loop;
end;
$$;

-- Bilan de la dernière partie terminée du salon : toutes les questions, bonnes réponses et réponses de chacun
-- (avec le temps mis), pour le podium. Rien avant la fin de la partie.
create function histoire.bilan_partie(p_salon_id uuid, p_jeton text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
  p histoire.parties_multi;
begin
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  select * into p from histoire.parties_multi where salon_id = p_salon_id and etat = 'terminee' order by numero desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'partie', jsonb_build_object('id', p.id, 'numero', p.numero, 'contenu', p.contenu, 'precision', p.reglages->>'precision',
      'total', (select count(*) from histoire.parties_multi_questions where partie_id = p.id)),
    'questions', (select jsonb_agg(jsonb_build_object('position', q.position, 'titre', q.title,
        'correction', jsonb_strip_nulls(jsonb_build_object(
          'debut', jsonb_build_object('year', q.expected_year, 'month', q.expected_month, 'day', q.expected_day),
          'fin', case when q.periode then jsonb_build_object('year', q.expected_end_year, 'month', q.expected_end_month, 'day', q.expected_end_day) end)),
        'reponses', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('membre_id', r.membre_id,
            'debut', jsonb_build_object('year', r.answer_year, 'month', r.answer_month, 'day', r.answer_day),
            'ecart', r.ecart, 'unite', r.unite, 'points', r.points,
            'secondes', round(extract(epoch from (r.recue_le - q.posee_le))::numeric, 1))) order by r.recue_le)
          from histoire.parties_multi_reponses r where r.question_id = q.id), '[]'::jsonb)) order by q.position)
      from histoire.parties_multi_questions q where q.partie_id = p.id),
    'scores', coalesce((select jsonb_agg(jsonb_build_object('membre_id', x.id, 'points', coalesce(t.points, 0)) order by x.ordre)
      from histoire.salon_membres x
      left join (select r.membre_id, sum(r.points)::integer as points from histoire.parties_multi_reponses r
        join histoire.parties_multi_questions y on y.id = r.question_id where y.partie_id = p.id group by r.membre_id) t
        on t.membre_id = x.id
      where x.salon_id = p_salon_id and not x.en_attente and x.arrive_le <= p.commence_le), '[]'::jsonb));
end;
$$;

-- Compteurs multi du profil du joueur connecté.
create function histoire.mes_stats_multi() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Connexion requise';
  end if;
  return coalesce((select jsonb_build_object('parties', parties, 'victoires', victoires)
    from histoire.stats_multi where user_id = auth.uid()), jsonb_build_object('parties', 0, 'victoires', 0));
end;
$$;

revoke all on function histoire.compter_partie_multi(uuid), histoire.bilan_partie(uuid, text), histoire.mes_stats_multi()
  from public, anon, authenticated;
grant execute on function histoire.bilan_partie(uuid, text) to anon, authenticated;
grant execute on function histoire.mes_stats_multi() to authenticated;
-- CREATE OR REPLACE conserve les droits ; les rappeler.
revoke all on function histoire.avancer_partie(uuid) from public, anon, authenticated;

insert into histoire.migrations_appliquees(version, nom) values ('20261022150000', 'fin_partie');
notify pgrst, 'reload schema';
commit;
