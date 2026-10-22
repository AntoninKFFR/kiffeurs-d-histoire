export type ModeProfil =
  "solo_libre" | "solo_scolaire" | "solo_date" | "inverse";
export type PartieHistorique = {
  id: string;
  finished_at: string;
  mode: ModeProfil;
  difficulty: "YEAR" | "MONTH" | "DAY";
  question_count: number;
  total_points: number;
  average_accuracy: number;
  pack: string | null;
  theme: string | null;
  level: string | null;
  chapters: { label: string; level: string }[];
};
export type Historique = {
  games: PartieHistorique[];
  next_cursor: string | null;
};
export type PerformanceMode = {
  mode: ModeProfil;
  games: number;
  average_accuracy: number;
  average_score: number;
  best_score: number;
  average_points_per_question?: number;
  best_points_per_question?: number;
};
export type PerformanceContexte = {
  kind: "pack" | "theme" | "chapter";
  label: string;
  level: string | null;
  games: number;
  average_accuracy: number;
  best_score: number;
  best_points_per_question?: number;
};
export type PointPrecision = {
  month: string;
  games: number;
  average_accuracy: number;
};
export type Statistiques = {
  games: number;
  average_accuracy: number | null;
  average_score: number | null;
  best_score: number | null;
  average_points_per_question?: number | null;
  best_points_per_question?: number | null;
  modes: PerformanceMode[];
  contexts: PerformanceContexte[];
  accuracy_over_time: PointPrecision[];
  games_without_context: number;
};
export type StatsMulti = { parties: number; victoires: number };
export const MODES_PROFIL: Record<ModeProfil, string> = {
  solo_libre: "Solo libre",
  solo_scolaire: "Solo scolaire",
  solo_date: "Solo · datation",
  inverse: "Mode inversé",
};
export const nombre = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
        value,
      );
export const pourcentage = (value: number | null) =>
  value === null ? "—" : `${nombre(value)} %`;
export const datePartie = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
export const mois = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
export function cursorValide(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}
