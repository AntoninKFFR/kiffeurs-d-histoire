# Choix des parties — relecture UX du 11 octobre 2026

Base : `main` à `681344547457ace1eaec9e53ec56834eee5693a2`, après fusion de la PR #108.
Branche : `ux-simplification-choix-parties`.

## Comportement

1. Chaque parent, y compris un parent imbriqué, propose « Jouer tout [pack] »
   pour le sélectionner et « Voir les sous-thèmes » pour explorer ses enfants.
   Choisir un parent n'ouvre pas les enfants et ne démarre aucune partie.
   Le décompte vivant, Tout le pack, Retour, le focus, la mémoire et Rejouer
   conservent leur contrat. Explorer et revenir gardent la sélection ; seul choisir
   un autre pack la remplace. Une navigation remet la liste en haut.
2. Le niveau 3 porte le libellé « Toutes les questions ». Il est choisi au
   premier affichage de Solo libre et Inversé sans mémoire. Les niveaux 1 et 2
   restent disponibles. Les anciens liens et mémoires conservent leur niveau
   explicite, ou le défaut historique 1 s'il manque. Aucun niveau éditorial ne change.
3. Le réglage Questions période disparaît du Solo libre. Les nouvelles parties
   classiques utilisent la valeur automatique existante du moteur. Les anciens
   `periodes=0` dans les URLs et leurs relances explicites restent compatibles.
   La restauration locale ignore cette option désactivée pour les nouvelles parties,
   sans perdre le pack, le niveau, la précision ou la longueur. L'onglet Période
   conserve le filtre des époques. Le scolaire, les tests de chapitre et le
   moteur inversé ne changent pas.
4. « ✦ Thème mystère » est une tuile de l'onglet Thème. Le joueur la sélectionne,
   ajuste niveau/précision/longueur, puis clique sur l'unique Jouer final.
   `BoutonMystere` réutilise `preparerMystere` et `RouletteMystere`. Les quatre
   longueurs restent sélectionnables ; la RPC vérifie l'éligibilité au lancement,
   sans faux décompte et sans appel de décompte pour le mystère. Le verrou existant
   empêche les doubles créations. Les deux relances du bilan restent disponibles.

L'écran PC met les choix et les réglages côte à côte. Les longues grilles
défilent à l'intérieur de leur zone, sur PC comme sur mobile. La barre Jouer
reste visible sur PC et collée en bas du viewport sur mobile. Les styles
restent ceux du Cabinet de curiosités ; les changements de présentation
concernent uniquement les formulaires Solo libre/Inversé.

## Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `npm test` | 450 tests Vitest, 45 fichiers ; 6 tests d'import Node, tous verts |
| Vitest ciblé (choix, packs, mystère, périodes, actions, bilan et Sport) | 132 tests, 11 fichiers, tous verts |
| `npm run lint` | Vert |
| `npm run typecheck` | Vert |
| Build Next de production | Vert, exécuté par le script de relecture |
| `npx tsx scripts/verifier-sous-packs-local.ts --ux` | Six parcours Chromium verts avec API de fixtures locale |
| `git diff --check` | Vert |

Le parcours navigateur traverse la vraie route Next et ses Server Actions,
avec une API locale sur 127.0.0.1. Il vérifie les réglages envoyés à
`start_mystery_game`, une seule création avant/après Passer, la navigation vers
la partie, le badge Début et fin en classique, la mémoire du gagnant et son
lancement ultérieur par `start_game`. Les contrats RPC, Rejouer, les deux relances,
les périodes et l'exclusion des tests de chapitre sont également testés en Vitest.

Les suites SQL et Playwright avec vraie base locale ne sont pas exécutées :
le daemon Docker est indisponible dans cette session. Les trois scénarios E2E
existants ont été adaptés aux nouveaux contrôles. Aucune CI GitHub n'est attendue.
Le build signale l'avertissement préexistant de fallback de police Big Shoulders.

Les 46 captures et 12 mesures sont dans [la relecture visuelle](captures/choix-ux/README.md).
Les fichiers de contenu, catalogue Sport, migrations, SQL, fonctions de jeu,
tests pédagogiques et associations restent inchangés ; aucune opération en base
de production n'a été exécutée.

## Corrections après la CI de la PR #109

Les deux échecs PC/mobile du [run 38147121535](https://github.com/Zazou13015/KIffeur-d-Histoire/actions/runs/38147121535)
venaient du test Solo libre qui attendait encore Débutant par défaut. Ce parcours
vérifie désormais le niveau 3 initial, sélectionne explicitement Débutant, contrôle
le niveau 1 transmis et enregistré, puis garde les dix questions et l'assertion
sur les seuls événements de niveau 1.

Les tests de navigation et restauration reproduisaient aussi la perte de sélection
et la désactivation silencieuse des périodes. Ils vérifient maintenant la conservation
du parent/enfant, le résumé et Jouer, la mémoire et Rejouer, les périodes automatiques
après une ancienne mémoire `periodes=0`, et la compatibilité des relances explicites.
La relecture Chromium contrôle ces comportements avec le vrai composant et ses actions,
sur les trois viewports et dans les deux sens, sans accès Supabase distant.

## Fichiers modifiés

- Interface : `ChoixSolo.tsx`, `SelectionPacks.tsx`, `BoutonMystere.tsx`,
  `LongueurPartie.tsx`, `choix.module.css`, `src/lib/solo/choix.ts`.
- Tests : `choix-ux.test.tsx`, `sous-packs-composant.test.tsx`,
  `longueur-composants.test.tsx`, `mystere-composants.test.tsx`.
- Parcours E2E : `solo-libre.spec.ts`, `sous-packs.spec.ts`, `sport.spec.ts`, `theme-mystere.spec.ts`.
- Relecture : `scripts/verifier-sous-packs-local.ts` et `docs/captures/choix-ux/`.
- Documentation : ce fichier, `sous-packs.md`, `questions-periode.md`, `theme-mystere.md`.
