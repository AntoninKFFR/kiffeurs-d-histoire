import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lireCsv, type LigneCsv } from "./csv";
import { periodeContexte } from "./periode-cartes";
import { chargerStructure, empreinteLigne, type Structure } from "./structure-pedagogique";
import { FICHIER_CARTES } from "./fichiers-pedagogiques";

export { FICHIER_CARTES, FICHIER_CARTES_ENFANTS } from "./fichiers-pedagogiques";
const dates = ["start_year", "start_month", "start_day", "end_year", "end_month", "end_day"] as const;
type ChampDate = typeof dates[number];
export type Carte = Record<ChampDate, number | null> & {
  card_id: string; chapter_id: string; event_id: string | null;
  date_text: string; date_precision: string; date_status: string;
  title: string; body: string; takeaway: string; key_concepts: string[];
  sort_order: number; official_wording: string; sources: string[];
};

export function estUrlLocale(url: string) {
  const u = new URL(url);
  return u.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
}

function liste(valeur: string) {
  const elements = valeur.split(";").map((v) => v.trim());
  if (!elements.length || elements.some((v) => !v) || new Set(elements).size !== elements.length)
    throw new Error(`Liste vide ou dupliquée : ${valeur}`);
  return elements;
}

// Validation complète avant toute écriture. Les événements reprennent le canon ;
// le contexte conserve uniquement les périodes explicites de son rattachement.
export function validerCartes(lignes: LigneCsv[], evenements: LigneCsv[], themes: LigneCsv[], liens: LigneCsv[], structure?: Structure): Carte[] {
  if (!lignes.length) throw new Error("CSV de cartes vide");
  const events = new Map(evenements.map((e) => [e.event_id, e]));
  const children = new Map(structure?.sous_chapitres.map(c => [c.id, c]) ?? []);
  const chapters = new Set([...themes.map((t) => t.theme_id), ...children.keys()]);
  const ids = new Set<string>();
  const parChapitre = new Map<string, Carte[]>();
  const cartes = lignes.map((l): Carte => {
    const erreur = (message: string): never => { throw new Error(`${l.card_id} : ${message}`); };
    if (!new RegExp(`^CARD-${l.chapter_id?.slice(4)}-[a-z0-9]+(?:-[a-z0-9]+)*$`).test(l.card_id) || ids.has(l.card_id)) erreur("identifiant invalide ou dupliqué");
    ids.add(l.card_id);
    if (!chapters.has(l.chapter_id)) erreur("chapitre inconnu");
    const child = children.get(l.chapter_id);
    if (child && l.event_id && !child.event_ids.includes(l.event_id)) erreur("événement hors sous-chapitre");
    const rattachements = liens.filter((r) => r.theme_id === (child?.parent_id ?? l.chapter_id) && r.event_id === l.event_id);
    if (!rattachements.some((r) => r.official_wording === l.official_wording)) erreur("rattachement ou libellé officiel inconnu");
    const mots = l.body.trim().split(/\s+/).length;
    if (!l.title || mots < 60 || mots > 120 || !/^À retenir : .+/.test(l.takeaway)) erreur("titre, texte (60–120 mots) ou takeaway invalide");
    if (/dataset|\bv18\b|base de données|\bchamp\b|statut technique|\b(?:EXACT|CONVENTIONAL|DISPUTED|APPROXIMATE|TRADITIONAL)\b|éduscol|le programme|cette carte|système d.import/i.test(`${l.title} ${l.body} ${l.takeaway} ${l.key_concepts}`))
      erreur("langage technique ou méta dans le contenu élève");
    // Les dates explicites sont dans les champs dédiés. Interdit les
    // repères supplémentaires non sourcés dans le texte (chiffres/siècles romains).
    if (/\d|\b[IVXLCDM]+(?:e|er|ème)\s+siècle/i.test(`${l.title} ${l.body} ${l.takeaway} ${l.key_concepts}`)) erreur("date ou nombre dans le texte : utiliser les champs de date sourcés");
    const d = Object.fromEntries(dates.map((champ) => {
      const v = l[champ];
      if (v === undefined || (v !== "" && !/^-?[1-9]\d*$/.test(v))) erreur(`entier invalide : ${champ}`);
      return [champ, v ? Number(v) : null];
    })) as Record<ChampDate, number | null>;
    if (l.event_id) {
      const e = events.get(l.event_id);
      if (!e) erreur("événement inconnu");
      const historique = structure?.empreintes_cartes_historiques[l.card_id] === empreinteLigne(l);
      for (const champ of dates) if (!historique && l[champ] !== e![champ]) erreur(`date différente du v18 : ${champ}`);
      if (!historique && (l.date_text !== e!.date_text || l.date_precision !== e!.precision || l.date_status !== e!.date_status))
        erreur("date textuelle, précision ou statut différents du v18");
    } else {
      const periode = periodeContexte(l.official_wording);
      for (const champ of dates) if (d[champ] !== periode[champ]) erreur("période de contexte différente du libellé officiel v18");
      for (const champ of ["date_text", "date_precision", "date_status"] as const)
        if (l[champ] !== periode[champ]) erreur("période de contexte différente du libellé officiel v18");
    }
    if (!/^[1-9]\d*$/.test(l.sort_order)) erreur("ordre invalide");
    const concepts = liste(l.key_concepts);
    if (concepts.length > 6) erreur("trop de notions");
    const sources = liste(l.sources);
    for (const source of sources) if (!/^https:\/\//.test(source)) erreur("source sans URL HTTPS");
    const carte = { ...d, card_id: l.card_id, chapter_id: l.chapter_id, event_id: l.event_id || null,
      date_text: l.date_text, date_precision: l.date_precision, date_status: l.date_status,
      title: l.title, body: l.body, takeaway: l.takeaway, key_concepts: concepts,
      sort_order: Number(l.sort_order), official_wording: l.official_wording, sources };
    parChapitre.set(l.chapter_id, [...(parChapitre.get(l.chapter_id) ?? []), carte]);
    return carte;
  });
  for (const [id, groupe] of parChapitre) {
    groupe.sort((a, b) => a.sort_order - b.sort_order);
    // Les lots incomplets sont autorisés uniquement pour un enfant inactif. L'activation
    // exige ensuite couverture exacte, test suffisant et validations de contenu/illustration.
    const minimum = children.get(id)?.etat === "inactif" ? 1 : 5;
    if (groupe.length < minimum || groupe.length > 64 || groupe.some((c, i) => c.sort_order !== i + 1))
      throw new Error(`${id} : ${minimum}–64 cartes avec ordre continu requis`);
    const evenementsGroupe = groupe.flatMap(c => c.event_id ? [c.event_id] : []);
    if (new Set(evenementsGroupe).size !== evenementsGroupe.length) throw new Error(`${id} : événement répété`);
    const datees = groupe.filter((c) => c.start_year !== null);
    for (let i = 1; i < datees.length; i++) {
      const a = datees[i - 1], b = datees[i];
      // Une année sans mois/jour ne doit pas devenir fictivement le premier janvier.
      const difference = a.start_year! - b.start_year! ||
        (a.start_month !== null && b.start_month !== null ? a.start_month - b.start_month ||
          (a.start_day !== null && b.start_day !== null ? a.start_day - b.start_day : 0) : 0);
      if (difference > 0) throw new Error(`${id} : ordre chronologique incohérent`);
    }
  }
  return cartes.sort((a, b) => a.chapter_id.localeCompare(b.chapter_id) || a.sort_order - b.sort_order);
}

export function chargerCartes(dossier = "content/dataset-v18", fichier = FICHIER_CARTES) {
  const themes = lireCsv(path.join(dossier, "kiffeurs-themes-v18.csv"));
  const cartes = validerCartes(lireCsv(fichier), lireCsv(path.join(dossier, "kiffeurs-events-v18.csv")),
    themes, lireCsv(path.join(dossier, "kiffeurs-curriculum-links-v18.csv")), chargerStructure());
  const couverts = new Set(cartes.map((c) => c.chapter_id));
  if (themes.some((t) => !couverts.has(t.theme_id))) throw new Error("Chapitre canonique sans cartes pédagogiques");
  return cartes;
}

/** Validation d'un futur lot enfant, sans copier ni créer de contenu dans cette phase. */
export function chargerCartesSousChapitres(fichier: string, racine = ".") {
  const s = chargerStructure(racine);
  const dossier = path.join(racine, "content/dataset-v18");
  const lignes = lireCsv(fichier);
  if (lignes.some(l => !s.sous_chapitres.some(c => c.id === l.chapter_id))) throw new Error("Lot enfant contenant un chapitre historique");
  validerFiliationCartes(lignes, lireCsv(path.join(racine,FICHIER_CARTES)), s);
  return validerCartes(lignes, lireCsv(path.join(dossier, "kiffeurs-events-v18.csv")),
    lireCsv(path.join(dossier, "kiffeurs-themes-v18.csv")), lireCsv(path.join(dossier, "kiffeurs-curriculum-links-v18.csv")), s);
}

export function validerFiliationCartes(lignes: LigneCsv[], anciennes: LigneCsv[], structure: Structure) {
  const origins = new Map(anciennes.map(c => [c.card_id,c]));
  for (const c of lignes) {
    const child = structure.sous_chapitres.find(u => u.id === c.chapter_id);
    const candidates = anciennes.filter(o => o.chapter_id === child?.parent_id && o.event_id === c.event_id);
    if (candidates.length && !c.source_card_id) throw new Error("Filiation explicite requise pour une carte déjà couverte");
    if (c.source_card_id) {
      const source = origins.get(c.source_card_id);
      if (!source || source.chapter_id !== child?.parent_id || source.event_id !== c.event_id || source.card_id === c.card_id)
        throw new Error("Filiation de carte incohérente");
    }
  }
}

export async function importerCartesSousChapitresLocales(fichier: string,url: string,cle: string) {
  if (!estUrlLocale(url)) throw new Error("Import enfant réservé à la pile locale");
  const cartes = chargerCartesSousChapitres(fichier);
  const filiation = lireCsv(fichier).filter(c => c.source_card_id).map(c => ({ card_id:c.card_id,source_card_id:c.source_card_id }));
  const {error} = await connecterCartes(url,cle).rpc("import_pedagogical_cards",{p_cards:cartes,p_lineage:filiation});
  if (error) throw new Error(`Import enfant : ${error.message}`);
}

export function connecterCartes(url: string, cle: string) {
  return createClient(url, cle, { db: { schema: "histoire" }, auth: { persistSession: false } });
}

export async function importerCartesLocales(cartes: Carte[], url: string, cle: string) {
  if (!estUrlLocale(url)) throw new Error("Import des cartes réservé à Supabase LOCAL ; aucune écriture distante autorisée");
  const db = connecterCartes(url, cle);
  const { error } = await db.rpc("replace_chapter_cards", { p_cards: cartes });
  if (error) throw new Error(`Import des cartes : ${error.message}`);
  console.log(`Cartes pédagogiques : ${cartes.length} cartes remplacées dans ${new Set(cartes.map((c) => c.chapter_id)).size} chapitres (LOCAL).`);
}
