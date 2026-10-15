-- #120 : ajout et création administrateur. Schéma histoire exclusivement.
-- Préparée : GO d'Antonin avant publication des nouvelles capacités d'écriture.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Espace numérique réservé aux créations manuelles, compatible avec EVT-[0-9]+.
-- Pas de changement de la contrainte des imports v18 ni de leurs identifiants.
create sequence histoire.manual_event_ids start with 900000000000;
revoke all on sequence histoire.manual_event_ids from public,anon,authenticated,service_role;

create table histoire.admin_event_creations (
  request_id uuid primary key,
  event_id text not null unique references histoire.events(id),
  admin_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  payload jsonb not null,
  sources text[] not null,
  territory text
);
create table histoire.admin_pack_additions (
  pack_id text not null,
  event_id text not null,
  primary key(pack_id,event_id)
);
-- Journal durable, sans cascade : conserve aussi les identités des anciens contenus.
create table histoire.admin_content_audit (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp(),
  event_id text not null,
  pack_id text not null,
  operation text not null check(operation in ('creer','ajouter','reintegrer'))
);
create index admin_content_audit_event_idx on histoire.admin_content_audit(event_id,id desc);
alter table histoire.admin_event_creations enable row level security;
alter table histoire.admin_pack_additions enable row level security;
alter table histoire.admin_content_audit enable row level security;
revoke all on histoire.admin_event_creations,histoire.admin_pack_additions,histoire.admin_content_audit
  from public,anon,authenticated,service_role;
revoke all on sequence histoire.admin_content_audit_id_seq from public,anon,authenticated,service_role;
-- Le seul lecteur direct supplémentaire est l'import serveur déjà privilégié.
grant select on histoire.admin_pack_additions to service_role;

create function histoire.admin_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from histoire.admins where user_id=auth.uid())
$$;

-- Recherche de vingt lignes (+ une sentinelle), avant projection des packs associés.
-- Aucune réponse privée n'est lue avant le contrôle administrateur.
create function histoire.admin_search_events(p_pack_id text,p_query text default '',p_niveau integer default null,
  p_year_min integer default null,p_year_max integer default null,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not histoire.admin_access() then raise exception using errcode='42501',message='Accès réservé'; end if;
  if not exists(select 1 from histoire.packs where id=p_pack_id)
    or p_query is null or length(p_query)>500 or p_page is null or p_page not between 0 and 100000
    or p_niveau not between 1 and 3 or p_year_min=0 or p_year_max=0 or p_year_min>p_year_max then
    raise exception using errcode='22023',message='Recherche invalide';
  end if;
  return (with matches as materialized (
    select e.id,e.title,e.niveau,a.date_text,a.start_year,a.start_month,a.start_day,a.end_year,a.end_month,a.end_day
    from histoire.events e left join histoire.event_answers a on a.event_id=e.id
    where (btrim(p_query)='' or strpos(histoire.normalize_answer(e.title),histoire.normalize_answer(p_query))>0)
      and (p_niveau is null or e.niveau=p_niveau)
      and (p_year_min is null or coalesce(a.end_year,a.start_year)>=p_year_min)
      and (p_year_max is null or a.start_year<=p_year_max)
    order by e.title,e.id limit 21 offset p_page*20
  ), page as (select * from matches order by title,id limit 20)
  select jsonb_build_object('has_more',(select count(*)>20 from matches),'items',coalesce((
    select jsonb_agg(to_jsonb(m) || jsonb_build_object(
      'associated',exists(select 1 from histoire.pack_events where pack_id=p_pack_id and event_id=m.id),
      'removed',coalesce((select removed from histoire.pack_event_status where pack_id=p_pack_id and event_id=m.id),false),
      'packs',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,
        'removed',coalesce(s.removed,false)) order by p.title,p.id)
        from histoire.pack_events pe join histoire.packs p on p.id=pe.pack_id
        left join histoire.pack_event_status s on s.pack_id=pe.pack_id and s.event_id=pe.event_id
        where pe.event_id=m.id),'[]'::jsonb)) order by m.title,m.id) from page m),'[]'::jsonb)));
end;
$$;

create function histoire.admin_add_pack_events(p_pack_id text,p_event_ids text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare eid text; inserted integer; added integer:=0; restored integer:=0; position_value integer;
begin
  if not histoire.admin_access() then raise exception using errcode='42501',message='Accès réservé'; end if;
  if p_event_ids is null or cardinality(p_event_ids) not between 1 and 100
    or array_position(p_event_ids,null) is not null then
    raise exception using errcode='22023',message='Sélection invalide (1 à 100 questions)';
  end if;
  -- Sérialise les ajouts (y compris les nouvelles associations sans ligne verrouillable).
  perform 1 from histoire.packs where id=p_pack_id for update;
  if not found then raise exception using errcode='22023',message='Pack inconnu'; end if;
  if exists(select 1 from unnest(p_event_ids) x where not exists(select 1 from histoire.events where id=x)) then
    raise exception using errcode='22023',message='Question inconnue';
  end if;
  select coalesce(max(position),0) into position_value from histoire.pack_events where pack_id=p_pack_id;
  for eid in select distinct x from unnest(p_event_ids) x order by x loop
    insert into histoire.pack_events(pack_id,event_id,position) values(p_pack_id,eid,position_value+1)
      on conflict do nothing;
    get diagnostics inserted=row_count;
    if inserted=1 then
      position_value:=position_value+1; added:=added+1;
      insert into histoire.admin_pack_additions values(p_pack_id,eid) on conflict do nothing;
      insert into histoire.admin_content_audit(admin_id,event_id,pack_id,operation)
        values(auth.uid(),eid,p_pack_id,'ajouter');
    end if;
    -- Même verrou et même audit de réintégration que #87 ; l'historique n'est pas effacé.
    perform 1 from histoire.pack_events where pack_id=p_pack_id and event_id=eid for update;
    if exists(select 1 from histoire.pack_event_status where pack_id=p_pack_id and event_id=eid and removed) then
      insert into histoire.admin_pack_additions values(p_pack_id,eid) on conflict do nothing;
      update histoire.pack_event_status set removed=false where pack_id=p_pack_id and event_id=eid;
      insert into histoire.pack_event_audit(pack_id,event_id,admin_id,operation,reason)
        values(p_pack_id,eid,auth.uid(),'remettre','Réintégration depuis Ajouter des questions');
      insert into histoire.admin_content_audit(admin_id,event_id,pack_id,operation)
        values(auth.uid(),eid,p_pack_id,'reintegrer');
      restored:=restored+1;
    end if;
  end loop;
  return jsonb_build_object('changed',added+restored>0,'added',added,'restored',restored,
    'packs',histoire.admin_list_packs(),'questions',histoire.admin_pack_questions(p_pack_id));
end;
$$;

create function histoire.admin_create_event(p_request_id uuid,p_pack_id text,p_event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  title_value text:=btrim(p_event->>'title'); description_value text:=btrim(p_event->>'description');
  level_value integer:=(p_event->>'niveau')::integer;
  status_value text:=p_event->>'date_status'; kind text:=p_event->>'kind';
  sy integer:=(p_event->>'start_year')::integer; sm integer:=(p_event->>'start_month')::integer;
  sd integer:=(p_event->>'start_day')::integer; ey integer:=(p_event->>'end_year')::integer;
  em integer:=(p_event->>'end_month')::integer; ed integer:=(p_event->>'end_day')::integer;
  date_label text:=nullif(btrim(p_event->>'date_text'),''); territory_value text:=nullif(btrim(p_event->>'territory'),'');
  sources_value text[]; precision_value text; mode_value text; eid text; result jsonb;
  prior histoire.admin_event_creations;
begin
  if not histoire.admin_access() then raise exception using errcode='42501',message='Accès réservé'; end if;
  if p_request_id is null or p_event is null or jsonb_typeof(p_event)<>'object' then
    raise exception using errcode='22023',message='Formulaire invalide';
  end if;
  -- Sérialise doublons et retries entre administrateurs, avant tout verrou de pack.
  perform pg_advisory_xact_lock(120,1);
  select * into prior from histoire.admin_event_creations where request_id=p_request_id;
  if found then
    if prior.admin_id<>auth.uid() or prior.payload<>jsonb_build_object('pack_id',p_pack_id,'event',p_event) then
      raise exception using errcode='22023',message='Cette demande a déjà été utilisée';
    end if;
    return jsonb_build_object('changed',false,'event_id',prior.event_id,'added',0,'restored',0,
      'packs',histoire.admin_list_packs(),'questions',histoire.admin_pack_questions(p_pack_id));
  end if;
  if title_value is null or length(title_value) not between 1 and 500 or title_value ~ '[[:cntrl:]]'
    or description_value is null or length(description_value) not between 1 and 3000
    or level_value is null or level_value not between 1 and 3
    or status_value is null or status_value not in ('EXACT','CONVENTIONAL','TRADITIONAL','APPROXIMATE','DISPUTED')
    or kind is null or kind not in ('event','film') or length(territory_value)>150 or territory_value ~ '[[:cntrl:]]'
    or (kind='film' and territory_value is null) or length(date_label)>500
    or jsonb_typeof(p_event->'sources') is distinct from 'array' then
    raise exception using errcode='22023',message='Vérifiez titre, description, niveau, statut, sources et territoire du film';
  end if;
  if jsonb_array_length(p_event->'sources') not between 1 and 10 or exists(
    select 1 from jsonb_array_elements(p_event->'sources') x where jsonb_typeof(x)<>'string') then
    raise exception using errcode='22023',message='Une à dix sources documentaires sont obligatoires';
  end if;
  select array_agg(btrim(x)) into sources_value from jsonb_array_elements_text(p_event->'sources') x;
  if exists(select 1 from unnest(sources_value) s where length(s) not between 8 and 2000 or s ~ '[[:cntrl:]]') then
    raise exception using errcode='22023',message='Chaque source doit être une URL ou une référence documentaire complète';
  end if;
  if sy is null then
    if sm is not null or sd is not null or ey is not null or em is not null or ed is not null or date_label is null or kind='film' then
      raise exception using errcode='22023',message='Année obligatoire pour une date connue ; sinon renseignez la période textuelle';
    end if;
    precision_value:='PERIOD_TEXT'; mode_value:='NOT_AUTOMATIC';
  else
    if sy not between -1000000 and 1000000 or ey not between -1000000 and 1000000 then
      raise exception using errcode='22023',message='Année hors limites';
    end if;
    perform histoire.verifier_date_reponse(sy,sm,sd,'YEAR');
    if ey is null then
      if em is not null or ed is not null then raise exception using errcode='22023',message='Année de fin manquante'; end if;
      precision_value:=case when sd is not null then 'DAY' when sm is not null then 'MONTH' else 'YEAR' end;
      mode_value:=precision_value;
    else
      perform histoire.verifier_date_reponse(ey,em,ed,'YEAR');
      if (ey,coalesce(em,1),coalesce(ed,1))<(sy,coalesce(sm,1),coalesce(sd,1)) then
        raise exception using errcode='22023',message='La fin précède le début';
      end if;
      precision_value:=case when sd is not null and ed is not null then 'DAY_RANGE'
        when sm is null and em is null then 'YEAR_RANGE' else 'MIXED_RANGE' end;
      mode_value:='RANGE';
    end if;
  end if;
  -- Le territoire doit aussi être visible dans la question jouée, pour lever l'ambiguïté.
  if kind='film' then title_value:=title_value || ' (sortie : ' || territory_value || ')'; end if;
  if length(title_value)>500 then raise exception using errcode='22023',message='Titre avec territoire trop long'; end if;
  if exists(select 1 from histoire.events e left join histoire.event_answers a on a.event_id=e.id
    where histoire.normalize_answer(e.title)=histoire.normalize_answer(title_value)
      or (sy is not null and a.start_year=sy and a.start_month is not distinct from sm
        and a.start_day is not distinct from sd and a.end_year is not distinct from ey
        and a.end_month is not distinct from em and a.end_day is not distinct from ed
        and extensions.similarity(histoire.normalize_answer(e.title),histoire.normalize_answer(title_value))>=0.8)) then
    raise exception using errcode='23505',message='Un événement de même titre existe déjà. Recherchez-le avant de créer une question';
  end if;
  eid:='EVT-' || nextval('histoire.manual_event_ids');
  insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau,source_status)
    values(eid,title_value,case when sy is null then 'PROCESS' when ey is null then 'POINT' else 'PERIOD' end,precision_value,status_value,
      sy is not null,mode_value,1,level_value,level_value,'ADMIN_SOURCED');
  insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,date_text,description)
    values(eid,sy,sm,sd,ey,em,ed,date_label,description_value);
  insert into histoire.admin_event_creations(request_id,event_id,admin_id,payload,sources,territory)
    values(p_request_id,eid,auth.uid(),jsonb_build_object('pack_id',p_pack_id,'event',p_event),sources_value,territory_value);
  result:=histoire.admin_add_pack_events(p_pack_id,array[eid]);
  insert into histoire.admin_content_audit(admin_id,event_id,pack_id,operation) values(auth.uid(),eid,p_pack_id,'creer');
  return result || jsonb_build_object('event_id',eid);
end;
$$;

create function histoire.admin_content_history(p_event_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not histoire.admin_access() then raise exception using errcode='42501',message='Accès réservé'; end if;
  return jsonb_build_object('creation',(select jsonb_build_object('admin_id',admin_id,'created_at',created_at,
    'sources',sources,'territory',territory) from histoire.admin_event_creations where event_id=p_event_id),
    'operations',coalesce((select jsonb_agg(to_jsonb(a) order by id desc) from histoire.admin_content_audit a
      where event_id=p_event_id),'[]'::jsonb));
end;
$$;

revoke all on function histoire.admin_access(),histoire.admin_search_events(text,text,integer,integer,integer,integer),
  histoire.admin_add_pack_events(text,text[]),histoire.admin_create_event(uuid,text,jsonb),histoire.admin_content_history(text)
  from public,anon,authenticated,service_role;
grant execute on function histoire.admin_access(),histoire.admin_search_events(text,text,integer,integer,integer,integer),
  histoire.admin_add_pack_events(text,text[]),histoire.admin_create_event(uuid,text,jsonb),histoire.admin_content_history(text)
  to authenticated;
insert into histoire.migrations_appliquees(version,nom) values('20261015201336','administration_questions');
notify pgrst,'reload schema';
commit;
