import catalogue from "./catalogue.json";
import { PERIODES } from "./periodes";
import { CHAPITRES } from "@/lib/apprendre/catalogue";
import type { SoloDifficulty, SoloFilters, SoloNiveau } from "@/lib/game/solo";
import { DEBUT_FRISE, FIN_FRISE, type Vue } from "@/lib/game/frise";
import { QUESTIONS_MIN_TEST } from "@/lib/progression/types";

// Ce que le joueur choisit avant de lancer une partie (accueil, /solo, /scolaire, « Rejouer »).
// Le même choix voyage dans un formulaire, dans l'URL de la partie et dans le stockage local du navigateur.
export type Mode = "general" | "periode" | "pack" | "theme" | "scolaire";
export type Longueur = 5 | 10 | 20 | "tout";
export type Choix = {
  /** Le pack/thème résolu vient d'une roulette ; sa relance peut le conserver. */
  mystere?: true;
  /** `inverse` : le jeu donne la date, le joueur écrit l'événement. Absent = jeu de dates classique. */
  sens?: "inverse";
  mode: Mode;
  /** Précision demandée : l'année, le mois et l'année, ou le jour exact. */
  difficulte: SoloDifficulty;
  /** Absente dans les anciens choix : dix questions. Tout est résolu par le moteur. */
  longueur?: Longueur;
  /** Niveau des événements tirés (absent en mode scolaire, qui suit le programme). */
  niveau?: SoloNiveau;
  /** Expert exclusif, uniquement avec niveau 3 hors scolaire. */
  expertOnly?: true;
  periode?: string;
  /** Période libre, en années astronomiques (négatives avant J.-C.). */
  de?: number;
  a?: number;
  pack?: string;
  theme?: string;
  chapitres?: string[];
  /** Test d'un seul chapitre lancé depuis « Découvrir » : sa précision alimente la progression pédagogique. */
  test?: true;
  /** Questions « période » coupées (#94). Absent : activées, comme dans les anciens choix. */
  periodes?: false;
};
export type Comptes = Record<SoloDifficulty, number>;

export const QUESTIONS = 10;
export const DIFFICULTES: { valeur: SoloDifficulty; titre: string; aide: string }[] = [
  { valeur: "YEAR", titre: "Année", aide: "l'année" },
  { valeur: "MONTH", titre: "Mois", aide: "le mois et l'année" },
  { valeur: "DAY", titre: "Jour", aide: "le jour exact" },
];
export const NIVEAUX: { valeur: SoloNiveau; expertOnly?: true; titre: string; aide: string }[] = [
  { valeur: 1, titre: "Débutant", aide: "Les grandes dates" },
  { valeur: 2, titre: "Intermédiaire", aide: "Niveaux 1 et 2" },
  { valeur: 3, expertOnly: true, titre: "Expert", aide: "Niveau 3 seulement" },
  { valeur: 3, titre: "Toutes les questions", aide: "Tous les niveaux" },
];
export function libelleNiveau(choix: Pick<Choix, "niveau" | "expertOnly">): string | undefined {
  return NIVEAUX.find(n => n.valeur === choix.niveau && Boolean(n.expertOnly) === Boolean(choix.expertOnly))?.titre;
}
/** Niveau d'une ancienne URL ou d'un ancien choix mémorisé, qui n'en avaient pas. */
export const NIVEAU_PAR_DEFAUT: SoloNiveau = 1;

export const PACKS = catalogue.packs;
export const THEMES = catalogue.themes;
export { PERIODES, CHAPITRES };

const MODES: Mode[] = ["general", "periode", "pack", "theme", "scolaire"];
const estNiveau = (v: number): v is SoloNiveau => v === 1 || v === 2 || v === 3;
const estDifficulte = (v: unknown): v is SoloDifficulty => v === "YEAR" || v === "MONTH" || v === "DAY";
const annee = (v: string | null) => {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n !== 0 && Math.abs(n) <= 100000 ? n : null;
};

/**
 * Lit un choix depuis des champs de formulaire ou de l'URL, en n'acceptant que des valeurs connues.
 * Renvoie `null` si le choix est incomplet ou inventé.
 */
export function lireChoix(champs: URLSearchParams): Choix | null {
  const mode = champs.get("mode") as Mode;
  const difficulte = champs.get("difficulte");
  if (!MODES.includes(mode) || !estDifficulte(difficulte)) return null;
  const choix: Choix = { mode, difficulte };
  if (champs.get("mystere") === "1") {
    if (!["general", "pack", "theme"].includes(mode)) return null;
    choix.mystere = true;
  }
  const longueur = champs.get("longueur");
  if (longueur !== null) {
    if (!["5", "10", "20", "tout"].includes(longueur)) return null;
    choix.longueur = longueur === "tout" ? "tout" : Number(longueur) as 5 | 10 | 20;
  }
  if (champs.get("periodes") === "0") choix.periodes = false;
  if (mode !== "scolaire") {
    const niveau = champs.get("niveau");
    if (niveau == null) choix.niveau = NIVEAU_PAR_DEFAUT;
    else if (estNiveau(Number(niveau))) choix.niveau = Number(niveau) as SoloNiveau;
    else return null;
  }
  const expertOnly = champs.get("expertOnly");
  if (expertOnly !== null && !["1", "true", "0", "false"].includes(expertOnly)) return null;
  if (expertOnly === "1" || expertOnly === "true") {
    if (mode === "scolaire" || choix.niveau !== 3) return null;
    choix.expertOnly = true;
  }
  // Inversé : seule la date exacte donne une question sans ambiguïté (plusieurs événements partagent une année).
  if (champs.get("sens") === "inverse") {
    choix.sens = "inverse";
    choix.difficulte = "DAY";
    // Pas de question période en inversé : l'option n'a pas de sens.
    delete choix.periodes;
  }
  if (mode === "periode") {
    const periode = champs.get("periode");
    if (periode && periode !== "libre") {
      if (!PERIODES.some((p) => p.id === periode)) return null;
      choix.periode = periode;
    } else {
      const de = annee(champs.get("de"));
      const a = annee(champs.get("a"));
      if (de === null || a === null || (de === undefined && a === undefined)) return null;
      if (de !== undefined && a !== undefined && de > a) return null;
      choix.periode = "libre";
      if (de !== undefined) choix.de = de;
      if (a !== undefined) choix.a = a;
    }
  }
  if (mode === "pack") {
    const pack = champs.get("pack");
    // Le catalogue vivant peut contenir des sous-packs absents du dataset local.
    // La base valide existence, activité et périmètre au décompte et au lancement.
    if (!pack || !/^[\w-]{1,80}$/.test(pack)) return null;
    choix.pack = pack!;
  }
  if (mode === "theme") {
    const theme = champs.get("theme");
    if (!THEMES.some((t) => t.id === theme) && !(choix.mystere && theme && /^[\w-]{1,80}$/.test(theme))) return null;
    choix.theme = theme!;
  }
  if (mode === "scolaire") {
    const ids = new Set(champs.getAll("chapitres").flatMap((c) => c.split(",")));
    const chapitres = CHAPITRES.filter((c) => ids.has(c.id)).map((c) => c.id);
    if (chapitres.length === 0) return null;
    choix.chapitres = chapitres;
    // Test de chapitre : un seul chapitre, jeu de dates, assez de questions jouables pour que la précision veuille dire quelque chose.
    if (champs.get("test") === "chapitre" && chapitres.length === 1 && !choix.sens) {
      const jouables = comptesDe({ ...choix, test: true })?.[difficulte];
      if (jouables != null && jouables < QUESTIONS_MIN_TEST) return null;
      choix.test = true;
    }
  }
  return choix;
}

/** Forme compacte du choix, pour l'URL de la partie (bouton « Rejouer ») et le stockage local. */
export function ecrireChoix(choix: Choix): string {
  const p = new URLSearchParams({ mode: choix.mode, difficulte: choix.difficulte });
  if (choix.mystere) p.set("mystere", "1");
  if (choix.longueur !== undefined) p.set("longueur", String(choix.longueur));
  if (choix.sens) p.set("sens", choix.sens);
  if (choix.niveau) p.set("niveau", String(choix.niveau));
  if (choix.expertOnly) p.set("expertOnly", "1");
  if (choix.periode) p.set("periode", choix.periode);
  if (choix.de != null) p.set("de", String(choix.de));
  if (choix.a != null) p.set("a", String(choix.a));
  if (choix.pack) p.set("pack", choix.pack);
  if (choix.theme) p.set("theme", choix.theme);
  if (choix.chapitres?.length) p.set("chapitres", choix.chapitres.join(","));
  if (choix.test) p.set("test", "chapitre");
  if (choix.periodes === false) p.set("periodes", "0");
  return p.toString();
}

/** Filtres passés à la RPC `start_game`. */
export function filtresDepuis(choix: Choix): SoloFilters {
  const f: SoloFilters = { difficulty: choix.difficulte, questionCount: choix.longueur === "tout" ? 0 : choix.longueur ?? QUESTIONS };
  if (choix.mystere) f.mystery = true;
  if (choix.sens === "inverse") f.direction = "inverse";
  if (choix.periodes === false) f.periods = false;
  if (choix.niveau) f.niveau = choix.niveau;
  if (choix.expertOnly) f.expertOnly = true;
  if (choix.mode === "periode") {
    const p = PERIODES.find((x) => x.id === choix.periode);
    const de = p ? p.de : choix.de;
    const a = p ? p.a : choix.a;
    if (de != null) f.yearMin = de;
    if (a != null) f.yearMax = a;
  }
  if (choix.mode === "pack") f.packId = choix.pack;
  if (choix.mode === "theme") f.tagId = choix.theme;
  if (choix.mode === "scolaire") f.chapterIds = choix.chapitres;
  // Un chapitre peut compter moins de 10 cartes jouables : le test s'adapte (5 questions au minimum).
  if (choix.test) {
    f.chapterTest = true;
    f.questionCount = Math.min(QUESTIONS, comptesDe(choix)?.[choix.difficulte] ?? QUESTIONS);
  }
  return f;
}

/**
 * Nombre d'événements jouables par difficulté pour ce choix, d'après le dataset.
 * `null` quand on ne sait pas d'avance (période libre, chapitres) : le serveur tranchera.
 */
export function comptesDe(choix: Pick<Choix, "mode" | "periode" | "pack" | "theme" | "chapitres" | "test" | "niveau" | "expertOnly">): Comptes | null {
  // Les dates distinctes Expert ne se déduisent pas de comptes cumulatifs : seule la RPC sait.
  if (choix.expertOnly) return null;
  // Test de chapitre : seulement les événements des cartes apprises.
  if (choix.test && choix.chapitres?.length === 1) return CHAPITRES_JOUABLES[choix.chapitres[0]]?.t ?? null;
  // Décomptes cumulés par niveau : [Débutant, Intermédiaire, Toutes les questions].
  const i = (choix.niveau ?? NIVEAU_PAR_DEFAUT) - 1;
  if (choix.mode === "general") return catalogue.general[i];
  if (choix.mode === "periode") return (catalogue.periodes as Record<string, Comptes[]>)[choix.periode ?? ""]?.[i] ?? null;
  if (choix.mode === "pack") return PACKS.find((p) => p.id === choix.pack)?.n[i] ?? null;
  if (choix.mode === "theme") return THEMES.find((t) => t.id === choix.theme)?.n[i] ?? null;
  if (choix.mode === "scolaire" && choix.chapitres?.length) {
    // Somme des chapitres : un plafond (un événement peut servir deux chapitres), le serveur tranche au-dessus.
    const n: Comptes = { YEAR: 0, MONTH: 0, DAY: 0 };
    for (const id of choix.chapitres) {
      const c = CHAPITRES_JOUABLES[id]?.n;
      if (c) for (const d of ["YEAR", "MONTH", "DAY"] as const) n[d] += c[d];
    }
    return n;
  }
  return null;
}

// n/b : tous les événements du chapitre ; t/tb : ceux de ses cartes pédagogiques (le test de chapitre).
const CHAPITRES_JOUABLES = catalogue.chapitres as Record<string, { n: Comptes; b: number[]; t: Comptes; tb: number[] }>;
const versAstro = (annee: number) => (annee < 0 ? annee + 1 : annee);

/**
 * Étendue de la frise pour ce choix (positions `t`, années astronomiques), à 10 ans près autour des
 * événements possibles. `null` : toute l'histoire.
 */
export function bornesDe(choix: Choix): Vue | null {
  let b: number[] | undefined;
  if (choix.mode === "periode" && choix.periode === "libre") {
    b = [choix.de != null ? versAstro(choix.de) - 10 : DEBUT_FRISE, choix.a != null ? versAstro(choix.a) + 11 : FIN_FRISE];
  } else if (choix.mode === "periode") b = (catalogue.bornesPeriodes as Record<string, number[]>)[choix.periode ?? ""];
  else if (choix.mode === "pack") b = PACKS.find((p) => p.id === choix.pack)?.b;
  else if (choix.mode === "theme") b = THEMES.find((t) => t.id === choix.theme)?.b;
  else if (choix.mode === "scolaire") {
    const liste = (choix.chapitres ?? []).flatMap((id) => (choix.test ? CHAPITRES_JOUABLES[id]?.tb : CHAPITRES_JOUABLES[id]?.b) ?? []);
    if (liste.length) b = [Math.min(...liste), Math.max(...liste)];
  }
  if (!b) return null;
  const debut = Math.max(DEBUT_FRISE, b[0]);
  const fin = Math.min(FIN_FRISE, b[1]);
  if (fin - debut < 30) {
    const milieu = (debut + fin) / 2;
    return { debut: Math.max(DEBUT_FRISE, milieu - 15), fin: Math.min(FIN_FRISE, milieu + 15) };
  }
  return debut <= DEBUT_FRISE && fin >= FIN_FRISE ? null : { debut, fin };
}

/** Un niveau est proposé s'il remplit une partie dans au moins une précision. */
export function niveauPossible(choix: Pick<Choix, "mode" | "periode" | "pack" | "theme">, niveau: SoloNiveau, precisions: SoloDifficulty[] = ["YEAR", "MONTH", "DAY"]): boolean {
  const comptes = comptesDe({ ...choix, niveau });
  return precisions.some((d) => difficultePossible(comptes, d));
}

/** Une difficulté est proposée s'il y a de quoi remplir une partie (ou si on ne peut pas le savoir). */
export function difficultePossible(comptes: Comptes | null, d: SoloDifficulty): boolean {
  return comptes == null || comptes[d] >= QUESTIONS;
}

/** Décompte exact fourni par la RPC, jamais une somme du catalogue. */
export function nombreQuestions(longueur: Longueur, disponibles: number | null): number | null {
  if (disponibles === null) return null;
  if (longueur === "tout") return disponibles > 0 ? Math.min(100, disponibles) : null;
  return disponibles >= longueur ? longueur : null;
}

/** Filtres enregistrés par le moteur, pour un bilan rouvert sans URL de lancement. */
export function relanceEnregistree(f: SoloFilters | null | undefined): string | null {
  if (!f) return null;
  const longueur: Longueur = f.questionCount === 0 ? "tout"
    : f.questionCount === 5 || f.questionCount === 20 ? f.questionCount
    : f.questionCount === 100 ? "tout" : 10;
  const mode: Mode = f.chapterIds?.length ? "scolaire" : f.packId ? "pack"
    : f.tagId ? "theme" : f.yearMin != null || f.yearMax != null ? "periode" : "general";
  const choix: Choix = { mode, difficulte: f.difficulty ?? "YEAR", longueur,
    ...(f.expertOnly === true ? { expertOnly: true as const } : {}),
    ...(f.mystery && (mode === "pack" || mode === "theme") ? { mystere: true as const } : {}),
    ...(mode !== "scolaire" ? { niveau: f.niveau ?? 3 } : {}),
    ...(f.direction === "inverse" ? { sens: "inverse" } : {}),
    ...(mode === "periode" ? { periode: "libre", de: f.yearMin, a: f.yearMax } : {}),
    ...(f.packId ? { pack: f.packId } : {}), ...(f.tagId ? { theme: f.tagId } : {}),
    ...(f.chapterIds ? { chapitres: f.chapterIds } : {}), ...(f.chapterTest ? { test: true } : {}),
    ...(f.periods === false ? { periodes: false as const } : {}) };
  const valide = lireChoix(new URLSearchParams(ecrireChoix(choix)));
  return valide ? ecrireChoix(valide) : null;
}
