-- #92 PHASE 2 : PRÉPARÉE UNIQUEMENT. GO SQL distinct avant toute exécution KFFR.
-- Additif, schéma histoire seulement. Aucune mutation de learning_progress/parties/réponses.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table histoire.pedagogical_units (
  chapter_id text primary key references histoire.chapters(id) on delete restrict,
  parent_id text references histoire.chapters(id) on delete restrict,
  slug text not null unique,
  content_version text not null check (btrim(content_version) <> ''),
  etat text not null check (etat in ('actif','historique','inactif')),
  expected_event_ids text[] not null,
  rubriques jsonb not null default '{}' check (jsonb_typeof(rubriques)='object'),
  blocages text[] not null default '{}',
  content_approval text,
  illustration_approval text,
  catalogue_approval text,
  published_fingerprint text,
  current_version text,
  check (chapter_id is distinct from parent_id)
);
alter table histoire.pedagogical_units enable row level security;
revoke all on histoire.pedagogical_units from public,anon,authenticated;
grant all on histoire.pedagogical_units to service_role;

-- Marqueur permanent : une absence de ligne après initialisation ferme l'accès.
create table histoire.pedagogical_registry (singleton boolean primary key default true check(singleton), initialized boolean not null default false);
insert into histoire.pedagogical_registry values(true,false);
alter table histoire.pedagogical_registry enable row level security;
revoke all on histoire.pedagogical_registry from public,anon,authenticated;
grant all on histoire.pedagogical_registry to service_role;

-- Instantanés privés : corpus et admissibilité au test indépendants du canon futur.
create table histoire.pedagogical_editions (
  chapter_id text not null references histoire.pedagogical_units(chapter_id) on delete restrict,
  version text not null,
  cards jsonb not null check(jsonb_typeof(cards)='array'),
  candidates jsonb not null check(jsonb_typeof(candidates)='array'),
  published boolean not null default false,
  content_approval text,
  illustration_approval text,
  catalogue_approval text,
  primary key(chapter_id,version)
);
alter table histoire.pedagogical_editions enable row level security;
revoke all on histoire.pedagogical_editions from public,anon,authenticated;
grant all on histoire.pedagogical_editions to service_role;
alter table histoire.pedagogical_units add foreign key(chapter_id,current_version)
  references histoire.pedagogical_editions(chapter_id,version);

create function histoire.protect_pedagogical_edition() returns trigger
language plpgsql security invoker set search_path='' as $$begin
  if old.published and (tg_op='DELETE' or to_jsonb(new) is distinct from to_jsonb(old)) then
    raise exception 'Édition publiée immuable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;$$;
revoke all on function histoire.protect_pedagogical_edition() from public,anon,authenticated;
create trigger protected_edition before update or delete on histoire.pedagogical_editions for each row execute function histoire.protect_pedagogical_edition();

create function histoire.snapshot_pedagogical_edition(p_chapter_id text,p_version text)
returns void language plpgsql security invoker set search_path='' as $$begin
  insert into histoire.pedagogical_editions(chapter_id,version,cards,candidates,published)
  select p_chapter_id,p_version,
    coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from histoire.chapter_cards c where c.chapter_id=p_chapter_id),'[]'),
    coalesce((select jsonb_agg(jsonb_build_object('id',c.event_id,'title',c.title,'image_path',e.image_path,
      'start_year',c.start_year,'start_month',c.start_month,'start_day',c.start_day,'description',c.body) order by c.sort_order)
      from histoire.chapter_cards c join histoire.events e on e.id=c.event_id
      where c.chapter_id=p_chapter_id and e.playable and e.playable_mode in ('YEAR','MONTH','DAY','RANGE') and c.start_year is not null),'[]'),true
  on conflict do nothing;
end;$$;
revoke all on function histoire.snapshot_pedagogical_edition(text,text) from public,anon,authenticated;
grant execute on function histoire.snapshot_pedagogical_edition(text,text) to service_role;

-- Filiation explicite des futures copies, jamais des SVG copiés. Aucun contenu créé ici.
create table histoire.pedagogical_card_lineage (
  card_id text primary key references histoire.chapter_cards(card_id) on delete cascade,
  source_card_id text not null references histoire.chapter_cards(card_id) on delete restrict,
  check (card_id <> source_card_id)
);
alter table histoire.pedagogical_card_lineage enable row level security;
revoke all on histoire.pedagogical_card_lineage from public,anon,authenticated;
grant all on histoire.pedagogical_card_lineage to service_role;

create function histoire.pedagogical_fingerprint(p_chapter_id text)
returns text language sql stable security invoker set search_path = '' as $$
  select md5(coalesce(string_agg(to_jsonb(c)::text,'|' order by c.card_id),''))
  from histoire.chapter_cards c where c.chapter_id=p_chapter_id;
$$;
revoke all on function histoire.pedagogical_fingerprint(text) from public,anon,authenticated;
grant execute on function histoire.pedagogical_fingerprint(text) to service_role;

-- Predicate de disponibilité uniquement : ne publie ni corpus, ni réponses, ni validations.
create function histoire.pedagogical_available(p_chapter_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from histoire.chapters c where c.id=p_chapter_id) and
    (case when coalesce((select r.initialized from histoire.pedagogical_registry r where singleton),true) then
      exists(select 1 from histoire.pedagogical_units u where u.chapter_id=p_chapter_id and u.etat<>'inactif')
    else not exists(select 1 from histoire.pedagogical_units u where u.chapter_id=p_chapter_id and u.etat='inactif') end);
$$;
revoke all on function histoire.pedagogical_available(text) from public,anon,authenticated;
grant execute on function histoire.pedagogical_available(text) to anon,authenticated,service_role;
create policy "brouillons pedagogiques caches" on histoire.chapters as restrictive for select
  to anon,authenticated using (histoire.pedagogical_available(id));
create policy "liens des brouillons caches" on histoire.event_chapters as restrictive for select
  to anon,authenticated using (histoire.pedagogical_available(chapter_id));

-- ID/URL et édition initiale restent stables. Chaque édition publiée est immuable.
-- Les complétions ajoutent une édition interne ; aucun score legacy n'est réinterprété.
create function histoire.protect_pedagogical_history()
returns trigger language plpgsql security definer set search_path = '' as $$
declare id text; destination text;
begin
  if tg_table_name='pedagogical_units' then
    if new.current_version is not null and not exists(select 1 from histoire.pedagogical_editions e
      where e.chapter_id=new.chapter_id and e.version=new.current_version and e.version='completion-v1' and e.published) then
      raise exception 'Édition active non publiée';
    end if;
    if tg_op='DELETE' or (new.chapter_id,new.parent_id,new.slug,new.content_version,new.expected_event_ids,new.rubriques)
      is distinct from (old.chapter_id,old.parent_id,old.slug,old.content_version,old.expected_event_ids,old.rubriques) then
      raise exception 'Identifiant, URL, version et périmètre pédagogiques immuables';
    end if;
    return new;
  end if;
  if tg_table_name='pedagogical_card_lineage' then
    select c.chapter_id into id from histoire.chapter_cards c where c.card_id=coalesce(to_jsonb(old)->>'card_id',to_jsonb(new)->>'card_id');
    select c.chapter_id into destination from histoire.chapter_cards c where c.card_id=to_jsonb(new)->>'card_id';
  else
  id := case when tg_table_name='chapters' then to_jsonb(old)->>'id'
    when tg_op='INSERT' then to_jsonb(new)->>'chapter_id' else to_jsonb(old)->>'chapter_id' end;
  destination := case when tg_table_name='chapters' then to_jsonb(new)->>'id' else to_jsonb(new)->>'chapter_id' end;
  end if;
  if exists(select 1 from histoire.pedagogical_units u where u.chapter_id in (id,destination) and u.published_fingerprint is not null) then
    if tg_op='DELETE' or (tg_op='INSERT') or to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception 'Périmètre pédagogique publié protégé : %',id;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function histoire.protect_pedagogical_history() from public,anon,authenticated;
create trigger protected_unit before update or delete on histoire.pedagogical_units
  for each row execute function histoire.protect_pedagogical_history();
create trigger protected_chapter before update or delete on histoire.chapters
  for each row execute function histoire.protect_pedagogical_history();
create trigger protected_card before insert or update or delete on histoire.chapter_cards
  for each row execute function histoire.protect_pedagogical_history();
create trigger protected_curriculum before insert or update or delete on histoire.event_chapters
  for each row execute function histoire.protect_pedagogical_history();
create trigger protected_lineage before insert or update or delete on histoire.pedagogical_card_lineage
  for each row execute function histoire.protect_pedagogical_history();

-- Enregistrement explicite du manifeste contrôlé, réservé à l'import. Aucun transfert de progression.
create function histoire.register_pedagogical_structure(p_units jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare item jsonb; parent histoire.chapters; unit_id text; existing histoire.pedagogical_units; expected text[];
begin
  perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
  if jsonb_typeof(p_units) is distinct from 'array' or jsonb_array_length(p_units)<>59
    or (select count(distinct x->>'id') from jsonb_array_elements(p_units) x)<>59 then
    raise exception 'Manifeste pédagogique incomplet ou dupliqué';
  end if;
  for item in select x from jsonb_array_elements(p_units) x order by (x->>'parent_id') nulls first,x->>'id' loop
    unit_id := item->>'id';
    if unit_id !~ '^THM-[0-9]{3}$' or coalesce(item->>'content_version','')='' or coalesce(item->>'slug','')='' then
      raise exception 'Métadonnées pédagogiques invalides';
    end if;
    if item->>'parent_id' is null then
      if not exists(select 1 from histoire.chapters c where c.id=unit_id) then raise exception 'Chapitre historique absent : %',unit_id; end if;
      select array_agg(ec.event_id order by ec.event_id) into expected from histoire.event_chapters ec where ec.chapter_id=unit_id;
    else
      select * into parent from histoire.chapters c where c.id=item->>'parent_id';
      if not found then raise exception 'Parent absent'; end if;
      expected := array(select jsonb_array_elements_text(item->'event_ids') order by 1);
      if cardinality(expected) not between 5 and 20
        or cardinality(expected)<>(select count(distinct e) from unnest(expected) e)
        or exists(select 1 from unnest(expected) e where not exists(select 1 from histoire.event_chapters ec where ec.chapter_id=parent.id and ec.event_id=e)) then
        raise exception 'Corpus enfant incohérent';
      end if;
      insert into histoire.chapters(id,level_id,school_year,program_scope,title)
        values(unit_id,parent.level_id,parent.school_year,parent.program_scope,item->>'titre') on conflict do nothing;
      insert into histoire.event_chapters(event_id,chapter_id,curriculum_status)
        select ec.event_id,unit_id,ec.curriculum_status from histoire.event_chapters ec
        where ec.chapter_id=parent.id and ec.event_id=any(expected)
          and not exists(select 1 from histoire.event_chapters current_link where current_link.chapter_id=unit_id and current_link.event_id=ec.event_id)
        on conflict do nothing;
    end if;
    select * into existing from histoire.pedagogical_units u where u.chapter_id=unit_id;
    if found then
      if (existing.parent_id,existing.slug,existing.content_version,existing.expected_event_ids,existing.rubriques)
        is distinct from (item->>'parent_id',item->>'slug',item->>'content_version',coalesce(expected,'{}'::text[]),coalesce(item->'rubriques','{}'::jsonb)) then
        raise exception 'Réimport incompatible avec le périmètre publié';
      end if;
    else
      insert into histoire.pedagogical_units(chapter_id,parent_id,slug,content_version,etat,expected_event_ids,rubriques,blocages,published_fingerprint)
      values(unit_id,item->>'parent_id',item->>'slug',item->>'content_version',
        case when item->>'parent_id' is null then 'actif' else 'inactif' end,coalesce(expected,'{}'),coalesce(item->'rubriques','{}'::jsonb),
        array(select jsonb_array_elements_text(coalesce(item->'blocages','[]'))),
        case when item->>'parent_id' is null then histoire.pedagogical_fingerprint(unit_id) end);
    end if;
  end loop;
  perform histoire.snapshot_pedagogical_edition(u.chapter_id,u.content_version)
    from histoire.pedagogical_units u where u.published_fingerprint is not null;
  -- Chaque union remplace exactement un parent, sans doublon ni trou.
  if exists(select 1 from histoire.pedagogical_units p where p.parent_id is null and exists(select 1 from histoire.pedagogical_units c where c.parent_id=p.chapter_id)
    and (select array_agg(e order by e) from histoire.pedagogical_units c cross join lateral unnest(c.expected_event_ids) e where c.parent_id=p.chapter_id)
      is distinct from p.expected_event_ids) then raise exception 'Partition parent/enfants inexacte'; end if;
  update histoire.pedagogical_registry set initialized=true where singleton;
end;
$$;
revoke all on function histoire.register_pedagogical_structure(jsonb) from public,anon,authenticated;
grant execute on function histoire.register_pedagogical_structure(jsonb) to service_role;

-- Liens importés dans une transaction. Les associations enregistrées restent exactement conservées.
create function histoire.sync_pedagogical_links(p_links jsonb,p_event_ids text[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
  if jsonb_typeof(p_links) is distinct from 'array' or cardinality(p_event_ids)=0 then raise exception 'Lot de liens invalide'; end if;
  delete from histoire.event_chapters ec where ec.event_id=any(p_event_ids)
    and not exists(select 1 from histoire.pedagogical_units u where u.chapter_id=ec.chapter_id)
    and not exists(select 1 from jsonb_to_recordset(p_links) as x(event_id text,chapter_id text) where x.event_id=ec.event_id and x.chapter_id=ec.chapter_id);
  insert into histoire.event_chapters(event_id,chapter_id,curriculum_status)
    select x.event_id,x.chapter_id,x.curriculum_status from jsonb_to_recordset(p_links) as x(event_id text,chapter_id text,curriculum_status text)
    where not exists(select 1 from histoire.event_chapters ec where ec.event_id=x.event_id and ec.chapter_id=x.chapter_id)
    on conflict do nothing;
end;
$$;
revoke all on function histoire.sync_pedagogical_links(jsonb,text[]) from public,anon,authenticated;
grant execute on function histoire.sync_pedagogical_links(jsonb,text[]) to service_role;

-- Les anciens lots identiques sont un no-op ; un retrait/modification historique est refusé.
create or replace function histoire.replace_chapter_cards(p_cards jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare chapter text; incoming jsonb; previous jsonb; protected boolean; n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
  if jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards)=0 then raise exception 'Lot de cartes vide ou invalide'; end if;
  lock table histoire.chapter_cards in share row exclusive mode;
  for chapter in select distinct x->>'chapter_id' from jsonb_array_elements(p_cards) x loop
    select jsonb_agg(to_jsonb(c) order by c.card_id),count(*) into incoming,n
      from jsonb_populate_recordset(null::histoire.chapter_cards,p_cards) c where c.chapter_id=chapter;
    select jsonb_agg(to_jsonb(c) order by c.card_id) into previous from histoire.chapter_cards c where c.chapter_id=chapter;
    select exists(select 1 from histoire.pedagogical_units u where u.chapter_id=chapter and u.published_fingerprint is not null) into protected;
    if protected then
      if incoming is distinct from previous then raise exception 'Lot modifiant les cartes historiques de %',chapter; end if;
    else
      if n not between 1 and 64 or (select count(distinct c.sort_order)<>n or min(c.sort_order)<>1 or max(c.sort_order)<>n
        from jsonb_populate_recordset(null::histoire.chapter_cards,p_cards) c where c.chapter_id=chapter) then raise exception 'Volume ou ordre de cartes invalide'; end if;
      delete from histoire.chapter_cards where chapter_id=chapter;
      insert into histoire.chapter_cards select c.* from jsonb_populate_recordset(null::histoire.chapter_cards,p_cards) c where c.chapter_id=chapter;
    end if;
  end loop;
end;
$$;

-- Validations privées liées aux octets du contenu. Publication atomique d'un groupe complet.
create function histoire.import_pedagogical_cards(p_cards jsonb,p_lineage jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
  if jsonb_typeof(p_lineage) is distinct from 'array' or jsonb_typeof(p_cards) is distinct from 'array'
    or exists(select 1 from jsonb_array_elements(p_cards) c where not exists(
      select 1 from histoire.pedagogical_units u where u.chapter_id=c->>'chapter_id' and u.parent_id is not null and u.etat='inactif')) then
    raise exception 'Import réservé aux enfants inactifs';
  end if;
  -- Une filiation déjà importée reste immuable ; elle est conservée sur les lots idempotents.
  if exists(select 1 from jsonb_to_recordset(p_lineage) as l(card_id text,source_card_id text)
    join histoire.pedagogical_card_lineage old on old.card_id=l.card_id where old.source_card_id<>l.source_card_id) then
    raise exception 'Filiation modifiée';
  end if;
  if (select count(distinct l->>'card_id') from jsonb_array_elements(p_lineage) l)<>jsonb_array_length(p_lineage)
    or exists(select 1 from jsonb_array_elements(p_lineage) l where not exists(select 1 from jsonb_array_elements(p_cards) c where c->>'card_id'=l->>'card_id')) then
    raise exception 'Filiation hors lot ou dupliquée';
  end if;
  -- Les brouillons peuvent être relus. La cascade ne porte que sur leur filiation,
  -- reconstruite dans la même transaction ; la carte source reste protégée.
  perform histoire.replace_chapter_cards(p_cards);
  if exists(select 1 from jsonb_to_recordset(p_lineage) as l(card_id text,source_card_id text)
    left join histoire.chapter_cards c on c.card_id=l.card_id
    left join histoire.chapter_cards source on source.card_id=l.source_card_id
    left join histoire.pedagogical_units u on u.chapter_id=c.chapter_id
    where c.card_id is null or source.card_id is null or u.parent_id is distinct from source.chapter_id or c.event_id is distinct from source.event_id) then
    raise exception 'Filiation de copie incohérente';
  end if;
  if exists(select 1 from jsonb_populate_recordset(null::histoire.chapter_cards,p_cards) c
    join histoire.pedagogical_units u on u.chapter_id=c.chapter_id
    join histoire.chapter_cards source on source.chapter_id=u.parent_id and source.event_id=c.event_id
    where not exists(select 1 from jsonb_to_recordset(p_lineage) as l(card_id text,source_card_id text) where l.card_id=c.card_id and l.source_card_id=source.card_id)) then
    raise exception 'Filiation obligatoire pour une carte déjà couverte';
  end if;
  insert into histoire.pedagogical_card_lineage(card_id,source_card_id)
    select l.card_id,l.source_card_id from jsonb_to_recordset(p_lineage) as l(card_id text,source_card_id text) on conflict do nothing;
end;
$$;
revoke all on function histoire.import_pedagogical_cards(jsonb,jsonb) from public,anon,authenticated;
grant execute on function histoire.import_pedagogical_cards(jsonb,jsonb) to service_role;

-- Validations privées liées aux octets du contenu. Publication atomique d'un groupe complet.
-- Aucun appel ni approbation n'est exécuté dans la phase 2 sur KFFR.
create function histoire.set_pedagogical_group_active(p_parent_id text,p_activate boolean,p_catalogue_approval text)
returns void language plpgsql security invoker set search_path = '' as $$
declare child histoire.pedagogical_units; n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
  perform 1 from histoire.pedagogical_units where chapter_id=p_parent_id and parent_id is null for update;
  if not found or p_activate is null or not exists(select 1 from histoire.pedagogical_units where parent_id=p_parent_id) then raise exception 'Groupe inconnu'; end if;
  for child in select * from histoire.pedagogical_units where parent_id=p_parent_id order by chapter_id for update loop
    if p_activate then
      if cardinality(child.blocages)>0 or child.content_approval is distinct from histoire.pedagogical_fingerprint(child.chapter_id)
        or coalesce(child.illustration_approval,'')='' or coalesce(p_catalogue_approval,'')=''
        or child.catalogue_approval is distinct from p_catalogue_approval then raise exception 'Validations manquantes ou périmées : %',child.chapter_id; end if;
      if (select array_agg(distinct cc.event_id order by cc.event_id) from histoire.chapter_cards cc where cc.chapter_id=child.chapter_id and cc.event_id is not null)
        is distinct from child.expected_event_ids then raise exception 'Cartes obligatoires manquantes ou hors périmètre'; end if;
      select jsonb_array_length(candidates) into n from histoire.pedagogical_editions
        where chapter_id=child.chapter_id and version=child.content_version and published;
      if not found then
      select count(distinct cc.event_id) into n from histoire.chapter_cards cc join histoire.events e on e.id=cc.event_id
        where cc.chapter_id=child.chapter_id and e.playable and cc.start_year is not null and e.playable_mode in ('YEAR','MONTH','DAY','RANGE');
      end if;
      if n<5 then raise exception 'Test insuffisant'; end if;
      update histoire.pedagogical_units set etat='actif',published_fingerprint=histoire.pedagogical_fingerprint(child.chapter_id) where chapter_id=child.chapter_id;
      perform histoire.snapshot_pedagogical_edition(child.chapter_id,child.content_version);
    else
      -- Ne jamais supprimer un enfant publié : URL, cartes, scores et parties restent résolubles.
      update histoire.pedagogical_units set etat=case when published_fingerprint is null then 'inactif' else 'historique' end where chapter_id=child.chapter_id;
    end if;
  end loop;
  update histoire.pedagogical_units set etat=case when p_activate then 'historique' else 'actif' end where chapter_id=p_parent_id;
end;
$$;
revoke all on function histoire.set_pedagogical_group_active(text,boolean,text) from public,anon,authenticated;
grant execute on function histoire.set_pedagogical_group_active(text,boolean,text) to service_role;

create or replace function histoire.get_chapter_cards(p_chapter_id text)
returns table(card_id text,chapter_id text,title text,body text,takeaway text,key_concepts text[],start_year integer,start_month smallint,start_day smallint,end_year integer,end_month smallint,end_day smallint,date_text text,sort_order integer)
language sql stable security definer set search_path = '' as $$
  select c.card_id,c.chapter_id,c.title,c.body,c.takeaway,c.key_concepts,c.start_year,c.start_month,c.start_day,c.end_year,c.end_month,c.end_day,c.date_text,c.sort_order
  from histoire.chapter_cards c where c.chapter_id=p_chapter_id and histoire.pedagogical_available(p_chapter_id)
    and not exists(select 1 from histoire.pedagogical_units u where u.chapter_id=p_chapter_id and u.current_version is not null)
  union all
  select c.card_id,c.chapter_id,c.title,c.body,c.takeaway,c.key_concepts,c.start_year,c.start_month,c.start_day,c.end_year,c.end_month,c.end_day,c.date_text,raw.position::integer
  from histoire.pedagogical_units u join histoire.pedagogical_editions e on e.chapter_id=u.chapter_id and e.version=u.current_version
  cross join lateral jsonb_array_elements(e.cards) with ordinality raw(card,position)
  cross join lateral jsonb_populate_record(null::histoire.chapter_cards,raw.card) c
  where u.chapter_id=p_chapter_id and e.published and histoire.pedagogical_available(p_chapter_id)
  order by sort_order;
$$;

-- Contrat identique ; les cartes publiées portent les dates de la version apprise.
-- Une correction future du canon ne réécrit ni ces cartes ni les anciennes game_questions.
alter function histoire.start_chapter_test(text,text,text,integer) rename to start_chapter_test_legacy;
revoke all on function histoire.start_chapter_test_legacy(text,text,text,integer) from public,anon,authenticated;
create function histoire.start_chapter_test_version(p_token text,p_chapter_id text,
  p_difficulty text,p_question_count integer,p_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g histoire.games; picked jsonb; player_id uuid:=auth.uid();
begin
  if not histoire.pedagogical_available(p_chapter_id) or p_difficulty is null or p_difficulty not in ('YEAR','MONTH','DAY')
    or p_question_count is null or p_question_count not between 5 and 10
    or (player_id is null and (p_token is null or p_token !~ '^[a-f0-9]{64}$')) then
    raise exception using errcode='22023',message='Paramètres de partie invalides';
  end if;
  select candidates into picked from histoire.pedagogical_editions where chapter_id=p_chapter_id and version=p_version and published;
  if not found then raise exception using errcode='22023',message='Édition indisponible'; end if;
  select jsonb_agg(x) into picked from (select x from jsonb_array_elements(picked) x
    where p_difficulty='YEAR' or (x->>'start_month' is not null and (p_difficulty<>'DAY' or x->>'start_day' is not null))
    order by random() limit p_question_count) q;
  if coalesce(jsonb_array_length(picked),0)<p_question_count then
    raise exception using errcode='22023',message='Pas assez de questions pour ces filtres';
  end if;
  insert into histoire.games(user_id,anonymous_token_hash,difficulty,question_count,direction,context)
    values(player_id,case when player_id is null then sha256(convert_to(p_token,'UTF8')) end,p_difficulty,p_question_count,'date',
      jsonb_build_object('mode','solo_scolaire','origin','test_chapitre','content_version',p_version,
        'chapters',(select jsonb_agg(jsonb_build_object('key',c.id,'label',c.title,'level',l.name))
          from histoire.chapters c join histoire.levels l on l.id=c.level_id where c.id=p_chapter_id))) returning * into g;
  insert into histoire.game_questions(game_id,event_id,position,difficulty,title,image_path,expected_year,expected_month,expected_day,correction_description)
    select g.id,x.event->>'id',x.position,p_difficulty,x.event->>'title',x.event->>'image_path',
      (x.event->>'start_year')::integer,(x.event->>'start_month')::integer,(x.event->>'start_day')::integer,x.event->>'description'
    from jsonb_array_elements(picked) with ordinality x(event,position);
  return jsonb_build_object('game_id',g.id,'question_count',g.question_count,'difficulty',g.difficulty,'direction',g.direction,'state',g.state,'anonymous',player_id is null);
end;$$;
revoke all on function histoire.start_chapter_test_version(text,text,text,integer,text) from public,anon,authenticated;
grant execute on function histoire.start_chapter_test_version(text,text,text,integer,text) to anon,authenticated;

create function histoire.start_chapter_test(p_token text default null,p_chapter_id text default null,
  p_difficulty text default 'YEAR',p_question_count integer default 10)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v text;
begin
  if not histoire.pedagogical_available(p_chapter_id) then raise exception using errcode='22023',message='Chapitre indisponible'; end if;
  select coalesce(current_version,content_version) into v from histoire.pedagogical_units where chapter_id=p_chapter_id;
  -- Compatibilité transitoire avant initialisation uniquement. Après initialisation, l'absence est fermée par le prédicat.
  if v is null then return histoire.start_chapter_test_legacy(p_token,p_chapter_id,p_difficulty,p_question_count); end if;
  return histoire.start_chapter_test_version(p_token,p_chapter_id,p_difficulty,p_question_count,v);
end;$$;
revoke all on function histoire.start_chapter_test(text,text,text,integer) from public,anon,authenticated;
grant execute on function histoire.start_chapter_test(text,text,text,integer) to anon,authenticated;

alter function histoire.mark_chapter_discovered(text) rename to mark_chapter_discovered_legacy;
revoke all on function histoire.mark_chapter_discovered_legacy(text) from public,anon,authenticated;
create function histoire.mark_chapter_discovered(p_chapter_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not histoire.pedagogical_available(p_chapter_id) then raise exception using errcode='22023',message='Chapitre indisponible'; end if;
  if exists(select 1 from histoire.pedagogical_units where chapter_id=p_chapter_id and current_version is not null) then
    if auth.uid() is null then raise exception using errcode='42501',message='Connexion requise'; end if;
    perform histoire.ensure_player();
    insert into histoire.learning_progress_editions(user_id,chapter_id,version,discovered_at)
      select auth.uid(),chapter_id,current_version,now() from histoire.pedagogical_units where chapter_id=p_chapter_id
      on conflict(user_id,chapter_id,version) do update set discovered_at=coalesce(histoire.learning_progress_editions.discovered_at,excluded.discovered_at);
  else perform histoire.mark_chapter_discovered_legacy(p_chapter_id); end if;
end;
$$;
revoke all on function histoire.mark_chapter_discovered(text) from public,anon,authenticated;
grant execute on function histoire.mark_chapter_discovered(text) to authenticated;

-- Filtre privé commun aux RPC scolaire : aucun changement de tirage libre/inversé sans chapitre.
create or replace function histoire.solo_candidates(p_expert_only boolean,p_niveau integer,p_pack_id text,p_tag_id text,p_year_min integer,p_year_max integer,p_level_id text,p_chapter_ids text[],p_difficulty text)
returns table(id text,title text,image_path text,start_year integer,start_month integer,start_day integer,description text)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if exists(select 1 from unnest(p_chapter_ids) c where not histoire.pedagogical_available(c)) then raise exception 'Chapitre indisponible'; end if;
  return query select c.* from histoire.solo_candidates(p_niveau,p_pack_id,p_tag_id,p_year_min,p_year_max,p_level_id,p_chapter_ids,p_difficulty) c
    join histoire.events e on e.id=c.id where p_expert_only is false or (p_expert_only is true and e.niveau=3);
end;
$$;

-- Complétions : aucun nouveau chapitre, anciennes cartes jamais déplacées/réécrites.
create function histoire.stage_pedagogical_completion(p_chapter_id text,p_cards jsonb)
returns text language plpgsql security invoker set search_path='' as $$
declare u histoire.pedagogical_units; base histoire.pedagogical_editions; full_cards jsonb; full_candidates jsonb; previous histoire.pedagogical_editions;
begin
  perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
  select * into u from histoire.pedagogical_units where chapter_id=p_chapter_id and parent_id is null;
  if not found or exists(select 1 from histoire.pedagogical_units where parent_id=p_chapter_id)
    or u.content_version<>'legacy-v1' then raise exception 'Complétion réservée aux chapitres non découpés'; end if;
  select * into strict base from histoire.pedagogical_editions where chapter_id=p_chapter_id and version=u.content_version and published;
  select * into previous from histoire.pedagogical_editions where chapter_id=p_chapter_id and version='completion-v1';
  if found and previous.published then
    select jsonb_agg(c order by (c->>'start_year')::integer nulls last,(c->>'start_month')::integer nulls first,
      (c->>'start_day')::integer nulls first,c->>'card_id') into full_cards from jsonb_array_elements(base.cards||p_cards) c;
    if previous.cards is distinct from full_cards then raise exception 'Édition publiée immuable'; end if;
    return md5(previous.cards::text||previous.candidates::text);
  end if;
  if jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards)=0
    or jsonb_array_length(base.cards)+jsonb_array_length(p_cards)>64
    or (select count(distinct c->>'card_id') from jsonb_array_elements(p_cards) c)<>jsonb_array_length(p_cards)
    or (select count(distinct c->>'event_id') from jsonb_array_elements(p_cards) c)<>jsonb_array_length(p_cards)
    or exists(select 1 from jsonb_populate_recordset(null::histoire.chapter_cards,p_cards) c
      where c.chapter_id is distinct from p_chapter_id or c.card_id is null or c.card_id !~ ('^CARD-'||substring(p_chapter_id from 5)||'-[a-z0-9-]+$')
        or c.event_id is null or not(c.event_id=any(u.expected_event_ids))
        or exists(select 1 from histoire.chapter_cards old where old.card_id=c.card_id)
        or exists(select 1 from jsonb_array_elements(base.cards) old where old->>'event_id'=c.event_id)
        or not exists(select 1 from histoire.event_answers a where a.event_id=c.event_id
          and (a.start_year,a.start_month,a.start_day,a.end_year,a.end_month,a.end_day,a.date_text)
            is not distinct from (c.start_year,c.start_month,c.start_day,c.end_year,c.end_month,c.end_day,c.date_text))) then
    raise exception 'Lot supplémentaire invalide ou modifiant les cartes historiques';
  end if;
  -- Les lignes héritées restent exactement identiques. L'ordre de présentation est propre à l'édition.
  select jsonb_agg(c order by (c->>'start_year')::integer nulls last,(c->>'start_month')::integer nulls first,
    (c->>'start_day')::integer nulls first,c->>'card_id') into full_cards from jsonb_array_elements(base.cards||p_cards) c;
  select base.candidates||coalesce(jsonb_agg(jsonb_build_object('id',c.event_id,'title',c.title,'image_path',e.image_path,
    'start_year',c.start_year,'start_month',c.start_month,'start_day',c.start_day,'description',c.body) order by c.sort_order),'[]') into full_candidates
    from jsonb_populate_recordset(null::histoire.chapter_cards,p_cards) c join histoire.events e on e.id=c.event_id
    where e.playable and e.playable_mode in ('YEAR','MONTH','DAY','RANGE') and c.start_year is not null;
  select * into previous from histoire.pedagogical_editions where chapter_id=p_chapter_id and version='completion-v1';
  if found and previous.published then
    if (previous.cards,previous.candidates) is distinct from (full_cards,full_candidates) then raise exception 'Édition publiée immuable'; end if;
  else
    insert into histoire.pedagogical_editions(chapter_id,version,cards,candidates) values(p_chapter_id,'completion-v1',full_cards,full_candidates)
    on conflict(chapter_id,version) do update set cards=excluded.cards,candidates=excluded.candidates;
  end if;
  return md5(full_cards::text||full_candidates::text);
end;$$;
revoke all on function histoire.stage_pedagogical_completion(text,jsonb) from public,anon,authenticated;
grant execute on function histoire.stage_pedagogical_completion(text,jsonb) to service_role;

create function histoire.publish_pedagogical_completion(p_chapter_id text,p_fingerprint text,p_illustrations text,p_catalogue text)
returns void language plpgsql security invoker set search_path='' as $$
declare u histoire.pedagogical_units; e histoire.pedagogical_editions;
begin
  perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
  select * into strict u from histoire.pedagogical_units where chapter_id=p_chapter_id for update;
  select * into strict e from histoire.pedagogical_editions where chapter_id=p_chapter_id and version='completion-v1' for update;
  if cardinality(u.blocages)>0 or md5(e.cards::text||e.candidates::text) is distinct from p_fingerprint
    or coalesce(p_illustrations,'')='' or coalesce(p_catalogue,'')=''
    or jsonb_array_length(e.candidates)<5
    or (select array_agg(distinct c->>'event_id' order by c->>'event_id') from jsonb_array_elements(e.cards) c where c->>'event_id' is not null)
      is distinct from u.expected_event_ids then raise exception 'Complétion incomplète ou validation manquante'; end if;
  if not e.published then update histoire.pedagogical_editions set published=true,content_approval=p_fingerprint,
    illustration_approval=p_illustrations,catalogue_approval=p_catalogue where chapter_id=p_chapter_id and version=e.version; end if;
  update histoire.pedagogical_units set current_version=e.version where chapter_id=p_chapter_id;
end;$$;
revoke all on function histoire.publish_pedagogical_completion(text,text,text,text) from public,anon,authenticated;
grant execute on function histoire.publish_pedagogical_completion(text,text,text,text) to service_role;

create function histoire.rollback_pedagogical_completion(p_chapter_id text)
returns void language plpgsql security invoker set search_path='' as $$begin
  perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
  update histoire.pedagogical_units set current_version=null where chapter_id=p_chapter_id;
end;$$;
revoke all on function histoire.rollback_pedagogical_completion(text) from public,anon,authenticated;
grant execute on function histoire.rollback_pedagogical_completion(text) to service_role;

create function histoire.get_chapter_cards_version(p_chapter_id text,p_version text)
returns table(card_id text,chapter_id text,title text,body text,takeaway text,key_concepts text[],start_year integer,start_month smallint,start_day smallint,end_year integer,end_month smallint,end_day smallint,date_text text,sort_order integer)
language sql stable security definer set search_path='' as $$
  select c.card_id,c.chapter_id,c.title,c.body,c.takeaway,c.key_concepts,c.start_year,c.start_month,c.start_day,c.end_year,c.end_month,c.end_day,c.date_text,
    case when p_version='completion-v1' then raw.position::integer else c.sort_order end
    from histoire.pedagogical_editions e cross join lateral jsonb_array_elements(e.cards) with ordinality raw(card,position)
    cross join lateral jsonb_populate_record(null::histoire.chapter_cards,raw.card) c
    where e.chapter_id=p_chapter_id and e.version=p_version and e.published and histoire.pedagogical_available(p_chapter_id);
$$;
revoke all on function histoire.get_chapter_cards_version(text,text) from public,anon,authenticated;
grant execute on function histoire.get_chapter_cards_version(text,text) to anon,authenticated;

-- Le bilan est contrôlé par le moteur historique avant d'y joindre la version de relance.
alter function histoire.finish_game(uuid,text) rename to finish_game_pedagogical_legacy;
revoke all on function histoire.finish_game_pedagogical_legacy(uuid,text) from public,anon,authenticated;
create function histoire.finish_game(p_game_id uuid,p_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; g histoire.games; v text;
begin
  r:=histoire.finish_game_pedagogical_legacy(p_game_id,p_token);
  select * into strict g from histoire.games where id=p_game_id;
  if g.context->>'origin'='test_chapitre' then
    select coalesce(g.context->>'content_version',u.content_version) into v from histoire.pedagogical_units u where u.chapter_id=g.context->'chapters'->0->>'key';
    if v is not null then r:=jsonb_set(r,'{replay_filters}',r->'replay_filters'||jsonb_build_object('chapterVersion',v)); end if;
  end if;
  return r;
end;$$;
revoke all on function histoire.finish_game(uuid,text) from public,anon,authenticated;
grant execute on function histoire.finish_game(uuid,text) to anon,authenticated;

-- Les scores initiaux restent dans learning_progress. Les complétions n'y écrivent jamais.
create table histoire.learning_progress_editions (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null,
  version text not null,
  discovered_at timestamptz,
  best_accuracy numeric,
  best_difficulty text check(best_difficulty in ('YEAR','MONTH','DAY')),
  best_tested_at timestamptz,
  tests_count integer not null default 0,
  last_game_id uuid references histoire.games(id) on delete set null,
  primary key(user_id,chapter_id,version),
  foreign key(chapter_id,version) references histoire.pedagogical_editions(chapter_id,version),
  check(best_accuracy is null or best_accuracy between 0 and 100)
);
alter table histoire.learning_progress_editions enable row level security;
revoke all on histoire.learning_progress_editions from public,anon,authenticated;
grant select on histoire.learning_progress_editions to authenticated;
grant all on histoire.learning_progress_editions to service_role;
create policy "ses scores par edition" on histoire.learning_progress_editions for select to authenticated using((select auth.uid())=user_id);

alter function histoire.record_chapter_test(uuid) rename to record_chapter_test_pedagogical_legacy;
revoke all on function histoire.record_chapter_test_pedagogical_legacy(uuid) from public,anon,authenticated;
create function histoire.record_chapter_test(p_game_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g histoire.games; ch text; v text; previous numeric; after_row histoire.learning_progress_editions;
begin
  select * into g from histoire.games where id=p_game_id and user_id=auth.uid() and state='finished' and direction='date';
  if not found then raise exception using errcode='42501',message='Partie inaccessible'; end if;
  v:=g.context->>'content_version';
  if v is distinct from 'completion-v1' then return histoire.record_chapter_test_pedagogical_legacy(p_game_id); end if;
  if g.question_count<5 or g.average_accuracy is null or g.context->>'origin' is distinct from 'test_chapitre'
    or jsonb_array_length(coalesce(g.context->'chapters','[]'))<>1 then raise exception 'Test invalide'; end if;
  ch:=g.context->'chapters'->0->>'key';
  if not exists(select 1 from histoire.pedagogical_editions where chapter_id=ch and version=v and published) then raise exception 'Édition inconnue'; end if;
  perform histoire.ensure_player();
  select best_accuracy into previous from histoire.learning_progress_editions where user_id=auth.uid() and chapter_id=ch and version=v;
  insert into histoire.learning_progress_editions as lp(user_id,chapter_id,version,best_accuracy,best_difficulty,best_tested_at,tests_count,last_game_id)
    values(auth.uid(),ch,v,g.average_accuracy,g.difficulty,g.finished_at,1,g.id)
  on conflict(user_id,chapter_id,version) do update set
    best_accuracy=case when lp.last_game_id is distinct from g.id and (lp.best_accuracy is null or g.average_accuracy>lp.best_accuracy) then g.average_accuracy else lp.best_accuracy end,
    best_difficulty=case when lp.last_game_id is distinct from g.id and (lp.best_accuracy is null or g.average_accuracy>lp.best_accuracy) then g.difficulty else lp.best_difficulty end,
    best_tested_at=case when lp.last_game_id is distinct from g.id and (lp.best_accuracy is null or g.average_accuracy>lp.best_accuracy) then g.finished_at else lp.best_tested_at end,
    tests_count=lp.tests_count+case when lp.last_game_id is distinct from g.id then 1 else 0 end,last_game_id=g.id
  returning * into after_row;
  return jsonb_build_object('chapter_id',ch,'version',v,'best_accuracy',after_row.best_accuracy,'best_difficulty',after_row.best_difficulty,
    'tests_count',after_row.tests_count,'improved',previous is null or after_row.best_accuracy>previous);
end;$$;
revoke all on function histoire.record_chapter_test(uuid) from public,anon,authenticated;
grant execute on function histoire.record_chapter_test(uuid) to authenticated;

-- Export privé pour préparer le catalogue public, sans réponses ni event_id.
-- Une unité publiée altérée ou un groupe partiellement activé fait échouer l'export.
create function histoire.export_pedagogical_structure()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if exists(select 1 from histoire.pedagogical_editions e where e.published and e.version='completion-v1' and
    (e.content_approval is distinct from md5(e.cards::text||e.candidates::text)
      or coalesce(e.illustration_approval,'')='' or coalesce(e.catalogue_approval,'')='')) then raise exception 'Édition sans validation'; end if;
  if exists(select 1 from histoire.pedagogical_units u where u.published_fingerprint is not null
    and u.published_fingerprint is distinct from histoire.pedagogical_fingerprint(u.chapter_id)) then raise exception 'Contenu publié altéré'; end if;
  if exists(select 1 from histoire.pedagogical_units p where p.parent_id is null and
    ((p.etat='historique' and exists(select 1 from histoire.pedagogical_units c where c.parent_id=p.chapter_id and c.etat<>'actif'))
      or (p.etat='actif' and exists(select 1 from histoire.pedagogical_units c where c.parent_id=p.chapter_id and c.etat='actif')))) then raise exception 'Groupe partiellement activé'; end if;
  return (select jsonb_agg(jsonb_build_object('id',u.chapter_id,'parent_id',u.parent_id,'slug',u.slug,
    'content_version',u.content_version,'etat',u.etat,'published',u.published_fingerprint is not null,
    'current_version',u.current_version,'editions',coalesce((select jsonb_agg(e.version order by e.version) from histoire.pedagogical_editions e
      where e.chapter_id=u.chapter_id and e.published and e.version<>u.content_version),'[]'),
    'edition_counts',coalesce((select jsonb_object_agg(e.version,jsonb_build_object('YEAR',jsonb_array_length(e.candidates),
      'MONTH',(select count(*) from jsonb_array_elements(e.candidates) c where c->>'start_month' is not null),
      'DAY',(select count(*) from jsonb_array_elements(e.candidates) c where c->>'start_month' is not null and c->>'start_day' is not null)))
      from histoire.pedagogical_editions e where e.chapter_id=u.chapter_id and e.published),'{}')) order by u.chapter_id)
    from histoire.pedagogical_units u);
end;
$$;
revoke all on function histoire.export_pedagogical_structure() from public,anon,authenticated;
grant execute on function histoire.export_pedagogical_structure() to service_role;

insert into histoire.migrations_appliquees(version,nom) values('20261012180633','preparation_sous_chapitres');
commit;
