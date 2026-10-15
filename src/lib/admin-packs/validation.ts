import type { NewEvent, SearchFilters } from "./types";

const entier = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
export function rechercheValide(f: SearchFilters): boolean {
  return !!f && typeof f.query === "string" && f.query.length <= 500 && (f.niveau === null || entier(f.niveau, 1, 3))
    && [f.yearMin, f.yearMax].every((n) => n === null || (entier(n, -1000000, 1000000) && n !== 0))
    && (f.yearMin === null || f.yearMax === null || f.yearMin <= f.yearMax) && entier(f.page, 0, 100000);
}
function dateValide(year: number | null, month: number | null, day: number | null): boolean {
  if (year === null) return month === null && day === null;
  if (!entier(year, -1000000, 1000000) || year === 0 || (month !== null && !entier(month, 1, 12))) return false;
  if (day === null) return true;
  if (month === null || !entier(day, 1, 31)) return false;
  const y = year < 0 ? year + 1 : year;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function erreurEvenement(e: NewEvent): string | null {
  if (!e || typeof e.title !== "string" || !e.title.trim() || e.title.trim().length > 500 || /[\u0000-\u001f\u007f]/.test(e.title)
    || typeof e.description !== "string" || !e.description.trim() || e.description.trim().length > 3000
    || !entier(e.niveau, 1, 3) || !["event", "film"].includes(e.kind)
    || !["EXACT", "CONVENTIONAL", "TRADITIONAL", "APPROXIMATE", "DISPUTED"].includes(e.date_status)) return "Vérifiez le titre, la description, le niveau et le statut historique.";
  if (typeof e.territory !== "string" || e.territory.length > 150 || /[\u0000-\u001f\u007f]/.test(e.territory) || (e.kind === "film" && !e.territory.trim())) return "Précisez le territoire de sortie du film.";
  if (e.kind === "film" && `${e.title.trim()} (sortie : ${e.territory.trim()})`.length > 500) return "Le titre avec son territoire dépasse 500 caractères.";
  if (typeof e.date_text !== "string" || e.date_text.length > 500 || !dateValide(e.start_year, e.start_month, e.start_day)
    || !dateValide(e.end_year, e.end_month, e.end_day)) return "Vérifiez les dates : aucune année zéro, mois et jours réels uniquement.";
  if (e.start_year === null && (e.end_year !== null || !e.date_text.trim() || e.kind === "film")) return "Renseignez une année ou une période textuelle (non jouable).";
  if (e.start_year !== null && e.end_year !== null) {
    const a = [e.start_year, e.start_month ?? 1, e.start_day ?? 1];
    const b = [e.end_year, e.end_month ?? 1, e.end_day ?? 1];
    if ((b[0] - a[0] || b[1] - a[1] || b[2] - a[2]) < 0) return "La fin ne peut pas précéder le début.";
  }
  if (!Array.isArray(e.sources) || e.sources.length < 1 || e.sources.length > 10
    || e.sources.some((s) => typeof s !== "string" || s.trim().length < 8 || s.trim().length > 2000 || /[\u0000-\u001f\u007f]/.test(s))) return "Ajoutez une à dix sources : URL ou référence documentaire complète.";
  return null;
}
