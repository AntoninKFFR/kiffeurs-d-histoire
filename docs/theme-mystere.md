# Thème mystère (#95)

Dans `/solo` et `/inverse`, la tuile « ✦ Thème mystère » est dans la grille de
l'onglet Thème. Elle sélectionne un pack ou un thème surprise à préparer : le joueur
règle son niveau, sa précision et sa longueur, puis clique sur le bouton final Jouer
pour ouvrir la roulette. La tuile elle-même ne lance aucune partie. Le lancement
réutilise `BoutonMystere`, `preparerMystere` et `RouletteMystere` ; il garde le niveau,
la précision, le sens et la longueur 5/10/20/Tout. Les quatre longueurs sont proposées,
la RPC existante vérifiant les thèmes éligibles sans décompte fictif dans la grille.
Le scolaire et les tests pédagogiques conservent leur parcours.

## Tirage et coût

`preparerMystere` appelle le même `startGame` que les autres parties. Pour le mystère,
celui-ci utilise `start_mystery_game` : une RPC métier par lancement, plus la purge
et la mesure de visite déjà présentes dans le moteur. Aucun décompte par tuile,
aucun sondage en boucle, aucun abonnement et aucun cache de disponibilité périmé.

La RPC matérialise une fois `solo_candidates` (#93), puis groupe ses événements par
pack actif et thème actif `SEMANTIC_TOPIC`, directement depuis la base. Les packs
et thèmes nouvellement importés sont inclus sans reconstruire `catalogue.json`.
En inversé, les dates sont dédupliquées à la précision demandée avant de comparer
à la longueur. Tout accepte une sélection non vide et reste plafonné à 100 questions.
Le catalogue statique sert uniquement au cadrage facultatif de la frise.

Le gagnant est tiré en SQL parmi les sélections suffisantes. `start_game` revalide
et enregistre les questions dans la même transaction. Si un retrait concurrent
rend le gagnant insuffisant, le lancement échoue avant toute animation. Aucun
autre thème n'est annoncé à sa place. La réponse contient uniquement le contrat
de partie, le gagnant et les identifiants/libellés des candidats éligibles.
Aucune date, réponse, liste d'événements ou décompte détaillé n'est ajouté à l'API.
Il n'y a aucun filtre de période libre dans cette nouvelle RPC.

La partie existe avant l'animation, mais le premier chrono commence seulement
quand `/partie/[id]` appelle `next_question`. Un abandon avant navigation suit
la rétention et les budgets existants du moteur ; aucun stockage illimité ajouté.

## Roulette et relances

La bande utilise `transform: translate3d` pendant quatre secondes, avec ralentissement,
petit rebond final et repère centré fixe. « Passer » et Échap affichent immédiatement
le même gagnant. `prefers-reduced-motion` supprime l'animation ; la préférence est
également écoutée pendant le tirage. Le message « C'est parti : [thème] » reste
visible 900 ms avant la navigation vers la partie déjà créée.
La modale native garde le focus et les interactions clavier dans la roulette.

Les filtres réels, `mystery: true` et le libellé du gagnant sont stockés dans
`games.context.replay_filters`. `finish_game` les restitue par son contrat existant.
Le bilan A+ préfère cet instantané à l'URL pour une partie mystère, y compris
depuis le profil. « Rejouer ce thème » fournit l'identifiant du gagnant à la même
RPC ; s'il n'est plus jouable, la relance échoue sans changer silencieusement
de thème. « Relancer la roulette » enlève uniquement le filtre de contenu.
Un nouveau tirage peut naturellement retomber sur le même thème.

Les statistiques et indicateurs conservent le contexte pack/thème du moteur,
les scores et leur normalisation par question. Les anciennes URLs conservent
dix questions par défaut. Les nouveaux identifiants sont acceptés dans un choix
mystère et revalidés en SQL ; les validations des choix classiques restent inchangées.

## Mise en service et vérifications préparées

Migration `20261010184125_theme_mystere.sql` **préparée, non appliquée** : GO explicite
requis avant toute exécution sur KFFR. Elle dépend de `solo_candidates` et du moteur
de longueur de la migration #93. Cette PR ne résout ni ne modifie le sujet de
sécurité préexistant décrit dans `audit-decompte-93.md` : l'état de déploiement de
#93 doit être confirmé avant mise en service. Aucune table, RLS ou permission
existante n'est modifiée, aucun changement dans `public` ou `auth`.

Tests préparés : sélection/niveau/précision/dates uniques et longueurs en SQL,
contrats des actions et RPC, bande/gagnant/destination, Passer, Échap, préférence
de mouvement initiale et modifiée, double clic, erreurs réessayables, mémoire,
contexte du bilan, deux relances et parcours navigateur à 375 px.
Les tests existants couvrent les parcours classiques, scolaires et inversés.

Conformément à la demande : seul `git diff --check` est exécuté ; pas de lint,
typecheck, build, Vitest, Playwright, test SQL ou test sur KFFR. Ces vérifications
restent à exécuter dans le cadre de la revue. Pas d'attente de CI/Vercel ni de fusion.
