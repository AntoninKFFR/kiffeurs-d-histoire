import { ecrireChoix, NIVEAU_PAR_DEFAUT, type Choix } from "./choix";
import type { MysteryTheme } from "@/lib/game/solo";

/** Le mystère remplace le contenu ; il conserve uniquement les réglages du joueur. */
export function choixMystere(choix: Choix): Choix {
  return { mode: "general", mystere: true, difficulte: choix.sens ? "DAY" : choix.difficulte,
    longueur: choix.longueur ?? 10, niveau: choix.niveau ?? NIVEAU_PAR_DEFAUT,
    ...(choix.sens ? { sens: choix.sens } : {}), ...(choix.periodes === false ? { periodes: false as const } : {}) };
}

export function choixGagnant(choix: Choix, gagnant: MysteryTheme): Choix {
  return { ...choixMystere(choix), mode: gagnant.mode,
    ...(gagnant.mode === "pack" ? { pack: gagnant.id } : { theme: gagnant.id }) };
}

export function destinationMystere(id: string, total: number, choix: Choix): string {
  return `/partie/${id}?n=${total}&c=${encodeURIComponent(ecrireChoix(choix))}`;
}

export type TirageMystere = { gagnant: MysteryTheme; candidats: MysteryTheme[]; choix: string; destination: string };

// Une bande déterministe : le résultat est déjà fixé, même après « Passer ».
export const INDEX_GAGNANT = 25;
export function bandeMystere(candidats: MysteryTheme[], gagnant: MysteryTheme): MysteryTheme[] {
  const liste = candidats.length ? candidats : [gagnant];
  return Array.from({ length: INDEX_GAGNANT + 5 }, (_, i) => i === INDEX_GAGNANT ? gagnant : liste[i % liste.length]);
}
