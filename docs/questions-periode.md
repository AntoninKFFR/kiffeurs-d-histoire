# Questions période — #94

Dans une partie classique (solo libre, scolaire, pack, thème mystère), certaines questions demandent
**le début et la fin** d'un événement. Le joueur pose deux dates ; le score de la question est la moyenne
des scores du début et de la fin, calculés avec la formule habituelle (`score_answer`).

Migration : `20261011083000_questions_periode.sql`. Tests : `supabase/tests/questions_periode.sql`
(lancés par `scripts/tests-sql.sh`) et `tests/questions-periode.test.ts`.

## Événements éligibles

`event_answers.periode_possible` marque les événements dont la fin est connue **et** postérieure au début
à la précision YEAR au moins (fin d'une autre année, ou d'un autre mois / jour aux précisions plus fines).
La règle est dans `histoire.periode_jouable` (interne). La migration marque l'existant ; le déclencheur
`marquer_periode_possible` marque chaque nouvel import. Un événement sans fin n'est jamais tiré en période.

Au tirage, l'éligibilité est recalculée à la précision de la partie : en MONTH ou DAY, une période qui
tient dans le même mois (ou le même jour) ne devient pas une question période.

## Tirage

Nouvelle surcharge `start_game(p_periodes boolean, …)` (et `start_mystery_game(p_periodes boolean, …)`).
Le premier paramètre est obligatoire : les anciens appels (sans `p_periodes`) tombent toujours sur les
anciennes signatures, qui ne tirent jamais de période. Aucune fonction n'est supprimée.

- Seulement en sens « date », pour une partie d'au moins 5 questions, et si `p_periodes` est vrai.
- Entre 1 et `floor(n / 5)` questions période (1 sur 5, 1 ou 2 sur 10, jusqu'à 4 sur 20), selon les
  événements éligibles disponibles.
- Les questions sont mélangées : une question période peut tomber à n'importe quel rang.
- `game_questions.periode` et `expected_end_*` sont figés à l'insertion, comme le début.

Le mode inversé et les tests de chapitre (« se tester ») ne changent pas : l'action n'envoie pas
`p_periodes` pour eux.

## Ce que voit le navigateur

`next_question` ajoute seulement `"periode": true` à la question : ni date de début ni date de fin.
`submit_answer` refuse une réponse simple à une question période (`Réponse invalide`) ; la seule entrée est
`submit_period_answer(p_game_id, p_question_id, début…, fin…, p_token)`, qui :

- vérifie la question active, le propriétaire ou le jeton, et la deadline, comme `submit_answer` ;
- refuse une fin avant le début à la précision de la partie (`La fin ne peut pas précéder le début`) ;
  une fin égale au début est acceptée ;
- note le début et la fin séparément (`start_accuracy`, `end_accuracy`, `end_gap`) puis la moyenne
  (`accuracy`, `points`).

Une question période expirée vaut 0 aux deux bornes. La correction et `finish_game` ajoutent
`correct_end_date`, `end_gap`, `start_accuracy`, `end_accuracy` (et `answer_end` au bilan).

## Écran

- La carte porte le badge « Début et fin ».
- Deux onglets Début / Fin au-dessus des trois cases. Un clic sur la frise pose le début puis passe
  à la fin ; le bouton devient « Placer la fin → » tant que la fin manque.
- Une fin avant le début est signalée et bloque Valider.
- À la correction, deux barres : la période du joueur (oxyde) et la bonne période (laiton).
- Le bilan affiche « Période attendue X → Y » et la fin donnée par le joueur.

## Réglage

Les nouvelles parties Solo libre utilisent automatiquement les questions période ;
le sélecteur « Activées / Coupées » a été retiré de cet écran. Le scolaire conserve
son réglage existant et les tests de chapitre restent exclus, comme le mode inversé.
La restauration de la mémoire locale conserve le contenu, le niveau, la précision
et la longueur, mais ignore une ancienne préférence `periodes=0` pour préparer une
nouvelle partie Solo libre. Les anciennes URLs et les relances historiques explicites
avec `periodes=0` restent comprises dans Rejouer et `replay_filters.periods`.
Le filtre supérieur « Période »
reste disponible pour choisir une époque. Le tirage et les fonctions SQL ne changent pas.
