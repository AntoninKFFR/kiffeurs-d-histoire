// Passerelle entre le contrat du moteur serveur (src/lib/game/solo.ts) et l'écran de partie.
// Sans DOM, pour être testée. Aucun calcul de score ni de correction ici : le serveur fait foi.

import { phraseEcart, type HistoricDate, type Precision } from "./dates";
import type { SoloCorrection, SoloDate, SoloDateQuestion, SoloDifficulty, SoloInverseQuestion, SoloQuestion } from "./solo";

// Certains titres et descriptions du dataset commencent par une minuscule : l'écran les écrit avec une majuscule.
export const capitaliser = (texte: string) => (texte ? texte.charAt(0).toLocaleUpperCase("fr") + texte.slice(1) : texte);

const PRECISION: Record<SoloDifficulty, Precision> = { YEAR: "annee", MONTH: "mois", DAY: "jour" };
export const precisionDepuis = (d: SoloDifficulty): Precision => PRECISION[d];

export const dateDepuis = (d: SoloDate): HistoricDate => ({ year: d.year, month: d.month ?? null, day: d.day ?? null });

// Ce que l'écran montre après la réponse.
export type CorrectionAffichee = {
  bonne: HistoricDate;
  points: number;
  ecart: string | null;
  description: string | null;
  expiree: boolean;
  /** Question période (#94) : la vraie fin et l'écart sur la fin. `ecart` porte alors sur le début. */
  bonneFin?: HistoricDate;
  ecartFin?: string | null;
};

export function correctionDepuis(c: SoloCorrection): CorrectionAffichee {
  const affichee: CorrectionAffichee = {
    bonne: dateDepuis(c.correct_date),
    points: c.points,
    ecart: c.expired || c.gap == null ? null : phraseEcart(c.gap, PRECISION[c.unit]),
    description: c.description ? capitaliser(c.description) : c.description,
    expiree: c.expired,
  };
  if (c.direction !== "inverse" && c.periode && c.correct_end_date) {
    affichee.bonneFin = dateDepuis(c.correct_end_date);
    affichee.ecartFin = c.expired || c.end_gap == null ? null : phraseEcart(c.end_gap, PRECISION[c.unit]);
  }
  return affichee;
}

// Les illustrations sont dans le bucket public `histoire-illustrations`, nommées <événement>.svg.
export function urlIllustration(chemin: string | null, baseSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!chemin || !baseSupabase || !/^EVT-\d+\.svg$/.test(chemin)) return null;
  return `${baseSupabase.replace(/\/$/, "")}/storage/v1/object/public/histoire-illustrations/${chemin}`;
}

// Le serveur fait foi pour le chrono. L'horloge du navigateur peut avoir de l'avance ou du retard :
// on mesure son décalage avec `server_time` à l'arrivée de la question, puis on n'affiche que la durée restante.
export type Chrono = { finMs: number; totalMs: number };

export function chronoDepuis(q: Pick<SoloDateQuestion, "asked_at" | "deadline" | "server_time">, maintenantMs: number): Chrono {
  const decalage = maintenantMs - Date.parse(q.server_time);
  return { finMs: Date.parse(q.deadline) + decalage, totalMs: Date.parse(q.deadline) - Date.parse(q.asked_at) };
}

// Mode inversé : ce que l'écran montre après la réponse écrite.
export type CorrectionInverseAffichee = {
  correcte: boolean;
  bonne: HistoricDate;
  titre: string;
  points: number;
  description: string | null;
  expiree: boolean;
};

export function correctionInverseDepuis(c: SoloCorrection): CorrectionInverseAffichee {
  if (c.direction !== "inverse") throw new Error("Correction inattendue pour une question inversée");
  return {
    correcte: c.correct,
    bonne: dateDepuis(c.correct_date),
    titre: capitaliser(c.title),
    points: c.points,
    description: c.description ? capitaliser(c.description) : c.description,
    expiree: c.expired,
  };
}

export const estInverse = (q: SoloQuestion): q is SoloInverseQuestion => "date" in q;
