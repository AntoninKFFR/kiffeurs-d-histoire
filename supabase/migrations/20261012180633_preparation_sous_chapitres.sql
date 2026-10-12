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
  check (chapter_id is distinct from parent_id)
);
alter table histoire.pedagogical_units enable row level security;
revoke all on histoire.pedagogical_units from public,anon,authenticated;
grant all on histoire.pedagogical_units to service_role;

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
  select exists(select 1 from histoire.chapters c where c.id=p_chapter_id)
    and not exists(select 1 from histoire.pedagogical_units u where u.chapter_id=p_chapter_id and u.etat='inactif');
$$;
revoke all on function histoire.pedagogical_available(text) from public,anon,authenticated;
grant execute on function histoire.pedagogical_available(text) to anon,authenticated,service_role;
create policy "brouillons pedagogiques caches" on histoire.chapters as restrictive for select
  to anon,authenticated using (histoire.pedagogical_available(id));
create policy "liens des brouillons caches" on histoire.event_chapters as restrictive for select
  to anon,authenticated using (histoire.pedagogical_available(chapter_id));

-- Un ID publié a un périmètre/version immutable : son score demeure comparable et résoluble.
-- Une révision future doit créer un nouvel ID/version ; pas de réinterprétation de la ligne legacy.
create function histoire.protect_pedagogical_history()
returns trigger language plpgsql security definer set search_path = '' as $$
declare id text; destination text;
begin
  if tg_table_name='pedagogical_units' then
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
  -- Chaque union remplace exactement un parent, sans doublon ni trou.
  if exists(select 1 from histoire.pedagogical_units p where p.parent_id is null and exists(select 1 from histoire.pedagogical_units c where c.parent_id=p.chapter_id)
    and (select array_agg(e order by e) from histoire.pedagogical_units c cross join lateral unnest(c.expected_event_ids) e where c.parent_id=p.chapter_id)
      is distinct from p.expected_event_ids) then raise exception 'Partition parent/enfants inexacte'; end if;
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
      select count(distinct cc.event_id) into n from histoire.chapter_cards cc join histoire.events e on e.id=cc.event_id
        where cc.chapter_id=child.chapter_id and e.playable and cc.start_year is not null and e.playable_mode in ('YEAR','MONTH','DAY','RANGE');
      if n<5 then raise exception 'Test insuffisant'; end if;
      update histoire.pedagogical_units set etat='actif',published_fingerprint=histoire.pedagogical_fingerprint(child.chapter_id) where chapter_id=child.chapter_id;
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
  from histoire.chapter_cards c where c.chapter_id=p_chapter_id and histoire.pedagogical_available(p_chapter_id) order by c.sort_order;
$$;

-- Contrat identique ; les cartes publiées portent les dates de la version apprise.
-- Une correction future du canon ne réécrit ni ces cartes ni les anciennes game_questions.
alter function histoire.start_chapter_test(text,text,text,integer) rename to start_chapter_test_legacy;
revoke all on function histoire.start_chapter_test_legacy(text,text,text,integer) from public,anon,authenticated;
create function histoire.start_chapter_test(p_token text default null,p_chapter_id text default null,
  p_difficulty text default 'YEAR',p_question_count integer default 10)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g histoire.games; picked jsonb; player_id uuid:=auth.uid(); version text;
begin
  if not histoire.pedagogical_available(p_chapter_id) then raise exception using errcode='22023',message='Chapitre indisponible'; end if;
  select u.content_version into version from histoire.pedagogical_units u where u.chapter_id=p_chapter_id;
  if version is null then return histoire.start_chapter_test_legacy(p_token,p_chapter_id,p_difficulty,p_question_count); end if;
  if p_difficulty is null or p_difficulty not in ('YEAR','MONTH','DAY')
    or p_question_count is null or p_question_count not between 5 and 10
    or (player_id is null and (p_token is null or p_token !~ '^[a-f0-9]{64}$')) then
    raise exception using errcode='22023',message='Paramètres de partie invalides';
  end if;
  select jsonb_agg(to_jsonb(x)) into picked from (
    select distinct on (cc.event_id) cc.event_id as id,cc.title,e.image_path,
      cc.start_year,cc.start_month,cc.start_day,cc.body as description
    from histoire.chapter_cards cc join histoire.events e on e.id=cc.event_id
    where cc.chapter_id=p_chapter_id and e.playable and e.playable_mode in ('YEAR','MONTH','DAY','RANGE')
      and cc.start_year is not null and (p_difficulty='YEAR' or cc.start_month is not null)
      and (p_difficulty<>'DAY' or cc.start_day is not null)
    order by cc.event_id,cc.sort_order
  ) x;
  select jsonb_agg(x) into picked from (select x from jsonb_array_elements(coalesce(picked,'[]')) x order by random() limit p_question_count) q;
  if coalesce(jsonb_array_length(picked),0)<p_question_count then
    raise exception using errcode='22023',message='Pas assez de questions pour ces filtres';
  end if;
  insert into histoire.games(user_id,anonymous_token_hash,difficulty,question_count,direction,context)
    values(player_id,case when player_id is null then sha256(convert_to(p_token,'UTF8')) end,p_difficulty,p_question_count,'date',
      jsonb_build_object('mode','solo_scolaire','origin','test_chapitre','content_version',version,
        'chapters',(select jsonb_agg(jsonb_build_object('key',c.id,'label',c.title,'level',l.name))
          from histoire.chapters c join histoire.levels l on l.id=c.level_id where c.id=p_chapter_id))) returning * into g;
  insert into histoire.game_questions(game_id,event_id,position,difficulty,title,image_path,expected_year,expected_month,expected_day,correction_description)
    select g.id,x.event->>'id',x.position,p_difficulty,x.event->>'title',x.event->>'image_path',
      (x.event->>'start_year')::integer,(x.event->>'start_month')::integer,(x.event->>'start_day')::integer,x.event->>'description'
    from jsonb_array_elements(picked) with ordinality x(event,position);
  return jsonb_build_object('game_id',g.id,'question_count',g.question_count,'difficulty',g.difficulty,'direction',g.direction,'state',g.state,'anonymous',player_id is null);
end;
$$;
revoke all on function histoire.start_chapter_test(text,text,text,integer) from public,anon,authenticated;
grant execute on function histoire.start_chapter_test(text,text,text,integer) to anon,authenticated;

alter function histoire.mark_chapter_discovered(text) rename to mark_chapter_discovered_legacy;
revoke all on function histoire.mark_chapter_discovered_legacy(text) from public,anon,authenticated;
create function histoire.mark_chapter_discovered(p_chapter_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not histoire.pedagogical_available(p_chapter_id) then raise exception using errcode='22023',message='Chapitre indisponible'; end if;
  perform histoire.mark_chapter_discovered_legacy(p_chapter_id);
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

-- Export privé pour préparer le catalogue public, sans réponses ni event_id.
-- Une unité publiée altérée ou un groupe partiellement activé fait échouer l'export.
create function histoire.export_pedagogical_structure()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if exists(select 1 from histoire.pedagogical_units u where u.published_fingerprint is not null
    and u.published_fingerprint is distinct from histoire.pedagogical_fingerprint(u.chapter_id)) then raise exception 'Contenu publié altéré'; end if;
  if exists(select 1 from histoire.pedagogical_units p where p.parent_id is null and
    ((p.etat='historique' and exists(select 1 from histoire.pedagogical_units c where c.parent_id=p.chapter_id and c.etat<>'actif'))
      or (p.etat='actif' and exists(select 1 from histoire.pedagogical_units c where c.parent_id=p.chapter_id and c.etat='actif')))) then raise exception 'Groupe partiellement activé'; end if;
  return (select jsonb_agg(jsonb_build_object('id',u.chapter_id,'parent_id',u.parent_id,'slug',u.slug,
    'content_version',u.content_version,'etat',u.etat,'published',u.published_fingerprint is not null) order by u.chapter_id)
    from histoire.pedagogical_units u);
end;
$$;
revoke all on function histoire.export_pedagogical_structure() from public,anon,authenticated;
grant execute on function histoire.export_pedagogical_structure() to service_role;

insert into histoire.migrations_appliquees(version,nom) values('20261012180633','preparation_sous_chapitres');
commit;
