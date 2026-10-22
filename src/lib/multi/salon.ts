// Types et petites règles partagées des salons (#133, #134), utilisables côté serveur et navigateur.

/** Le jeton d'invité vit 24 h (comme côté SQL). */
export const DUREE_JETON_INVITE = 60 * 60 * 24;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cookieInvite(salonId: string): string {
  if (!UUID.test(salonId)) throw new Error("Identifiant de salon invalide");
  return `histoire-salon-${salonId.toLowerCase()}`;
}

/** « 14/07/1789 », « 14.07.1789 » ou « 14-07-1789 » → « 14/07/1789 » ; null si ce n'est pas une date. */
export function lireCodeSalon(saisie: string): string | null {
  const m = /^\s*(\d{1,2}) *[/.-] *(\d{1,2}) *[/.-] *(\d{4})\s*$/.exec(saisie);
  if (!m) return null;
  const [jour, mois, annee] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  date.setUTCFullYear(annee);
  if (date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) return null;
  return `${String(jour).padStart(2, "0")}/${String(mois).padStart(2, "0")}/${annee}`;
}

/** Même règle que histoire.refus_pseudo_invite, pour prévenir avant l'envoi (le serveur tranche). */
export function refusPseudoInvite(pseudo: string): string | null {
  const p = pseudo.trim().replace(/\s+/g, " ");
  if ([...p].length < 3 || [...p].length > 16) return "Pseudo : 3 à 16 caractères";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u.test(p)) return "Pseudo : lettres, chiffres, espaces, tirets, points et apostrophes seulement";
  return null;
}

export type MembreSalon = {
  id: string; pseudo: string; est_hote: boolean; invite: boolean; ordre: number;
  /** Arrivé pendant une partie : l'hôte l'accepte ou le refuse avant la suivante. */
  en_attente: boolean;
};

export type EtatSalon = {
  salon: {
    id: string; code: string; mode: "convivial" | "un_contre_un"; visibilite: "prive" | "ouvert";
    max_joueurs: number; etat: "attente" | "partie"; version: number; reglages: Reglages;
  };
  moi: string;
  membres: MembreSalon[];
};

export type ResultatBattement = { ok: true; version: number; heureServeur: number } | { ok: false; perdu: boolean };

export type ChoixContenu = "direct" | "mystere" | "vote" | "pick_ban";
export type Categorie = "pack" | "periode" | "theme";
export type CibleContenu = { type: Categorie; id: string };

/** Réglages tels que rendus par histoire.reglages_salon (toutes les clés présentes). */
export type Reglages = {
  questions: 5 | 10 | 20;
  precision: "YEAR" | "MONTH" | "DAY";
  questions_periode: boolean;
  mode_visible: boolean;
  mode_chrono: boolean;
  contenu: { choix: ChoixContenu; categories: Categorie[]; cible: CibleContenu | null };
};

export const PLACES_CONVIVIAL = [4, 6, 8, 10] as const;

export const LIBELLES_PRECISION: Record<Reglages["precision"], string> = { YEAR: "Année", MONTH: "Mois", DAY: "Jour" };
