import type { SoloDifficulty } from "@/lib/game/solo";

// Progression d'un joueur dans le mode pédagogique, par chapitre du catalogue (THM-…).
export type ProgressionChapitre = {
  decouvert: boolean;
  /** Meilleure précision (0 à 100) d'un test de ce chapitre ; null = jamais testé. */
  precision: number | null;
  difficulte: SoloDifficulty | null;
  tests: number;
};
export type Progression = {
  /** true : lue dans le compte ; false : gardée dans le navigateur le temps de la session. */
  connecte: boolean;
  chapitres: Record<string, ProgressionChapitre>;
  historique?: {chapter_id:string;version:string;progression:ProgressionChapitre}[];
};

export const LIBELLE_DIFFICULTE: Record<SoloDifficulty, string> = { YEAR: "Année", MONTH: "Mois", DAY: "Jour" };

/** Un test de chapitre compte au moins 5 questions : en dessous, la précision ne dit rien. */
export const QUESTIONS_MIN_TEST = 5;

export type LigneProgression = {
  chapter_id: string;
  discovered_at: string | null;
  best_accuracy: number | string | null;
  best_difficulty: string | null;
  tests_count: number;
};

const estDifficulte = (v: unknown): v is SoloDifficulty => v === "YEAR" || v === "MONTH" || v === "DAY";

/** Lignes de `histoire.learning_progress` (RLS : celles du joueur seulement) vers la forme du navigateur. */
export function progressionDepuisLignes(lignes: LigneProgression[], idsConnus: ReadonlySet<string>): Record<string, ProgressionChapitre> {
  const chapitres: Record<string, ProgressionChapitre> = {};
  for (const l of lignes) {
    if (!idsConnus.has(l.chapter_id)) continue;
    const precision = l.best_accuracy == null ? null : Number(l.best_accuracy);
    chapitres[l.chapter_id] = {
      decouvert: l.discovered_at != null,
      precision: precision != null && Number.isFinite(precision) ? precision : null,
      difficulte: estDifficulte(l.best_difficulty) ? l.best_difficulty : null,
      tests: Number.isInteger(l.tests_count) && l.tests_count > 0 ? l.tests_count : 0,
    };
  }
  return chapitres;
}

/** Aucun résultat de l'édition initiale n'est présenté comme un acquis de la complétion. */
export function progressionParEditions(initiales:LigneProgression[],editions:(LigneProgression&{version:string})[],
  chapitres:{id:string;content_version:string;edition_active?:string}[]):Pick<Progression,"chapitres"|"historique"> {
  const connus=new Set(chapitres.map(c=>c.id)),active=progressionDepuisLignes(initiales,connus);
  const historique:NonNullable<Progression["historique"]>=[];
  for(const c of chapitres) {
    if(c.edition_active && active[c.id]) {
      historique.push({chapter_id:c.id,version:c.content_version,progression:active[c.id]});
      delete active[c.id];
    }
    for(const row of editions.filter(e=>e.chapter_id===c.id)) {
      const p=progressionDepuisLignes([row],connus)[c.id];
      if(row.version===c.edition_active) active[c.id]=p;
      else historique.push({chapter_id:c.id,version:row.version,progression:p});
    }
  }
  return {chapitres:active,...(historique.length?{historique}:{})};
}
