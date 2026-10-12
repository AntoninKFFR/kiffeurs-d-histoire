# Habillages de frise par période (#97)

Quand on joue un pack, un thème ou une période liée à une époque retenue, la frise prend l'habillage de cette époque :
un fond (couleur, trame), un décor d'horizon très discret en arrière-plan, de petits détails posés sur l'axe, parfois la variante de nuit de la charte.
La frise (axe, dates, repères, réponse) reste toujours au premier plan : l'habillage n'est qu'un fond.
Sans habillage, la frise reste celle de la V1.

> **Choix provisoires.** L'issue #86 (périodes retenues et exemple de Maxou) n'était pas tranchée au moment du développement.
> Les trois habillages ci-dessous reprennent les exemples cités dans #86 et #97. Ajouter, retirer ou renommer un habillage
> ne demande que de modifier `src/lib/game/habillages.ts` et d'ajouter ses deux SVG.

## Les habillages

| Habillage | Période | Où il s'applique | Fond | Décor d'horizon |
| --- | --- | --- | --- | --- |
| Tranchées (`tranchees`) | Première Guerre mondiale | Pack « Première Guerre mondiale » (`COL-0063`), ou toute partie dont les dates tiennent dans 1900-1935 | Carte d'état-major jaunie | Parapet de sacs de sable, barbelés, arbres brisés |
| Mosaïque (`mosaique`) | Antiquité | Pack « Antiquité » (`COL-0078`), période « Antiquité », ou toute partie dans -3500…500 | Tesselles de mosaïque | Colonnade, frise de grecques |
| Ciel étoilé (`espace`) | Conquête spatiale | Pack « Espace » (`COL-0070`) et thème « Espace » (`TAG-0130`), par identifiant | Ciel de nuit étoilé | Horizon lunaire, planète à anneau |

## Règle d'application

`habillageDe(choix, bornes)` (`src/lib/game/habillages.ts`) est appelée par la page de partie (`src/app/partie/[id]/page.tsx`) :

1. le pack, le thème ou la période joués sont ceux d'un habillage (identifiants listés dans `HABILLAGES`) ;
2. sinon, si la partie a une plage de dates et qu'elle tient tout entière dans la `plage` d'un habillage (chapitres, sous-packs, périodes libres) ;
3. sinon, aucun habillage : frise de la V1. Le Solo libre sur toute l'histoire, le thème mystère tiré hors période et les parties qui couvrent plusieurs époques sont dans ce cas.

L'habillage vaut pour toute la partie, quelle que soit la zone zoomée. Il s'applique à l'écran de partie classique, période comprise, et au mode inversé.
Il n'est pas appliqué à la frise du bilan ni à « Découvrir » (cartes pédagogiques), qui restent celles de la V1.

## Mécanique

- `Frise` reçoit `habillage` (identifiant). Le fond est posé sur la racine de la frise (couleur, trame SVG, dégradé) ;
  le décor d'horizon est un `div` sans interaction (`pointer-events: none`, `aria-hidden`) dont l'image est une tuile SVG répétée,
  en arrière-plan à 40-55 % d'opacité, juste au-dessus de la bande des époques. Il grandit avec le ciel sur les grands écrans et disparaît sur un écran bas
  (téléphone couché) pour ne pas passer sous la question.
- Petits détails sur la frise : à chaque graduation, un petit motif (piquet de barbelés avec un coquelicot, colonne, étoile) se pose sur l'axe,
  au-dessus de la ligne, loin des dates qui sont dessous. Les noms d'époques passent par-dessus avec un halo de la couleur du fond.
- Le décor glisse lentement (parallaxe) quand on parcourt la frise, selon la place de la vue dans la période jouée.
  Il ne dépend jamais de la date visible ni de la réponse : **il ne donne aucun indice**. Les motifs gravés de la V1 (qui varient avec l'époque) laissent la place au décor.
- Les bandeaux d'époques deviennent translucides pour laisser voir le fond ; leur texte reste opaque.
- Fond sombre (`espace`) : la bande de la frise passe en thème de nuit (`data-theme="dark"`), donc dates, repères et marqueurs prennent
  leurs couleurs claires. La question, « Quitter » et les boîtes du bas gardent le thème normal, sur une carte claire opaque (`data-fond="sombre"` dans `partie.module.css`).
- Poids : neuf SVG de 0,2 à 5,6 Ko (moins de 26 Ko en tout), chargés seulement quand la période est jouée (le fond est une image CSS posée en ligne, pas une image de page).
  Ils sont produits par `scripts/generer-habillages.mjs` (déterministe).

## Lisibilité

`tests/habillages.test.tsx` vérifie, pour chaque habillage, sur le fond et sur ses trames les plus marquées :
contraste ≥ 4,5:1 pour les dates (`encre`), les petites étiquettes (`encre-douce`), les années en gras (`oxyde`) et les noms d'époques sur le bandeau translucide ;
repère d'axe ≥ 3:1. Il vérifie aussi que la frise sans habillage n'a ni fond posé ni décor, et que le décor ne change pas avec la date visible.

## Aperçu

`/apercu?habillage=tranchees|mosaique|espace` (menu « Démo : habillage de la frise » en haut de la page) montre l'écran de partie habillé,
avec une vraie question de démonstration et la correction.

## Vérifications

- Écran sans défilement et réponse posée d'un clic sur la frise : `e2e/habillages.spec.ts` à 1366×768, 375×667 et 667×375.
- Zoom (molette, 80 images) : 16,3 ms par image en plein écran PC et téléphone, avec et sans habillage (limité par l'écran, aucun surcoût mesurable).
