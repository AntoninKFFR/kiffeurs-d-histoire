// Assemblage éditorial et contrôle des ensembles privés ; aucun import ni accès réseau.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lireCsv, type LigneCsv } from "./csv";
import { appliquerEtatsPublies, chargerStructure, empreinteLigne, type EtatPublie } from "./structure-pedagogique";
import { chargerCompletions, planCompletions } from "./completions-pedagogiques";
import { chargerCartesSousChapitres } from "./import-cartes";
import { scenes } from "./illustrations-pedagogiques/catalogue";
import { objets } from "./illustrations-pedagogiques/objets";
import { verifierIntegriteStockPhase4 } from "./illustrations-pedagogiques/phase4-verifier";

const BASE = "a4759cea8bebd66003c2d69592bf8fd5af24b264";
const dossier = "docs/phase-3-92";
const ancienFichier = "content/pedagogie/cartes-v1.csv";
const completionFichier = "content/pedagogie/cartes-completions.csv";
const enfantFichier = "content/pedagogie/cartes-sous-chapitres.csv";
const dates = ["start_year", "start_month", "start_day", "end_year", "end_month", "end_day", "date_text", "date_status"];
export type Redaction = {
  chapter_id: string; event_id: string; title: string; body: string; takeaway: string;
  key_concepts: string[]; sources: string[];
  illustration?: { intention: string; objets_stock: string[]; vigilances: string };
};
type Consultation = {
  event_ids: string[]; url: string; titre: string; date_consultation: string;
  affirmations_verifiees: string | string[]; reserves: string | string[]; statut: string;
};
const json = <T,>(fichier: string): T => JSON.parse(readFileSync(fichier, "utf8").replace(/^\uFEFF/, ""));
const paire = (c: { chapter_id?: string; event_id?: string }) => `${c.chapter_id}/${c.event_id}`;
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const quote = (v: unknown) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
export function ecrireCsv(fichier: string, lignes: Record<string, unknown>[], champs = Object.keys(lignes[0])) {
  writeFileSync(fichier, [champs.map(quote).join(","), ...lignes.map(l => champs.map(k => quote(l[k])).join(","))].join("\n") + "\n");
}
function lireRedactions() {
  return ["primaire", "college", "lycee"].flatMap(n => json<Redaction[]>(`${dossier}/redaction-${n}.json`));
}
function chronologie(a: LigneCsv, b: LigneCsv) {
  if (!a.start_year || !b.start_year) return a.start_year ? -1 : b.start_year ? 1 : a.event_id.localeCompare(b.event_id);
  return Number(a.start_year) - Number(b.start_year) ||
    (a.start_month && b.start_month ? Number(a.start_month) - Number(b.start_month) ||
      (a.start_day && b.start_day ? Number(a.start_day) - Number(b.start_day) : 0) : 0) || a.event_id.localeCompare(b.event_id);
}
function ordonner(lignes: LigneCsv[]) {
  const groupes = new Map<string, LigneCsv[]>();
  for (const l of lignes) groupes.set(l.chapter_id, [...(groupes.get(l.chapter_id) ?? []), l]);
  return [...groupes].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, groupe]) =>
    groupe.sort(chronologie).map((l, i) => ({ ...l, sort_order: String(i + 1) })));
}

/** Recompose le plan à partir du canon, puis le compare à l'audit et au plan #111. */
export function inventaireIndependant() {
  const structure = chargerStructure(), anciennes = lireCsv(ancienFichier);
  const liens = lireCsv("content/dataset-v18/kiffeurs-curriculum-links-v18.csv");
  const redirects = new Map(lireCsv("content/dataset-v18/kiffeurs-event-redirects-v18.csv").map(r => [r.old_event_id, r.canonical_event_id]));
  const canon = (id: string) => redirects.get(id) ?? id;
  const corpus = new Map(structure.chapitres_historiques.map(c => [c.id,
    [...new Set(liens.filter(l => l.theme_id === c.id && l.event_id).map(l => canon(l.event_id)))]]));
  const manques = [...corpus].flatMap(([chapter_id, ids]) => ids.filter(event_id =>
    !anciennes.some(c => c.chapter_id === chapter_id && canon(c.event_id) === event_id)).map(event_id => ({ chapter_id, event_id })));
  const audit = lireCsv("docs/audit-92/cartes-manquantes-par-chapitre.csv");
  assert.deepEqual(manques.map(paire).sort(), audit.map(paire).sort(), "Écart canon / audit à documenter");
  const parents = new Set(structure.sous_chapitres.map(c => c.parent_id));
  const completions = manques.filter(c => !parents.has(c.chapter_id));
  assert.deepEqual(completions.map(paire).sort(), planCompletions().flatMap(c => c.event_ids.map(event_id => paire({ chapter_id: c.chapter_id, event_id }))).sort());
  const enfants = structure.sous_chapitres.flatMap(c => c.event_ids.map(event_id => ({ chapter_id: c.id, event_id, parent_id: c.parent_id!,
    origine: anciennes.find(o => o.chapter_id === c.parent_id && o.event_id === event_id) })));
  assert.equal(manques.length, 231); assert.equal(completions.length, 104);
  assert.equal(new Set(completions.map(c => c.chapter_id)).size, 27);
  assert.equal(enfants.length, 188); assert.equal(enfants.filter(c => c.origine).length, 61);
  assert.equal(enfants.filter(c => !c.origine).length, 127);
  assert.equal([...corpus.values()].flat().length, 534);
  return { structure, anciennes, liens, corpus, manques, completions, enfants };
}

export function assemblerPhase3() {
  const p = inventaireIndependant(), redactions = lireRedactions();
  assert.equal(new Set(redactions.map(paire)).size, redactions.length, "Rédaction dupliquée");
  assert.deepEqual(redactions.map(paire).sort(), p.manques.map(paire).sort(), "Rédaction incomplète ou hors corpus");
  const parPaire = new Map(redactions.map(r => [paire(r), r]));
  const events = new Map(lireCsv("content/dataset-v18/kiffeurs-events-v18.csv").map(e => [e.event_id, e]));
  function nouvelle(chapter_id: string, parent_id: string, event_id: string): LigneCsv {
    const r = parPaire.get(paire({ chapter_id: parent_id, event_id }))!, e = events.get(event_id)!;
    const lien = p.liens.find(l => l.theme_id === parent_id && l.event_id === event_id)!;
    return { card_id: `CARD-${chapter_id.slice(4)}-evt-${event_id.slice(4)}`, chapter_id, event_id,
      ...Object.fromEntries(dates.map(k => [k, e[k]])), date_precision: e.precision,
      title: r.title, body: r.body, takeaway: r.takeaway, key_concepts: r.key_concepts.join(";"),
      sort_order: "1", official_wording: lien.official_wording, sources: r.sources.join(";") };
  }
  const completions = ordonner(p.completions.map(c => nouvelle(c.chapter_id, c.chapter_id, c.event_id)));
  const enfants = ordonner(p.enfants.map(c => c.origine ? { ...c.origine,
    card_id: `CARD-${c.chapter_id.slice(4)}-${c.origine.card_id.slice(9)}`, chapter_id: c.chapter_id, source_card_id: c.origine.card_id } :
    { ...nouvelle(c.chapter_id, c.parent_id, c.event_id), source_card_id: "" }));
  const champs = Object.keys(p.anciennes[0]);
  ecrireCsv(completionFichier, completions, champs);
  ecrireCsv(enfantFichier, enfants, [...champs, "source_card_id"]);
  return verifierPhase3();
}

/** Vérifie les CSV livrés indépendamment de l'assemblage et produit les pièces de relecture. */
export function verifierPhase3() {
  const p = inventaireIndependant();
  assert.equal(chargerCompletions(completionFichier).length, 104);
  assert.equal(chargerCartesSousChapitres(enfantFichier).length, 188);
  const completions = lireCsv(completionFichier), enfants = lireCsv(enfantFichier), ajouts = [...completions, ...enfants];
  assert.equal(new Set([...p.anciennes, ...ajouts].map(c => c.card_id)).size, 617);
  assert.deepEqual(completions.map(paire).sort(), p.completions.map(paire).sort());
  assert.deepEqual(enfants.map(paire).sort(), p.enfants.map(paire).sort());
  assert.equal(enfants.filter(c => c.source_card_id).length, 61);
  const originals = new Map(p.anciennes.map(c => [c.card_id, c]));
  const copies = enfants.filter(c => c.source_card_id);
  for (const c of copies) for (const k of Object.keys(p.anciennes[0]).filter(k => !["card_id", "chapter_id", "sort_order"].includes(k)))
    assert.equal(c[k], originals.get(c.source_card_id)![k], `Copie infidèle ${c.card_id}/${k}`);
  const parents = new Map(p.structure.sous_chapitres.map(c => [c.id, c.parent_id!]));
  const couvertures = ajouts.filter(c => !c.source_card_id).map(c => ({ chapter_id: parents.get(c.chapter_id) ?? c.chapter_id, event_id: c.event_id }));
  assert.deepEqual(couvertures.map(paire).sort(), p.manques.map(paire).sort());
  const baselineGit = execFileSync("git", ["show", `${BASE}:${ancienFichier}`]);
  const protections = ["content/dataset-v18", "content/illustrations", "content/pedagogie/chapitres-v2.json",
    "scripts/illustrations-pedagogiques", "docs/illustrations/generalisation", "docs/audit-92", "docs/phase-2-92", "supabase", "src"];
  const stock = verifierIntegriteStockPhase4({ exigerComplet: false });
  const publication='content/pedagogie/etats-publies-92.json';
  if(existsSync(publication)){
    const exportReel=JSON.parse(readFileSync(publication,'utf8')) as EtatPublie[];
    const projection=appliquerEtatsPublies(p.structure,exportReel).filter(c=>c.etat!=='inactif');
    assert.equal(projection.length,56);
    assert.equal(JSON.stringify(JSON.parse(readFileSync('src/lib/apprendre/structure.json','utf8'))),JSON.stringify(projection),'Projection différente de l’export publié');
    assert(projection.every(c=>c.parent_id!=='THM-006'),'Han doit rester fermé');
  }
  // Seuls les fichiers ajoutés de phase 4 et le vérificateur HTTP adapté sont exclus.
  // Tous les SVG historiques sont en outre comparés octet par octet aux deux bases.
  execFileSync("git", ["diff", "--exit-code", BASE, "--", ...protections,
    ...stock.nouveaux.map(e => `:(exclude)content/illustrations/${e.event_id}.svg`),
    ":(exclude)scripts/illustrations-pedagogiques/phase4-*",
    ":(exclude)scripts/illustrations-pedagogiques/verifier-routes.ts",
    ...(existsSync(publication)?[':(exclude)src/lib/apprendre/structure.json',':(exclude)src/lib/solo/catalogue.json']:[])], { stdio: "pipe" });
  // Comparer aussi les octets après les filtres du checkout Windows (LF → CRLF).
  const baseline = execFileSync("git", ["cat-file", "--filters", `${BASE}:${ancienFichier}`]);
  assert.equal(sha(readFileSync(ancienFichier)), sha(baseline), "CSV historique différent du checkout de main");
  assert.equal(sha(readFileSync(ancienFichier, "utf8").replaceAll("\r\n", "\n")), sha(baselineGit), "CSV historique différent du contenu Git");
  const svg = stock.anciens;
  assert.equal(svg.length, 331);
  // Le contrôle exhaustif ci-dessus a comparé chaque blob des deux bases à
  // chaque fichier courant ; conserver exactement les 331 preuves historiques.
  const svgHashes = stock.empreintes;
  mkdirSync(dossier, { recursive: true });
  ecrireCsv(`${dossier}/integrite-svg.csv`, svgHashes);
  ecrireCsv(`${dossier}/integrite-cartes-historiques.csv`, p.anciennes.map(c => ({ card_id: c.card_id,
    empreinte_manifeste: p.structure.empreintes_cartes_historiques[c.card_id], empreinte_phase3: empreinteLigne(c), identique: "oui" })));
  const events = new Map(lireCsv("content/dataset-v18/kiffeurs-events-v18.csv").map(e => [e.event_id, e]));
  const eligible = (c: LigneCsv, historique: boolean) => historique ? p.structure.eligibilite_tests_historiques[c.chapter_id].includes(c.event_id) :
    events.get(c.event_id)?.playable === "TRUE" && ["YEAR", "MONTH", "DAY", "RANGE"].includes(events.get(c.event_id)!.playable_mode) && !!c.start_year;
  const count = (cards: LigneCsv[], historique = false) => {
    const e = cards.filter(c => c.event_id && eligible(c, historique));
    return { YEAR: e.length, MONTH: e.filter(c => c.start_month).length, DAY: e.filter(c => c.start_month && c.start_day).length };
  };
  const unites = [...p.structure.chapitres_historiques, ...p.structure.sous_chapitres];
  const couverture = unites.map(u => {
    const old = p.anciennes.filter(c => c.chapter_id === u.id), added = ajouts.filter(c => c.chapter_id === u.id);
    const children = p.structure.sous_chapitres.filter(c => c.parent_id === u.id);
    const corpus = u.parent_id ? p.structure.sous_chapitres.find(c => c.id === u.id)!.event_ids : p.corpus.get(u.id)!;
    const locally = [...old, ...added], parcours = children.length ? enfants.filter(c => parents.get(c.chapter_id) === u.id) : locally;
    const ids = new Set(locally.map(c => c.event_id).filter(Boolean)), covered = new Set(parcours.map(c => c.event_id).filter(Boolean));
    const initial = u.parent_id ? { YEAR: 0, MONTH: 0, DAY: 0 } : count(old, true);
    // Un parent découpé garde son test initial ; l'union de ses enfants ne devient pas son nouveau test.
    const potential = children.length ? initial : count(locally);
    const blockers = u.parent_id ? p.structure.sous_chapitres.find(c => c.id === u.id)!.blocages : [];
    const groupBlockers = p.structure.sous_chapitres.filter(c => c.parent_id === (u.parent_id ?? u.id)).flatMap(c => c.blocages);
    const testBlocked = blockers.length || (u.parent_id && groupBlockers.length);
    assert(corpus.every(id => covered.has(id)), `Événement sans carte dans le parcours ${u.id}`);
    return { chapter_id: u.id, niveau: u.niveau, titre: u.titre, parent_id: u.parent_id ?? "", etat_production_prevu: u.etat,
      corpus_attendu: corpus.length, event_ids_attendus: corpus.join(";"), cartes_historiques: old.length, cartes_ajoutees: added.length,
      cartes_disponibles_edition_locale: locally.length, evenements_couverts_unite: ids.size,
      evenements_sans_carte_unite: corpus.filter(id => !ids.has(id)).join(";"), evenements_sans_carte_parcours: "",
      parcours_enfants: children.map(c => c.id).join(";"), jouables_annee_initial: initial.YEAR, jouables_mois_initial: initial.MONTH, jouables_jour_initial: initial.DAY,
      jouables_annee_simulation: potential.YEAR, jouables_mois_simulation: potential.MONTH, jouables_jour_simulation: potential.DAY,
      questions_annee_simulation: testBlocked || potential.YEAR < 5 ? 0 : Math.min(10, potential.YEAR),
      questions_mois_simulation: testBlocked || potential.MONTH < 5 ? 0 : Math.min(10, potential.MONTH),
      questions_jour_simulation: testBlocked || potential.DAY < 5 ? 0 : Math.min(10, potential.DAY),
      chronologie: "canon inchangé, ordre contrôlé", sources_presentes: locally.every(c => c.sources) ? "oui" : "non", doublons: "aucun", blocages: blockers.join(";"), blocages_activation_groupe: [...new Set(groupBlockers)].join(";") };
  });
  assert.equal(couverture.length, 59);
  ecrireCsv(`${dossier}/couverture-59-unites.csv`, couverture);
  ecrireCsv(`${dossier}/inventaire-292.csv`, ajouts.map(c => ({ card_id: c.card_id, chapter_id: c.chapter_id, event_id: c.event_id, title: c.title,
    date_text: c.date_text, date_precision: c.date_precision, date_status: c.date_status, sort_order: c.sort_order,
    niveau: unites.find(u => u.id === c.chapter_id)!.niveau, edition: parents.has(c.chapter_id) ? "sous-chapitres-v1" : "completion-v1",
    source_card_id: c.source_card_id ?? "", mots: c.body.split(/\s+/).length, empreinte_sha256: empreinteLigne(c) })));
  ecrireCsv(`${dossier}/couverture-231-manques.csv`, p.manques.map(c => {
    const child = p.structure.sous_chapitres.find(u => u.parent_id === c.chapter_id && u.event_ids.includes(c.event_id));
    const added = ajouts.find(a => a.chapter_id === (child?.id ?? c.chapter_id) && a.event_id === c.event_id)!;
    return { chapter_audit: c.chapter_id, event_id: c.event_id, chapitre_destination: added.chapter_id, card_id: added.card_id };
  }));
  const consultations = ["primaire", "college", "lycee", "copies", "audit", "finalisation"].flatMap(n => existsSync(`${dossier}/sources-${n}.json`) ? json<Consultation[]>(`${dossier}/sources-${n}.json`) : []).map(s => ({ ...s,
    affirmations_verifiees: Array.isArray(s.affirmations_verifiees) ? s.affirmations_verifiees.join(" ") : s.affirmations_verifiees,
    reserves: Array.isArray(s.reserves) ? s.reserves.join(" ") : s.reserves }));
  const documentation = ajouts.flatMap(c => c.sources.split(";").map(url => {
    const evidence = consultations.find(s => s.url === url && s.event_ids.includes(c.event_id) && s.statut === "consultee");
    assert(evidence || c.source_card_id, `Source sans consultation attestée : ${c.card_id} ${url}`);
    const tentative = consultations.find(s => s.url === url && s.event_ids.includes(c.event_id));
    return { card_id: c.card_id, event_id: c.event_id, url, role: "source du CSV", statut: evidence ? "consultée en phase 3" : "source historique conservée, accès non confirmé en phase 3",
      titre: evidence?.titre ?? "Référence de la carte parent", date_consultation: evidence?.date_consultation ?? "",
      affirmations_verifiees: evidence?.affirmations_verifiees ?? "Contenu validé du parent recopié sans réécriture",
      reserves: evidence?.reserves ?? tentative?.reserves ?? "Relecture humaine du contenu historique conservé", source_card_id: c.source_card_id ?? "" };
  }));
  // Les URL historiques restent fidèles, même lorsqu'une référence complémentaire
  // est nécessaire pour soutenir réellement l'objet ou le jour du jalon.
  for (const c of ajouts) for (const url of new Set(consultations.filter(s => s.event_ids.includes(c.event_id) && s.statut === "consultee").map(s => s.url))) {
    if (documentation.some(s => s.card_id === c.card_id && s.url === url)) continue;
    const evidence = consultations.find(s => s.url === url && s.event_ids.includes(c.event_id) && s.statut === "consultee")!;
    documentation.push({ card_id: c.card_id, event_id: c.event_id, url, role: "appui documentaire complémentaire", statut: "consultée en phase 3",
      titre: evidence.titre, date_consultation: evidence.date_consultation, affirmations_verifiees: evidence.affirmations_verifiees,
      reserves: evidence.reserves, source_card_id: c.source_card_id ?? "" });
  }
  ecrireCsv(`${dossier}/sources-par-carte.csv`, documentation);
  writeFileSync(`${dossier}/relecture-copies.md`, ["# Relecture des soixante et une copies fidèles", "",
    "Chaque copie conserve intégralement le contenu validé de son parent, y compris ses sources. Le contrôle compare tous les champs sauf identifiant, chapitre et rang. Les sources complémentaires ci-dessous ne remplacent pas les URL historiques : elles permettent de relire le récit et de repérer les références hors objet ou les précisions restant à corroborer.", "",
    "Les dossiers sensibles de Fachoda et Becquerel sont distincts : leurs cartes historiques ne sont pas copiées dans les enfants de cette phase. Han/Wudi est une copie de EVT-0041 ; la rédaction de EVT-0040 reste nouvelle et bloquée.", "",
    ...copies.map(c => `## ${c.card_id} — ${c.title}\n\nOrigine : ${c.source_card_id} ; événement : ${c.event_id} ; date conservée : ${c.date_text}. Tous les champs de contenu sont identiques.\n\n${documentation.filter(s => s.card_id === c.card_id).map(s => `- [${s.titre}](${s.url}) — ${s.role} ; ${s.statut}. ${s.affirmations_verifiees} Réserve : ${s.reserves || "aucune réserve supplémentaire journalisée"}`).join("\n")}\n`),
    "## Décision humaine", "", "Relire toutes les copies et leurs limites documentaires avant publication. Les appuis hors objet déjà inscrits dans l'historique (notamment Empire allemand/Savoie, Bastille/privilèges/DDHC/Roland avec sources Louis XVI ou Code civil) sont signalés, sans correction silencieuse. Une éventuelle édition historique corrigée devra être validée et versionnée séparément.", ""].join("\n"));
  const sensibles = [...new Set([...ajouts.map(c => c.event_id), "EVT-0475", "EVT-0322"])].flatMap(event_id => {
    const e = events.get(event_id)!;
    const notes = consultations.filter(s => s.event_ids.includes(event_id) && s.reserves).map(s => s.reserves);
    if (e.date_status === "EXACT" && !notes.length && !["EVT-0040", "EVT-0475", "EVT-0322", "EVT-0323"].includes(event_id)) return [];
    return [{ event_id, titre_canonique: e.title_canonical, date_canonique: e.date_text, statut_canonique: e.date_status,
      card_ids: [...p.anciennes, ...ajouts].filter(c => c.event_id === event_id).map(c => c.card_id).join(";"),
      reserves: [...new Set(notes)].join(" | "), decision_attendue: event_id === "EVT-0040" ? "Correction canonique séparée à valider ; blocage conservé" :
        "Relire l'objet, la source et la précision ; aucun changement canonique dans cette PR", canon_modifie: "non" }];
  });
  ecrireCsv(`${dossier}/evenements-sensibles.csv`, sensibles);
  writeFileSync(`${dossier}/validation-humaine.md`, ["# Éléments exacts à valider par Antonin et Max", "",
    "La phase prépare des textes et des preuves techniques. Elle ne constitue pas une approbation éditoriale. Les 292 identifiants à relire sont dans l'inventaire ; tous leurs textes et leurs réserves sont dans le recueil.", "",
    "1. Relire et approuver les 231 rédactions nouvelles, leurs titres, notions, vocabulaire et idées à retenir, par niveau et chapitre.",
    "2. Relire les 61 reprises fidèles et leurs appuis documentaires complémentaires. Les sources mal associées ne sont pas remplacées silencieusement dans une copie : toute correction du contenu historique requiert un chantier explicitement validé.",
    "3. Valider chaque réserve ci-dessous et la précision calendaire réellement soutenue. Une consultation n'est pas une certification de toutes les composantes du canon.",
    "4. Arbitrer séparément EVT-0040 : objet, bornes, statut, admissibilité et conséquences sur les instantanés. Le blocage han-canon-incoherent reste en place et tout le groupe THM-047/048/049 reste inactif.",
    "5. Relire l'inventaire d'illustrations mutualisé : exactitude des scènes, objets du stock et références de la DA validée. La création et la validation des SVG appartiennent à la campagne suivante.",
    "6. Après ces validations et celles des futures illustrations, autoriser séparément les imports, attestations et éventuelles publications. Les attestations fixture-phase3 des tests sont jetables et n'ont aucune valeur de validation humaine.", "",
    "## Dossiers documentaires du corpus", "",
    ...sensibles.map(s => `### ${s.event_id} — ${s.titre_canonique}\n\nCartes : ${s.card_ids}.\n\nCanon conservé : ${s.date_canonique} (${s.statut_canonique}).\n\n${s.reserves || "La convention, tradition ou approximation du canon doit rester explicitement respectée."}\n\nDécision : ${s.decision_attendue}.\n`),
    "## Portée des preuves", "", "Les tests techniques prouvent les ensembles, les filiations et les protections. Ils ne remplacent pas une relecture savante. Les sources consultées, les tentatives infructueuses et les appuis complémentaires sont distingués dans les journaux et le tableau par carte. Aucun champ de validation du manifeste n'a été renseigné.", ""].join("\n"));
  const redactions = lireRedactions();
  const byEvent = new Map(redactions.map(r => [r.event_id, r]));
  const briefs = [...new Set(ajouts.map(c => c.event_id))].sort().map(event_id => {
    const existing = svg.includes(`${event_id}.svg`), scene = scenes.find(s => s.event === event_id);
    const r = byEvent.get(event_id), intention = r?.illustration?.intention ?? scene?.intention ?? ajouts.find(c => c.event_id === event_id)!.title;
    const stock = r?.illustration?.objets_stock ?? scene?.objets ?? [];
    for (const nom of stock) assert(objets[nom], `Objet de stock inconnu : ${event_id}/${nom}`);
    assert(existing || stock.length >= 2, `Brief sans objets validés : ${event_id}`);
    const vigilance = r?.illustration?.vigilances ?? scene?.vigilance ?? "Réutilisation exacte du SVG existant, sans modification";
    return { event_id, card_ids: ajouts.filter(c => c.event_id === event_id).map(c => c.card_id).join(";"), illustration_existante: existing ? "oui" : "non",
      svg_reutilisable: existing ? `content/illustrations/${event_id}.svg` : "", nouvelle_illustration_requise: existing ? "non" : "oui",
      intention, objets_stock: stock.join(";"), references_DA: [...new Set(stock.map(n => objets[n].reference))].join(";"), vigilances_historiques: vigilance };
  });
  ecrireCsv(`${dossier}/illustrations-par-evenement.csv`, briefs);
  ecrireCsv(`${dossier}/illustrations-par-carte.csv`, ajouts.map(c => ({ card_id: c.card_id, ...briefs.find(b => b.event_id === c.event_id)! })));
  const recueil = ["# Recueil intégral de relecture — phase 3 #92", "", "Préparation privée : 104 complétions et 188 cartes enfants, dont 61 reprises fidèles. Les dates restent celles du canon, y compris la réserve Han. Aucune publication. Les copies incluent leur filiation ; elles sont aussi présentes ici pour permettre une relecture exhaustive.", ""];
  for (const niveau of [...new Set(unites.map(u => u.niveau))]) {
    recueil.push(`## ${niveau}`, "");
    for (const u of unites.filter(u => u.niveau === niveau)) {
      const group = ajouts.filter(c => c.chapter_id === u.id); if (!group.length) continue;
      recueil.push(`### ${u.id} — ${u.titre}`, "");
      for (const c of group) {
        recueil.push(`#### ${c.card_id} — ${c.title}`, "", `**${c.date_text}** · ${c.event_id}${c.source_card_id ? ` · copie fidèle de ${c.source_card_id}` : ""}`, "", c.body, "", c.takeaway, "", `**Notions :** ${c.key_concepts.replaceAll(";", ", ")}`, "", `**Sources du CSV :** ${c.sources.split(";").map((url, i) => `[${i + 1}](${url})`).join(" · ")}`, "");
        const refs = documentation.filter(s => s.card_id === c.card_id && s.role === "appui documentaire complémentaire");
        if (refs.length) recueil.push(`**Appuis complémentaires consultés :** ${refs.map(s => `[${s.titre}](${s.url})`).join(" · ")}`, "");
        const notes = [...new Set(consultations.filter(s => s.event_ids.includes(c.event_id) && s.reserves).map(s => s.reserves))];
        if (notes.length) recueil.push(`**Réserves pour la relecture :** ${notes.join(" | ")}`, "");
      }
    }
  }
  writeFileSync(`${dossier}/recueil-cartes.md`, recueil.join("\n").trimEnd() + "\n");
  writeFileSync(`${dossier}/couverture-59-unites.md`, ["# Couverture des cinquante-neuf unités", "", "Les nombres de tests sont une simulation technique du corpus préparé. Aucun brouillon n'est admissible en production. Les six parents découpés conservent leur test historique ; leur corpus complet est couvert par leurs enfants. Le blocage Han interdit l'activation de tout son groupe.", "",
    "| Unité | Niveau | Attendus | Historiques | Ajouts | Sans carte dans le parcours | Jouables A/M/J | Questions A/M/J | Blocage |",
    "| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |",
    ...couverture.map(c => `| ${c.chapter_id} — ${c.titre} | ${c.niveau} | ${c.corpus_attendu} | ${c.cartes_historiques} | ${c.cartes_ajoutees} | aucun | ${c.jouables_annee_simulation}/${c.jouables_mois_simulation}/${c.jouables_jour_simulation} | ${c.questions_annee_simulation}/${c.questions_mois_simulation}/${c.questions_jour_simulation} | ${c.blocages_activation_groupe || "aucun"} |`), "",
    "Le CSV compagnon fournit tous les identifiants d'événements, la couverture propre à chaque parent, les modes initiaux, les modes simulés et les états. Un mode inférieur à cinq repères n'est pas proposé ; le contenu de contexte n'est jamais compté comme question.", ""].join("\n"));
  const rapport = { base_main: BASE, historiques: 325, completions: completions.length, enfants: enfants.length, filiations: copies.length,
    manques_audit_couverts: couvertures.length, unites: couverture.length, svg_inchanges: svg.length,
    sha256_cartes_historiques_main_git: sha(baselineGit), sha256_cartes_historiques_main_checkout: sha(baseline), sha256_cartes_historiques_phase3: sha(readFileSync(ancienFichier)),
    illustrations_evenements_uniques: briefs.length, illustrations_a_creer: briefs.filter(b => b.nouvelle_illustration_requise === "oui").length,
    illustrations_a_reutiliser: briefs.filter(b => b.illustration_existante === "oui").length,
    nouvelles_cartes_sources_consultees: ajouts.filter(c => !c.source_card_id).length, copies_sources_conservees: copies.length,
    activation_production: false, chemins_proteges_identiques_main: protections,
    blocages: couverture.filter(c => c.blocages).map(c => ({ chapter_id: c.chapter_id, blocages: c.blocages })) };
  writeFileSync(`${dossier}/rapport-controles.json`, JSON.stringify(rapport, null, 2) + "\n");
  console.log(JSON.stringify(rapport, null, 2));
  return rapport;
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/phase3-pedagogie.ts")) {
  if (process.argv.includes("--plan")) {
    const p = inventaireIndependant(); console.log(JSON.stringify({ manques: p.manques.length, completions: p.completions.length,
      enfants: p.enfants.length, filiations: p.enfants.filter(c => c.origine).length, nouveaux_enfants: p.enfants.filter(c => !c.origine).length }));
  } else if (process.argv.includes("--assembler")) assemblerPhase3();
  else verifierPhase3();
}
