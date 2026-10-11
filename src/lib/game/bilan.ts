// Présentation du résultat serveur : aucun recalcul du score ni de l'écart.
import { aLaPrecision, phraseEcart, type HistoricDate, type Precision } from "./dates";
import { REGLAGES, versT, type Vue } from "./frise";
import { capitaliser, precisionDepuis } from "./partie";
import type { SoloResult } from "./solo";

export type ReponseBilan = {
  id: string; position: number; titre: string; precision: Precision;
  attendue: HistoricDate; dateJoueur: HistoricDate | null; texteJoueur: string | null;
  points: number; accuracy: number; exacte: boolean; expiree: boolean;
  etat: string; ecart: string | null;
  /** Question période (#94) : la vraie fin, celle du joueur et l'écart sur la fin. */
  periode?: { attendueFin: HistoricDate; dateJoueurFin: HistoricDate | null; ecartFin: string | null };
};

export function reponsesBilan(resultat: SoloResult): ReponseBilan[] {
  return resultat.questions.map((q) => {
    const precision = precisionDepuis(q.unit);
    const inverse = "correct" in q;
    const a = q.answer;
    const complete = typeof a === "object" && a !== null && a.year !== null && a.year !== 0
      && (precision === "annee" || a.month !== null)
      && (precision !== "jour" || a.day !== null);
    const dateJoueur = !q.expired && complete && typeof a === "object" && a !== null && a.year !== null
      ? aLaPrecision({ ...a, year: a.year }, precision) : null;
    const texteJoueur = !q.expired && typeof a === "string" && a.trim() ? a : null;
    const presente = inverse ? texteJoueur !== null : dateJoueur !== null;
    const exacte = !q.expired && presente && (inverse ? q.correct : q.gap === 0);
    const fin = "answer_end" in q ? q.answer_end : undefined;
    const finJoueur = fin && dateJoueur && fin.year !== null && fin.year !== 0
      && (precision === "annee" || fin.month !== null) && (precision !== "jour" || fin.day !== null)
      ? aLaPrecision({ ...fin, year: fin.year }, precision) : null;
    const periode = !inverse && q.periode && q.correct_end_date ? {
      attendueFin: aLaPrecision(q.correct_end_date, precision), dateJoueurFin: finJoueur,
      ecartFin: finJoueur && q.end_gap != null ? phraseEcart(q.end_gap, precision) : null,
    } : undefined;
    return {
      ...(periode ? { periode } : {}),
      id: q.question_id, position: q.position, titre: capitaliser(q.title), precision,
      attendue: aLaPrecision(q.correct_date, precision), dateJoueur, texteJoueur,
      points: q.points, accuracy: q.accuracy, exacte, expiree: q.expired,
      etat: q.expired ? "Temps écoulé" : !presente ? "Sans réponse"
        : periode ? (exacte && periode.ecartFin === null && finJoueur ? "Période exacte" : "Réponse incorrecte")
        : exacte ? "Réponse exacte" : "Réponse incorrecte",
      ecart: !inverse && presente && q.gap !== null ? phraseEcart(q.gap, precision) : null,
    };
  });
}

export function appreciation(points: number, maximum: number): string {
  const part = maximum > 0 ? points / maximum : 0;
  if (part < .35) return "L’Histoire continue.";
  if (part < .65) return "Vos repères prennent forme.";
  if (part < .9) return "Une belle traversée.";
  return "Une traversée remarquable.";
}

/** Cadre toutes les dates, y compris une réponse hors des bornes du gameplay. */
export function cadrerBilan(reponses: ReponseBilan[], precision: Precision, rapprochee = true): Vue {
  const ts = reponses.flatMap((q) => [versT(q.attendue), ...(q.dateJoueur ? [versT(q.dateJoueur)] : [])]);
  if (!ts.length) return { debut: 1, fin: 13 };
  const debut = Math.min(...ts), fin = Math.max(...ts);
  if (!rapprochee && fin > debut) return { debut, fin };
  const marge = Math.max((fin - debut) * .18, REGLAGES[precision].ecartMin / 2);
  return { debut: debut - marge, fin: fin + marge };
}

/** Regroupe les étiquettes selon leur largeur, même pour des dates identiques. */
export function groupesBilan(reponses: ReponseBilan[], vue: Vue, largeur: number, ecart: number) {
  const groupes: { t: number; indices: number[] }[] = [];
  const tries = reponses.map((q, i) => ({ t: versT(q.attendue), i })).sort((a, b) => a.t - b.t);
  for (const p of tries) {
    const groupe = groupes.at(-1);
    if (groupe && (p.t - groupe.t) * largeur / (vue.fin - vue.debut) < ecart) {
      groupe.t = (groupe.t * groupe.indices.length + p.t) / (groupe.indices.length + 1);
      groupe.indices.push(p.i);
    } else groupes.push({ t: p.t, indices: [p.i] });
  }
  // Les cibles se décalent aux bords. Fusionner celles que ce décalage rapprocherait.
  const centre = (t: number) => Math.max(ecart / 2, Math.min(largeur - ecart / 2, (t - vue.debut) / (vue.fin - vue.debut) * largeur));
  for (let i = 1; i < groupes.length;) {
    const a = groupes[i - 1], b = groupes[i];
    if (centre(b.t) - centre(a.t) < ecart) {
      a.t = (a.t * a.indices.length + b.t * b.indices.length) / (a.indices.length + b.indices.length);
      a.indices.push(...b.indices); groupes.splice(i, 1); i = Math.max(1, i - 1);
    } else i++;
  }
  return groupes;
}

export function raisonSansEcart(q: ReponseBilan, inverse: boolean): string | null {
  if (q.expiree) return "Temps écoulé : seule la date attendue est représentée.";
  if (inverse) return "En mode inversé, votre réponse est un événement : aucun écart de dates à représenter.";
  if (!q.dateJoueur) return "Aucune date complète donnée : seule la date attendue est représentée.";
  return null;
}
