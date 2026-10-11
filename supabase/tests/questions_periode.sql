-- #94 : questions « période ». Données simulées, transaction locale/CI exclusivement.
begin;
create function pg_temp.verifier(condition boolean, description text) returns void
language plpgsql as $$ begin
  if condition is not true then raise exception 'ÉCHEC : %', description; end if;
end $$;
create function pg_temp.refuser(query text, expected_state text) returns void
language plpgsql as $$ begin
  begin execute query;
  exception when others then if sqlstate = expected_state then return; end if; raise; end;
  raise exception 'ÉCHEC : requête acceptée : %', query;
end $$;

-- Dix questions à une date (1er janvier 1800) et cinq événements qui durent.
insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
select 'EVT-' || (9700+i), 'Ponctuel ' || i, 'POINT', 'DAY', 'EXACT', true, 'DAY', 1, 1, 1 from generate_series(0,9) i;
insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau) values
  ('EVT-9710','Grande guerre de test','PERIOD','DAY_RANGE','EXACT',true,'RANGE',1,1,1),
  ('EVT-9711','Guerre antique de test','PERIOD','YEAR_RANGE','EXACT',true,'RANGE',1,1,1),
  ('EVT-9712','Bataille de test','PERIOD','DAY_RANGE','EXACT',true,'RANGE',1,1,1),
  ('EVT-9713','Rafle de test','PERIOD','DAY_RANGE','EXACT',true,'RANGE',1,1,1),
  ('EVT-9714','Révolution de test','PERIOD','YEAR_RANGE','EXACT',true,'RANGE',1,1,1);
insert into histoire.event_answers(event_id,start_year,start_month,start_day)
select 'EVT-' || (9700+i), 1800, 1, 1 from generate_series(0,9) i;
-- Le déclencheur marque les périodes : plusieurs années, mois, un jour, puis une fausse période.
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description) values
  ('EVT-9710',1914,7,28,1918,11,11,'Du 28 juillet 1914 au 11 novembre 1918'),
  ('EVT-9711',-431,null,null,-404,null,null,null),
  ('EVT-9712',1916,2,21,1916,12,18,null),
  ('EVT-9713',1942,7,16,1942,7,17,null),
  ('EVT-9714',1917,null,null,1917,null,null,null);
insert into histoire.packs(id,slug,title) values ('PER-94','per-94','Périodes de test'), ('PER-94-SEUL','per-94-seul','Une seule période');
insert into histoire.pack_events(pack_id,event_id,position)
select 'PER-94','EVT-' || (9700+i),i+1 from generate_series(0,14) i;
insert into histoire.pack_events(pack_id,event_id,position)
select 'PER-94-SEUL','EVT-' || (9700+i),i+1 from generate_series(0,9) i;
insert into histoire.pack_events(pack_id,event_id,position) values ('PER-94-SEUL','EVT-9710',11);

do $$ begin
  perform pg_temp.verifier((select array_agg(event_id order by event_id) from histoire.event_answers
    where periode_possible and event_id between 'EVT-9700' and 'EVT-9714')
    = array['EVT-9710','EVT-9711','EVT-9712','EVT-9713'], 'marquage : seulement les fins après le début');
  perform pg_temp.verifier(histoire.periode_jouable(1914,7,28,1918,11,11,'YEAR')
    and histoire.periode_jouable(-431,null,null,-404,null,null,'YEAR')
    and not histoire.periode_jouable(1916,2,21,1916,12,18,'YEAR')
    and histoire.periode_jouable(1916,2,21,1916,12,18,'MONTH')
    and not histoire.periode_jouable(-431,null,null,-404,null,null,'MONTH')
    and not histoire.periode_jouable(1942,7,16,1942,7,17,'MONTH')
    and histoire.periode_jouable(1942,7,16,1942,7,17,'DAY')
    and not histoire.periode_jouable(1800,1,1,null,null,null,'YEAR'), 'durée minimale selon la précision');
  perform pg_temp.verifier(not has_function_privilege('anon','histoire.periode_jouable(integer,integer,integer,integer,integer,integer,text)','execute')
    and not has_function_privilege('anon','histoire.verifier_date_reponse(integer,integer,integer,text)','execute')
    and not has_function_privilege('anon','histoire.correction_periode(histoire.game_questions)','execute')
    and not has_function_privilege('authenticated','histoire.periode_jouable(integer,integer,integer,integer,integer,integer,text)','execute')
    and not has_table_privilege('anon','histoire.event_answers','select')
    and has_function_privilege('anon','histoire.submit_period_answer(uuid,uuid,integer,integer,integer,integer,integer,integer,text)','execute')
    and has_function_privilege('anon','histoire.start_game(boolean,integer,text,text,text,integer,integer,text,text[],text,integer,text)','execute'),
    'fonctions internes fermées, RPC ouvertes');
end $$;

create temporary table periodes(game_id uuid, question_id uuid, jeton text);
grant all on periodes to anon;
set local role anon;

-- Tirage : jamais un événement sans fin, au plus une question sur cinq.
do $$ declare g jsonb; n integer; begin
  for i in 1..25 loop
    g := histoire.start_game(p_periodes=>true, p_token=>repeat('a',64), p_pack_id=>'PER-94', p_question_count=>10);
    insert into periodes values ((g->>'game_id')::uuid, null, repeat('a',64));
  end loop;
  for i in 1..10 loop
    g := histoire.start_game(p_periodes=>true, p_token=>repeat('a',64), p_pack_id=>'PER-94', p_question_count=>5);
    insert into periodes values ((g->>'game_id')::uuid, null, 'cinq');
    g := histoire.start_game(p_periodes=>true, p_token=>repeat('a',64), p_pack_id=>'PER-94', p_question_count=>5, p_difficulty=>'MONTH');
    insert into periodes values ((g->>'game_id')::uuid, null, 'mois');
    g := histoire.start_game(p_periodes=>false, p_token=>repeat('a',64), p_pack_id=>'PER-94', p_question_count=>10);
    insert into periodes values ((g->>'game_id')::uuid, null, 'coupees');
    g := histoire.start_game(p_niveau=>1, p_token=>repeat('a',64), p_pack_id=>'PER-94', p_question_count=>10);
    insert into periodes values ((g->>'game_id')::uuid, null, 'ancienne');
    g := histoire.start_game(p_periodes=>true, p_token=>repeat('a',64), p_pack_id=>'PER-94', p_question_count=>3, p_direction=>'inverse', p_difficulty=>'DAY');
    insert into periodes values ((g->>'game_id')::uuid, null, 'inverse');
    g := histoire.start_mystery_game(p_periodes=>true, p_token=>repeat('a',64), p_pack_id=>'PER-94', p_question_count=>5);
    insert into periodes values ((g->>'game_id')::uuid, null, 'mystere');
  end loop;
  perform pg_temp.refuser($q$select histoire.start_game(p_periodes=>null, p_token=>repeat('a',64))$q$, '22023');
end $$;
reset role;
do $$ begin
  perform pg_temp.verifier(not exists (select 1 from histoire.game_questions q join periodes p using (game_id)
    where q.periode and (q.event_id not in ('EVT-9710','EVT-9711','EVT-9712','EVT-9713') or q.expected_end_year is null)),
    'jamais de période pour un événement sans fin');
  perform pg_temp.verifier(not exists (select 1 from periodes p where p.jeton = repeat('a',64)
    and (select count(*) filter (where periode) from histoire.game_questions where game_id = p.game_id) not between 1 and 2),
    'dix questions : une ou deux questions période');
  perform pg_temp.verifier(not exists (select 1 from periodes p where p.jeton = repeat('a',64)
    and exists (select 1 from histoire.game_questions where game_id = p.game_id and periode and event_id in ('EVT-9712','EVT-9713'))),
    'précision Année : une période d''au moins un an');
  perform pg_temp.verifier(not exists (select 1 from periodes p where p.jeton in ('cinq','mois','mystere')
    and (select count(*) filter (where periode) from histoire.game_questions where game_id = p.game_id) <> 1),
    'cinq questions : exactement une question période');
  perform pg_temp.verifier(not exists (select 1 from periodes p where p.jeton = 'mois'
    and exists (select 1 from histoire.game_questions where game_id = p.game_id and periode and event_id not in ('EVT-9710','EVT-9712'))),
    'précision Mois : une période d''au moins un mois');
  perform pg_temp.verifier(not exists (select 1 from periodes p join histoire.game_questions q using (game_id)
    where p.jeton in ('coupees','ancienne','inverse') and q.periode),
    'option coupée, ancienne signature et mode inversé : aucune question période');
  perform pg_temp.verifier((select context->'replay_filters'->>'periods' from histoire.games
    where id = (select game_id from periodes where jeton = 'coupees' limit 1)) = 'false', 'option rejouée au bilan');
end $$;
truncate periodes;

-- Partie de cinq questions : la période est la seule différence visible avant la réponse.
set local role anon;
do $$ declare g jsonb; q jsonb; r jsonb; cles text[]; vue boolean := false; begin
  g := histoire.start_game(p_periodes=>true, p_token=>repeat('b',64), p_pack_id=>'PER-94-SEUL', p_question_count=>5);
  for i in 1..5 loop
    q := histoire.next_question((g->>'game_id')::uuid, repeat('b',64));
    select array_agg(k order by k) into cles from jsonb_object_keys(q) k;
    if q ? 'periode' then
      vue := true;
      perform pg_temp.verifier(cles = array['asked_at','deadline','difficulty','image_path','periode','position',
        'question_count','question_id','server_time','title'] and q->>'periode' = 'true',
        'question période : une seule clé de plus, aucune date');
      perform pg_temp.verifier(q::text !~ '1914|1918', 'aucune date de début ou de fin avant la réponse');
      -- Une question période ne se répond pas avec une seule date.
      perform pg_temp.refuser(format('select histoire.submit_answer(%L,%L,1914,p_token=>%L)', g->>'game_id', q->>'question_id', repeat('b',64)), '22023');
      -- La fin ne peut pas précéder le début.
      perform pg_temp.refuser(format('select histoire.submit_period_answer(%L,%L,1918,null,null,1914,null,null,%L)',
        g->>'game_id', q->>'question_id', repeat('b',64)), '22023');
      perform pg_temp.refuser(format('select histoire.submit_period_answer(%L,%L,1914,null,null,null,null,null,%L)',
        g->>'game_id', q->>'question_id', repeat('b',64)), '22023');
      -- Début juste, fin fausse de 25 ans : 100 et 50 de précision, moyenne 75.
      r := histoire.submit_period_answer((g->>'game_id')::uuid, (q->>'question_id')::uuid,
        1914, null, null, 1943, null, null, repeat('b',64));
      perform pg_temp.verifier((r->>'start_accuracy')::numeric = 100 and (r->>'end_accuracy')::numeric = 50
        and (r->>'accuracy')::numeric = 75 and (r->>'points')::int between 74 and 75
        and r->>'gap' = '0' and r->>'end_gap' = '25' and r->>'periode' = 'true'
        and r->'correct_date'->>'year' = '1914' and r->'correct_end_date'->>'year' = '1918'
        and r->>'expired' = 'false', 'score période = moyenne du début et de la fin');
      perform pg_temp.refuser(format('select histoire.submit_period_answer(%L,%L,1914,null,null,1918,null,null,%L)',
        g->>'game_id', q->>'question_id', repeat('b',64)), '22023');
    else
      perform pg_temp.verifier(cles = array['asked_at','deadline','difficulty','image_path','position',
        'question_count','question_id','server_time','title'], 'question à une date inchangée');
      perform pg_temp.refuser(format('select histoire.submit_period_answer(%L,%L,1800,null,null,1801,null,null,%L)',
        g->>'game_id', q->>'question_id', repeat('b',64)), '22023');
      r := histoire.submit_answer((g->>'game_id')::uuid, (q->>'question_id')::uuid, 1800, p_token=>repeat('b',64));
      perform pg_temp.verifier(not r ? 'periode' and (r->>'accuracy')::numeric = 100, 'correction à une date inchangée');
    end if;
  end loop;
  perform pg_temp.verifier(vue, 'la partie contient sa question période');
  r := histoire.finish_game((g->>'game_id')::uuid, repeat('b',64));
  perform pg_temp.verifier((select count(*) from jsonb_array_elements(r->'questions') x
    where x->>'periode' = 'true' and x->'answer'->>'year' = '1914' and x->'answer_end'->>'year' = '1943'
      and x->'correct_end_date'->>'year' = '1918' and x->>'end_gap' = '25') = 1
    and (select count(*) from jsonb_array_elements(r->'questions') x where x ? 'answer_end') = 1,
    'bilan : fin répondue et fin attendue de la seule question période');
  perform pg_temp.verifier((r->>'average_accuracy')::numeric = 95, 'précision moyenne de la partie');
end $$;

-- Égalité début = fin acceptée ; mois et jour exigés à la précision Jour ; expiration à zéro.
do $$ declare g jsonb; q jsonb; r jsonb; begin
  g := histoire.start_game(p_periodes=>true, p_token=>repeat('c',64), p_pack_id=>'PER-94-SEUL', p_question_count=>5, p_difficulty=>'DAY');
  for i in 1..5 loop
    q := histoire.next_question((g->>'game_id')::uuid, repeat('c',64));
    if q ? 'periode' then
      perform pg_temp.refuser(format('select histoire.submit_period_answer(%L,%L,1914,7,null,1918,11,11,%L)',
        g->>'game_id', q->>'question_id', repeat('c',64)), '22023');
      perform pg_temp.refuser(format('select histoire.submit_period_answer(%L,%L,1914,7,28,1914,7,27,%L)',
        g->>'game_id', q->>'question_id', repeat('c',64)), '22023');
      insert into periodes values ((g->>'game_id')::uuid, (q->>'question_id')::uuid, repeat('c',64));
      exit;
    end if;
    perform histoire.submit_answer((g->>'game_id')::uuid, (q->>'question_id')::uuid, 1800, 1, 1, repeat('c',64));
  end loop;
end $$;
reset role;
update histoire.game_questions set asked_at = clock_timestamp()-interval '31 seconds', deadline = clock_timestamp()-interval '1 second'
where id = (select question_id from periodes);
set local role anon;
do $$ declare p periodes; r jsonb; begin
  select * into p from periodes;
  r := histoire.submit_period_answer(p.game_id, p.question_id, p_token=>p.jeton);
  perform pg_temp.verifier(r->>'expired' = 'true' and r->>'points' = '0' and (r->>'accuracy')::numeric = 0
    and r->'correct_end_date'->>'day' = '11', 'temps écoulé : zéro et correction de la période');
end $$;
reset role;

-- Égalité début = fin, à la précision Mois.
set local role anon;
do $$ declare g jsonb; q jsonb; r jsonb; begin
  g := histoire.start_game(p_periodes=>true, p_token=>repeat('d',64), p_pack_id=>'PER-94-SEUL', p_question_count=>5, p_difficulty=>'MONTH');
  for i in 1..5 loop
    q := histoire.next_question((g->>'game_id')::uuid, repeat('d',64));
    if q ? 'periode' then
      r := histoire.submit_period_answer((g->>'game_id')::uuid, (q->>'question_id')::uuid,
        1916, 3, null, 1916, 3, null, repeat('d',64));
      perform pg_temp.verifier(r->>'unit' = 'MONTH' and r->>'gap' = '20' and r->>'end_gap' = '32', 'début = fin accepté');
      exit;
    end if;
    perform histoire.submit_answer((g->>'game_id')::uuid, (q->>'question_id')::uuid, 1800, 1, p_token=>repeat('d',64));
  end loop;
  raise notice 'OK : questions période (marquage, tirage, option, score, inversion, expiration, bilan)';
end $$;
rollback;
