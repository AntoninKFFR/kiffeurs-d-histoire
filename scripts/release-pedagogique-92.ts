// Publication #92 par les RPC existantes ; aucune modification des protections LOCAL.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { chargerCartes, chargerCartesSousChapitres } from "./import-cartes";
import { chargerCompletions, planCompletions, empreintesCartesPubliees } from "./completions-pedagogiques";
import { appliquerEtatsPublies, chargerStructure, type EtatPublie } from "./structure-pedagogique";
import { lireCsv } from "./csv";
import { verifierPhase4 } from "./illustrations-pedagogiques/phase4-verifier";

export const PROJET_92 = "bskyfdjwcdvzhlugtknb";
export const SHA_APPROUVE_92 = "31ab0d56dd87a3400101e112005d63292c544853";
export const AUTORISATION_92 = `PUBLIER_92_${PROJET_92}_${SHA_APPROUVE_92}`;
const migration = "20261012180633";
const tablesSauvegardees = ["chapter_cards", "chapters", "pedagogical_units", "pedagogical_editions", "pedagogical_card_lineage",
  "pedagogical_registry", "event_chapters", "learning_progress", "learning_progress_editions", "games", "game_questions",
  "game_question_editorial_snapshots", "players", "kpi_games", "solo_anonymous_limits"];
const tablesJoueurs = ["learning_progress", "learning_progress_editions", "games", "game_questions", "game_question_editorial_snapshots", "players", "kpi_games", "solo_anonymous_limits"];
const rpcProtegees = ["import_pedagogical_cards", "set_pedagogical_group_active", "stage_pedagogical_completion",
  "publish_pedagogical_completion", "rollback_pedagogical_completion", "export_pedagogical_structure"];
const empreinte = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const lit = (v: unknown) => "'" + String(v).replaceAll("'", "''") + "'";
const json = (v: unknown) => lit(JSON.stringify(v)) + "::jsonb";
const agregat = (table: string, where = "true") => `(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from histoire.${table} t where ${where})`;

export type PreuveHumaine92 = { sha: string; source: string; confirmation: string; cartes_validees: number; svg_nouveaux_valides: number; han_reste_bloque: boolean };
export type Autorisation92 = { projectId: string; endpoint: string; autorisation: string; preuve: PreuveHumaine92;
  sauvegarde: { projectId: string; fichier: string; sha256: string; verifiee: boolean } };
export type Sauvegarde92 = { project_id:string; source_sha:string; captured_at:string; tables:Record<string,Record<string,unknown>[]> };
export type Corpus92 = ReturnType<typeof chargerCorpus92>;

export function verifierCible92(projectId: string, endpoint: string) {
  const u = new URL(endpoint);
  assert.equal(projectId, PROJET_92, "Identifiant Supabase incorrect");
  assert.equal(u.origin, `https://${PROJET_92}.supabase.co`, "Origine Supabase incorrecte");
  assert(!u.username && !u.password && !u.search && !u.hash && ["", "/"].includes(u.pathname), "URL de cible non canonique");
}

/** La confirmation vient de la consigne humaine, jamais des attestations de fixtures. */
export function verifierAutorisation92(a: Autorisation92) {
  verifierCible92(a.projectId, a.endpoint);
  assert.equal(a.autorisation, AUTORISATION_92, "Autorisation explicite de publication requise");
  assert.equal(a.preuve.sha, SHA_APPROUVE_92);
  assert.equal(a.preuve.cartes_validees, 292); assert.equal(a.preuve.svg_nouveaux_valides, 203);
  assert.equal(a.preuve.han_reste_bloque, true);
  assert(a.preuve.source.trim() && a.preuve.confirmation.trim(), "Preuve humaine absente");
  assert(!/fixture|simulation|test technique/i.test(a.preuve.source), "Une fixture ne vaut pas attestation humaine");
  assert.equal(a.sauvegarde.projectId, PROJET_92);
  assert(a.sauvegarde.verifiee && a.sauvegarde.fichier && /^[a-f0-9]{64}$/.test(a.sauvegarde.sha256), "Sauvegarde vérifiée requise");
}

export function verifierSauvegarde92(s:Sauvegarde92, maintenant=Date.now()) {
  assert.equal(s.project_id,PROJET_92); assert.equal(s.source_sha,SHA_APPROUVE_92);
  const age=maintenant-Date.parse(s.captured_at);
  assert(Number.isFinite(age)&&age>=0&&age<=15*60_000,"Sauvegarde absente, future ou âgée de plus de quinze minutes");
  assert.deepEqual(Object.keys(s.tables).sort(),[...tablesSauvegardees].sort());
  for(const t of tablesSauvegardees)assert(Array.isArray(s.tables[t]),`Table de sauvegarde absente : ${t}`);
  assert.equal(s.tables.pedagogical_units.length,59); assert.equal(s.tables.event_chapters.length,722);
  const anciennes=chargerCartes(),ids=new Set(anciennes.map(c=>c.card_id));
  const stable=(x:unknown):string=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b,'en'))):v);
  const normaliser=(l:unknown[])=>l.map(stable).sort();
  assert.deepEqual(normaliser(s.tables.chapter_cards.filter(c=>ids.has(String(c.card_id)))),normaliser(anciennes),"Sauvegarde de l’historique incompatible");
  assert.equal(s.tables.pedagogical_editions.filter(e=>String(e.chapter_id)<'THM-047'&&e.version!=='completion-v1').length,41);
  const han=s.tables.pedagogical_units.find(u=>u.chapter_id==='THM-049');
  assert(han?.etat==='inactif'&&Array.isArray(han.blocages)&&han.blocages.includes('han-canon-incoherent'),"Blocage Han absent de la sauvegarde");
  return Object.fromEntries(tablesSauvegardees.map(t=>[t,s.tables[t].length]));
}

export function chargerCorpus92() {
  const fichiers = ["content/pedagogie/cartes-v1.csv", "content/pedagogie/cartes-sous-chapitres.csv", "content/pedagogie/cartes-completions.csv",
    "content/pedagogie/chapitres-v2.json", "supabase/migrations/20261012180633_preparation_sous_chapitres.sql"];
  const hashes = Object.fromEntries(fichiers.map(p => {
    const local = readFileSync(p, "utf8").replaceAll("\r\n", "\n");
    const approuve = execFileSync("git", ["show", `${SHA_APPROUVE_92}:${p}`], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    assert.equal(local, approuve, `Source approuvée modifiée : ${p}`);
    return [p, empreinte(local)];
  }));
  const structure = chargerStructure(), anciennes = chargerCartes(), enfants = chargerCartesSousChapitres(fichiers[1]), completions = chargerCompletions(fichiers[2]);
  const filiation = lireCsv(fichiers[1]).filter(c => c.source_card_id).map(c => ({ card_id: c.card_id, source_card_id: c.source_card_id }));
  assert.equal(anciennes.length, 325); assert.equal(enfants.length, 188); assert.equal(completions.length, 104); assert.equal(filiation.length, 61);
  const illustrations = verifierPhase4();
  // Les 203 SVG validés doivent aussi correspondre au SHA humain, pas seulement au générateur courant.
  const noms = execFileSync("git", ["ls-tree", "-r", "--name-only", SHA_APPROUVE_92, "content/illustrations"], { encoding: "utf8" }).trim().split("\n").filter(p => p.endsWith(".svg"));
  const blobs = execFileSync("git", ["cat-file", "--batch"], { input: noms.map(p => `${SHA_APPROUVE_92}:${p}\n`).join(""), maxBuffer: 8 * 1024 * 1024 });
  let offset = 0;
  for (const p of noms) {
    const fin = blobs.indexOf(10, offset), m = /^\S+ blob (\d+)$/.exec(blobs.subarray(offset, fin).toString()); assert(m);
    const n = Number(m[1]), b = blobs.subarray(fin + 1, fin + 1 + n); offset = fin + 1 + n + 1;
    assert.equal(empreinte(readFileSync(p)), empreinte(b), `SVG approuvé modifié : ${p}`); hashes[p] = empreinte(b);
  }
  assert.equal(noms.length, 534); assert.equal(offset, blobs.length);
  const sqlMigration = readFileSync(fichiers[4], "utf8").replaceAll("\r", "");
  const fonctions = Object.fromEntries([...sqlMigration.matchAll(/create\s+(?:or\s+replace\s+)?function\s+histoire\.([a-z_]+)[\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$;/gi)]
    .filter(m => rpcProtegees.includes(m[1])).map(m => [m[1], createHash("md5").update(m[2]).digest("hex")]));
  assert.equal(Object.keys(fonctions).length, rpcProtegees.length);
  const groupes = [...new Set(structure.sous_chapitres.filter(c => c.parent_id !== "THM-006").map(c => c.parent_id!))].sort();
  assert.equal(groupes.length, 5);
  const ids=new Set([...enfants,...completions].map(c=>c.event_id));
  const canon=lireCsv('content/dataset-v18/kiffeurs-events-v18.csv').filter(e=>ids.has(e.event_id)).map(e=>({
    id:e.event_id,precision:e.precision,date_status:e.date_status,playable:e.playable==='TRUE',playable_mode:e.playable_mode,
    ...Object.fromEntries(['start_year','start_month','start_day','end_year','end_month','end_day'].map(k=>[k,e[k]?Number(e[k]):null]))}));
  assert.equal(canon.length,285);
  return { anciennes, enfants, completions, filiation, structure, hashes, fonctions, groupes, canon, plan: planCompletions(), illustrations };
}

export function sqlPreflight92() {
  return `begin read only;
select jsonb_build_object('project_id',${lit(PROJET_92)},'migration',(select jsonb_agg(to_jsonb(m)) from histoire.migrations_appliquees m where version=${lit(migration)}),
'cartes',(select count(*) from histoire.chapter_cards),'unites',(select count(*) from histoire.pedagogical_units),'liens',(select count(*) from histoire.event_chapters),
'editions_publiees',(select count(*) from histoire.pedagogical_editions where published),
'blocages',(select coalesce(jsonb_agg(jsonb_build_object('chapter_id',chapter_id,'parent_id',parent_id,'etat',etat,'blocages',blocages)),'[]') from histoire.pedagogical_units where cardinality(blocages)>0),
'fonctions',(select jsonb_object_agg(proname,md5(replace(prosrc,E'\\r',''))) from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='histoire' and proname=any(array[${rpcProtegees.map(lit).join(",")}])));
commit;\n`;
}

/** Retour privé : à sauvegarder hors Git et hors logs, jamais afficher les lignes joueurs. */
export function sqlSauvegarde92() {
  return `begin isolation level repeatable read read only;
select jsonb_build_object('project_id',${lit(PROJET_92)},'source_sha',${lit(SHA_APPROUVE_92)},'captured_at',now(),'tables',jsonb_build_object(
${tablesSauvegardees.map(t => `${lit(t)},${agregat(t)}`).join(",\n")}));
commit;\n`;
}

/** Toute publication est atomique. Les imports d'enfants déjà publiés sont évités, jamais forcés. */
export function sqlPublication92(c: Corpus92, a: Autorisation92) {
  verifierAutorisation92(a);
  const revue = `confirmation-humaine:${empreinte(JSON.stringify(a.preuve))}`;
  const catalogue = `catalogue-92:${SHA_APPROUVE_92}:ci-38557124868`;
  const protections = tablesJoueurs.map(t => `${lit(t)},md5(${agregat(t)}::text)`).join(",");
  const idsAnciennes = c.anciennes.map(x => lit(x.card_id)).join(",");
  const liensAttendus = c.structure.sous_chapitres.flatMap(u => u.event_ids.map(id => ({ chapter_id: u.id, event_id: id })));
  const sql = `begin isolation level repeatable read;
set local lock_timeout='5s'; set local statement_timeout='120s';
do $release92$
declare anciennes jsonb := ${json(c.anciennes)}; enfants jsonb := ${json(c.enfants)}; completions jsonb := ${json(c.completions)}; filiation jsonb := ${json(c.filiation)};
  avant_joueurs jsonb; avant_initiales jsonb; avant_liens jsonb; avant_blocages jsonb; avant_han jsonb;
  lot jsonb; lignage jsonb; e record; u record; fp text; attendu jsonb; actuel jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
  if not exists(select 1 from histoire.migrations_appliquees where version=${lit(migration)}) then raise exception 'Migration requise absente : ne pas la réexécuter automatiquement'; end if;
  if (select count(*) from histoire.pedagogical_units)<>59 or (select count(*) from histoire.event_chapters)<>722 then raise exception 'Structure production différente du périmètre audité'; end if;
  if (select jsonb_object_agg(proname,md5(replace(prosrc,E'\\r',''))) from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='histoire' and proname=any(array[${rpcProtegees.map(lit).join(",")}])) is distinct from ${json(c.fonctions)} then raise exception 'RPC existantes modifiées : nouvel audit requis'; end if;
  if ${agregat("chapter_cards", `t.card_id in (${idsAnciennes})`)} is distinct from (select jsonb_agg(x order by x::text) from jsonb_array_elements(anciennes) x) then raise exception 'Cartes historiques différentes des cartes humaines approuvées'; end if;
  if exists(select 1 from jsonb_to_recordset(${json(liensAttendus)}) as l(chapter_id text,event_id text) where not exists(select 1 from histoire.event_chapters ec where ec.chapter_id=l.chapter_id and ec.event_id=l.event_id)) then raise exception 'Rattachement enfant manquant'; end if;
  if (select jsonb_agg(jsonb_build_object('id',ev.id,'precision',ev.precision,'date_status',ev.date_status,'playable',ev.playable,'playable_mode',ev.playable_mode,
      'start_year',ea.start_year,'start_month',ea.start_month,'start_day',ea.start_day,'end_year',ea.end_year,'end_month',ea.end_month,'end_day',ea.end_day) order by ev.id)
      from histoire.events ev join histoire.event_answers ea on ea.event_id=ev.id where ev.id=any(array[${c.canon.map(e=>lit(e.id)).join(',')}]))
      is distinct from (select jsonb_agg(x order by x->>'id') from jsonb_array_elements(${json(c.canon)}) x) then raise exception 'Canon distant différent du corpus validé'; end if;
  if not exists(select 1 from histoire.pedagogical_units where chapter_id='THM-049' and etat='inactif' and 'han-canon-incoherent'=any(blocages))
    or exists(select 1 from histoire.pedagogical_units where chapter_id=any(array['THM-047','THM-048','THM-049']) and etat<>'inactif') then raise exception 'Blocage Han altéré'; end if;
  if exists(select 1 from histoire.pedagogical_units where cardinality(blocages)>0 and chapter_id<>'THM-049') then raise exception 'Nouveau blocage : arrêt sûr et audit requis'; end if;
  avant_initiales := ${agregat("pedagogical_editions", "t.version<>'completion-v1' and t.chapter_id<'THM-047'")};
  if jsonb_array_length(avant_initiales)<>41 then raise exception 'Les 41 éditions initiales doivent être préservées'; end if;
  avant_liens := ${agregat("event_chapters")}; avant_blocages := (select jsonb_agg(jsonb_build_object('id',chapter_id,'blocages',blocages) order by chapter_id) from histoire.pedagogical_units);
  avant_han := ${agregat("pedagogical_units", "t.chapter_id=any(array['THM-047','THM-048','THM-049'])")};
  avant_joueurs := jsonb_build_object(${protections});
  -- Vérifier et ignorer toute copie déjà publiée : la RPC interdit même son réimport identique.
  for u in select * from histoire.pedagogical_units where parent_id is not null order by chapter_id for update loop
    select coalesce(jsonb_agg(x),'[]') into attendu from jsonb_array_elements(enfants) x where x->>'chapter_id'=u.chapter_id;
    select coalesce(jsonb_agg(to_jsonb(cc) order by to_jsonb(cc)::text),'[]') into actuel from histoire.chapter_cards cc where cc.chapter_id=u.chapter_id;
    if u.published_fingerprint is not null then
      if actuel is distinct from (select jsonb_agg(x order by x::text) from jsonb_array_elements(attendu) x) then raise exception 'Enfant publié différent : %',u.chapter_id; end if;
    elsif u.etat<>'inactif' then raise exception 'Enfant non publié dans un état inattendu : %',u.chapter_id;
    end if;
  end loop;
  select coalesce(jsonb_agg(x),'[]') into lot from jsonb_array_elements(enfants) x join histoire.pedagogical_units pu on pu.chapter_id=x->>'chapter_id' where pu.published_fingerprint is null;
  select coalesce(jsonb_agg(x),'[]') into lignage from jsonb_array_elements(filiation) x where exists(select 1 from jsonb_array_elements(lot) card where card->>'card_id'=x->>'card_id');
  if jsonb_array_length(lot)>0 then perform histoire.import_pedagogical_cards(lot,lignage); end if;
  if exists(select 1 from jsonb_to_recordset(filiation) as l(card_id text,source_card_id text) where not exists(select 1 from histoire.pedagogical_card_lineage p where p.card_id=l.card_id and p.source_card_id=l.source_card_id)) then raise exception 'Filiation incomplète ou différente'; end if;
  for e in select distinct x->>'chapter_id' as id from jsonb_array_elements(completions) x order by id loop
    select jsonb_agg(x) into lot from jsonb_array_elements(completions) x where x->>'chapter_id'=e.id;
    perform histoire.stage_pedagogical_completion(e.id,lot);
  end loop;
  for u in select * from histoire.pedagogical_units where parent_id=any(array[${c.groupes.map(lit).join(",")}]) order by chapter_id loop
    fp := histoire.pedagogical_fingerprint(u.chapter_id);
    update histoire.pedagogical_units set content_approval=fp,illustration_approval=${lit(revue)},catalogue_approval=${lit(catalogue)} where chapter_id=u.chapter_id;
  end loop;
  ${c.groupes.map(p => `perform histoire.set_pedagogical_group_active(${lit(p)},true,${lit(catalogue)});`).join("\n  ")}
  for e in select chapter_id,md5(cards::text||candidates::text) as fingerprint from histoire.pedagogical_editions where version='completion-v1' order by chapter_id loop
    if not(e.chapter_id=any(array[${c.plan.map(p => lit(p.chapter_id)).join(",")}])) then raise exception 'Complétion étrangère au périmètre'; end if;
    perform histoire.publish_pedagogical_completion(e.chapter_id,e.fingerprint,${lit(revue)},${lit(catalogue)});
  end loop;
  if ${agregat("chapter_cards", `t.card_id in (${idsAnciennes})`)} is distinct from (select jsonb_agg(x order by x::text) from jsonb_array_elements(anciennes) x)
    or ${agregat("pedagogical_editions", "t.version<>'completion-v1' and t.chapter_id<'THM-047'")} is distinct from avant_initiales
    or ${agregat("event_chapters")} is distinct from avant_liens
    or (select jsonb_agg(jsonb_build_object('id',chapter_id,'blocages',blocages) order by chapter_id) from histoire.pedagogical_units) is distinct from avant_blocages
    or ${agregat("pedagogical_units", "t.chapter_id=any(array['THM-047','THM-048','THM-049'])")} is distinct from avant_han
    or jsonb_build_object(${protections}) is distinct from avant_joueurs then raise exception 'État protégé modifié : transaction annulée'; end if;
  if (select count(*) from histoire.chapter_cards)<>513 or (select count(*) from histoire.pedagogical_card_lineage)<>61
    or (select count(*) from histoire.pedagogical_editions where published)<>83
    or (select count(*) from histoire.pedagogical_units where parent_id is not null and etat='actif')<>15 then raise exception 'Effectifs finaux inattendus'; end if;
  perform histoire.export_pedagogical_structure();
end;
$release92$;
select jsonb_build_object('project_id',${lit(PROJET_92)},'source_sha',${lit(SHA_APPROUVE_92)},'cartes',513,'filiations',61,'editions_publiees',83,'enfants_actifs',15,'han','bloqué','sauvegarde_sha256',${lit(a.sauvegarde.sha256)},'etats',histoire.export_pedagogical_structure()) as resultat;
commit;\n`;
  assert(!JSON.stringify([c.anciennes,c.enfants,c.completions]).includes("$release92$"), "Délimiteur SQL dans le contenu");
  return sql;
}

export function sqlRollback92(c: Corpus92, a: Autorisation92) {
  verifierAutorisation92(a);
  const preserve=[...tablesJoueurs,'chapter_cards','pedagogical_editions','pedagogical_card_lineage','event_chapters'];
  const snapshot=`jsonb_build_object(${preserve.map(t=>`${lit(t)},md5(${agregat(t)}::text)`).join(',')})`;
  return `begin isolation level repeatable read; set local lock_timeout='5s'; set local statement_timeout='60s';
do $rollback92$ declare avant jsonb; han jsonb; begin
perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
if (select jsonb_object_agg(proname,md5(replace(prosrc,E'\\r',''))) from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='histoire' and proname=any(array[${rpcProtegees.map(lit).join(',')}])) is distinct from ${json(c.fonctions)} then raise exception 'RPC modifiées : rollback à réauditer'; end if;
avant:=${snapshot}; han:=${agregat('pedagogical_units',"t.chapter_id=any(array['THM-047','THM-048','THM-049'])")};
${c.plan.map(p => `perform histoire.rollback_pedagogical_completion(${lit(p.chapter_id)});`).join("\n")}
${c.groupes.map(p => `perform histoire.set_pedagogical_group_active(${lit(p)},false,null);`).join("\n")}
if ${snapshot} is distinct from avant or ${agregat('pedagogical_units',"t.chapter_id=any(array['THM-047','THM-048','THM-049'])")} is distinct from han
then raise exception 'Rollback destructif refusé'; end if;
perform histoire.export_pedagogical_structure(); end $rollback92$;
select histoire.export_pedagogical_structure(); commit;\n`;
}

export function sqlExport92() {
  return `begin read only; select jsonb_build_object('project_id',${lit(PROJET_92)},'source_sha',${lit(SHA_APPROUVE_92)},'etats',histoire.export_pedagogical_structure(),'cartes_publiees',(select jsonb_agg(cards order by chapter_id,version) from histoire.pedagogical_editions where published)); commit;\n`;
}

export function exporterArtefacts92(data: { project_id: string; source_sha: string; etats: EtatPublie[]; cartes_publiees: Record<string, unknown>[][] }, dossier = ".") {
  assert.equal(data.project_id,PROJET_92); assert.equal(data.source_sha,SHA_APPROUVE_92);
  const s = chargerStructure(), registre = appliquerEtatsPublies(s,data.etats);
  assert.equal(registre.length,59);
  const actif=registre.filter(u=>u.etat==='actif').length,historique=registre.filter(u=>u.etat==='historique').length;
  assert((actif===51&&historique===5)||(actif===41&&historique===15),'Seuls publication complète ou rollback complet sont exportables');
  assert.equal(registre.filter(u=>u.etat==='inactif').length,3);
  assert.equal(data.cartes_publiees.length,83);
  for(const u of registre)if(u.parent_id==='THM-006')assert.equal(u.etat,'inactif');
  const lignes = ["cartes-v1", "cartes-sous-chapitres", "cartes-completions"].flatMap(n=>lireCsv(`content/pedagogie/${n}.csv`));
  const ledger = empreintesCartesPubliees(lignes,data.cartes_publiees.flat());
  const sorties = { "src/lib/apprendre/structure.json": registre.filter(u=>u.etat!=="inactif"), "content/pedagogie/cartes-publiees.json": ledger,
    "content/pedagogie/etats-publies-92.json": data.etats };
  for(const [p,v] of Object.entries(sorties)) { const cible=resolve(dossier,p); mkdirSync(dirname(cible),{recursive:true}); writeFileSync(cible,JSON.stringify(v,null,2)+"\n"); }
  return { unites: registre.length, publiques: registre.filter(u=>u.etat!=="inactif").length, empreintes: Object.keys(ledger).length };
}

function main() {
  const args = process.argv.slice(2), valeur = (k: string):string|undefined => args.includes(k)?args[args.indexOf(k)+1]:undefined;
  const requise = (k:string) => { const v=valeur(k); assert(v&&!v.startsWith('--'),`Valeur requise : ${k}`);return v; };
  const autorisees = new Set(["--project-id","--endpoint","--preuve","--sauvegarde","--autorisation","--emettre-publication","--emettre-rollback","--export","--dossier-export"]);
  assert.equal(new Set(args.filter(s=>s.startsWith('--'))).size,args.filter(s=>s.startsWith('--')).length,"Option dupliquée");
  for(let i=0;i<args.length;i++) { assert(autorisees.has(args[i]),"Option inconnue"); if(!['--emettre-publication','--emettre-rollback'].includes(args[i])){requise(args[i]);i++;} }
  assert(!(args.includes('--emettre-publication')&&args.includes('--emettre-rollback')),'Publication et rollback exclusifs');
  verifierCible92(valeur("--project-id") ?? PROJET_92,valeur("--endpoint") ?? `https://${PROJET_92}.supabase.co`);
  if(args.includes("--export")) { const r=exporterArtefacts92(JSON.parse(readFileSync(requise("--export"),"utf8")),valeur("--dossier-export")??".");console.log(JSON.stringify(r));return; }
  const c=chargerCorpus92();
  if(args.includes("--emettre-publication")||args.includes('--emettre-rollback')) {
    const preuve=JSON.parse(readFileSync(requise("--preuve"),"utf8")) as PreuveHumaine92;
    const sauvegarde=JSON.parse(readFileSync(requise("--sauvegarde"),"utf8")) as Autorisation92["sauvegarde"];
    assert(existsSync(sauvegarde.fichier),"Fichier de sauvegarde introuvable"); assert.equal(empreinte(readFileSync(sauvegarde.fichier)),sauvegarde.sha256);
    verifierSauvegarde92(JSON.parse(readFileSync(sauvegarde.fichier,'utf8')) as Sauvegarde92);
    const a={projectId:PROJET_92,endpoint:`https://${PROJET_92}.supabase.co`,autorisation:requise("--autorisation"),preuve,sauvegarde};
    process.stdout.write(args.includes('--emettre-rollback')?sqlRollback92(c,a):sqlPublication92(c,a)); return;
  }
  console.log(JSON.stringify({ mode:"dry-run", execution:false, project_id:PROJET_92, source_sha:SHA_APPROUVE_92, cartes_enfants:188, completions:104, filiations:61,
    groupes_eligibles:c.groupes, groupe_han_exclu:"THM-006", empreintes:c.hashes, sql_preflight:sqlPreflight92(), sql_sauvegarde:sqlSauvegarde92() },null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve("scripts/release-pedagogique-92.ts")) {
  try{main();}catch(error){console.error(error instanceof Error?error.message:"Release refusée");process.exitCode=1;}
}
