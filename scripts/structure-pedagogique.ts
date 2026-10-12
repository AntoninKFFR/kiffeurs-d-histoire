import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { lireCsv, type LigneCsv } from "./csv";

export type EtatUnite = "actif" | "historique" | "inactif";
export type Unite = {
  id: string; parent_id: string | null; titre: string; niveau: string; niveauSlug: string;
  slug: string; content_version: string; etat: EtatUnite;
  edition_active?: string; editions?: string[];
  edition_counts?:Record<string,{YEAR:number;MONTH:number;DAY:number}>;
};
export type SousChapitre = Unite & {
  event_ids: string[]; validation_contenu: string | null; validation_illustrations: string | null;
  blocages: string[]; rubriques: Record<string, string[]>;
};
export type Structure = {
  version: number; audit_sha: string; chapitres_historiques: Unite[];
  sous_chapitres: SousChapitre[]; empreintes_cartes_historiques: Record<string, string>;
  eligibilite_tests_historiques:Record<string,string[]>;
};
export const FICHIER_STRUCTURE = "content/pedagogie/chapitres-v2.json";
export function empreinteLigne(ligne: LigneCsv) {
  return createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(ligne).sort(([a], [b]) => a.localeCompare(b, "en"))))).digest("hex");
}

/** Les sources éditoriales restent privées. Le manifeste est entièrement validé avant import/génération. */
export function chargerStructure(racine = "."): Structure {
  const s = JSON.parse(readFileSync(`${racine}/${FICHIER_STRUCTURE}`, "utf8")) as Structure;
  const liens = lireCsv(`${racine}/content/dataset-v18/kiffeurs-curriculum-links-v18.csv`);
  const themes = lireCsv(`${racine}/content/dataset-v18/kiffeurs-themes-v18.csv`);
  const cartes = lireCsv(`${racine}/content/pedagogie/cartes-v1.csv`);
  validerStructure(s, themes, liens, cartes);
  return s;
}
export function validerStructure(s: Structure, themes: LigneCsv[], liens: LigneCsv[], cartes: LigneCsv[]) {
  const refuser = (message: string): never => { throw new Error(`Structure pédagogique : ${message}`); };
  if (s.version !== 1 || s.chapitres_historiques.length !== 41 || s.sous_chapitres.length !== 18) refuser("effectifs inattendus");
  if(Object.keys(s.eligibilite_tests_historiques??{}).length!==41 || s.chapitres_historiques.some(c=>!Array.isArray(s.eligibilite_tests_historiques[c.id])
    || s.eligibilite_tests_historiques[c.id].some(id=>!cartes.some(x=>x.chapter_id===c.id && x.event_id===id)))) refuser("admissibilité historique manquante ou hors cartes");
  const anciens = new Map(s.chapitres_historiques.map(c => [c.id, c]));
  if (themes.length !== anciens.size || themes.some(t => !anciens.has(t.theme_id))) refuser("anciens chapitres perdus");
  if (cartes.length !== 325 || Object.keys(s.empreintes_cartes_historiques).length !== 325
    || cartes.some(c => empreinteLigne(c) !== s.empreintes_cartes_historiques[c.card_id])) refuser("cartes historiques modifiées");
  const ids = new Set<string>(), slugs = new Set<string>();
  for (const c of [...s.chapitres_historiques, ...s.sous_chapitres]) {
    if (!/^THM-\d{3}$/.test(c.id) || ids.has(c.id) || slugs.has(`${c.niveauSlug}/${c.slug}`)) refuser("identifiant ou URL dupliqué");
    if (!c.content_version || !["actif", "historique", "inactif"].includes(c.etat)) refuser("version ou état invalide");
    ids.add(c.id); slugs.add(`${c.niveauSlug}/${c.slug}`);
  }
  const parents = new Set(s.sous_chapitres.map(c => c.parent_id));
  if (parents.size !== 6) refuser("six parents requis");
  for (const c of s.sous_chapitres) {
    const parent = anciens.get(c.parent_id!);
    if (!parent || c.niveauSlug !== parent.niveauSlug || c.niveau !== parent.niveau) refuser("filiation ou niveau invalide");
    if (c.event_ids.length < 5 || c.event_ids.length > 20 || new Set(c.event_ids).size !== c.event_ids.length) refuser("corpus invalide");
    const rubriques = Object.values(c.rubriques).flat();
    if (rubriques.length && (rubriques.length !== c.event_ids.length || new Set(rubriques).size !== rubriques.length
      || rubriques.some(id => !c.event_ids.includes(id)))) refuser("rubriques incohérentes");
    // La phase 2 ne publie aucun enfant, y compris via un changement manuel de JSON.
    if (c.etat !== "inactif" || c.validation_contenu !== null || c.validation_illustrations !== null) refuser("activation interdite en préparation");
    if (c.event_ids.includes("EVT-0040") && !c.blocages.includes("han-canon-incoherent")) refuser("blocage Han manquant");
  }
  for (const parent of parents) {
    const attendus = new Set(liens.filter(l => l.theme_id === parent && l.event_id).map(l => l.event_id));
    const effectifs = s.sous_chapitres.filter(c => c.parent_id === parent).flatMap(c => c.event_ids);
    if (effectifs.length !== attendus.size || new Set(effectifs).size !== effectifs.length
      || effectifs.some(id => !attendus.has(id))) refuser(`partition inexacte ${parent}`);
  }
  if (s.sous_chapitres.find(c => c.event_ids.includes("EVT-0115"))?.id !== "THM-060") refuser("URSS hors S4");
}

/** Aucun event_id, compteur daté, validation privée ou empreinte dans le registre client. */
export function projectionStructure(s: Structure): Unite[] {
  return [...s.chapitres_historiques, ...s.sous_chapitres].map(c => ({
    id: c.id, titre: c.titre, niveau: c.niveau, niveauSlug: c.niveauSlug, slug: c.slug,
    parent_id: c.parent_id, content_version: c.content_version, etat: c.etat,
  }));
}

export type EtatPublie = Pick<Unite,"id" | "parent_id" | "slug" | "content_version" | "etat"> & {published:boolean; current_version?:string|null; editions?:string[];edition_counts?:Unite['edition_counts']};
/** Le manifeste de préparation reste inactif ; seuls les états contrôlés en base sont exportables. */
export function appliquerEtatsPublies(s: Structure, etats: EtatPublie[]): Unite[] {
  const connus = projectionStructure(s), map = new Map(etats.map(c => [c.id,c]));
  if (map.size !== connus.length || map.size !== etats.length) throw new Error("Export de structure incomplet ou dupliqué");
  const resultat = connus.map(c => {
    const e=map.get(c.id);
    if (!e || e.parent_id!==c.parent_id || e.slug!==c.slug || e.content_version!==c.content_version
      || !["actif","historique","inactif"].includes(e.etat) || (e.etat!=="inactif" && !e.published)) throw new Error("Export incompatible avec les IDs et versions conservés");
    const versions=e.editions??[];
    if (new Set(versions).size!==versions.length || versions.some(v=>v!=="completion-v1") || (versions.length && (c.parent_id || s.sous_chapitres.some(x=>x.parent_id===c.id)))
      || (e.current_version && !versions.includes(e.current_version))) throw new Error("Éditions exportées incompatibles");
    if(versions.length && (!e.edition_counts || [c.content_version,...versions].some(v=>!e.edition_counts![v]))) throw new Error("Décomptes publiés manquants");
    if(e.edition_counts && Object.entries(e.edition_counts).some(([v,n])=>![c.content_version,...versions].includes(v)
      || Object.keys(n).sort().join(',')!=='DAY,MONTH,YEAR' || Object.values(n).some(x=>!Number.isInteger(x)||x<0||x>64)
      || n.DAY>n.MONTH || n.MONTH>n.YEAR)) throw new Error("Décomptes d'édition invalides");
    return {...c,etat:e.etat,...(versions.length?{editions:versions}:{}),
      ...((versions.length||c.parent_id)&&e.edition_counts?{edition_counts:e.edition_counts}:{}),...(e.current_version?{edition_active:e.current_version}:{})};
  });
  for (const p of s.chapitres_historiques) {
    const children=resultat.filter(c => c.parent_id===p.id), parent=resultat.find(c=>c.id===p.id)!;
    if (children.length && (parent.etat==="historique" ? children.some(c=>c.etat!=="actif") : children.some(c=>c.etat==="actif")))
      throw new Error("Activation partielle ou doublon actif parent/enfant");
  }
  return resultat;
}

/** Fusion de liens additive : une réimportation du canon ne retire ni parent ni enfant publié. */
export function conserverLiensPedagogiques<T extends { chapter_id: string; event_id: string }>(nouveaux: T[], anciens: T[], proteges: ReadonlySet<string>) {
  const resultat = new Map(nouveaux.map(l => [`${l.chapter_id}\0${l.event_id}`, l]));
  for (const l of anciens) if (proteges.has(l.chapter_id)) resultat.set(`${l.chapter_id}\0${l.event_id}`, l);
  return [...resultat.values()];
}
