// Postgres jetable dans un conteneur explicitement identifié ; aucune URL/clé Supabase.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { lireCsv } from "./csv";
import { chargerCartes } from "./import-cartes";
import { chargerStructure } from "./structure-pedagogique";
import {verifierDockerFixture} from "./verifier-docker-fixture";
import {planCompletions} from "./completions-pedagogiques";

const container = process.argv[process.argv.indexOf("--container") + 1];
verifierDockerFixture(container);
const database = "kffr_phase2_" + randomBytes(6).toString("hex");
execFileSync("docker", ["exec", container, "createdb", "-U", "postgres", database]);
function sql(text: string) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-X", "-Atq"],
    { input: text, encoding: "utf8", maxBuffer: 10_000_000, stdio: ["pipe", "pipe", "pipe"] }).trim();
}
const quote = (x: unknown) => "'" + JSON.stringify(x).replace(/'/g, "''") + "'::jsonb";
function insertRecords(table: string, rows: object[]) {
  const columns = Object.keys(rows[0]).join(",");
  sql(`insert into histoire.${table}(${columns}) select ${columns} from jsonb_populate_recordset(null::histoire.${table},${quote(rows)});`);
}
const json = <T,>(text: string) => JSON.parse(sql(text).split("\n").at(-1)!) as T;
const snapshot = (table: string) => sql(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from histoire.${table} x;`);
function rejects(text: string) { assert.throws(() => sql(text)); }
const A = "00000000-0000-0000-0000-000000000092", B = "00000000-0000-0000-0000-000000000093";
const asPlayer = (id: string, statement: string) => `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); ${statement}`;
const anon = "set role anon; ";
try {
  // Stubs locaux des contrats externes, jamais des migrations dans auth/public.
  sql(`do $$begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end$$; create schema extensions; create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';`);
  sql(readFileSync("supabase/fixtures/kffr_profiles.sql", "utf8"));
  const files = readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort();
  const prepared = files.find(f => f.endsWith("_preparation_sous_chapitres.sql"))!;
  for (const f of files.filter(f => f !== prepared)) sql(readFileSync("supabase/migrations/" + f, "utf8"));
  const csv = (name: string) => lireCsv("content/dataset-v18/kiffeurs-" + name + "-v18.csv");
  const integer = (s: string) => s ? Number(s) : null;
  const events = csv("events"), themes = csv("themes"), links = csv("curriculum-links");
  const settings = new Map(lireCsv("content/niveaux-evenements.csv").map(r => [r.event_id, r]));
  const ev = events.map(e => ({ id: e.event_id, title: e.title_canonical, event_type: e.event_type, precision: e.precision,
    date_status: e.date_status, playable: e.playable === "TRUE", playable_mode: e.playable_mode, importance: integer(e.importance),
    difficulty: integer(e.difficulty), source_status: e.source_status || null, niveau: Number(settings.get(e.event_id)?.niveau ?? 3) }));
  insertRecords("events",ev);
  const answers = events.map(e => ({ event_id: e.event_id, ...Object.fromEntries(["start_year","start_month","start_day","end_year","end_month","end_day"].map(k => [k,integer(e[k])])),
    date_text: e.date_text || null, description: e.description_short || null }));
  insertRecords("event_answers",answers);
  const levels = json<{ id: string; name: string }[]>("select jsonb_agg(jsonb_build_object('id',id,'name',name)) from histoire.levels");
  const chapters = themes.map(t => ({ id: t.theme_id, level_id: levels.find(l => l.name === t.level)!.id, school_year: t.school_year, program_scope: t.program_scope, title: t.theme_title }));
  sql(`insert into histoire.chapters select * from jsonb_populate_recordset(null::histoire.chapters,${quote(chapters)});`);
  const redirections = new Map(csv("event-redirects").map(r => [r.old_event_id,r.canonical_event_id]));
  const curriculum = [...new Map(links.filter(l => l.theme_id && l.event_id).map(l => {
    const event_id = redirections.get(l.event_id) ?? l.event_id; return [l.theme_id+event_id,{ chapter_id: l.theme_id,event_id,curriculum_status:l.curriculum_status || null }];
  })).values()];
  sql(`insert into histoire.event_chapters select * from jsonb_populate_recordset(null::histoire.event_chapters,${quote(curriculum)});`);
  const cards = chargerCartes();
  sql(`select histoire.replace_chapter_cards(${quote(cards)});`);
  sql(`insert into auth.users values('${A}'),('${B}'); select set_config('request.jwt.claim.sub','${A}',false); select histoire.mark_chapter_discovered('THM-017');`);
  const prior = json<{game_id:string}>(asPlayer(A,`select histoire.start_chapter_test('${"a".repeat(64)}','THM-017','YEAR',5);`));
  sql(`update histoire.games set state='finished',average_accuracy=83,finished_at=now() where id='${prior.game_id}';
    update histoire.game_questions set answered_at=now(),answer_year=expected_year,answer_month=expected_month,answer_day=expected_day,accuracy=83,points=83 where game_id='${prior.game_id}';
    select set_config('request.jwt.claim.sub','${A}',false); select histoire.record_chapter_test('${prior.game_id}');`);
  const before = Object.fromEntries(["chapters","chapter_cards","event_chapters","learning_progress","games","game_questions"].map(t => [t,snapshot(t)]));
  const migration=readFileSync("supabase/migrations/"+prepared,"utf8");
  rejects(migration.replace("insert into histoire.migrations_appliquees(version,nom)","select 1/0; insert into histoire.migrations_appliquees(version,nom)"));
  assert.equal(sql("select to_regclass('histoire.pedagogical_units') is null"),"t","DDL partiellement conservé après erreur de migration");
  sql(migration);
  assert.equal(sql(anon+"select histoire.pedagogical_available('THM-017')"),"t","Ancien chapitre fermé avant enregistrement");
  assert.equal(sql(asPlayer(A,"select histoire.pedagogical_available('THM-017')")).split("\n").at(-1),"t");
  for (const [t,data] of Object.entries(before)) assert.equal(snapshot(t),data,"Migration modifiant "+t);
  const structure = chargerStructure(), units = [...structure.chapitres_historiques,...structure.sous_chapitres];
  const register = `select histoire.register_pedagogical_structure(${quote(units)});`;
  sql(register); const registered = snapshot("pedagogical_units"); sql(register);
  assert.equal(snapshot("pedagogical_units"),registered,"Réenregistrement non idempotent");
  assert.equal(sql("select count(*) from histoire.chapters"),"59");
  assert.equal(sql("select count(*) from histoire.chapter_cards"),"325");
  assert.equal(sql("select count(*) from histoire.event_chapters"),"722");
  for (const t of ["chapter_cards","learning_progress","games","game_questions"]) assert.equal(snapshot(t),before[t],"Enregistrement modifiant "+t);
  const after = Object.fromEntries(["chapters","chapter_cards","event_chapters","learning_progress","pedagogical_units"].map(t => [t,snapshot(t)]));
  // Après initialisation, un chapitre absent du registre reste fermé, même avec une carte.
  sql(`begin; insert into histoire.chapters select 'THM-999',level_id,school_year,program_scope,'Fixture hors registre' from histoire.chapters limit 1;
    insert into histoire.event_chapters(event_id,chapter_id) values('${cards[0].event_id}','THM-999');
    insert into histoire.chapter_cards select * from jsonb_populate_recordset(null::histoire.chapter_cards,${quote([{...cards[0],chapter_id:'THM-999',card_id:'CARD-999-fixture'}])});
    set role anon;
    do $$begin if histoire.pedagogical_available('THM-999') or (select count(*) from histoire.get_chapter_cards('THM-999'))<>0 then raise exception 'Chapitre non enregistré exposé'; end if; end $$;
    reset role; set role authenticated;
    do $$begin if histoire.pedagogical_available('THM-999') or (select count(*) from histoire.get_chapter_cards('THM-999'))<>0 then raise exception 'Chapitre non enregistré exposé au joueur'; end if; end $$;
    rollback;`);
  for (let i=0;i<2;i++) {
    sql(`select histoire.sync_pedagogical_links(${quote(curriculum)},array(select id from histoire.events)); select histoire.replace_chapter_cards(${quote(cards)});`+register);
    for (const [t,data] of Object.entries(after)) assert.equal(snapshot(t),data,"Réimport modifiant "+t);
  }
  // Les anciennes RPC et cartes restent exactes, tous les enfants et données privées sont fermés.
  for (const c of structure.chapitres_historiques) {
    const visible = json<{card_id:string}[]>(anon+`select coalesce(jsonb_agg(x),'[]') from histoire.get_chapter_cards('${c.id}') x;`);
    assert.deepEqual(visible.map(v=>v.card_id),cards.filter(v=>v.chapter_id===c.id).map(v=>v.card_id));
    assert(!JSON.stringify(visible).includes('"event_id"')); assert(!JSON.stringify(visible).includes('"sources"'));
  }
  assert.equal(sql(anon+"select count(*) from histoire.chapters"),"41");
  for (const c of structure.sous_chapitres) {
    assert.equal(sql(anon+`select count(*) from histoire.get_chapter_cards('${c.id}')`),"0");
    rejects(anon+`select histoire.start_chapter_test('${"a".repeat(64)}','${c.id}','YEAR',5);`);
    rejects(asPlayer(A,`select histoire.mark_chapter_discovered('${c.id}');`));
  }
  for (const table of ["chapter_cards","event_answers","event_aliases","pedagogical_units","pedagogical_card_lineage","pedagogical_registry","pedagogical_editions"]) {
    rejects(anon+`select * from histoire.${table};`); rejects(asPlayer(A,`select * from histoire.${table};`));
  }
  assert.equal(sql(asPlayer(B,"select count(*) from histoire.learning_progress" )).split("\n").at(-1),"0");
  assert.equal(sql(asPlayer(A,"select count(*) from histoire.learning_progress" )).split("\n").at(-1),"1");
  rejects(asPlayer(B,`select histoire.record_chapter_test('${prior.game_id}');`));
  assert.equal(sql("select count(*) from histoire.learning_progress where chapter_id between 'THM-047' and 'THM-064'"),"0");
  rejects("delete from histoire.chapters where id='THM-017';");
  rejects("delete from histoire.chapter_cards where card_id='CARD-017-fin-urss';");
  rejects("delete from histoire.event_chapters where chapter_id='THM-017';");
  rejects(`select histoire.replace_chapter_cards(${quote(cards.filter(c=>c.card_id!=="CARD-017-fin-urss"))});`);
  rejects(`select histoire.replace_chapter_cards(${quote([...cards.slice(0,-1),{...cards.at(-1)!,event_id:"EVT-INCONNU"}])});`);
  rejects(`select histoire.register_pedagogical_structure(${quote(units.slice(0,-1))});`);
  rejects("select histoire.set_pedagogical_group_active('THM-006',true,'non-valide');");
  rejects("select histoire.set_pedagogical_group_active('THM-012',true,'non-valide');");
  sql("select histoire.set_pedagogical_group_active('THM-006',false,null);");
  for (const [t,data] of Object.entries(after)) assert.equal(snapshot(t),data,"Erreur/rollback modifiant "+t);
  // Publication et retour arrière sur des fixtures techniques complètes uniquement.
  // Textes existants repris en mémoire ; aucun nouveau contenu pédagogique dans le dépôt.
  const testChildren=structure.sous_chapitres.filter(c=>c.parent_id==='THM-017');
  const origins: {card_id:string;source_card_id:string}[]=[];
  const technical=testChildren.flatMap(child=>child.event_ids.map((id,i)=>{
    const e=events.find(e=>e.event_id===id)!;
    const origin=cards.find(c=>c.chapter_id===child.parent_id&&c.event_id===id);
    const template=origin??cards.find(c=>c.chapter_id===child.parent_id&&c.event_id)!;
    const card_id=`CARD-${child.id.slice(4)}-fixture-${id.slice(4)}`;
    if(origin)origins.push({card_id,source_card_id:origin.card_id});
    return {...template,card_id,chapter_id:child.id,event_id:id,sort_order:i+1,date_text:e.date_text,date_precision:e.precision,date_status:e.date_status,
      ...Object.fromEntries(['start_year','start_month','start_day','end_year','end_month','end_day'].map(k=>[k,integer(e[k])])),
      official_wording:links.find(l=>l.theme_id===child.parent_id&&l.event_id===id)!.official_wording};
  }));
  const stage=`select histoire.import_pedagogical_cards(${quote(technical)},${quote(origins)});`;
  rejects(`begin; ${stage} select 1/0; commit;`);
  for(const [t,data] of Object.entries(after))assert.equal(snapshot(t),data,'Lot enfant non atomique : '+t);
  sql(`begin; ${stage} ${stage}
    update histoire.pedagogical_units set content_approval=histoire.pedagogical_fingerprint(chapter_id),illustration_approval='fixture-illustrations',catalogue_approval='fixture-catalogue' where parent_id='THM-017';
    select histoire.set_pedagogical_group_active('THM-017',true,'fixture-catalogue');
    do $$begin
      begin
        delete from histoire.pedagogical_card_lineage where card_id='${origins[0].card_id}';
        raise exception 'Filiation publiée modifiable';
      exception when raise_exception then
        if sqlerrm='Filiation publiée modifiable' then raise; end if;
      end;
    end $$;
    do $$declare g jsonb; begin
      if (select count(*) from histoire.pedagogical_units where etat='actif')<>44
        or (select count(*) from histoire.pedagogical_units where parent_id='THM-017' and etat='actif')<>4
        or (select etat from histoire.pedagogical_units where chapter_id='THM-017')<>'historique' then raise exception 'Activation partielle'; end if;
      if not histoire.pedagogical_available('THM-017') or not histoire.pedagogical_available('THM-059') then raise exception 'Historique/actif inaccessible'; end if;
      perform set_config('request.jwt.claim.sub','${A}',true);
      perform histoire.mark_chapter_discovered('THM-059');
      if (select best_accuracy from histoire.learning_progress where user_id='${A}' and chapter_id='THM-059') is not null then raise exception 'Score transféré'; end if;
      g:=histoire.start_chapter_test(null,'THM-059','YEAR',5);
      update histoire.games set state='finished',average_accuracy=50,finished_at=now() where id=(g->>'game_id')::uuid;
      perform histoire.record_chapter_test((g->>'game_id')::uuid);
      if (select best_accuracy from histoire.learning_progress where user_id='${A}' and chapter_id='THM-059')<>50
        or (select best_accuracy from histoire.learning_progress where user_id='${A}' and chapter_id='THM-017')<>83 then raise exception 'Progression non indépendante'; end if;
    end $$;
    select histoire.export_pedagogical_structure();
    select histoire.set_pedagogical_group_active('THM-017',false,null);
    ${register}
    do $$begin
      if (select count(*) from histoire.pedagogical_units where etat='actif')<>41
        or (select count(*) from histoire.pedagogical_units where parent_id='THM-017' and etat='historique')<>4
        or not histoire.pedagogical_available('THM-059')
        or (select best_accuracy from histoire.learning_progress where user_id='${A}' and chapter_id='THM-059')<>50 then raise exception 'Rollback destructeur'; end if;
    end $$;
    rollback;`);
  for (const [t,data] of Object.entries(after))assert.equal(snapshot(t),data,'Fixture de publication persistante : '+t);
  // Les 104 ajouts des 27 chapitres sont importables sans aucun nouveau chapitre.
  // Fixtures techniques uniquement : textes existants repris, transaction annulée.
  const plan=planCompletions(); assert.equal(plan.length,27); assert.equal(plan.flatMap(p=>p.event_ids).length,104);
  const completionLots=plan.map(p=>({chapter:p.chapter_id,cards:p.event_ids.map((id,i)=>{
    const e=events.find(e=>e.event_id===id)!,template=cards.find(c=>c.chapter_id===p.chapter_id)!;
    return {...template,card_id:`CARD-${p.chapter_id.slice(4)}-completion-fixture-${id.slice(4)}`,event_id:id,sort_order:i+1,
      date_text:e.date_text,date_precision:e.precision,date_status:e.date_status,
      ...Object.fromEntries(['start_year','start_month','start_day','end_year','end_month','end_day'].map(k=>[k,integer(e[k])]))};
  })}));
  const stageAll=completionLots.map(p=>`select histoire.stage_pedagogical_completion('${p.chapter}',${quote(p.cards)});`).join('\n');
  rejects(`begin; ${stageAll} select 1/0; commit;`);
  for(const [t,data] of Object.entries(after))assert.equal(snapshot(t),data,'Import de complétion non atomique : '+t);
  const target=completionLots.find(p=>p.chapter==='THM-001')!,legacyCount=cards.filter(c=>c.chapter_id==='THM-001').length;
  rejects(`begin; select histoire.stage_pedagogical_completion('THM-001',${quote(target.cards.slice(0,1))});
    select histoire.publish_pedagogical_completion('THM-001', (select md5(cards::text||candidates::text) from histoire.pedagogical_editions where chapter_id='THM-001' and version='completion-v1'),'fixture','fixture'); commit;`);
  sql(`begin; ${stageAll} ${stageAll}
    do $$begin if (select count(*) from histoire.pedagogical_editions where version='completion-v1')<>27
      or (select count(*) from histoire.chapters)<>59 or (select count(*) from histoire.chapter_cards)<>325 then raise exception 'Complétion multipliant les chapitres ou modifiant les anciennes cartes'; end if; end $$;
    select set_config('request.jwt.claim.sub','${A}',true);
    select histoire.mark_chapter_discovered('THM-001');
    do $$declare g jsonb; begin
      if (select count(*) from histoire.get_chapter_cards_version('THM-001','completion-v1'))<>0 then raise exception 'Brouillon exposé'; end if;
      g:=histoire.start_chapter_test(null,'THM-001','YEAR',5);
      update histoire.games set state='finished',average_accuracy=83,finished_at=now() where id=(g->>'game_id')::uuid;
      perform histoire.record_chapter_test((g->>'game_id')::uuid);
    end $$;
    select histoire.publish_pedagogical_completion('THM-001',(select md5(cards::text||candidates::text) from histoire.pedagogical_editions where chapter_id='THM-001' and version='completion-v1'),'fixture-svg','fixture-catalogue');
    do $$declare g jsonb; begin
      if (select count(*) from histoire.get_chapter_cards('THM-001'))<>(select jsonb_array_length(cards) from histoire.pedagogical_editions where chapter_id='THM-001' and version='completion-v1') then raise exception 'Complétion non visible'; end if;
      if (select count(*) from histoire.get_chapter_cards_version('THM-001','legacy-v1'))<>${legacyCount} then raise exception 'Ancienne édition perdue'; end if;
      perform histoire.mark_chapter_discovered('THM-001');
      if (select best_accuracy from histoire.learning_progress_editions where user_id='${A}' and chapter_id='THM-001') is not null then raise exception 'Score hérité'; end if;
      g:=histoire.start_chapter_test(null,'THM-001','YEAR',5);
      if (select context->>'content_version' from histoire.games where id=(g->>'game_id')::uuid)<>'completion-v1' then raise exception 'Édition active ignorée'; end if;
      update histoire.games set state='finished',average_accuracy=50,finished_at=now() where id=(g->>'game_id')::uuid;
      perform histoire.record_chapter_test((g->>'game_id')::uuid); perform histoire.record_chapter_test((g->>'game_id')::uuid);
      if (select tests_count from histoire.learning_progress_editions where user_id='${A}' and chapter_id='THM-001')<>1 then raise exception 'Résultat non idempotent'; end if;
      if (select best_accuracy from histoire.learning_progress where user_id='${A}' and chapter_id='THM-001')<>83 then raise exception 'Score initial réinterprété'; end if;
    end $$;
    update histoire.events set playable=false,playable_mode='NOT_AUTOMATIC' where id in (select unnest(expected_event_ids) from histoire.pedagogical_units where chapter_id='THM-001');
    update histoire.event_answers set start_year=2099 where event_id='${target.cards[0].event_id}';
    select histoire.stage_pedagogical_completion('THM-001',${quote(target.cards)});
    select histoire.start_chapter_test_version(null,'THM-001','YEAR',5,'completion-v1');
    set role authenticated; select set_config('request.jwt.claim.sub','${B}',true);
    do $$begin if (select count(*) from histoire.learning_progress_editions)<>0 then raise exception 'Scores interjoueurs exposés'; end if; end $$;
    reset role;
    select histoire.rollback_pedagogical_completion('THM-001');
    do $$begin if (select count(*) from histoire.get_chapter_cards('THM-001'))<>${legacyCount}
      or (select best_accuracy from histoire.learning_progress_editions where user_id='${A}' and chapter_id='THM-001')<>50 then raise exception 'Rollback de complétion destructeur'; end if; end $$;
    rollback;`);
  for (const [t,data] of Object.entries(after))assert.equal(snapshot(t),data,'Fixture de complétion persistante : '+t);
  // Même après un correctif canonique futur, les cartes/tests publiés gardent leur version.
  sql("update histoire.event_answers set start_year=2099 where event_id='EVT-0115';");
  const verifyVersion=(label:string)=>{
    const g=json<{game_id:string}>(asPlayer(A,"select histoire.start_chapter_test_version(null,'THM-017','YEAR',10,'legacy-v1');"));
    assert.equal(sql(`select count(*) from histoire.game_questions q join histoire.chapter_cards c on c.event_id=q.event_id and c.chapter_id='THM-017' where q.game_id='${g.game_id}' and q.expected_year is distinct from c.start_year;`),'0',label);
  };
  verifyVersion('Correctif de date réinterprétant une édition');
  sql("update histoire.events set playable_mode='YEAR' where id in (select event_id from histoire.chapter_cards where chapter_id='THM-017' and event_id is not null);");
  verifyVersion('Changement de mode réinterprétant une édition');
  sql("update histoire.events set playable_mode='NOT_AUTOMATIC',playable=false where id in (select event_id from histoire.chapter_cards where chapter_id='THM-017' and event_id is not null);");
  verifyVersion('Événement retiré du canon supprimant une ancienne question');
  // Les deux autres changements canoniques ne doivent plus filtrer les anciens tests.
  sql("update histoire.events set playable_mode='NOT_AUTOMATIC',playable=false where id in (select event_id from histoire.chapter_cards where chapter_id='THM-017' and event_id is not null);");
  const replay = json<{game_id:string}>(anon+`select histoire.start_chapter_test('${"b".repeat(64)}','THM-017','YEAR',10);`);
  assert.equal(sql(`select count(*) from histoire.game_questions q join histoire.chapter_cards c on c.event_id=q.event_id and c.chapter_id='THM-017' where q.game_id='${replay.game_id}' and q.expected_year is distinct from c.start_year;`),"0");
  assert.equal(sql(`select context->>'content_version' from histoire.games where id='${replay.game_id}'`),"legacy-v1");
  const bilan=json<{replay_filters:{chapterVersion:string};questions:{correct_date:{year:number}}[]}>(asPlayer(A,`select histoire.finish_game('${prior.game_id}',null);`));
  assert.equal(bilan.replay_filters.chapterVersion,'legacy-v1');
  const relance=json<{game_id:string}>(asPlayer(A,"select histoire.start_chapter_test_version(null,'THM-017','YEAR',10,'legacy-v1');"));
  assert.equal(sql(`select count(*) from histoire.game_questions q join histoire.chapter_cards c on c.event_id=q.event_id and c.chapter_id='THM-017' where q.game_id='${relance.game_id}' and q.expected_year is distinct from c.start_year;`),'0');
  assert.equal(snapshot("learning_progress"),before.learning_progress);
  assert.equal(sql("select jsonb_array_length(candidates) from histoire.pedagogical_editions where chapter_id='THM-017' and version='legacy-v1'"),String(structure.eligibilite_tests_historiques['THM-017'].length));
  assert.equal(sql(`select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]') from histoire.game_questions q where game_id='${prior.game_id}';`),before.game_questions);
  console.log("OK : migration sans perte, 41/325 historiques, 59 unités/722 liens/18 inactifs, 104 complétions techniques sur 27 éditions sans nouvel ID, disponibilité restrictive, scores par édition/RLS A/B, dates/modes/retrait canonique sans effet sur anciens tests/bilans/Rejouer, erreurs atomiques et rollback.");
} finally {
  // Cette base a été créée par cette invocation ; le nom aléatoire reste dans le conteneur labellisé.
  execFileSync("docker",["exec",container,"dropdb","-U","postgres","--force",database]);
}
