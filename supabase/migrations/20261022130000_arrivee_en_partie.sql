-- #137 (décision de Maxou, 22 oct.) : un joueur qui entre pendant une partie attend dans le salon ;
-- entre deux parties, l'hôte l'accepte ou le refuse. Schéma histoire exclusivement.
begin;

alter table histoire.salon_membres add column en_attente boolean not null default false;

-- Posé par la base, pas par l'appelant : vrai si le salon est en partie au moment de l'entrée.
create function histoire.marquer_arrivee_en_partie() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.en_attente := exists (select 1 from histoire.salons where id = new.salon_id and etat = 'partie');
  return new;
end;
$$;
create trigger salon_membres_arrivee_en_partie before insert on histoire.salon_membres
  for each row execute function histoire.marquer_arrivee_en_partie();

-- État du salon : chaque membre dit en plus s'il attend l'accord de l'hôte.
create or replace function histoire.etat_salon(p_salon_id uuid, p_jeton text default null) returns jsonb
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
        'invite', x.user_id is null, 'ordre', x.ordre, 'en_attente', x.en_attente) order by x.ordre)
      from histoire.salon_membres x where x.salon_id = s.id));
end;
$$;

-- L'hôte accepte un joueur arrivé pendant la partie (le refuser, c'est expulser_membre).
create function histoire.accepter_membre(p_salon_id uuid, p_membre_id uuid, p_jeton text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m histoire.salon_membres;
begin
  perform 1 from histoire.salons where id = p_salon_id for update;
  m := histoire.membre_appelant(p_salon_id, p_jeton);
  if not m.est_hote then
    raise exception using errcode = '42501', message = 'Seul l''hôte accepte les joueurs';
  end if;
  update histoire.salon_membres set en_attente = false where id = p_membre_id and salon_id = p_salon_id;
  if not found then
    raise exception using errcode = '22023', message = 'Ce joueur n''est plus dans le salon';
  end if;
  update histoire.salons set version = version + 1, activite_le = clock_timestamp() where id = p_salon_id;
end;
$$;

revoke all on function histoire.marquer_arrivee_en_partie(), histoire.accepter_membre(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function histoire.accepter_membre(uuid, uuid, text) to anon, authenticated;

insert into histoire.migrations_appliquees(version, nom) values ('20261022130000', 'arrivee_en_partie');
notify pgrst, 'reload schema';
commit;
