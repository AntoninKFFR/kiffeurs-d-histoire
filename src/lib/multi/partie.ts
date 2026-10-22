// Partie Convivial (#140) : contrat de histoire.etat_partie et calculs d'affichage, sans DOM pour être testés.
// Le serveur arbitre tout (horaires, réponses, score) ; ici on ne fait que lire et présenter.
import { phraseEcart, type HistoricDate } from "@/lib/game/dates";
import { capitaliser, precisionDepuis } from "@/lib/game/partie";
import type { SoloDate, SoloDifficulty } from "@/lib/game/solo";
import type { Correction } from "@/components/partie/EcranPartie";

export type ReponseRevelee = {
  membre_id: string;
  debut: SoloDate;
  fin?: SoloDate;
  ecart?: number;
  ecart_fin?: number;
  unite?: SoloDifficulty;
  points: number;
};

export type QuestionMulti = {
  id: string;
  position: number;
  titre: string;
  image_path: string | null;
  periode: boolean;
  posee_le: string;
  limite_le: string;
  revelee_le: string | null;
  /** Qui a validé, dans l'ordre d'arrivée : jamais leurs réponses avant la clôture. */
  ont_valide: string[];
  /** Après la clôture seulement. */
  correction?: { debut: SoloDate; fin?: SoloDate; description?: string };
  reponses?: ReponseRevelee[];
};

export type EtatPartie = {
  partie: {
    id: string; numero: number; etat: "en_cours" | "terminee";
    contenu: { type?: string; id?: string; titre?: string; mystere?: boolean };
    precision: SoloDifficulty; mode_chrono: boolean; total: number;
    duree_question: number; duree_revelation: number;
  };
  heure_serveur: number;
  moi: string;
  je_joue: boolean;
  question: QuestionMulti | null;
  prochaine: { position: number; posee_le: string } | null;
  scores: { membre_id: string; points: number }[];
};

/** Phase affichée : décompte avant une question, question ouverte, révélation, fin. */
export type Phase =
  | { type: "decompte"; position: number; debutMs: number }
  | { type: "question"; question: QuestionMulti }
  | { type: "revelation"; question: QuestionMulti; suivanteMs: number | null }
  | { type: "fin" };

/** Ce que l'écran doit montrer à l'instant `maintenantServeur` (ms, heure du serveur). */
export function phaseDe(etat: EtatPartie, maintenantServeur: number): Phase {
  const q = etat.question;
  const prochaine = etat.prochaine ? Date.parse(etat.prochaine.posee_le) : null;
  if (prochaine != null && maintenantServeur >= prochaine) {
    // La question suivante a commencé : en attendant le nouvel état, on la montre en décompte terminé.
    return { type: "decompte", position: etat.prochaine!.position, debutMs: prochaine };
  }
  if (!q) return etat.prochaine ? { type: "decompte", position: etat.prochaine.position, debutMs: prochaine! } : { type: "fin" };
  if (!q.revelee_le) return { type: "question", question: q };
  if (etat.partie.etat === "terminee") {
    const finRevelation = Date.parse(q.revelee_le) + etat.partie.duree_revelation * 1000;
    return maintenantServeur < finRevelation ? { type: "revelation", question: q, suivanteMs: null } : { type: "fin" };
  }
  return { type: "revelation", question: q, suivanteMs: prochaine };
}

/** Prochain instant (heure du serveur) où l'état change sans action de personne : à redemander alors. */
export function prochainRendezVous(etat: EtatPartie): number | null {
  const q = etat.question;
  if (etat.prochaine) return Date.parse(etat.prochaine.posee_le);
  if (q && !q.revelee_le) return Date.parse(q.limite_le);
  return null;
}

export type LigneClassement = { membreId: string; points: number; rang: number; aValide: boolean };

/** Classement : points décroissants, ex æquo au même rang, puis l'ordre du serveur (ordre d'arrivée). */
export function classement(etat: EtatPartie): LigneClassement[] {
  const valides = new Set(etat.question && !etat.question.revelee_le ? etat.question.ont_valide : []);
  const tries = etat.scores.map((s, i) => ({ ...s, i })).sort((a, b) => b.points - a.points || a.i - b.i);
  return tries.map((s) => ({
    membreId: s.membre_id,
    points: s.points,
    rang: 1 + tries.filter((x) => x.points > s.points).length,
    aValide: valides.has(s.membre_id),
  }));
}

const versDate = (d: SoloDate): HistoricDate => ({ year: d.year, month: d.month ?? null, day: d.day ?? null });

/** Correction de l'écran de partie pour un joueur, une fois la question révélée. */
export function correctionPour(q: QuestionMulti, membreId: string): Correction | null {
  if (!q.correction) return null;
  const r = q.reponses?.find((x) => x.membre_id === membreId);
  const unite = precisionDepuis(r?.unite ?? "YEAR");
  return {
    bonne: versDate(q.correction.debut),
    bonneFin: q.correction.fin && versDate(q.correction.fin),
    points: r?.points ?? 0,
    ecart: r?.ecart != null ? phraseEcart(r.ecart, unite) : null,
    ecartFin: r?.ecart_fin != null ? phraseEcart(r.ecart_fin, unite) : null,
    description: q.correction.description ? capitaliser(q.correction.description) : null,
    expiree: !r,
  };
}

/** Le mode chrono a raccourci la question : il reste au plus 10 s après la première réponse. */
export function chronoAccelere(etat: EtatPartie): boolean {
  const q = etat.question;
  if (!q || !etat.partie.mode_chrono) return false;
  return Date.parse(q.limite_le) - Date.parse(q.posee_le) < etat.partie.duree_question * 1000;
}
