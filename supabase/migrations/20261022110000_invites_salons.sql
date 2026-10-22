-- #134 : invités sans compte. Schéma histoire exclusivement (rien dans public ni auth : pas de connexion
-- anonyme Supabase, aucun compte créé). L'invité est reconnu par un jeton secret (seul son hash est gardé),
-- que le site garde dans un cookie httpOnly ; il expire 24 h après l'entrée dans le salon.
begin;

alter table histoire.salon_membres add column jeton_expire_le timestamptz;
alter table histoire.salon_membres add constraint salon_membres_jeton_expire_check
  check ((jeton_invite_hash is null) = (jeton_expire_le is null));

-- Pseudo d'invité : null s'il est acceptable, sinon la raison du refus (affichée telle quelle).
-- Les grossièretés sont cherchées sans accents, sans casse et sans les chiffres « l33t » (c0nn4rd).
create function histoire.refus_pseudo_invite(p_pseudo text) returns text
language plpgsql stable set search_path = '' as $$
declare
  compact text;
  mots text[];
begin
  if p_pseudo is null or length(p_pseudo) not between 3 and 16 then
    return 'Pseudo : 3 à 16 caractères';
  end if;
  if p_pseudo !~ '^[[:alnum:]][[:alnum:] _.''-]*$' then
    return 'Pseudo : lettres, chiffres, espaces, tirets, points et apostrophes seulement';
  end if;
  compact := translate(lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_pseudo)),
    '013457@$', 'oieastas');
  mots := regexp_split_to_array(regexp_replace(compact, '[^a-z]+', ' ', 'g'), ' ');
  compact := regexp_replace(compact, '[^a-z]', '', 'g');
  -- Racines assez longues pour être cherchées n'importe où dans le pseudo.
  if compact ~ '(connard|connass|salop|putain|encul|batard|couill|niqu|nique|bougnoul|youpin|negre|negro|tapett|pedale|hitler|siegheil|chatte|branle|bitch|fuck|nigg|whore|cunt)' then
    return 'Ce pseudo n''est pas accepté';
  end if;
  -- Mots courts : seulement entiers, pour ne pas refuser « Hercule » ou « Conrad ».
  if mots && array['pd','fdp','ntm','tg','cul','bite','pute','putes','nazi','merde','con','conne','cons','ss','slut']
     or compact = any(array['pd','fdp','ntm','tg','nazi','merde']) then
    return 'Ce pseudo n''est pas accepté';
  end if;
  -- Noms qui feraient passer l'invité pour l'équipe du jeu ou pour l'hôte.
  if compact ~ '^(admin|administrateur|moderateur|modo|kffr|kiffeur|kiffeurs|officiel|hote|invite|systeme|support)' then
    return 'Ce pseudo est réservé';
  end if;
  return null;
end;
$$;

-- Invité : jeton encore valide exigé.
create or replace function histoire.membre_appelant(p_salon_id uuid, p_jeton text)
returns histoire.salon_membres
language plpgsql stable security definer set search_path = '' as $$
declare m histoire.salon_membres;
begin
  if auth.uid() is not null then
    select * into m from histoire.salon_membres where salon_id = p_salon_id and user_id = auth.uid();
  elsif p_jeton ~ '^[a-f0-9]{64}$' then
    select * into m from histoire.salon_membres
      where salon_id = p_salon_id and jeton_invite_hash = sha256(convert_to(p_jeton, 'UTF8'))
        and jeton_expire_le > clock_timestamp();
  end if;
  if m.id is null then
    raise exception using errcode = '42501', message = 'Salon inaccessible';
  end if;
  return m;
end;
$$;

-- Même entrée qu'en #133, avec les règles de pseudo des invités et l'expiration du jeton.
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
  if p_salon.etat <> 'attente' then
    raise exception using errcode = '55000', message = 'Partie en cours : attends qu''elle se termine';
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

revoke all on function histoire.refus_pseudo_invite(text) from public, anon, authenticated;

insert into histoire.migrations_appliquees(version, nom) values ('20261022110000', 'invites_salons');
notify pgrst, 'reload schema';
commit;
