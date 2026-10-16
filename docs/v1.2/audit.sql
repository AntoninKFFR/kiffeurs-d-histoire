begin isolation level repeatable read read only;
with cohorts(label,n,expert) as (values ('debutant',1,false),('intermediaire_cumule',2,false),('expert_exclusif',3,true),('tous',3,false)),
m as (select label,dir, histoire.playable_packs(p_expert_only=>expert,p_niveau=>n,p_direction=>dir) as packs
from cohorts cross join (values ('date'),('inverse')) d(dir))
select jsonb_build_object('at',now(),'rpc_matrix',(select jsonb_agg(to_jsonb(m)) from m),
'coverage',(select jsonb_agg(x) from (
select p.id,p.title,p.parent_id,
(select count(*) from histoire.pack_events pe where pe.pack_id=p.id) direct,
(select count(distinct pe.event_id) from histoire.pack_events pe where pe.pack_id=p.id) direct_unique,
(select count(*) from histoire.pack_scope_events(p.id)) effective_memberships,
(select count(*) from histoire.pack_event_status s where s.pack_id=p.id and s.removed) removed_direct,
(select count(distinct pe.event_id) from histoire.pack_events pe join histoire.pack_event_status s using(pack_id,event_id) where pe.pack_id=p.id and s.removed) removed_linked,
(select jsonb_build_object('min',min(c.start_year),'max',max(c.start_year),'antiquite',count(*) filter(where c.start_year<476),'moyen_age',count(*) filter(where c.start_year>=476 and c.start_year<1492),'moderne',count(*) filter(where c.start_year>=1492 and c.start_year<1789),'1789_1900',count(*) filter(where c.start_year>=1789 and c.start_year<=1900),'1901_2000',count(*) filter(where c.start_year>=1901 and c.start_year<=2000),'apres_2000',count(*) filter(where c.start_year>2000)) from histoire.solo_candidates(3,p.id,null,null,null,null,null,'YEAR') c) chronology,
(select jsonb_agg(z) from (select t.name,count(distinct c.id) n from histoire.solo_candidates(3,p.id,null,null,null,null,null,'YEAR') c join histoire.event_tags et on et.event_id=c.id join histoire.tags t on t.id=et.tag_id where t.tag_type='SEMANTIC_TOPIC' group by t.name order by count(distinct c.id) desc,t.name limit 8) z) topics,
(select count(*) from histoire.events e join histoire.pack_scope_events(p.id) s on s.event_id=e.id where not e.playable) not_playable
from histoire.packs p where p.active order by p.id) x),
'fingerprints',(select jsonb_build_object('events',md5(string_agg(to_jsonb(e)::text,'' order by e.id)),'answers',(select md5(string_agg(to_jsonb(a)::text,'' order by a.event_id)) from histoire.event_answers a),'pack_events',(select md5(string_agg(to_jsonb(pe)::text,'' order by pe.pack_id,pe.event_id)) from histoire.pack_events pe),'removals',(select md5(coalesce(string_agg(to_jsonb(s)::text,'' order by s.pack_id,s.event_id),'')) from histoire.pack_event_status s)) from histoire.events e),
'confidentiality',(select jsonb_agg(jsonb_build_object('role',r,'answers_select',has_table_privilege(r,'histoire.event_answers','SELECT'),'aliases_select',has_table_privilege(r,'histoire.event_aliases','SELECT'))) from unnest(array['anon','authenticated']) r)
) audit;
commit;
