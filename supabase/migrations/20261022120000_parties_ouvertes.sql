-- #137 : parties ouvertes et entrée pendant une partie. Schéma histoire exclusivement.
begin;

-- Liste des salons ouverts, pour les comptes seulement (un invité n'y a pas accès).
-- Rien de privé : pas de code, pas de jeton, pas d'identifiant de compte ; l'uuid sert à rejoindre.
create function histoire.parties_ouvertes() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Connecte-toi pour voir les parties ouvertes';
  end if;
  perform histoire.purger_salons();
  return coalesce((
    select jsonb_agg(x.ligne order by x.activite_le desc)
    from (
      select s.activite_le, jsonb_build_object(
        'id', s.id,
        'hote', (select m.pseudo from histoire.salon_membres m where m.salon_id = s.id and m.est_hote),
        'mode', s.mode,
        'reglages', s.reglages,
        'joueurs', (select count(*) from histoire.salon_membres m where m.salon_id = s.id),
        'max_joueurs', s.max_joueurs,
        'etat', s.etat,
        'moi', exists (select 1 from histoire.salon_membres m where m.salon_id = s.id and m.user_id = auth.uid())
      ) as ligne
      from histoire.salons s
      where s.visibilite = 'ouvert'
        and not exists (select 1 from histoire.salon_exclus e where e.salon_id = s.id and e.user_id = auth.uid())
      order by s.activite_le desc
      limit 50
    ) x), '[]'::jsonb);
end;
$$;

-- Une partie lancée n'empêche plus d'entrer : on attend la suivante dans le salon (décision de #130).
-- Les joueurs d'une partie sont ceux inscrits à son lancement (#140), pas tous les membres du salon.
create or replace function histoire.entrer_salon(p_salon histoire.salons, p_pseudo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
  ancien uuid;
  v_pseudo text;
  refus text;
  jeton text;
begin
  if auth.uid() is not null then
    select * into m from histoire.salon_membres where salon_id = p_salon.id and user_id = auth.uid();
    if m.id is not null then
      return jsonb_build_object('salon_id', p_salon.id, 'membre_id', m.id, 'code', histoire.format_code_salon(p_salon.code));
    end if;
    if exists (select 1 from histoire.salon_exclus where salon_id = p_salon.id and user_id = auth.uid()) then
      raise exception using errcode = '42501', message = 'L''hôte t''a exclu de ce salon';
    end if;
  elsif p_salon.mode = 'un_contre_un' then
    raise exception using errcode = '42501', message = 'Le 1 contre 1 demande un compte';
  end if;
  if (select count(*) from histoire.salon_membres where salon_id = p_salon.id) >= p_salon.max_joueurs then
    raise exception using errcode = '55000', message = 'Salon complet';
  end if;

  if auth.uid() is not null then
    -- Un compte est dans un seul salon : il quitte l'ancien en entrant dans le nouveau.
    select id into ancien from histoire.salon_membres where user_id = auth.uid();
    if ancien is not null then perform histoire.retirer_membre(ancien); end if;
    -- Pseudo KFFR (public.profiles, lu seulement, jamais modifié).
    select nullif(btrim(p.username), '') into v_pseudo from public.profiles p where p.id = auth.uid();
    insert into histoire.salon_membres(salon_id, user_id, pseudo)
      values (p_salon.id, auth.uid(), left(coalesce(v_pseudo, 'Joueur'), 40)) returning * into m;
  else
    v_pseudo := regexp_replace(btrim(coalesce(p_pseudo, '')), '\s+', ' ', 'g');
    refus := histoire.refus_pseudo_invite(v_pseudo);
    if refus is not null then
      raise exception using errcode = '22023', message = refus;
    end if;
    if exists (select 1 from histoire.salon_membres where salon_id = p_salon.id and lower(salon_membres.pseudo) = lower(v_pseudo)) then
      raise exception using errcode = '22023', message = 'Ce pseudo est déjà pris dans le salon';
    end if;
    jeton := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into histoire.salon_membres(salon_id, jeton_invite_hash, jeton_expire_le, pseudo)
      values (p_salon.id, sha256(convert_to(jeton, 'UTF8')), clock_timestamp() + interval '24 hours', v_pseudo)
      returning * into m;
  end if;
  update histoire.salons set version = version + 1, activite_le = clock_timestamp() where id = p_salon.id;
  return jsonb_strip_nulls(jsonb_build_object('salon_id', p_salon.id, 'membre_id', m.id,
    'code', histoire.format_code_salon(p_salon.code), 'jeton', jeton));
end;
$$;

revoke all on function histoire.parties_ouvertes() from public, anon, authenticated;
grant execute on function histoire.parties_ouvertes() to authenticated;

insert into histoire.migrations_appliquees(version, nom) values ('20261022120000', 'parties_ouvertes');
notify pgrst, 'reload schema';
commit;
