# Habillages de frise par période (#97)

Quand on joue un pack, un thème ou une période liée à une époque retenue, la frise prend l'habillage de cette époque :
**uniquement un fond**. Une grande scène très pâle remplit tout l'écran derrière la frise (ciel, paysage, objets de l'époque),
sur une trame de papier. La frise et la bande des époques du bas prennent les couleurs de l'habillage (thème de nuit de la charte pour l'espace,
teintes propres à la période pour les deux autres), et un halo très clair, qui s'estompe, met l'axe et les dates en valeur.
Rien n'est posé sur la frise ni collé à l'axe : l'axe, les dates, les repères et la réponse restent seuls au premier plan.
Sans habillage, la frise reste celle de la V1.

> **Choix provisoires.** L'issue #86 (périodes retenues et exemple de Maxou) n'était pas tranchée au moment du développement.
> Les trois premiers habillages reprennent les exemples cités dans #86 et #97, les huit autres (#112) ont été validés en images par Maxou le 12 octobre 2026 ; les packs et périodes auxquels ils s'appliquent sont des choix par défaut. Ajouter, retirer ou renommer un habillage
> ne demande que de modifier `src/lib/game/habillages.ts` et d'ajouter ses deux SVG (trame et scène).

## Les habillages

| Habillage | Période | Où il s'applique | Trame | Scène de fond |
| --- | --- | --- | --- | --- |
| Tranchées (`tranchees`) | Première Guerre mondiale | Pack « Première Guerre mondiale » (`COL-0063`), ou toute partie dont les dates tiennent dans 1900-1935 | Carte d'état-major jaunie | Ciel de fumée, un zeppelin en vedette et des biplans, crêtes dévastées aux arbres brisés, barbelés et coquelicots |
| Mosaïque (`mosaique`) | Antiquité | Pack « Antiquité » (`COL-0078`), période « Antiquité », ou toute partie dans -3500…500 | Tesselles de mosaïque | Soleil, temple à fronton posé sur un rocher qui descend vers la mer, olivier, cyprès, trirème, hirondelles, amphores et frise de grecques |
| Ciel étoilé (`espace`) | Conquête spatiale | Pack « Espace » (`COL-0070`) et thème « Espace » (`TAG-0130`), par identifiant | Ciel de nuit étoilé | Nébuleuses, une Terre qui se lève et l'horizon lunaire (volontairement peu d'éléments) |
| Grotte (`prehistoire`) | Préhistoire | Aucun pack ; parties dont les dates tiennent avant -3500 | Paroi de roche | Mammouth peint à l'ocre, mains au pochoir, chasseurs, feu de camp, montagnes |
| Enluminure (`moyen-age`) | Moyen Âge | Pack « Moyen Âge » (`COL-0079`), période « Moyen Âge », ou parties dans 476…1492 | Parchemin réglé | Château fort aux bannières, cathédrale, soleil d'or, rinceaux |
| Carte d'état-major (`seconde-guerre`) | Seconde Guerre mondiale | Pack « Seconde Guerre mondiale » (`COL-0064`), ou parties dans 1939…1945 | Carte quadrillée grise | Bombardier en formation, projecteurs, ballons de barrage |
| Tricolore (`revolution`) | Révolution française et Empire | Packs « Révolution française » (`COL-0066`) et « Époque napoléonienne » (`COL-0067`), ou parties dans 1789…1815 | Bandes bleu-blanc-rouge très pâles | Bastille et son drapeau, Arc de triomphe au loin, rubans tricolores |
| Carte marine (`renaissance`) | Renaissance et Temps modernes | Pack « Époque moderne » (`COL-0080`), période « Époque moderne », ou parties dans 1492…1789 | Carte à rhumbs | Galion toutes voiles, rose des vents, vagues |
| Vapeur (`industrielle`) | Révolution industrielle | Pack « XIXe siècle » (`COL-0081`), période « XIXe siècle », ou parties dans 1789…1914 (hors Révolution et Empire) | Plan d'ingénieur | Locomotive à vapeur, usine et cheminées, engrenage |
| Affiche rouge (`guerre-froide`) | Guerre froide | Pack « Guerre froide » (`COL-0065`), ou parties dans 1947…1991 | Hachures constructivistes | Spoutnik et ses orbites sur un disque rouge, mur et mirador |
| Stade (`sport`) | Sport | Pack « Sport » (`COL-0105`) et ses six sous-packs (`COL-0106` à `COL-0111`) | Pelouse tondue | Flamme dans sa vasque, stade et mâts d'éclairage, piste en terre battue |

## Règle d'application

`habillageDe(choix, bornes)` (`src/lib/game/habillages.ts`) est appelée par la page de partie (`src/app/partie/[id]/page.tsx`) :

1. le pack, le thème ou la période joués sont ceux d'un habillage (identifiants listés dans `HABILLAGES`) ;
2. sinon, si la partie a une plage de dates et qu'elle tient tout entière dans la `plage` d'un habillage (chapitres, sous-packs, périodes libres) ;
L'ordre de `HABILLAGES` départage les plages qui se recoupent : Tranchées passe avant Vapeur, Tricolore avant Vapeur.
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
- Couleurs de la frise : chaque habillage porte une `palette` (variables de la charte redéfinies : encre, encre douce, couleurs des époques), posée sur la racine de la frise ;
  la bande des époques du bas, les boîtes, le bouton « Quitter » et les boutons de zoom l'héritent. Tranchées : encre sépia, époques kaki, ocre et olive. Mosaïque : encre brun-rouge, époques ocre, terre cuite et turquoise passé.
  Ciel étoilé : thème de nuit de la charte, sans palette.
- Halo : une bande du fond (`--frise-fond` à 90 %), de 160 px autour de l'axe, estompée en haut et en bas (`.habille .bandeScene::before`). Pas de halo en thème de nuit.
  L'axe passe à 6 px et les dates à 18 px.
- Les bandeaux d'époques deviennent translucides pour laisser voir le fond ; leur texte reste opaque.
- Fond sombre (`espace`) : la bande de la frise, la zone de la scène et le bas (bande des époques) passent en thème de nuit (`data-theme="dark"`), donc dates, repères et marqueurs prennent
  leurs couleurs claires.
- Intégration des boîtes : sur un habillage, la carte de la question n'a plus de cadre (texte à halo de la couleur du fond), et les boîtes de réponse et de correction, les cases de saisie,
  « Quitter » et les boutons de zoom sont translucides, teintés de `--frise-fond` avec un léger flou, bordés d'encre et de laiton (fin de `partie.module.css`, sélecteurs `[data-habillage]`).
- Élément phare : chaque scène a un sujet bien visible au-dessus du halo, loin du texte de la question (zeppelin, temple, Terre). Il ne doit jamais dépasser le haut du halo (≈ 300 px à 1366×768).
- Poids : deux SVG par habillage (la scène, de 2 à 9 Ko, et la trame), moins de 16 Ko par habillage, chargés seulement quand la période est jouée.
  Ils sont produits par `scripts/generer-habillages.mjs` (déterministe : `node scripts/generer-habillages.mjs public/habillages`).

## Lisibilité

La scène est volontairement très pâle (couleurs proches du fond, opacité de 5 à 20 %). Les couleurs de `fondsPires` ont été
**mesurées** sur la scène rendue (captures à 1366×768, 667×375 et 375×667 : 5 % des pixels les plus marqués au-dessus du bas de l'écran, hors traits très fins).
Si on retouche une scène, on remesure et on met à jour `fondsPires`. Pour les huit habillages de #112, la mesure porte sur la zone des dates de l'écran de jeu réel (10 % des pixels les plus marqués entre l'axe + 10 px et + 12 % de la hauteur, halo compris), sur PC, téléphone debout et téléphone couché.
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
