// Contenus qu'un hôte peut choisir pour une partie de salon (#136) : packs, périodes et thèmes du solo.
import { PACKS, THEMES } from "@/lib/solo/choix";
import { PERIODES } from "@/lib/solo/periodes";
import type { Categorie, CibleContenu, Reglages } from "./salon";

export type OptionContenu = { type: Categorie; id: string; titre: string; detail: string };

const annee = (a: number) => (a < 0 ? `${-a} av. J.-C.` : String(a));
const bornes = (b: number[] | null | undefined) =>
  b && b.length === 2 ? `${annee(b[0])} – ${b[1] >= new Date().getFullYear() ? "aujourd'hui" : annee(b[1])}` : "";
// Tous niveaux confondus : le niveau n'est pas un réglage du multi.
const total = (n: { YEAR: number }[]) => n[n.length - 1]?.YEAR ?? 0;

export const CATEGORIES: { type: Categorie; titre: string }[] = [
  { type: "pack", titre: "Pack" },
  { type: "periode", titre: "Période" },
  { type: "theme", titre: "Thème" },
];

export function optionsContenu(type: Categorie): OptionContenu[] {
  if (type === "pack") return PACKS.map((p) => ({ type, id: p.id, titre: p.titre, detail: `Pack · ${total(p.n)} questions · ${bornes(p.b)}` }));
  if (type === "theme") return THEMES.map((t) => ({ type, id: t.id, titre: t.nom, detail: `Thème · ${total(t.n)} questions · ${bornes(t.b)}` }));
  return PERIODES.map((p) => ({ type, id: p.id, titre: p.nom, detail: `Période · ${p.detail}` }));
}

export function decrireCible(cible: CibleContenu | null): OptionContenu | null {
  if (!cible) return null;
  return optionsContenu(cible.type).find((o) => o.id === cible.id) ?? null;
}

/** Une ligne pour le résumé (téléphone, joueurs qui ne sont pas l'hôte). */
export function titreContenu(r: Reglages): string {
  if (r.contenu.choix === "mystere") return "Thème Mystère";
  if (r.contenu.choix === "vote") return "Vote des joueurs";
  if (r.contenu.choix === "pick_ban") return "Pick & ban";
  return decrireCible(r.contenu.cible)?.titre ?? "Toute l'Histoire";
}

// Vote et roulette (#144) : un motif de la charte et une ligne de détail pour chaque contenu proposé.
const MOTIFS_PERIODES: Record<string, string> = {
  antiquite: "amphore", "moyen-age": "donjon", "epoque-moderne": "caravelle", xixe: "locomotive",
  "guerres-mondiales": "casque", "depuis-1945": "fusee",
};
const MOTIFS_MOTS: [RegExp, string][] = [
  [/espace|spatial/i, "fusee"], [/premi[eè]re guerre|seconde guerre|xxe|guerre froide/i, "casque"],
  [/guerre|bataille|conflit|g[ée]nocide|terroris|violence/i, "epee"], [/r[ée]volution|insurrection|nationalis/i, "cocarde"],
  [/napol|roi|empire|totalitar/i, "couronne"], [/religion/i, "vitrail"], [/france/i, "lys"],
  [/science|savoir|technique|invention|m[ée]decine|premi[eè]res/i, "ampoule"], [/transport|industri|cyclisme|m[ée]canique/i, "locomotive"],
  [/explor|colonis|esclav|migration/i, "caravelle"], [/europe|diplomat|g[ée]opolit|international|fronti[eè]re/i, "globe"],
  [/film|pop|m[ée]dia|culture|art/i, "journal"], [/droit|libert|d[ée]mocratie|politique|[ée]tat|l[ée]gislation|travail|social/i, "parchemin"],
  [/antiquit/i, "amphore"], [/moyen/i, "donjon"], [/moderne/i, "caravelle"], [/xixe/i, "locomotive"],
  [/sport|football|tennis|olymp/i, "tour"], [/environnement|urbanis/i, "boussole"],
];
const MOTIFS_REPLI = ["parchemin", "colonne", "ecu", "plume", "globe", "boussole", "journal", "tour"];

export function motifContenu(c: { type: string; id: string; titre: string }): string {
  if (c.type === "periode" && MOTIFS_PERIODES[c.id]) return MOTIFS_PERIODES[c.id];
  const mot = MOTIFS_MOTS.find(([re]) => re.test(c.titre));
  if (mot) return mot[1];
  const h = [...c.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return MOTIFS_REPLI[h % MOTIFS_REPLI.length];
}

/** « 186 questions · 1789 – 1815 » (sans le type, déjà affiché sur l'étiquette). */
export function detailContenu(c: { type: string; id: string }): string {
  if (c.type !== "pack" && c.type !== "periode" && c.type !== "theme") return "";
  return decrireCible({ type: c.type, id: c.id })?.detail.replace(/^(Pack|Thème|Période) · /, "").replace(/ · $/, "") ?? "";
}
