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
