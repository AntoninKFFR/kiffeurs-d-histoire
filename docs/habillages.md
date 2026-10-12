# Habillages de frise par période (#97)

Quand on joue un pack, un thème ou une période liée à une époque retenue, la frise prend l'habillage de cette époque :
**uniquement un fond**. Une grande scène très pâle remplit tout l'écran derrière la frise (ciel, paysage, objets de l'époque),
sur une trame de papier. La frise et la bande des époques du bas prennent les couleurs de l'habillage (thème de nuit de la charte pour l'espace,
teintes propres à la période pour les deux autres), et un halo très clair, qui s'estompe, met l'axe et les dates en valeur.
Rien n'est posé sur la frise ni collé à l'axe : l'axe, les dates, les repères et la réponse restent seuls au premier plan.
Sans habillage, la frise reste celle de la V1.

> **Choix provisoires.** L'issue #86 (périodes retenues et exemple de Maxou) n'était pas tranchée au moment du développement.
> Les trois habillages ci-dessous reprennent les exemples cités dans #86 et #97. Ajouter, retirer ou renommer un habillage
> ne demande que de modifier `src/lib/game/habillages.ts` et d'ajouter ses deux SVG (trame et scène).

## Les habillages

| Habillage | Période | Où il s'applique | Trame | Scène de fond |
| --- | --- | --- | --- | --- |
| Tranchées (`tranchees`) | Première Guerre mondiale | Pack « Première Guerre mondiale » (`COL-0063`), ou toute partie dont les dates tiennent dans 1900-1935 | Carte d'état-major jaunie | Ciel de fumée, avions biplans, crêtes dévastées aux arbres brisés, barbelés et coquelicots |
| Mosaïque (`mosaique`) | Antiquité | Pack « Antiquité » (`COL-0078`), période « Antiquité », ou toute partie dans -3500…500 | Tesselles de mosaïque | Soleil, temple à fronton, olivier, cyprès, mer et trirème, hirondelles, amphores et frise de grecques |
| Ciel étoilé (`espace`) | Conquête spatiale | Pack « Espace » (`COL-0070`) et thème « Espace » (`TAG-0130`), par identifiant | Ciel de nuit étoilé | Nébuleuses, une Terre qui se lève et l'horizon lunaire (volontairement peu d'éléments) |

## Règle d'application

`habillageDe(choix, bornes)` (`src/lib/game/habillages.ts`) est appelée par la page de partie (`src/app/partie/[id]/page.tsx`) :

1. le pack, le thème ou la période joués sont ceux d'un habillage (identifiants listés dans `HABILLAGES`) ;
2. sinon, si la partie a une plage de dates et qu'elle tient tout entière dans la `plage` d'un habillage (chapitres, sous-packs, périodes libres) ;
3. sinon, aucun habillage : frise de la V1. Le Solo libre sur toute l'histoire, le thème mystère tiré hors période et les parties qui couvrent plusieurs époques sont dans ce cas.

L'habillage vaut pour toute la partie, quelle que soit la zone zoomée. Il s'applique à l'écran de partie classique, période comprise, et au mode inversé.
Il n'est pas appliqué à la frise du bilan ni à « Découvrir » (cartes pédagogiques), qui restent celles de la V1.

## Mécanique

- `Frise` reçoit `habillage` (identifiant). Le fond est posé sur la racine de la frise, en CSS : la scène SVG (1600×900, `cover`, calée en bas),
  puis la trame répétée et, pour l'espace, le dégradé du ciel. Aucun élément n'est ajouté dans la frise : le décor ne peut ni capter un clic ni gêner la lecture d'écran.
- La scène est dessinée pour que son sujet occupe le ciel libre, entre la carte de la question et l'axe, et pour que son horizon passe derrière la bande des époques.
  Le bas de l'écran (sous la bande des époques) est caché par les boîtes de réponse, donc il ne porte que du sol.
- La scène est la même sur toute la frise et à tout zoom : elle ne dépend jamais de la date visible ni de la réponse, **elle ne donne aucun indice**.
  Les motifs gravés de la V1 (qui varient avec l'époque) laissent la place à la scène.
- Couleurs de la frise : chaque habillage porte une `palette` (variables de la charte redéfinies : encre, encre douce, couleurs des époques), posée sur la bande de la frise
  et sur la bande des époques du bas. Tranchées : encre sépia, époques kaki, ocre et olive. Mosaïque : encre brun-rouge, époques ocre, terre cuite et turquoise passé.
  Ciel étoilé : thème de nuit de la charte, sans palette.
- Halo : une bande du fond (`--frise-fond` à 90 %), de 160 px autour de l'axe, estompée en haut et en bas (`.habille .bandeScene::before`). Pas de halo en thème de nuit.
  L'axe passe à 6 px et les dates à 18 px.
- Les bandeaux d'époques deviennent translucides pour laisser voir le fond ; leur texte reste opaque.
- Fond sombre (`espace`) : la bande de la frise et la bande des époques du bas passent en thème de nuit (`data-theme="dark"`), donc dates, repères et marqueurs prennent
  leurs couleurs claires. La question, « Quitter » et les boîtes du bas gardent le thème normal, sur une carte claire opaque (`data-fond="sombre"` dans `partie.module.css`).
- Poids : six SVG de 2 à 8 Ko (moins de 30 Ko en tout), chargés seulement quand la période est jouée.
  Ils sont produits par `scripts/generer-habillages.mjs` (déterministe : `node scripts/generer-habillages.mjs public/habillages`).

## Lisibilité

La scène est volontairement très pâle (couleurs proches du fond, opacité de 5 à 20 %). Les couleurs de `fondsPires` ont été
**mesurées** sur la scène rendue (captures à 1366×768, 667×375 et 375×667 : 5 % des pixels les plus marqués au-dessus du bas de l'écran, hors traits très fins).
Si on retouche une scène, on remesure et on met à jour `fondsPires`.
`tests/habillages.test.tsx` vérifie, pour chaque habillage, sur ces couleurs :
contraste ≥ 4,5:1 pour les dates (`encre`), les petites étiquettes (`encre-douce`), les années en gras (`oxyde`), les noms d'époques sur le bandeau translucide et les noms et dates de la bande des époques du bas, avec la palette de l'habillage ;
repère d'axe ≥ 3:1. Il vérifie aussi que la frise sans habillage n'a pas de fond posé, que l'habillage ne pose que le fond (aucun élément ajouté),
et que le fond ne change pas avec la date visible.

## Aperçu

`/apercu?habillage=tranchees|mosaique|espace` (menu « Démo : habillage de la frise » en haut de la page) montre l'écran de partie habillé,
avec une vraie question de démonstration et la correction.

## Vérifications

- Écran sans défilement et réponse posée d'un clic sur la frise : `e2e/habillages.spec.ts` à 1366×768, 375×667 et 667×375.
- Zoom (molette, 80 images) : 16,3 ms par image en plein écran PC et téléphone, avec et sans habillage (limité par l'écran, aucun surcoût mesurable).
