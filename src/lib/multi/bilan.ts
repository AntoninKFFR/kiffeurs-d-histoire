// Fin de partie (#143) : contrat de histoire.bilan_partie et faits marquants, sans DOM pour être testés.
import { formatHistoricDate, phraseEcart, type HistoricDate } from "@/lib/game/dates";
import { versT } from "@/lib/game/frise";
import { capitaliser, precisionDepuis } from "@/lib/game/partie";
import type { SoloDate, SoloDifficulty } from "@/lib/game/solo";

export type BilanPartie = {
  partie: { id: string; numero: number; contenu: { titre?: string }; precision: SoloDifficulty; total: number };
  questions: {
    position: number;
    titre: string;
    correction: { debut: SoloDate; fin?: SoloDate };
    reponses: { membre_id: string; debut: SoloDate; ecart?: number; unite?: SoloDifficulty; points: number; secondes: number }[];
  }[];
  scores: { membre_id: string; points: number }[];
};

export type Rang = { membreId: string; points: number; rang: number };

/** Classement final : points décroissants, ex æquo au même rang, puis l'ordre d'arrivée dans le salon. */
export function classementFinal(bilan: BilanPartie): Rang[] {
  const tries = bilan.scores.map((s, i) => ({ ...s, i })).sort((a, b) => b.points - a.points || a.i - b.i);
  return tries.map((s) => ({ membreId: s.membre_id, points: s.points, rang: 1 + tries.filter((x) => x.points > s.points).length }));
}

export type FaitMarquant = { membreId: string; titre: string; texte: string };

const date = (d: SoloDate): HistoricDate => ({ year: d.year, month: d.month ?? null, day: d.day ?? null });
const PILE = { annee: "à l'année près", mois: "au mois près", jour: "au jour près" } as const;

/** La meilleure réponse de la partie : le plus de points, puis la plus rapide. */
export function coupDeMaitre(bilan: BilanPartie): FaitMarquant | null {
  const toutes = bilan.questions.flatMap((q) => q.reponses.map((r) => ({ q, r })));
  const meilleur = toutes.sort((a, b) => b.r.points - a.r.points || a.r.secondes - b.r.secondes)[0];
  if (!meilleur || meilleur.r.points <= 0) return null;
  const unite = precisionDepuis(meilleur.r.unite ?? bilan.partie.precision);
  const s = Math.max(1, Math.round(meilleur.r.secondes));
  const precision = meilleur.r.ecart ? `à ${phraseEcart(meilleur.r.ecart, unite)} près` : PILE[unite];
  return { membreId: meilleur.r.membre_id, titre: capitaliser(meilleur.q.titre),
    texte: `${precision} en ${s} seconde${s > 1 ? "s" : ""}` };
}

/** Le plus gros raté : le moins de points, puis le plus grand écart. Rien si tout le monde a visé juste. */
export function plusGrosRate(bilan: BilanPartie): FaitMarquant | null {
  const toutes = bilan.questions.flatMap((q) => q.reponses.map((r) => ({ q, r })));
  const pire = toutes.sort((a, b) => a.r.points - b.r.points || (b.r.ecart ?? 0) - (a.r.ecart ?? 0))[0];
  if (!pire || !pire.r.ecart || toutes.length < 2) return null;
  const unite = precisionDepuis(pire.r.unite ?? bilan.partie.precision);
  const tard = versT(date(pire.r.debut)) > versT(date(pire.q.correction.debut));
  return { membreId: pire.r.membre_id, titre: capitaliser(pire.q.titre),
    texte: `en ${formatHistoricDate(date(pire.r.debut), precisionDepuis(bilan.partie.precision))} : ${phraseEcart(pire.r.ecart, unite)} trop ${tard ? "tard" : "tôt"}` };
}

export type HabillageFin = "musee" | "gazette";

/** Habillage de l'écran de fin : la gazette quand la partie portait surtout sur l'époque des journaux
 *  (année médiane des questions à partir de 1789), la salle de musée sinon. */
export function habillageFin(bilan: BilanPartie): HabillageFin {
  const annees = bilan.questions.map((q) => q.correction.debut.year).sort((a, b) => a - b);
  if (annees.length === 0) return "musee";
  return annees[Math.floor((annees.length - 1) / 2)] >= DEBUT_GAZETTE ? "gazette" : "musee";
}
const DEBUT_GAZETTE = 1789;

const ROMAINS: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
/** Rang en chiffres romains (I, II, III…), comme sur les socles. */
export function romain(n: number): string {
  let reste = n, texte = "";
  for (const [valeur, signe] of ROMAINS) while (reste >= valeur) { texte += signe; reste -= valeur; }
  return texte;
}
