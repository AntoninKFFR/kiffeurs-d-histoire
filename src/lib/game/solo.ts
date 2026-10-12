// Contrat des RPC solo. Le calcul et les transitions restent entièrement en SQL.
export type SoloDifficulty = "YEAR" | "MONTH" | "DAY";
export type SoloDirection = "date" | "inverse";
/** Contrat cumulatif : 1, 1+2, 1+2+3. Expert exclusif exige expertOnly en plus de 3. */
export type SoloNiveau = 1 | 2 | 3;
export type SoloFilters = {
  /** Tirage mystère, ou relance du gagnant si packId/tagId est fourni. */
  mystery?: boolean;
  /** Libellé de l'instantané serveur, rendu seulement au bilan. */
  mysteryLabel?: string;
  direction?: SoloDirection;
  packId?: string;
  tagId?: string;
  yearMin?: number;
  yearMax?: number;
  levelId?: string;
  chapterIds?: string[];
  difficulty?: SoloDifficulty;
  /** Absent : aucun filtre de niveau (mode scolaire). */
  niveau?: SoloNiveau;
  /** Niveau 3 exclusivement ; absent/false : contrat cumulatif historique. */
  expertOnly?: boolean;
  questionCount?: number;
  // questionCount = 0 : « Tout », résolu atomiquement en 1 à 100 par start_game (#93).
  /** Test d'un chapitre : le serveur ne tire que parmi les événements de ses cartes pédagogiques. */
  chapterTest?: boolean;
  chapterVersion?: string;
  /** Questions « période » (début et fin, #94). Absent : activées. Sans effet en inversé et en test. */
  periods?: boolean;
};
/** Façon dont une réponse datée a été donnée (indicateurs #26). Pas de calendrier en V1. */
export type MethodeSaisie = "frise" | "clavier" | "calendrier";
export type SoloDate = { year: number; month?: number | null; day?: number | null };
export type SoloGame = {
  mystery?: { winner: MysteryTheme; candidates: MysteryTheme[] };
  game_id: string;
  question_count: number;
  difficulty: SoloDifficulty;
  direction: SoloDirection;
  state: "playing";
  anonymous: boolean;
};
export type MysteryTheme = { mode: "pack" | "theme"; id: string; titre: string };
type QuestionTiming = {
  /** Longueur réelle en base ; optionnelle pour les anciennes réponses RPC. */
  question_count?: number;
  question_id: string;
  position: number;
  difficulty: SoloDifficulty;
  asked_at: string;
  deadline: string;
  server_time: string;
};
/** `periode` : le joueur donne le début et la fin (#94). Aucune date n'est envoyée avant la réponse. */
export type SoloDateQuestion = QuestionTiming & { title: string; image_path: string | null; periode?: true };
export type SoloInverseQuestion = QuestionTiming & {
  date: SoloDate;
  date_label: string;
  date_precision: SoloDifficulty;
};
// La présence de `date` distingue la question inverse, sans titre ni illustration.
export type SoloQuestion = SoloDateQuestion | SoloInverseQuestion;
type CorrectionDetails = {
  question_id: string;
  correct_date: SoloDate;
  gap: number | null;
  unit: SoloDifficulty;
  accuracy: number;
  points: number;
  expired: boolean;
  description: string | null;
};
/** Clés ajoutées à la correction d'une question période (#94). Score = moyenne du début et de la fin. */
export type CorrectionPeriode = {
  periode: true;
  correct_end_date: SoloDate;
  end_gap: number | null;
  start_accuracy: number | null;
  end_accuracy: number | null;
};
export type SoloDateCorrection = CorrectionDetails & { direction?: "date" } & Partial<CorrectionPeriode>;
export type SoloInverseCorrection = CorrectionDetails & { direction: "inverse"; title: string; correct: boolean };
export type SoloCorrection = SoloDateCorrection | SoloInverseCorrection;
type ReponseDate = { year: number | null; month: number | null; day: number | null };
type ResultDetails = {
  /** Instantané privé de lancement, disponible seulement au bilan (#93). Anciens jeux : null. */
  replay_filters?: SoloFilters | null;
  game_id: string;
  state: "finished";
  question_count: number;
  average_accuracy: number;
  total_points: number;
};
export type SoloResult = ResultDetails & (
  { direction: "date"; questions: (SoloDateCorrection & { position: number; title: string; answer: ReponseDate; answer_end?: ReponseDate })[] }
  | { direction: "inverse"; questions: (SoloInverseCorrection & { position: number; answer: string | null })[] }
);
