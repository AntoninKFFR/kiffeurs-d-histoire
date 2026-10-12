// Habillages de frise propres à certaines périodes (#97).
// Un habillage est un petit jeu de réglages : un fond (couleur, trame, grande scène très pâle qui remplit tout l'écran)
// et les couleurs de la frise (axe, dates, époques) : thème de nuit pour l'espace, teintes propres à la période sinon. Rien n'est posé sur la frise elle-même. Tout est en SVG léger
// (public/habillages/) et n'est chargé que quand une partie de la période est jouée.
// Aucun habillage ne dépend de la date : le décor est le même sur toute la frise, il ne donne aucun indice.

export type HabillageId = "tranchees" | "mosaique" | "espace" | "prehistoire" | "moyen-age" | "seconde-guerre" | "revolution" | "renaissance" | "industrielle" | "guerre-froide" | "sport";

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
  // Préhistoire : paroi de grotte, mammouth peint à l'ocre, mains au pochoir.
  "prehistoire": {
    id: "prehistoire",
    nom: "Grotte",
    periode: "Préhistoire",
    sombre: false,
    palette: {
      "--color-encre": "#3b2a1e",
      "--color-encre-douce": "#5c4531",
      "--color-epoque-prehistoire": "#dcc09a",
      "--color-epoque-antiquite": "#e3b98a",
      "--color-epoque-moyen-age": "#cdc7a0",
      "--color-epoque-temps-modernes": "#dfae94",
      "--color-epoque-contemporaine": "#bfc6b8",
    },
    fond: {
      couleur: "#eddcc0",
      image: `url(${DOSSIER}/prehistoire-scene.svg), url(${DOSSIER}/prehistoire-fond.svg)`,
      taille: "cover, 200px 200px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#eddcc0", "#dabe9d"],
    packs: [],
    themes: [],
    periodes: [],
    plage: [-5000000, -3500],
  },
  // Moyen Âge : parchemin enluminé, château fort, cathédrale, soleil d'or.
  "moyen-age": {
    id: "moyen-age",
    nom: "Enluminure",
    periode: "Moyen Âge",
    sombre: false,
    palette: {
      "--color-encre": "#3a2a2f",
      "--color-encre-douce": "#5c4650",
      "--color-epoque-prehistoire": "#dcd0b0",
      "--color-epoque-antiquite": "#e8cf90",
      "--color-epoque-moyen-age": "#c4cde0",
      "--color-epoque-temps-modernes": "#e0b9a8",
      "--color-epoque-contemporaine": "#cbd0c0",
    },
    fond: {
      couleur: "#f0e4c4",
      image: `url(${DOSSIER}/moyen-age-scene.svg), url(${DOSSIER}/moyen-age-fond.svg)`,
      taille: "cover, 160px 160px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#f0e4c4", "#e0d3b1"],
    packs: ["COL-0079"],
    themes: [],
    periodes: ["moyen-age"],
    plage: [476, 1492],
  },
  // Seconde Guerre mondiale : carte grise, bombardier en formation, projecteurs.
  "seconde-guerre": {
    id: "seconde-guerre",
    nom: "Carte d'état-major",
    periode: "Seconde Guerre mondiale",
    sombre: false,
    palette: {
      "--color-encre": "#232c33",
      "--color-encre-douce": "#46525a",
      "--color-epoque-prehistoire": "#d3d6cb",
      "--color-epoque-antiquite": "#d9d3bd",
      "--color-epoque-moyen-age": "#cbd3d6",
      "--color-epoque-temps-modernes": "#dcc9c2",
      "--color-epoque-contemporaine": "#c6cdc7",
    },
    fond: {
      couleur: "#e6e8e2",
      image: `url(${DOSSIER}/seconde-guerre-scene.svg), url(${DOSSIER}/seconde-guerre-fond.svg)`,
      taille: "cover, 200px 200px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#e6e8e2", "#cbcfcd"],
    packs: ["COL-0064"],
    themes: [],
    periodes: [],
    plage: [1939, 1945],
  },
  // Révolution et Empire : la Bastille, drapeau tricolore, Arc de triomphe.
  "revolution": {
    id: "revolution",
    nom: "Tricolore",
    periode: "Révolution française et Empire",
    sombre: false,
    palette: {
      "--color-encre": "#2c2f4a",
      "--color-encre-douce": "#4b4f6d",
      "--color-epoque-prehistoire": "#e1dccd",
      "--color-epoque-antiquite": "#e6d5b5",
      "--color-epoque-moyen-age": "#cfd6e4",
      "--color-epoque-temps-modernes": "#ebd1cf",
      "--color-epoque-contemporaine": "#d9dce8",
    },
    fond: {
      couleur: "#f3ede2",
      image: `url(${DOSSIER}/revolution-scene.svg), url(${DOSSIER}/revolution-fond.svg)`,
      taille: "cover, 160px 160px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#f3ede2", "#e5e1db"],
    packs: ["COL-0066", "COL-0067"],
    themes: [],
    periodes: [],
    plage: [1789, 1815],
  },
  // Renaissance : carte marine, galion, rose des vents.
  "renaissance": {
    id: "renaissance",
    nom: "Carte marine",
    periode: "Renaissance et Temps modernes",
    sombre: false,
    palette: {
      "--color-encre": "#243a46",
      "--color-encre-douce": "#445a66",
      "--color-epoque-prehistoire": "#dccfb0",
      "--color-epoque-antiquite": "#e4cf9e",
      "--color-epoque-moyen-age": "#cfd7c6",
      "--color-epoque-temps-modernes": "#bfd2d6",
      "--color-epoque-contemporaine": "#cfd0c4",
    },
    fond: {
      couleur: "#eee3c6",
      image: `url(${DOSSIER}/renaissance-scene.svg), url(${DOSSIER}/renaissance-fond.svg)`,
      taille: "cover, 200px 200px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#eee3c6", "#d5d0b6"],
    packs: ["COL-0080"],
    themes: [],
    periodes: ["epoque-moderne"],
    plage: [1492, 1789],
  },
  // Révolution industrielle : locomotive à vapeur, usine et cheminées, engrenage.
  "industrielle": {
    id: "industrielle",
    nom: "Vapeur",
    periode: "Révolution industrielle",
    sombre: false,
    palette: {
      "--color-encre": "#2f2a28",
      "--color-encre-douce": "#554d48",
      "--color-epoque-prehistoire": "#dcd5c6",
      "--color-epoque-antiquite": "#e2d2b0",
      "--color-epoque-moyen-age": "#cdcfc0",
      "--color-epoque-temps-modernes": "#dcc4b0",
      "--color-epoque-contemporaine": "#c7c9c4",
    },
    fond: {
      couleur: "#e9e3d8",
      image: `url(${DOSSIER}/industrielle-scene.svg), url(${DOSSIER}/industrielle-fond.svg)`,
      taille: "cover, 160px 160px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#e9e3d8", "#cfc8bf"],
    packs: ["COL-0081"],
    themes: [],
    periodes: ["xixe"],
    plage: [1789, 1914],
  },
  // Guerre froide : affiche constructiviste, Spoutnik, mur et mirador.
  "guerre-froide": {
    id: "guerre-froide",
    nom: "Affiche rouge",
    periode: "Guerre froide",
    sombre: false,
    palette: {
      "--color-encre": "#1e1e22",
      "--color-encre-douce": "#4a4040",
      "--color-epoque-prehistoire": "#ddd3c0",
      "--color-epoque-antiquite": "#e4cfae",
      "--color-epoque-moyen-age": "#d4d6c8",
      "--color-epoque-temps-modernes": "#e0b8aa",
      "--color-epoque-contemporaine": "#d0c8c4",
    },
    fond: {
      couleur: "#eee6d6",
      image: `url(${DOSSIER}/guerre-froide-scene.svg), url(${DOSSIER}/guerre-froide-fond.svg)`,
      taille: "cover, 160px 160px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#eee6d6", "#ddcdbe"],
    packs: ["COL-0065"],
    themes: [],
    periodes: [],
    plage: [1947, 1991],
  },
  // Sport : flamme dans sa vasque, stade et mâts d'éclairage, piste en terre battue.
  "sport": {
    id: "sport",
    nom: "Stade",
    periode: "Sport",
    sombre: false,
    palette: {
      "--color-encre": "#1f3a2c",
      "--color-encre-douce": "#3f5a4a",
      "--color-epoque-prehistoire": "#d9dcc2",
      "--color-epoque-antiquite": "#e6dcb0",
      "--color-epoque-moyen-age": "#cfdcc4",
      "--color-epoque-temps-modernes": "#e8c9b4",
      "--color-epoque-contemporaine": "#c3d3cf",
    },
    fond: {
      couleur: "#eef0dc",
      image: `url(${DOSSIER}/sport-scene.svg), url(${DOSSIER}/sport-fond.svg)`,
      taille: "cover, 160px 160px",
      repetition: "no-repeat, repeat",
      position: "center bottom, 0 0",
    },
    fondsPires: ["#eef0dc", "#d1cab4"],
    packs: ["COL-0105", "COL-0106", "COL-0107", "COL-0108", "COL-0109", "COL-0110", "COL-0111"],
    themes: [],
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
