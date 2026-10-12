import catalogue from "./structure.json";

export type Chapitre = Omit<(typeof catalogue)[number], "etat"> & { etat: "actif" | "historique" | "inactif" };
// Slugs figés et associés à THM, indépendants d'un index ou d'un futur libellé.
const REGISTRE: Chapitre[] = catalogue as Chapitre[];
/** Résolution des anciens liens, bilans, sessions et Rejouer ; jamais les brouillons. */
export const CHAPITRES = REGISTRE.filter(c => c.etat !== "inactif");
export const CHAPITRES_ACTIFS = CHAPITRES.filter(c => c.etat === "actif");
export const CHAPITRES_HISTORIQUES = CHAPITRES.filter(c => c.etat === "historique");
export const NIVEAUX = [...new Map(CHAPITRES.map((c) => [c.niveauSlug, { slug: c.niveauSlug, nom: c.niveau }])).values()];
export function cheminChapitre(c: Chapitre) {
  return `/apprendre/${c.niveauSlug}/${c.slug}`;
}
export function trouverChapitre(niveau: string, chapitre: string) {
  return CHAPITRES.find((c) => c.niveauSlug === niveau && c.slug === chapitre);
}

// Motifs existants de la charte : aucune jointure publique vers les événements.
export function motifChapitre(id: string): string {
  const n = Number((REGISTRE.find(c => c.id === id)?.parent_id ?? id).slice(4));
  if (n === 4) return "biface";
  if (n <= 6 || n === 17) return "colonne";
  if (n <= 10 || n === 18) return "donjon";
  if (n === 27 || n === 28 || n === 33 || n === 34) return "casque";
  if (n >= 37) return "globe";
  return "parchemin";
}
