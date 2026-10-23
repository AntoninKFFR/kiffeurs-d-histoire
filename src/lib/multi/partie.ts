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

/** Un contenu proposé au vote ou tiré par la roulette (#144). */
export type PropositionContenu = { type: "pack" | "periode" | "theme"; id: string; titre: string };

/** Vote en cours : les trois propositions, l'échéance et le vote de chacun (visible de tous). */
export type VotePartie = {
  propositions: PropositionContenu[];
  fin: string;
  duree: number;
  votes: { membre_id: string; choix: number }[];
};

/** Pick & ban du 1 contre 1 (#145) : les deux joueurs dans l'ordre des tours, les bans déjà faits, la fin du tour
 *  en cours (null une fois terminé : la proposition restante est jouée). */
export type PickBan = {
  propositions: PropositionContenu[];
  ordre: string[];
  duree: number;
  bans: { tour: number; membre_id: string | null; choix: number; hasard: boolean }[];
  tour_fin: string | null;
};

/** Roulette tirée par le serveur (Thème Mystère, ou égalité au vote) : la même pour tout le salon. */
export type TiragePartie = { candidats: PropositionContenu[]; gagnant: PropositionContenu; fin: string };

export type EtatPartie = {
  partie: {
    id: string; numero: number; etat: "vote" | "pick_ban" | "en_cours" | "terminee";
    contenu: { type?: string; id?: string; titre?: string; mystere?: boolean };
    precision: SoloDifficulty; mode_chrono: boolean; total: number;
    duree_question: number; duree_revelation: number;
    categories?: ("pack" | "periode" | "theme")[];
  };
  vote?: VotePartie | null;
  tirage?: TiragePartie | null;
  pick_ban?: PickBan | null;
  heure_serveur: number;
  moi: string;
  je_joue: boolean;
  question: QuestionMulti | null;
  prochaine: { position: number; posee_le: string } | null;
  scores: { membre_id: string; points: number }[];
};

/** Phase affichée : décompte avant une question, question ouverte, révélation, fin. */
export type Phase =
  | { type: "vote"; vote: VotePartie }
  | { type: "roulette"; tirage: TiragePartie; debutMs: number }
  /** Pick & ban en cours (debutMs null), puis le contenu retenu jusqu'à la première question. */
  | { type: "pickban"; pickBan: PickBan; debutMs: number | null }
  | { type: "decompte"; position: number; debutMs: number }
  | { type: "question"; question: QuestionMulti }
  | { type: "revelation"; question: QuestionMulti; suivanteMs: number | null }
  | { type: "fin" };

/** Ce que l'écran doit montrer à l'instant `maintenantServeur` (ms, heure du serveur). */
export function phaseDe(etat: EtatPartie, maintenantServeur: number): Phase {
  if (etat.partie.etat === "vote" && etat.vote) return { type: "vote", vote: etat.vote };
  if (etat.partie.etat === "pick_ban" && etat.pick_ban) return { type: "pickban", pickBan: etat.pick_ban, debutMs: null };
  const q = etat.question;
  if (!q && etat.pick_ban && etat.prochaine?.position === 1 && maintenantServeur < Date.parse(etat.prochaine.posee_le)) {
    return { type: "pickban", pickBan: etat.pick_ban, debutMs: Date.parse(etat.prochaine.posee_le) };
  }
  // Roulette (Mystère, égalité au vote) : elle tourne, puis montre le gagnant jusqu'à la première question.
  if (!q && etat.tirage && etat.prochaine?.position === 1 && maintenantServeur < Date.parse(etat.prochaine.posee_le)) {
    return { type: "roulette", tirage: etat.tirage, debutMs: Date.parse(etat.prochaine.posee_le) };
  }
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
  if (etat.vote) return Date.parse(etat.vote.fin);
  if (etat.pick_ban?.tour_fin) return Date.parse(etat.pick_ban.tour_fin);
  const q = etat.question;
  if (etat.prochaine) return Date.parse(etat.prochaine.posee_le);
  if (q && !q.revelee_le) return Date.parse(q.limite_le);
  return null;
}

export type LigneClassement = {
  membreId: string; points: number; rang: number; aValide: boolean;
  /** Révélation, une fois le classement mis à jour : points de la question (null : pas de réponse). */
  gain?: number | null;
  /** Places gagnées (positif) ou perdues (négatif) sur cette question. */
  mouvement?: number;
};

/** Révélation en trois temps (ms après la clôture) : les placements de chacun, puis la bonne date, puis le
 *  classement qui bouge. */
export const REVELATION_DATE = 1200;
export const REVELATION_CLASSEMENT = 2400;
export type EtapeRevelation = "placements" | "date" | "classement";

export function etapeRevelation(q: QuestionMulti, maintenantServeur: number): EtapeRevelation {
  const ecoule = maintenantServeur - Date.parse(q.revelee_le ?? "");
  return ecoule >= REVELATION_CLASSEMENT ? "classement" : ecoule >= REVELATION_DATE ? "date" : "placements";
}

/** Classement : points décroissants, ex æquo au même rang, puis l'ordre du serveur (ordre d'arrivée).
 *  Pendant la révélation, `etape` dit s'il faut encore montrer le classement d'avant la question. */
export function classement(etat: EtatPartie, etape?: EtapeRevelation): LigneClassement[] {
  const q = etat.question;
  const valides = new Set(q && !q.revelee_le ? q.ont_valide : []);
  const revelee = q?.revelee_le ? q : null;
  const gain = (id: string) => revelee?.reponses?.find((r) => r.membre_id === id)?.points ?? null;
  const ranger = (scores: { membre_id: string; points: number }[]) => {
    const tries = scores.map((s, i) => ({ ...s, i })).sort((a, b) => b.points - a.points || a.i - b.i);
    return tries.map((s) => ({ membreId: s.membre_id, points: s.points, rang: 1 + tries.filter((x) => x.points > s.points).length }));
  };
  const apres = ranger(etat.scores);
  if (!revelee || !etape) return apres.map((l) => ({ ...l, aValide: valides.has(l.membreId) }));
  const avant = ranger(etat.scores.map((s) => ({ ...s, points: s.points - (gain(s.membre_id) ?? 0) })));
  if (etape !== "classement") return avant.map((l) => ({ ...l, aValide: false }));
  // Places gagnées ou perdues dans la liste ; rien à la première question, quand tout le monde partait de 0.
  const departage = avant.some((a) => a.points > 0);
  return apres.map((l, i) => ({
    ...l, aValide: false, gain: gain(l.membreId),
    mouvement: departage ? avant.findIndex((a) => a.membreId === l.membreId) - i : 0,
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
    autres: (q.reponses ?? []).filter((x) => x.membre_id !== membreId).flatMap((x) => [versDate(x.debut), ...(x.fin ? [versDate(x.fin)] : [])]),
  };
}

/** La question s'est close avant la fin du chrono : tout le monde avait validé. */
export function closeAvantLaFin(q: QuestionMulti): boolean {
  return q.revelee_le != null && Date.parse(q.revelee_le) < Date.parse(q.limite_le);
}

/** Le mode chrono a raccourci la question : il reste au plus 10 s après la première réponse. */
export function chronoAccelere(etat: EtatPartie): boolean {
  const q = etat.question;
  if (!q || !etat.partie.mode_chrono) return false;
  return Date.parse(q.limite_le) - Date.parse(q.posee_le) < etat.partie.duree_question * 1000;
}

/** Votes reçus par chaque proposition, et le mien (null : pas encore voté). */
export function decompteVotes(vote: VotePartie, moi: string): { voix: string[][]; monChoix: number | null } {
  const voix = vote.propositions.map((_, i) => vote.votes.filter((v) => v.choix === i).map((v) => v.membre_id));
  return { voix, monChoix: vote.votes.find((v) => v.membre_id === moi)?.choix ?? null };
}

/** Bande de la roulette : les candidats à tour de rôle, le gagnant à l'index `arret`, quelques cartes après.
 *  Ses voisines ne sont jamais le gagnant (la bande aurait l'air de s'arrêter une carte trop tôt). */
export function bandeRoulette(tirage: TiragePartie, arret: number): PropositionContenu[] {
  const liste = tirage.candidats.length ? tirage.candidats : [tirage.gagnant];
  const n = liste.length;
  return Array.from({ length: arret + 4 }, (_, i) => {
    if (i === arret) return tirage.gagnant;
    const c = liste[i % n];
    return Math.abs(i - arret) === 1 && n > 1 && memeContenu(c, tirage.gagnant) ? liste[(i + 1) % n] : c;
  });
}

export const memeContenu = (a: PropositionContenu, b: PropositionContenu) => a.type === b.type && a.id === b.id;

/** Où en est le pick & ban : à qui le tour, ce qui reste, ce qui est retenu, qui a banni quoi. */
export function lirePickBan(pb: PickBan) {
  const bannis = new Map(pb.bans.map((b) => [b.choix, b]));
  const restantes = pb.propositions.map((_, i) => i).filter((i) => !bannis.has(i));
  const fini = restantes.length <= 1;
  return {
    bannis,
    restantes,
    retenue: fini ? restantes[0] ?? null : null,
    joueur: fini ? null : pb.ordre[pb.bans.length % 2] ?? null,
    bansDe: (membreId: string) => pb.bans.filter((b) => b.membre_id === membreId).length,
  };
}
