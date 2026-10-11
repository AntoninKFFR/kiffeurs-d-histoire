// Construit src/lib/solo/catalogue.json depuis le dataset v18 : les packs prêts à jouer, les thèmes
// et, pour chaque choix, le nombre d'événements jouables par niveau et par précision (pour griser ce qui ne remplit pas 10 questions).
// Les niveaux viennent de content/niveaux-evenements.csv : n[0] Débutant, n[1] Intermédiaire (niveaux 1 et 2), n[2] Expert (tout).
// Aucune date d'événement n'y figure : des identifiants, des libellés, des décomptes et, pour cadrer
// la frise, l'étendue de chaque choix arrondie à la dizaine d'années avec 10 ans de marge.
// Usage : npm run content:catalogue-solo
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireCsv, type LigneCsv } from "./csv";
import { PERIODES } from "../src/lib/solo/periodes";
import { contenuPacksHierarchiques } from "./catalogue-packs";
import sport from "../content/sport/packs-proposes.json";

const dossier = join(import.meta.dirname, "..", "content", "dataset-v18");
const csv = (nom: string) => lireCsv(join(dossier, `kiffeurs-${nom}-v18.csv`));
type Comptes = { YEAR: number; MONTH: number; DAY: number };

// Mêmes règles que histoire.start_game : jouable, mode automatique, mois et jour présents selon la difficulté.
const evenements = csv("events").filter(
  (e) => e.playable === "TRUE" && ["YEAR", "MONTH", "DAY", "RANGE"].includes(e.playable_mode) && e.start_year !== "",
);
const parId = new Map(evenements.map((e) => [e.event_id, e]));
const niveaux = new Map(lireCsv(join(import.meta.dirname, "..", "content", "niveaux-evenements.csv")).map((r) => [r.event_id, Number(r.niveau)]));
// Même règle que la base : un événement sans niveau est rangé en Expert.
const niveauDe = (e: LigneCsv) => niveaux.get(e.event_id) ?? 3;
function compter(liste: LigneCsv[]): Comptes {
  return {
    YEAR: liste.length,
    MONTH: liste.filter((e) => e.start_month !== "").length,
    DAY: liste.filter((e) => e.start_month !== "" && e.start_day !== "").length,
  };
}
const deIds = (ids: Iterable<string>) => [...new Set(ids)].flatMap((id) => { const e = parId.get(id); return e ? [e] : []; });
const parNiveau = (liste: LigneCsv[]) => [1, 2, 3].map((n) => compter(liste.filter((e) => niveauDe(e) <= n)));
const deListe = (ids: Iterable<string>) => parNiveau(deIds(ids));

// Étendue de la frise pour un choix, en années astronomiques (positions `t` de la frise, 1 av. J.-C. = 0).
const DEBUT_FRISE = -3500, FIN_FRISE = 2030, LARGEUR_MIN = 30;
function bornes(liste: LigneCsv[]): [number, number] {
  if (!liste.length) return [DEBUT_FRISE, FIN_FRISE];
  const astro = liste.map((e) => { const a = Number(e.start_year); return a < 0 ? a + 1 : a; });
  let debut = Math.max(DEBUT_FRISE, Math.floor((Math.min(...astro) - 10) / 10) * 10);
  let fin = Math.min(FIN_FRISE, Math.ceil((Math.max(...astro) + 11) / 10) * 10);
  if (fin - debut < LARGEUR_MIN) {
    const manque = LARGEUR_MIN - (fin - debut);
    debut -= Math.ceil(manque / 2);
    fin += Math.floor(manque / 2);
  }
  return [debut, fin];
}

const contenuPacks = new Map<string, string[]>();
for (const r of csv("ready-collection-events")) contenuPacks.set(r.collection_id, [...(contenuPacks.get(r.collection_id) ?? []), r.event_id]);
const packsSource = csv("ready-collections");
// #90 : contenu séparé du dataset ; l’import des 24 anciens packs ne le synchronise pas.
for (const p of sport.packs) packsSource.push({ collection_id: p.id, title: p.title, description: p.description,
  parent_id: p.parent_id ?? "", active: "TRUE", ready_to_play: "TRUE" });
for (const a of sport.associations) {
  for (const id of ["COL-0105", a.sous_pack]) contenuPacks.set(id, [...(contenuPacks.get(id) ?? []), a.event_id]);
}
const packsActifs = packsSource.filter((p) => p.active === "TRUE" && p.ready_to_play === "TRUE");
const unionsPacks = contenuPacksHierarchiques(packsSource, contenuPacks);
const packs = packsActifs.map((p) => ({ id: p.collection_id, titre: p.title, description: p.description,
  ...(p.parent_id ? { parent_id: p.parent_id } : {}),
  n: deListe(unionsPacks.get(p.collection_id) ?? []), b: bornes(deIds(unionsPacks.get(p.collection_id) ?? [])) }));

const tagsEvenements = new Map<string, string[]>();
for (const r of csv("event-tags")) tagsEvenements.set(r.tag_id, [...(tagsEvenements.get(r.tag_id) ?? []), r.event_id]);
const themes = csv("tags")
  .filter((t) => t.tag_type === "SEMANTIC_TOPIC" && t.active === "TRUE")
  .map((t) => ({ id: t.tag_id, nom: t.name, n: deListe(tagsEvenements.get(t.tag_id) ?? []), b: bornes(deIds(tagsEvenements.get(t.tag_id) ?? [])) }))
  .filter((t) => t.n[2].YEAR >= 10)
  .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

const dansPeriode = (p: (typeof PERIODES)[number]) =>
  evenements.filter((e) => (p.de == null || Number(e.start_year) >= p.de) && (p.a == null || Number(e.start_year) <= p.a));
const periodes = Object.fromEntries(PERIODES.map((p) => [p.id, parNiveau(dansPeriode(p))]));
const bornesPeriodes = Object.fromEntries(PERIODES.map((p) => [p.id, bornes(dansPeriode(p))]));

// Chapitres : mêmes liens que l'import (curriculum-links, doublons redirigés vers l'identifiant canonique).
const redirection = new Map(csv("event-redirects").map((r) => [r.old_event_id, r.canonical_event_id]));
const contenuChapitres = new Map<string, string[]>();
for (const l of csv("curriculum-links")) {
  if (!l.theme_id || !l.event_id) continue;
  const id = redirection.get(l.event_id) ?? l.event_id;
  contenuChapitres.set(l.theme_id, [...(contenuChapitres.get(l.theme_id) ?? []), id]);
}
// Test d'un chapitre (#23) : seulement les événements de ses cartes pédagogiques, ce que le joueur vient d'apprendre.
const cartesChapitres = new Map<string, string[]>();
for (const c of lireCsv(join(import.meta.dirname, "..", "content", "pedagogie", "cartes-v1.csv"))) {
  if (!c.event_id) continue;
  cartesChapitres.set(c.chapter_id, [...(cartesChapitres.get(c.chapter_id) ?? []), redirection.get(c.event_id) ?? c.event_id]);
}
const chapitres = Object.fromEntries([...contenuChapitres].sort().map(([id, ids]) => {
  const test = cartesChapitres.get(id) ?? [];
  // Le mode scolaire n'a pas de niveau : tous les événements du chapitre comptent.
  return [id, { n: compter(deIds(ids)), b: bornes(deIds(ids)), t: compter(deIds(test)), tb: bornes(deIds(test)) }];
}));

const catalogue = { general: parNiveau(evenements), packs, themes, periodes, bornesPeriodes, chapitres };
writeFileSync(join(import.meta.dirname, "..", "src", "lib", "solo", "catalogue.json"), `${JSON.stringify(catalogue, null, 1)}\n`);
console.log(`${packs.length} packs, ${themes.length} thèmes, ${evenements.length} événements jouables.`);
