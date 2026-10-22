-- #135 : temps réel des salons. Schéma histoire exclusivement (rien dans public, auth ni realtime).
-- Le canal Realtime du salon est public (son nom contient l'uuid du salon, connu des seuls membres) :
-- les invités n'ont pas de session, et protéger le canal demanderait des policies dans le schéma
-- realtime, qui n'appartient pas à ce jeu. Rien de secret n'y passe : le serveur reste l'arbitre.
begin;

-- Battement de présence : un membre silencieux depuis plus de 30 s perd sa place.
alter table histoire.salon_membres add column vu_le timestamptz not null default clock_timestamp();
create index salon_membres_vu_le_idx on histoire.salon_membres(vu_le);

-- Plafond de joueurs connectés pour Histoire : le plan gratuit offre 200 connexions Realtime,
-- partagées avec KFFR contrée. Chaque membre actif tient une connexion.
create table histoire.limites_temps_reel (
  id boolean primary key default true check (id),
  max_connexions integer not null default 120 check (max_connexions > 0),
  -- Places gardées pour ceux qui rejoignent un salon existant : on refuse d'abord les nouveaux salons.
  reserve_salons integer not null default 10 check (reserve_salons >= 0)
);
insert into histoire.limites_temps_reel default values;
alter table histoire.limites_temps_reel enable row level security;
revoke all on histoire.limites_temps_reel from public, anon, authenticated;

-- Heure du serveur en millisecondes : le client en déduit son décalage d'horloge.
create function histoire.heure_serveur() returns bigint
language sql volatile set search_path = '' as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

-- Retire les membres absents depuis plus de 30 s d'un salon (couronne transmise par retirer_membre).
create function histoire.retirer_absents(p_salon_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select id from histoire.salon_membres
    where salon_id = p_salon_id and vu_le < clock_timestamp() - interval '30 seconds'
    order by ordre
  loop
    perform histoire.retirer_membre(r.id);
  end loop;
end;
$$;

-- Battement envoyé par chaque membre toutes les 10 s. Il garde sa place, retire les absents
-- et renvoie l'heure du serveur et la version du salon (le client recharge l'état si elle a changé).
create function histoire.battement_salon(p_salon_id uuid, p_jeton text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
  v integer;
begin
  perform 1 from histoire.salons where id = p_salon_id for update;
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  update histoire.salon_membres set vu_le = clock_timestamp() where id = m.id;
  perform histoire.retirer_absents(p_salon_id);
  update histoire.salons set activite_le = clock_timestamp() where id = p_salon_id returning version into v;
  return jsonb_build_object('heure_serveur', histoire.heure_serveur(), 'version', v);
end;
$$;

-- Garde-fou de capacité, posé en déclencheur pour couvrir toutes les façons d'entrer.
create function histoire.verifier_capacite_temps_reel() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  l histoire.limites_temps_reel;
  actifs bigint;
begin
  select * into strict l from histoire.limites_temps_reel where id;
  select count(*) into actifs from histoire.salon_membres where vu_le > clock_timestamp() - interval '30 seconds';
  if tg_table_name = 'salons' then
    if actifs >= l.max_connexions - l.reserve_salons then
      raise exception using errcode = '53400', message = 'Trop de joueurs en ligne : réessaie dans quelques minutes';
    end if;
  elsif actifs >= l.max_connexions then
    raise exception using errcode = '53400', message = 'Trop de joueurs en ligne : réessaie dans quelques minutes';
  end if;
  return new;
end;
$$;
create trigger verifier_capacite_salon before insert on histoire.salons
  for each row execute function histoire.verifier_capacite_temps_reel();
create trigger verifier_capacite_membre before insert on histoire.salon_membres
  for each row execute function histoire.verifier_capacite_temps_reel();

revoke all on function histoire.heure_serveur(), histoire.retirer_absents(uuid),
  histoire.battement_salon(uuid, text), histoire.verifier_capacite_temps_reel()
  from public, anon, authenticated;
grant execute on function histoire.heure_serveur(), histoire.battement_salon(uuid, text) to anon, authenticated;

insert into histoire.migrations_appliquees(version, nom) values ('20261022100000', 'temps_reel_salons');
notify pgrst, 'reload schema';
commit;
