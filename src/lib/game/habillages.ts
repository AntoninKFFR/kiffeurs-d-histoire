// Habillages de frise propres à certaines périodes (#97).
// Un habillage est un petit jeu de réglages : un fond (couleur, trame, dégradé), un décor d'horizon
// posé sur la bande des époques et, pour la nuit, la variante sombre de la charte. Tout est en SVG léger
// (public/habillages/) et n'est chargé que quand une partie de la période est jouée.
// Aucun habillage ne dépend de la date : le décor est le même sur toute la frise, il ne donne aucun indice.

export type HabillageId = "tranchees" | "mosaique" | "espace";

export type Habillage = {
  id: HabillageId;
  nom: string;
  /** Période évoquée, pour l'aperçu et la documentation. */
  periode: string;
  /** Fond sombre : la frise passe en thème de nuit de la charte (texte clair), sans toucher aux boîtes posées dessus. */
  sombre: boolean;
  fond: {
    couleur: string;
    /** Valeur CSS de `background-image` (trame, dégradé). */
    image: string;
    taille: string;
    repetition: string;
  };
  /** Couleurs les plus défavorables sous les dates : le fond et ses trames les plus marquées (aplats, pas les traits de 1 px), pour le contrôle de contraste (tests). */
  fondsPires: string[];
  /** Décor d'horizon : tuile SVG répétée sur la largeur, en arrière-plan très discret au-dessus de la bande des époques. */
  horizon: { url: string; hauteur: number; tuile: number; opacite: number };
  /** Petit détail posé sur l'axe à chaque graduation (piquet, colonne, étoile) : la frise reste au premier plan. */
  detail: string;
  /** Où il s'applique, voir `habillageDe`. */
  packs: string[];
  themes: string[];
  periodes: string[];
  /** Un pack, thème ou chapitre dont les dates tiennent tout entières dans cette plage reçoit aussi l'habillage. */
  plage?: [number, number];
};

const DOSSIER = "/habillages";

export const HABILLAGES: Record<HabillageId, Habillage> = {
  // Grande Guerre : carte d'état-major jaunie, parapet de sacs de sable et barbelés.
  tranchees: {
    id: "tranchees",
    nom: "Tranchées",
    periode: "Première Guerre mondiale",
    sombre: false,
    fond: { couleur: "#e8dec3", image: `url(${DOSSIER}/tranchees-fond.svg)`, taille: "240px 240px", repetition: "repeat" },
    fondsPires: ["#e8dec3", "#ded2b5"], // le fond, puis sous la tache de trame la plus marquée
    horizon: { url: `${DOSSIER}/tranchees-horizon.svg`, hauteur: 110, tuile: 480, opacite: 0.4 },
    detail: `${DOSSIER}/tranchees-detail.svg`,
    packs: ["COL-0063"],
    themes: [],
    periodes: [],
    plage: [1900, 1935],
  },
  // Antiquité : tesselles de mosaïque, colonnade et frise de grecques.
  mosaique: {
    id: "mosaique",
    nom: "Mosaïque",
    periode: "Antiquité",
    sombre: false,
    fond: { couleur: "#efe4c6", image: `url(${DOSSIER}/mosaique-fond.svg)`, taille: "96px 96px", repetition: "repeat" },
    fondsPires: ["#efe4c6", "#e5d1b2", "#e2d4b4"], // le fond, puis sous les tesselles les plus marquées
    horizon: { url: `${DOSSIER}/mosaique-horizon.svg`, hauteur: 110, tuile: 400, opacite: 0.4 },
    detail: `${DOSSIER}/mosaique-detail.svg`,
    packs: ["COL-0078"],
    themes: [],
    periodes: ["antiquite"],
    plage: [-3500, 500],
  },
  // Conquête spatiale : ciel étoilé et horizon lunaire. Le pack « Espace » remonte à Galilée : on l'associe par son identifiant.
  espace: {
    id: "espace",
    nom: "Ciel étoilé",
    periode: "Conquête spatiale",
    sombre: true,
    fond: {
      couleur: "#0d1630",
      image: `url(${DOSSIER}/espace-fond.svg), linear-gradient(180deg, #080e24 0%, #14224a 100%)`,
      taille: "400px 400px, 100% 100%",
      repetition: "repeat, no-repeat",
    },
    fondsPires: ["#080e24", "#14224a"], // les deux bouts du dégradé du ciel
    horizon: { url: `${DOSSIER}/espace-horizon.svg`, hauteur: 110, tuile: 600, opacite: 0.55 },
    detail: `${DOSSIER}/espace-detail.svg`,
    packs: ["COL-0070"],
    themes: ["TAG-0130"],
    periodes: [],
  },
};

export const LISTE_HABILLAGES = Object.values(HABILLAGES);

export const estHabillage = (id: unknown): id is HabillageId => typeof id === "string" && id in HABILLAGES;

type ChoixPartie = { mode?: string; pack?: string; theme?: string; periode?: string };

/**
 * Habillage d'une partie, ou `null` (frise de la V1). Règle par défaut, en attendant les choix de l'issue #86 :
 * le pack, le thème ou la période jouée est celui de l'habillage, ou ses dates tiennent toutes dans sa plage.
 * Le Solo libre sur toute l'histoire et les parties qui couvrent plusieurs époques gardent la frise V1.
 */
export function habillageDe(choix: ChoixPartie | null | undefined, bornes: { debut: number; fin: number } | null | undefined): HabillageId | null {
  if (choix) {
    for (const h of LISTE_HABILLAGES) {
      if (choix.mode === "pack" && choix.pack && h.packs.includes(choix.pack)) return h.id;
      if (choix.mode === "theme" && choix.theme && h.themes.includes(choix.theme)) return h.id;
      if (choix.mode === "periode" && choix.periode && h.periodes.includes(choix.periode)) return h.id;
    }
  }
  if (!bornes) return null;
  return LISTE_HABILLAGES.find((h) => h.plage && bornes.debut >= h.plage[0] && bornes.fin <= h.plage[1])?.id ?? null;
}
