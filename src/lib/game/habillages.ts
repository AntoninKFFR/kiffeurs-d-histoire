// Habillages de frise propres à certaines périodes (#97).
// Un habillage est un petit jeu de réglages : un fond (couleur, trame, grande scène très pâle qui remplit tout l'écran)
// et les couleurs de la frise (axe, dates, époques) : thème de nuit pour l'espace, teintes propres à la période sinon. Rien n'est posé sur la frise elle-même. Tout est en SVG léger
// (public/habillages/) et n'est chargé que quand une partie de la période est jouée.
// Aucun habillage ne dépend de la date : le décor est le même sur toute la frise, il ne donne aucun indice.

export type HabillageId = "tranchees" | "mosaique" | "espace";

export type Habillage = {
  id: HabillageId;
  nom: string;
  /** Période évoquée, pour l'aperçu et la documentation. */
  periode: string;
  /** Fond sombre : la frise et la bande des époques passent en thème de nuit de la charte (texte clair), sans toucher aux boîtes posées dessus. */
  sombre: boolean;
  /** Couleurs de la frise et de la bande des époques propres à l'habillage (variables de la charte redéfinies, thème clair). Vide pour le thème de nuit. */
  palette: Record<string, string>;
  fond: {
    couleur: string;
    /** Valeur CSS de `background-image` : la scène plein écran d'abord (dessus), puis la trame et le dégradé. */
    image: string;
    taille: string;
    repetition: string;
    position: string;
  };
  /** Couleurs les plus défavorables sous les dates : le fond, la trame et la scène à leur plus marqué (aplats, pas les traits fins), pour le contrôle de contraste (tests). */
  fondsPires: string[];
  /** Où il s'applique, voir `habillageDe`. */
  packs: string[];
  themes: string[];
  periodes: string[];
  /** Un pack, thème ou chapitre dont les dates tiennent tout entières dans cette plage reçoit aussi l'habillage. */
  plage?: [number, number];
};

const DOSSIER = "/habillages";

export const HABILLAGES: Record<HabillageId, Habillage> = {
  // Grande Guerre : carte d'état-major jaunie, ciel de fumée, avions, crêtes dévastées et barbelés.
  tranchees: {
    id: "tranchees",
    nom: "Tranchées",
    periode: "Première Guerre mondiale",
    sombre: false,
    // Sépia et kaki : encre brune, époques en teintes de boue, d'ocre et d'olive. Le rouge coquelicot reste celui de la charte.
    palette: {
      "--color-encre": "#3a2d1f",
      "--color-encre-douce": "#5a4a35",
      "--color-epoque-prehistoire": "#d6cfb0",
      "--color-epoque-antiquite": "#dfca98",
      "--color-epoque-moyen-age": "#cdd1a6",
      "--color-epoque-temps-modernes": "#dcbea0",
      "--color-epoque-contemporaine": "#c8c6b2",
    },
    fond: {
      couleur: "#efe6cd",
      image: `url(${DOSSIER}/tranchees-scene.svg), url(${DOSSIER}/tranchees-fond.svg)`,
      taille: "cover, 240px 240px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#efe6cd", "#decfae"], // le fond, puis les grands aplats de la scène et de la trame (mesurés, voir docs/habillages.md)
    packs: ["COL-0063"],
    themes: [],
    periodes: [],
    plage: [1900, 1935],
  },
  // Antiquité : tesselles de mosaïque, temple, mer, olivier, trirème et frise de grecques.
  mosaique: {
    id: "mosaique",
    nom: "Mosaïque",
    periode: "Antiquité",
    sombre: false,
    // Terre cuite : encre brun-rouge, époques en ocre, terre cuite et turquoise passé.
    palette: {
      "--color-encre": "#4a2a1b",
      "--color-encre-douce": "#6a4430",
      "--color-epoque-prehistoire": "#dccfb2",
      "--color-epoque-antiquite": "#ecc48c",
      "--color-epoque-moyen-age": "#c6d3c0",
      "--color-epoque-temps-modernes": "#e6b9a0",
      "--color-epoque-contemporaine": "#b9cfce",
    },
    fond: {
      couleur: "#f5ecd2",
      image: `url(${DOSSIER}/mosaique-scene.svg), url(${DOSSIER}/mosaique-fond.svg)`,
      taille: "cover, 96px 96px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#f5ecd2", "#ddceaf"], // le fond, puis les grands aplats de la scène et des tesselles (mesurés)
    packs: ["COL-0078"],
    themes: [],
    periodes: ["antiquite"],
    plage: [-3500, 500],
  },
  // Conquête spatiale : ciel étoilé, Terre qui se lève sur la Lune, fusée et satellite. Le pack « Espace » remonte à Galilée : on l'associe par son identifiant.
  espace: {
    id: "espace",
    nom: "Ciel étoilé",
    periode: "Conquête spatiale",
    sombre: true,
    palette: {},
    fond: {
      couleur: "#0d1630",
      image: `url(${DOSSIER}/espace-scene.svg), url(${DOSSIER}/espace-fond.svg), linear-gradient(180deg, #080e24 0%, #14224a 100%)`,
      taille: "cover, 400px 400px, 100% 100%",
      repetition: "no-repeat, repeat, no-repeat",
      position: "center bottom, 0 0, 0 0",
    },
    fondsPires: ["#080e24", "#282354"], // le bas du ciel, puis les nébuleuses les plus claires (mesurés)
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
