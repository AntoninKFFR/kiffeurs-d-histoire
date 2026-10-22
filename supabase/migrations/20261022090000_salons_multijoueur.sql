-- #133 : salons multijoueur (V1.3). Schéma histoire exclusivement : rien dans public ni auth.
-- Inspiré des salons de KFFR contrée (membres ordonnés, couronne transmise, numéro de version),
-- sans réutiliser leurs tables. Amis, présence et invitations restent ceux de la contrée (#149) :
-- un salon a un identifiant stable (uuid) qu'une invitation peut transmettre.
-- Toutes les tables sont fermées aux rôles API : seules les RPC ci-dessous y touchent.
begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Un salon n'existe que tant qu'il a des membres : le dernier qui part le supprime,
-- ce qui libère son code. La purge supprime aussi les salons inactifs.
create table histoire.salons (
  id uuid primary key default gen_random_uuid(),
  -- Code de partie « RP » : une date, affichée JJ/MM/AAAA.
  code date not null check (code between date '1000-01-01' and date '2025-12-31'),
  mode text not null check (mode in ('convivial', 'un_contre_un')),
  visibilite text not null default 'prive' check (visibilite in ('prive', 'ouvert')),
  max_joueurs integer not null check (max_joueurs between 2 and 10),
  reglages jsonb not null,
  etat text not null default 'attente' check (etat in ('attente', 'partie')),
  -- Incrémenté à chaque changement : le client sait si son affichage est à jour (#135).
  version integer not null default 1,
  cree_par uuid not null,
  cree_le timestamptz not null default clock_timestamp(),
  activite_le timestamptz not null default clock_timestamp(),
  check (mode = 'convivial' or max_joueurs = 2)
);
create unique index salons_code_idx on histoire.salons(code);
create index salons_activite_idx on histoire.salons(activite_le);

-- Membre = compte (user_id) ou invité sans compte (jeton secret, seul son hash est gardé).
create table histoire.salon_membres (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references histoire.salons(id) on delete cascade,
  -- Ordre d'arrivée : la couronne passe au plus ancien membre restant.
  ordre bigint generated always as identity,
  user_id uuid,
  jeton_invite_hash bytea,
  pseudo text not null check (length(pseudo) between 1 and 40 and pseudo = btrim(pseudo) and pseudo !~ '[[:cntrl:]]'),
  est_hote boolean not null default false,
  arrive_le timestamptz not null default clock_timestamp(),
  check ((user_id is null) <> (jeton_invite_hash is null))
);
create unique index salon_membres_hote_idx on histoire.salon_membres(salon_id) where est_hote;
-- Un compte est dans un seul salon à la fois.
create unique index salon_membres_compte_idx on histoire.salon_membres(user_id) where user_id is not null;
create unique index salon_membres_jeton_idx on histoire.salon_membres(jeton_invite_hash) where jeton_invite_hash is not null;
create index salon_membres_ordre_idx on histoire.salon_membres(salon_id, ordre);

-- Comptes expulsés par l'hôte : ils ne reviennent pas dans ce salon.
create table histoire.salon_exclus (
  salon_id uuid not null references histoire.salons(id) on delete cascade,
  user_id uuid not null,
  primary key (salon_id, user_id)
);

-- Essais de code ratés, pour freiner la devinette (voir rejoindre_salon).
create table histoire.salon_essais_code (
  id bigint generated always as identity primary key,
  cle text not null,
  essai_le timestamptz not null default clock_timestamp()
);
create index salon_essais_code_cle_idx on histoire.salon_essais_code(cle, essai_le);

-- Parties, questions et réponses : structure seulement, les RPC de jeu arrivent avec #140.
create table histoire.parties_multi (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references histoire.salons(id) on delete cascade,
  numero integer not null check (numero > 0),
  -- Instantané des réglages au lancement : les changer ensuite ne touche pas la partie.
  reglages jsonb not null,
  etat text not null default 'en_cours' check (etat in ('en_cours', 'terminee')),
  commence_le timestamptz not null default clock_timestamp(),
  termine_le timestamptz,
  unique (salon_id, numero)
);

create table histoire.parties_multi_questions (
  id uuid primary key default gen_random_uuid(),
  partie_id uuid not null references histoire.parties_multi(id) on delete cascade,
  position integer not null check (position > 0),
  event_id text not null references histoire.events(id),
  precision text not null check (precision in ('YEAR', 'MONTH', 'DAY')),
  title text not null,
  image_path text,
  -- Bonne réponse : privée, jamais renvoyée avant la révélation.
  expected_year integer not null,
  expected_month integer,
  expected_day integer,
  posee_le timestamptz,
  limite_le timestamptz,
  revelee_le timestamptz,
  unique (partie_id, position),
  unique (partie_id, event_id),
  check ((posee_le is null) = (limite_le is null)),
  check (limite_le is null or limite_le > posee_le)
);

create table histoire.parties_multi_reponses (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references histoire.parties_multi_questions(id) on delete cascade,
  membre_id uuid not null references histoire.salon_membres(id) on delete cascade,
  answer_year integer not null,
  answer_month integer,
  answer_day integer,
  -- Horodatage serveur : c'est lui qui fait foi pour le chrono, jamais l'heure du navigateur.
  recue_le timestamptz not null default clock_timestamp(),
  ecart integer,
  precision_pct numeric check (precision_pct between 0 and 100),
  points integer check (points between 0 and 100),
  unique (question_id, membre_id)
);

alter table histoire.salons enable row level security;
alter table histoire.salon_membres enable row level security;
alter table histoire.salon_exclus enable row level security;
alter table histoire.salon_essais_code enable row level security;
alter table histoire.parties_multi enable row level security;
alter table histoire.parties_multi_questions enable row level security;
alter table histoire.parties_multi_reponses enable row level security;
-- Aucune policy : le navigateur passe uniquement par les RPC.
revoke all on histoire.salons, histoire.salon_membres, histoire.salon_exclus, histoire.salon_essais_code,
  histoire.parties_multi, histoire.parties_multi_questions, histoire.parties_multi_reponses
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Code de partie JJ/MM/AAAA
-- ---------------------------------------------------------------------------

-- Dates trop connues : un code facile à deviner ferait entrer des inconnus.
create function histoire.codes_salon_interdits() returns date[]
language sql immutable set search_path = '' as $$
  select array[
    date '1066-10-14', date '1415-10-25', date '1492-10-12', date '1515-09-13', date '1572-08-24',
    date '1776-07-04', date '1789-07-14', date '1789-08-04', date '1789-08-26', date '1793-01-21',
    date '1804-12-02', date '1805-12-02', date '1815-06-18', date '1870-09-04', date '1914-06-28',
    date '1918-11-11', date '1939-09-01', date '1939-09-03', date '1940-06-18', date '1941-12-07',
    date '1944-06-06', date '1944-08-25', date '1945-05-08', date '1945-08-06', date '1958-10-04',
    date '1963-11-22', date '1968-05-13', date '1969-07-21', date '1981-05-10', date '1989-11-09',
    date '2000-01-01', date '2001-09-11'
  ];
$$;

-- Lit « 14/07/1789 » (ou 14.07.1789, 14-07-1789) ; NULL si ce n'est pas un vrai jour du calendrier.
create function histoire.lire_code_salon(p_code text) returns date
language plpgsql immutable set search_path = '' as $$
declare m text[];
begin
  m := regexp_match(btrim(coalesce(p_code, '')), '^(\d{1,2}) *[/.-] *(\d{1,2}) *[/.-] *(\d{4})$');
  if m is null then return null; end if;
  return make_date(m[3]::integer, m[2]::integer, m[1]::integer);
exception when others then
  return null;
end;
$$;

create function histoire.format_code_salon(p_code date) returns text
language sql immutable set search_path = '' as $$ select to_char(p_code, 'DD/MM/YYYY') $$;

-- Date au hasard entre 1000 et 2025, hors dates interdites ; l'unicité est vérifiée à l'insertion.
create function histoire.tirer_code_salon() returns date
language plpgsql volatile set search_path = '' as $$
declare d date;
begin
  loop
    d := date '1000-01-01' + floor(random() * (date '2025-12-31' - date '1000-01-01' + 1))::integer;
    if not d = any(histoire.codes_salon_interdits()) then return d; end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Réglages de l'hôte
-- ---------------------------------------------------------------------------

-- Complète avec les valeurs par défaut et refuse toute clé ou valeur inconnue.
create function histoire.reglages_salon(p_mode text, p_reglages jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  r jsonb;
  c jsonb;
  k text;
  cat jsonb;
  cible jsonb;
begin
  p_reglages := coalesce(p_reglages, '{}');
  if jsonb_typeof(p_reglages) <> 'object' then
    raise exception using errcode = '22023', message = 'Réglages invalides';
  end if;
  for k in select jsonb_object_keys(p_reglages) loop
    if k not in ('questions', 'precision', 'questions_periode', 'mode_visible', 'mode_chrono', 'contenu') then
      raise exception using errcode = '22023', message = format('Réglage inconnu : %s', k);
    end if;
  end loop;

  r := jsonb_build_object('questions', 10, 'precision', 'YEAR', 'questions_periode', false,
    'mode_visible', false, 'mode_chrono', false) || (p_reglages - 'contenu');
  if jsonb_typeof(r->'questions') <> 'number' or (r->>'questions') not in ('5', '10', '20') then
    raise exception using errcode = '22023', message = 'Nombre de questions : 5, 10 ou 20';
  end if;
  if jsonb_typeof(r->'precision') <> 'string' or (r->>'precision') not in ('YEAR', 'MONTH', 'DAY') then
    raise exception using errcode = '22023', message = 'Précision : YEAR, MONTH ou DAY';
  end if;
  foreach k in array array['questions_periode', 'mode_visible', 'mode_chrono'] loop
    if jsonb_typeof(r->k) <> 'boolean' then
      raise exception using errcode = '22023', message = format('%s : vrai ou faux', k);
    end if;
  end loop;

  -- Contenu : choix direct (cible), Mystère (roulette), vote (Convivial) ou pick & ban (1 contre 1),
  -- avec la ou les catégories proposées.
  c := coalesce(p_reglages->'contenu', '{}');
  if jsonb_typeof(c) <> 'object' then
    raise exception using errcode = '22023', message = 'Contenu invalide';
  end if;
  for k in select jsonb_object_keys(c) loop
    if k not in ('choix', 'categories', 'cible') then
      raise exception using errcode = '22023', message = format('Réglage de contenu inconnu : %s', k);
    end if;
  end loop;
  c := jsonb_build_object('choix', case when p_mode = 'un_contre_un' then 'pick_ban' else 'direct' end,
    'categories', '["pack"]'::jsonb, 'cible', null) || c;
  if jsonb_typeof(c->'choix') <> 'string' or (c->>'choix') not in ('direct', 'mystere', 'vote', 'pick_ban')
    or (c->>'choix' = 'vote' and p_mode <> 'convivial')
    or (c->>'choix' = 'pick_ban' and p_mode <> 'un_contre_un') then
    raise exception using errcode = '22023', message = 'Choix du contenu invalide pour ce mode';
  end if;
  cat := c->'categories';
  if jsonb_typeof(cat) <> 'array' or jsonb_array_length(cat) not between 1 and 3
    or exists (select 1 from jsonb_array_elements(cat) e where jsonb_typeof(e) <> 'string' or e #>> '{}' not in ('pack', 'periode', 'theme'))
    or (select count(distinct e #>> '{}') from jsonb_array_elements(cat) e) <> jsonb_array_length(cat) then
    raise exception using errcode = '22023', message = 'Catégories : pack, periode et/ou theme';
  end if;
  cible := c->'cible';
  if jsonb_typeof(cible) <> 'null' then
    if jsonb_typeof(cible) <> 'object' or (select count(*) from jsonb_object_keys(cible)) <> 2
      or jsonb_typeof(cible->'type') <> 'string' or (cible->>'type') not in ('pack', 'periode', 'theme')
      or jsonb_typeof(cible->'id') <> 'string' or length(cible->>'id') not between 1 and 80 then
      raise exception using errcode = '22023', message = 'Cible : {"type": pack|periode|theme, "id": …}';
    end if;
  end if;
  return r || jsonb_build_object('contenu', c);
end;
$$;

-- ---------------------------------------------------------------------------
-- Outils internes (aucun droit pour les rôles API)
-- ---------------------------------------------------------------------------

-- Membre qui appelle : par son compte, ou par son jeton d'invité.
create function histoire.membre_appelant(p_salon_id uuid, p_jeton text)
returns histoire.salon_membres
language plpgsql stable security definer set search_path = '' as $$
declare m histoire.salon_membres;
begin
  if auth.uid() is not null then
    select * into m from histoire.salon_membres where salon_id = p_salon_id and user_id = auth.uid();
  elsif p_jeton ~ '^[a-f0-9]{64}$' then
    select * into m from histoire.salon_membres
      where salon_id = p_salon_id and jeton_invite_hash = sha256(convert_to(p_jeton, 'UTF8'));
  end if;
  if m.id is null then
    raise exception using errcode = '42501', message = 'Salon inaccessible';
  end if;
  return m;
end;
$$;

-- Retire un membre ; le dernier ferme le salon (code libéré), sinon la couronne
-- passe au membre arrivé juste après l'hôte, c'est-à-dire le plus ancien restant.
create function histoire.retirer_membre(p_membre_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m histoire.salon_membres;
begin
  delete from histoire.salon_membres where id = p_membre_id returning * into m;
  if m.id is null then return; end if;
  if not exists (select 1 from histoire.salon_membres where salon_id = m.salon_id) then
    delete from histoire.salons where id = m.salon_id;
    return;
  end if;
  if m.est_hote then
    update histoire.salon_membres set est_hote = true where id = (
      select id from histoire.salon_membres where salon_id = m.salon_id order by ordre limit 1);
  end if;
  update histoire.salons set version = version + 1, activite_le = clock_timestamp() where id = m.salon_id;
end;
$$;

-- Purge opportuniste (pas de planificateur) : salons sans activité depuis 2 h et vieux essais de code.
create function histoire.purger_salons() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from histoire.salons where id in (
    select id from histoire.salons
    where activite_le < clock_timestamp() - interval '2 hours'
    order by activite_le limit 200 for update skip locked);
  delete from histoire.salon_essais_code where id in (
    select id from histoire.salon_essais_code
    where essai_le < clock_timestamp() - interval '1 hour'
    order by id limit 1000 for update skip locked);
end;
$$;

-- Entrée commune aux deux façons de rejoindre (code ou lien). Le salon doit être verrouillé.
create function histoire.entrer_salon(p_salon histoire.salons, p_pseudo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
  ancien uuid;
  v_pseudo text;
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
    v_pseudo := btrim(coalesce(p_pseudo, ''));
    if length(v_pseudo) not between 2 and 20 or v_pseudo ~ '[[:cntrl:]]' then
      raise exception using errcode = '22023', message = 'Pseudo : 2 à 20 caractères';
    end if;
    if exists (select 1 from histoire.salon_membres where salon_id = p_salon.id and lower(salon_membres.pseudo) = lower(v_pseudo)) then
      raise exception using errcode = '22023', message = 'Ce pseudo est déjà pris dans le salon';
    end if;
    jeton := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into histoire.salon_membres(salon_id, jeton_invite_hash, pseudo)
      values (p_salon.id, sha256(convert_to(jeton, 'UTF8')), v_pseudo) returning * into m;
  end if;
  update histoire.salons set version = version + 1, activite_le = clock_timestamp() where id = p_salon.id;
  return jsonb_strip_nulls(jsonb_build_object('salon_id', p_salon.id, 'membre_id', m.id,
    'code', histoire.format_code_salon(p_salon.code), 'jeton', jeton));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC du navigateur
-- ---------------------------------------------------------------------------

-- Créer un salon (compte requis). Renvoie l'identifiant, le code JJ/MM/AAAA et le membre hôte.
create function histoire.creer_salon(
  p_mode text default 'convivial',
  p_visibilite text default 'prive',
  p_max_joueurs integer default null,
  p_reglages jsonb default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s histoire.salons;
  ancien uuid;
  v_pseudo text;
  m histoire.salon_membres;
  essai integer := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Connexion requise pour créer un salon';
  end if;
  if p_mode not in ('convivial', 'un_contre_un') or p_visibilite not in ('prive', 'ouvert') then
    raise exception using errcode = '22023', message = 'Mode ou visibilité invalide';
  end if;
  p_max_joueurs := case when p_mode = 'un_contre_un' then 2 else coalesce(p_max_joueurs, 8) end;
  if p_max_joueurs not between 2 and 10 then
    raise exception using errcode = '22023', message = 'De 2 à 10 joueurs';
  end if;
  perform histoire.purger_salons();

  select id into ancien from histoire.salon_membres where user_id = auth.uid();
  if ancien is not null then perform histoire.retirer_membre(ancien); end if;

  loop
    essai := essai + 1;
    begin
      insert into histoire.salons(code, mode, visibilite, max_joueurs, reglages, cree_par)
        values (histoire.tirer_code_salon(), p_mode, p_visibilite, p_max_joueurs,
          histoire.reglages_salon(p_mode, p_reglages), auth.uid())
        returning * into s;
      exit;
    exception when unique_violation then
      if essai >= 50 then
        raise exception using errcode = '53400', message = 'Aucun code de salon disponible, réessaie';
      end if;
    end;
  end loop;

  select nullif(btrim(p.username), '') into v_pseudo from public.profiles p where p.id = auth.uid();
  insert into histoire.salon_membres(salon_id, user_id, pseudo, est_hote)
    values (s.id, auth.uid(), left(coalesce(v_pseudo, 'Joueur'), 40), true) returning * into m;
  return jsonb_build_object('salon_id', s.id, 'membre_id', m.id, 'code', histoire.format_code_salon(s.code));
end;
$$;

-- Rejoindre avec le code JJ/MM/AAAA. Compte : pseudo KFFR. Invité : p_pseudo, et la réponse
-- contient un jeton secret à garder (il sert à toutes les RPC suivantes).
-- Anti-devinette : 20 codes faux par 10 minutes et par appelant (compte, sinon adresse IP).
-- Un code faux renvoie {"erreur": "code_inconnu"} sans exception, pour que l'essai reste compté.
create function histoire.rejoindre_salon(p_code text, p_pseudo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cle text;
  entetes jsonb;
  d date;
  s histoire.salons;
begin
  if auth.uid() is not null then
    v_cle := 'compte:' || auth.uid();
  else
    begin
      entetes := nullif(current_setting('request.headers', true), '')::jsonb;
    exception when others then
      entetes := null;
    end;
    v_cle := 'ip:' || coalesce(nullif(btrim(split_part(entetes->>'x-forwarded-for', ',', 1)), ''), 'inconnue');
  end if;
  if (select count(*) from histoire.salon_essais_code
      where salon_essais_code.cle = v_cle and essai_le > clock_timestamp() - interval '10 minutes') >= 20 then
    raise exception using errcode = '53400', message = 'Trop de codes essayés : réessaie dans quelques minutes';
  end if;
  perform histoire.purger_salons();

  d := histoire.lire_code_salon(p_code);
  if d is not null then
    select * into s from histoire.salons where code = d for update;
  end if;
  if s.id is null then
    insert into histoire.salon_essais_code(cle) values (v_cle);
    return jsonb_build_object('erreur', 'code_inconnu');
  end if;
  return histoire.entrer_salon(s, p_pseudo);
end;
$$;

-- Rejoindre par le lien d'invitation (il contient l'identifiant du salon, impossible à deviner).
create function histoire.rejoindre_salon_par_lien(p_salon_id uuid, p_pseudo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s histoire.salons;
begin
  select * into s from histoire.salons where id = p_salon_id for update;
  if s.id is null then
    raise exception using errcode = '42501', message = 'Ce salon n''existe plus';
  end if;
  return histoire.entrer_salon(s, p_pseudo);
end;
$$;

create function histoire.quitter_salon(p_salon_id uuid, p_jeton text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare m histoire.salon_membres;
begin
  perform 1 from histoire.salons where id = p_salon_id for update;
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  perform histoire.retirer_membre(m.id);
end;
$$;

-- État du salon pour l'affichage : jamais de jeton ni d'identifiant de compte.
create function histoire.etat_salon(p_salon_id uuid, p_jeton text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s histoire.salons;
  m histoire.salon_membres;
begin
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  update histoire.salons set activite_le = clock_timestamp() where id = p_salon_id returning * into s;
  return jsonb_build_object(
    'salon', jsonb_build_object('id', s.id, 'code', histoire.format_code_salon(s.code), 'mode', s.mode,
      'visibilite', s.visibilite, 'max_joueurs', s.max_joueurs, 'reglages', s.reglages,
      'etat', s.etat, 'version', s.version),
    'moi', m.id,
    'membres', (select jsonb_agg(jsonb_build_object('id', x.id, 'pseudo', x.pseudo, 'est_hote', x.est_hote,
        'invite', x.user_id is null, 'ordre', x.ordre) order by x.ordre)
      from histoire.salon_membres x where x.salon_id = s.id));
end;
$$;

-- Réglages, visibilité et nombre de places : l'hôte seul, et seulement entre deux parties.
-- p_reglages remplace les clés données (fusion de premier niveau), puis tout est revalidé.
create function histoire.modifier_salon(
  p_salon_id uuid,
  p_jeton text default null,
  p_reglages jsonb default null,
  p_visibilite text default null,
  p_max_joueurs integer default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s histoire.salons;
  m histoire.salon_membres;
begin
  select * into s from histoire.salons where id = p_salon_id for update;
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  if not m.est_hote then
    raise exception using errcode = '42501', message = 'Seul l''hôte change les réglages';
  end if;
  if s.etat <> 'attente' then
    raise exception using errcode = '55000', message = 'Partie en cours';
  end if;
  if p_reglages is not null and jsonb_typeof(p_reglages) <> 'object' then
    raise exception using errcode = '22023', message = 'Réglages invalides';
  end if;
  if p_visibilite is not null and p_visibilite not in ('prive', 'ouvert') then
    raise exception using errcode = '22023', message = 'Visibilité invalide';
  end if;
  if p_max_joueurs is not null and (s.mode = 'un_contre_un' and p_max_joueurs <> 2
      or p_max_joueurs not between 2 and 10
      or p_max_joueurs < (select count(*) from histoire.salon_membres where salon_id = s.id)) then
    raise exception using errcode = '22023', message = 'Nombre de places invalide';
  end if;
  update histoire.salons set
    reglages = histoire.reglages_salon(s.mode, s.reglages || coalesce(p_reglages, '{}')),
    visibilite = coalesce(p_visibilite, visibilite),
    max_joueurs = coalesce(p_max_joueurs, max_joueurs),
    version = version + 1,
    activite_le = clock_timestamp()
  where id = s.id;
  return histoire.etat_salon(p_salon_id, p_jeton);
end;
$$;

-- Expulser un membre (l'hôte seul). Un compte expulsé ne peut plus revenir dans ce salon.
create function histoire.expulser_membre(p_salon_id uuid, p_membre_id uuid, p_jeton text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
  cible histoire.salon_membres;
begin
  perform 1 from histoire.salons where id = p_salon_id for update;
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  if not m.est_hote then
    raise exception using errcode = '42501', message = 'Seul l''hôte peut expulser';
  end if;
  select * into cible from histoire.salon_membres where id = p_membre_id and salon_id = p_salon_id;
  if cible.id is null or cible.id = m.id then
    raise exception using errcode = '22023', message = 'Membre introuvable';
  end if;
  if cible.user_id is not null then
    insert into histoire.salon_exclus(salon_id, user_id) values (p_salon_id, cible.user_id) on conflict do nothing;
  end if;
  perform histoire.retirer_membre(cible.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

revoke all on function
  histoire.codes_salon_interdits(), histoire.lire_code_salon(text), histoire.format_code_salon(date),
  histoire.tirer_code_salon(), histoire.reglages_salon(text, jsonb),
  histoire.membre_appelant(uuid, text), histoire.retirer_membre(uuid), histoire.purger_salons(),
  histoire.entrer_salon(histoire.salons, text),
  histoire.creer_salon(text, text, integer, jsonb), histoire.rejoindre_salon(text, text),
  histoire.rejoindre_salon_par_lien(uuid, text), histoire.quitter_salon(uuid, text),
  histoire.etat_salon(uuid, text), histoire.modifier_salon(uuid, text, jsonb, text, integer),
  histoire.expulser_membre(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function histoire.creer_salon(text, text, integer, jsonb) to authenticated;
grant execute on function
  histoire.rejoindre_salon(text, text), histoire.rejoindre_salon_par_lien(uuid, text),
  histoire.quitter_salon(uuid, text), histoire.etat_salon(uuid, text),
  histoire.modifier_salon(uuid, text, jsonb, text, integer), histoire.expulser_membre(uuid, uuid, text)
  to anon, authenticated;

insert into histoire.migrations_appliquees(version, nom) values ('20261022090000', 'salons_multijoueur');
notify pgrst, 'reload schema';
commit;
