# Partie solo et inversée côté serveur (issues #13 et #14)

> Extension #93 préparée : choix 5/10/20/Tout, décompte réel partagé avec le tirage,
> longueur réelle dans les questions et filtres de relance seulement au bilan.
> `p_question_count = 0` demande Tout (stockage réel 1 à 100), les anciens appels
> restent à dix par défaut. [Contrat et migration non appliquée](longueur-parties.md).
> Le texte historique ci-dessous décrit le contrat initial ; la fusion de #93
> attend l'autorisation d'application de sa migration.

> Questions période (#94) : nouvelles surcharges `start_game(p_periodes, …)`,
> `start_mystery_game(p_periodes, …)` et RPC `submit_period_answer`. [Contrat](questions-periode.md).

Migrations : `20261006214244_solo_server.sql` (moteur), après celle du score de #12,
puis `20261006220620_solo_anonymous_retention.sql` (rétention/budget anonyme).
Le mode inversé ajoute `20261006225007_inverse_server.sql`, sans modifier les
migrations déjà livrées. Son déploiement attend une revue et les GO écrits de
Max et Antonin ; cette branche ne touche aucune base distante.
Cette livraison est testée uniquement en local et en CI. Aucune migration ni
écriture Supabase distante n'est exécutée par ce travail.

## Stockage et autorisation

`histoire.games` conserve le propriétaire, le sens (`direction`: `date` par
défaut, ou `inverse`), la difficulté (`YEAR`, `MONTH`, `DAY`),
le nombre de questions, l'état et le résultat final. `histoire.game_questions`
conserve le tirage ordonné, les horodatages serveur et les réponses/scorings.
Les contraintes uniques empêchent de tirer deux fois le même événement.
Un instantané privé de la date et de la description garantit que les imports
ultérieurs ne changent pas la correction d'une partie existante.

Les deux tables ont la RLS active, aucun droit pour `anon`/`authenticated` et
aucune policy. Toutes les lectures et mutations passent par les quatre RPC
`security definer`, avec `search_path = ''`. Le helper `lock_solo_game` est interne.
Il verrouille la partie (`FOR UPDATE`), contrôle l'accès et sérialise ses
transitions, y compris les appels simultanés.

- Connecté : `user_id = auth.uid()`, déterminé par le JWT Supabase validé ; aucun
  identifiant utilisateur n'est accepté comme paramètre. Le jeton anonyme ne
  permet jamais de contourner cette vérification sur une partie connectée.
- Anonyme : `startGame` génère 32 octets aléatoires avec `node:crypto`, les envoie
  à la RPC et les conserve dans un cookie `histoire-solo-<uuid>` de session,
  `httpOnly`, `sameSite=strict`, `secure` en production, sans domaine partagé.
  La base conserve uniquement SHA-256. Chaque RPC vérifie cette capacité ;
  connaître l'UUID ne donne aucun accès. Le secret n'est jamais renvoyé par une
  action, stocké côté JavaScript ni journalisé. Le cookie par partie permet
  plusieurs onglets et la relecture du bilan pendant la session.

Les RPC sont appelables avec la clé publique et la session normale : aucun
`service_role` requis. En usage direct par script, le secret est fourni par le
client serveur appelant ; l'interface web utilise exclusivement le cookie.
Une connexion pendant une partie anonyme ne la transfère pas au compte tant
qu’elle est en cours : le secret reste nécessaire. Après la fin, #24 permet un
rattachement atomique à `auth.uid()` avec le secret serveur, puis supprime
hash, expiration et cookie. Parcours : [Comptes et sauvegarde](comptes.md).
Les parties connectées restent privées
après déconnexion. Les parties anonymes expirent 24 heures après leur création,
indépendamment du cookie de session (voir rétention ci-dessous).

## Rétention et protection du stockage anonyme

Décisions d'Antonin du 7 octobre 2026 : expiration à 24 h, purge automatique lors
des appels de jeu, titre nettoyé et illustration avant réponse, descriptions
réservées à la correction. Aucun worker permanent ni cron distant n'est ajouté.

`games.expires_at` vaut exactement `created_at + interval '24 hours'` pour une
partie anonyme. Le trigger fixe les deux instants côté serveur ; l'appelant ne
peut pas fournir ou prolonger cette expiration. `lock_solo_game` refuse les
trois RPC d'accès dès `expires_at <= clock_timestamp()`, même avec le bon secret,
même si la purge physique n'a pas encore eu lieu, même pour un bilan terminé.
Une partie connectée garde `expires_at = null` : aucune expiration, suppression
ou modification de ses données par cette protection.

La RPC `purge_expired_anonymous_games()` supprime uniquement les parties
anonymes déjà expirées. Elle ne prend aucun paramètre (ni identifiant, ni date
de coupure) et ne renvoie aucune donnée privée. L'accès `anon`/`authenticated`
permet le nettoyage sans `service_role` ni secret serveur en base ; il ne donne
pas la possibilité de supprimer une partie encore valide ou connectée.
`game_questions` est supprimée par la FK `ON DELETE CASCADE` existante.
La purge travaille par lots de 1 000 et ignore les parties verrouillées par
une autre transaction (`SKIP LOCKED`), qui seront traitées au prochain appel.

Chaque Server Action appelle cette purge dans une **transaction distincte**
avant sa RPC métier : le nettoyage est conservé même si l'appel suivant est
refusé. Une création anonyme directe via `start_game` déclenche également la
purge, dans son trigger SQL. Dans ce dernier cas, la transaction entière reste
atomique : un échec de création annule aussi cette purge, et l'appelant peut
utiliser la RPC de purge distincte. La migration initialise l'expiration des
éventuelles parties anonymes existantes et commence leur nettoyage.

**Limite acceptée de la purge opportuniste** : à 24 h l'accès est interdit,
mais sans trafic les lignes expirées restent physiquement présentes jusqu'au
prochain appel. Le plafond ci-dessous borne leur volume. Il ne s'agit pas d'une
suppression garantie à heure fixe pendant l'inactivité du site.

`histoire.solo_anonymous_limits` est une table privée singleton avec deux
budgets initiaux : **1 000 parties et 10 000 questions anonymes stockées**.
Le trigger de création verrouille cette ligne avant de purger, compter et
admettre une nouvelle partie. Il compte aussi les expirées encore verrouillées,
et toutes les anonymes, terminées ou en cours. Ainsi les créations simultanées
et les jetons/cookies renouvelés ne contournent pas les budgets. Un refus SQL
`53400` ne laisse ni partie ni question supplémentaire ; la Server Action
affiche une indisponibilité temporaire, sans exposer les compteurs privés.
Seul un administrateur peut changer les budgets, après estimation du stockage
disponible ; les rôles API n'ont aucun droit sur cette table ou le trigger.

**Limites restantes** : ce plafond protège le volume des lignes de jeu anonymes,
pas le nombre de requêtes ni la consommation CPU, WAL/logs ou les sauvegardes.
Un attaquant peut occuper tout le budget et priver temporairement les autres
visiteurs de création de partie. Un contrôle de débit/CAPTCHA en amont sera à
envisager si l'usage le nécessite ; un quota par jeton librement renouvelable
ne suffirait pas. Conformément au périmètre demandé, aucune limitation ni purge
des parties connectées n'est ajoutée : leurs créations restent sans quota.

Le correcteur inversé historique `check_event_answer(text,text)` reste
**interne** : il permettait de tester librement des alias qui contiennent parfois
une date, sans jouer une question. Le moteur inversé de #14 le réutilise
à travers `submit_answer`, après validation du propriétaire, du sens, de la
question active et de la deadline. Aucune RPC n'accepte un `event_id` à corriger.

## Contrat RPC et actions

#89 ajoute les sous-packs via `pack_scope_events` interne : `p_pack_id` désigne
le périmètre choisi, parent ou enfant. Les signatures de lancement, compte,
correction et relance restent identiques. La RPC publique `playable_packs`
fournit parenté, comptes et bornes arrondies, sans réponses par événement.
Migration préparée uniquement, GO SQL séparé : [Sous-packs](sous-packs.md).

Les exports de `src/app/solo/actions.ts` servent de point d'intégration pour la
future interface #18. Aucune page ni aucun composant graphique n'est ajouté.

| Action | RPC / paramètres | Résultat |
| --- | --- | --- |
| `startGame(filters?)` | `start_game(p_token, p_pack_id, p_tag_id, p_year_min, p_year_max, p_level_id, p_chapter_ids, p_difficulty, p_question_count, p_direction)` | UUID de partie, longueur, difficulté, sens, état, indicateur anonyme |
| `nextQuestion(gameId)` | `next_question(p_game_id, p_token)` | Question active ou `null` quand le tirage est épuisé |
| `submitAnswer(gameId, questionId, dateOrTextOrNull)` | `submit_answer(p_game_id, p_question_id, p_year, p_month, p_day, p_token, p_answer_text)` | Correction adaptée au sens, précision, points, expiration |
| `finishGame(gameId)` | `finish_game(p_game_id, p_token)` | État terminé, sens, longueur, précision moyenne, total et récapitulatif des questions |

`filters.direction` vaut `date` par défaut. Les nouvelles signatures remplacent
les anciennes, sans surcharge : les paramètres ajoutés en dernière position
sont optionnels, donc les appels SQL/PostgREST existants restent valides.
Les parties déjà stockées reçoivent `direction = 'date'`. La réponse datée
garde son contrat ; `start_game` et `finish_game` ajoutent la clé `direction`.
Les types TypeScript distinguent les questions par la présence du champ `date`,
et les bilans par `direction`. Les actions transmettent le texte brut : aucune
normalisation, correction, décision de délai ou formule de score en TypeScript.

Les filtres se combinent avec **ET** ; plusieurs chapitres se combinent avec
**OU**, dans le niveau demandé. Packs/tags inactifs et tags `CENTURY` sont exclus.
La période porte sur l'année de début, bornes inclusives, sans année 0.
La difficulté désigne l'unité de saisie, pas la difficulté éditoriale 1–5 du dataset.
Le nombre de questions vaut 10 par défaut, entre 1 et 100. Une sélection
insuffisante est refusée sans liste de candidats, dates ou décompte disponible.
Les événements non jouables ou connus moins précisément que l'unité demandée
sont exclus. Les événements de type plage sont datés par leur **début**.

En sens `date`, avant réponse, seules les clés `question_id`, `position`, `title`,
`image_path`, `difficulty`, `asked_at`, `deadline`, `server_time` sont renvoyées.
Le champ `description` est absent : les descriptions actuelles restent réservées
à la correction. Les chiffres, mois et mentions de siècle sont
masqués dans le titre de question. Les illustrations suivent la convention
existante `<event_id>.svg` ; les autres chemins sont masqués. Aucun alias,
identifiant d'événement, tag, date secondaire ou date attendue n'est ajouté.
Le contenu public existant et les connaissances historiques du joueur restent
des indices naturels ; les filtres de période sont eux-mêmes un choix du joueur.
Un texte descriptif avant réponse nécessiterait un champ éditorial distinct,
explicitement relu sans date.

`next_question` active uniquement la première question non répondue et conserve
son chrono sur tous les rappels. La durée vient de `scoring_settings` au moment
d'activer la question (30 s par défaut). L'heure `clock_timestamp()` fait foi,
prise après acquisition du verrou. La durée active est figée ; si le réglage
change entre-temps, le temps écoulé est converti en fraction du chrono courant
avant l'appel de `score_answer`, sans dupliquer la formule. Les autres réglages
du score utilisent leur valeur actuelle. Les points sont bornés à 100 par
question, donc 1 000 pour dix questions.

Après la deadline, la réponse est enregistrée avec précision/points à zéro et
la correction est disponible. Une date `null` permet de constater l'expiration :
elle vaut zéro et est refusée avant la deadline. L'expiration ne révèle rien
automatiquement ; l'interface doit appeler `submitAnswer(..., null)` à la fin du
chrono. Aucun appel ne peut répondre à une question future ou déjà répondue.
Les mois/jours requis dépendent de la difficulté et les dates impossibles sont
refusées avant expiration. `finish_game` refuse toute question non répondue,
calcule en SQL les agrégats et devient idempotente. `next_question` renvoie ensuite
`null` ; le récapitulatif permet de relire les corrections.

## Sens inverse : tirage, question et correction (#14)

Le même moteur, le même verrou de partie, les mêmes filtres, chrono, cookies,
expiration, purge et plafonds sont utilisés. `game_questions.answer_text`
conserve la réponse (1 000 caractères au maximum). Une réponse date dans une
partie inverse ou texte dans une partie date est refusée ; le sens vient de la
partie privée, jamais d'un paramètre de soumission. Un texte vide est refusé
avant la deadline. `null` après la deadline permet d'obtenir la correction à zéro.

Le tirage inverse groupe les candidats filtrés par **date à afficher** : année
en `YEAR`, année/mois en `MONTH`, année/mois/jour en `DAY`. Un événement est choisi
au hasard dans chaque groupe, puis les groupes sont tirés au hasard. Une partie
ne contient donc jamais deux dates affichées identiques. Le mode date conserve
tous les candidats, même s'ils ont la même date. La date d'une plage est son
début ; aucune précision absente n'est inventée. Tirage et instantanés sont lus
ensemble, pour que les changements concurrents de contenu ne créent pas de
collision après la déduplication. Si le nombre de dates distinctes est
insuffisant, l'erreur reste « Pas assez de questions pour ces filtres », sans
décompte, liste de candidats ni partie résiduelle.

Cette unicité concerne **le tirage de la partie**, conformément à #14. Deux
événements du catalogue ayant la même date peuvent chacun être sélectionnés
dans des parties différentes. Une réponse désignant l'autre événement sera
évaluée uniquement contre celui retenu. Écarter tous les doublons du catalogue
serait une règle produit plus restrictive, à décider séparément.

Avant réponse, la liste exacte des clés est : `question_id`, `position`, `date`,
`date_label`, `date_precision`, `difficulty`, `asked_at`, `deadline`, `server_time`.
`date` contient `year/month/day`, avec `null` pour les composantes non demandées.
`date_label` est généré depuis ces entiers en français, sans utiliser le texte
éditorial privé : `1947`, `février 1947`, `3 février 1947`, `44 av. J.-C.`,
`mars 44 av. J.-C.`, `15 mars 44 av. J.-C.`. Aucune année 0. Aucun titre, description,
identifiant d'événement, alias, tag ou chemin d'illustration. Le PRD n'autorise
pas explicitement d'illustration pour ce sens ; aucune n'est envoyée.
Le catalogue public `events` existe toujours : il ne donne pas le lien privé
entre une question UUID et son événement. Les tables de parties et d'alias
restent fermées aux deux rôles API.

Après autorisation et vérification de la question active, une seule réponse
peut être enregistrée, même avec deux transactions simultanées. Avant expiration,
`check_event_answer` compare uniquement l'événement privé de cette question.
Il conserve `normalize_answer` et utilise le seuil `pg_trgm` **0,75**, fixé dans
la migration #14 par décision produit. La précision vaut
100 si accepté, 0 sinon ; `score_points` de #12 calcule le bonus avec la fraction
du chrono figé. Après la deadline, le correcteur n'est pas appelé et précision
et points valent zéro. La correction ajoute `direction: 'inverse'`, `title`
(attendu), `correct`, et conserve `correct_date`, `description`, `accuracy`,
`points`, `expired`, `unit` et `gap` (toujours `null` en inverse).
Le bilan n'est disponible qu'après toutes les réponses ; il ajoute le sens et
conserve la réponse texte, les précisions 100/0 et la somme des points. Il est
idempotent. Les alias ne sont jamais renvoyés, même dans le bilan.

**Tolérance validée** : « Guerre froide », « la guerre froide », « guere froide »,
la casse et les accents restent acceptés. La faute « guere froide » a une
similarité de **0,80** ; l'article est supprimé par la normalisation existante.
Les titres du dataset `EVT-0111` (« Début du blocus de Berlin », 1948) et
`EVT-0112` (« Fin du blocus de Berlin », 1949), similaires à **0,72**, sont
désormais refusés l'un pour l'autre. Les tests vérifient les deux refus dans
le correcteur interne et dans la RPC de partie. La migration #14 redéfinit
uniquement le correcteur avec 0,75 : la migration déjà appliquée
`20261006084353_modele_dataset_v18.sql` et `normalize_answer` restent inchangés.
Le correcteur conserve `SECURITY DEFINER`, `search_path = ''` et l'interdiction
d'EXECUTE pour `PUBLIC`, `anon` et `authenticated`.
Avec la migration préparée #104 (GO SQL séparé), les titres classiques affichés
et les libellés acceptés en inverse sont aussi figés au tirage, dans une table
privée. Une correction éditoriale ou un import ne modifie donc pas une partie
déjà lancée. Les parties encore actives à l’application sont couvertes par un
backfill, sans réécrire leurs questions/réponses/scores. Date, titre canonique
affiché à la correction et description restent les instantanés de #13.

## Vérifications du moteur commun

`scripts/tests-sql.sh` attend un **Postgres vide**, recrée le strict simulateur
Supabase déjà utilisé en CI puis applique les migrations et le seed. Les claims
JWT sont simulés sans insérer de compte dans `auth.users`. Ce script ne doit
jamais viser une base Supabase distante ni une base existante.

```sh
# Postgres local vide (variables PG* configurées), jamais une URL distante :
bash scripts/tests-sql.sh
# Supabase local déjà migré :
npm run db:test-securite
npm run db:test-score
npm run db:test-solo
npm run db:test-solo-retention
npm run db:test-inverse
npm test
npm run lint
npm run typecheck
npm run build
```

La CI exécute automatiquement `supabase/tests/inverse.sql`, `supabase/tests/solo.sql`,
`supabase/tests/solo_anonymous_retention.sql` et les tests de deux transactions
concurrentes `scripts/tests-solo-concurrence.sh` (réponse date/inverse et création au quota).
La suite inverse couvre les deux identités, les filtres, les collisions aux trois
précisions, le manque de dates, les formats antiques, la tolérance, les erreurs
génériques, l'isolation, l'absence de correction arbitraire, les réponses futures,
la deadline, le bonus, le bilan et la rétention. Les suites #12/#13 restent
exécutées pour vérifier le score, les parties date, les filtres et la rétention.
Couverture : expiration à 24 h, refus des trois accès expirés, purge des anonymes
en cours/terminées, cascade, conservation des non-expirées et des comptes,
interdiction de changer l'expiration/budget, budgets de parties/questions et
purge automatique à la création, ainsi que
parties complètes de dix questions anonymes et connectées simulées, 1 000 points,
filtres, précision disponible, plages, tirage unique, chrono/configuration,
réponses exactes/imprécises/absentes/tardives, fin/récapitulatif, instant de
validation, accès étrangers, absence de colonnes privées et de correction sans
partie. `tests/soloActions.test.ts` vérifie les cookies, les paramètres RPC,
l'absence de fuite de secret/erreur et le fonctionnement avec session connectée.

## Écran de partie (issue #18)

`/partie/nouvelle` lance une partie solo de 10 questions (action `lancer`, `src/app/partie/actions.ts`) puis redirige vers
`/partie/<id>?n=10`. `n` ne sert qu'à l'affichage (« 4 sur 10 ») : le serveur décide de la fin, aucun RPC ne renvoie la longueur
d'une partie en cours.

`/partie/[id]` appelle `nextQuestion` : la question en cours avec son chrono d'origine (reprise après rechargement), ou `null`
quand tout est répondu, auquel cas la page appelle `finishGame` et affiche le bilan. Après une correction, « Question suivante »
rappelle `nextQuestion` : le chrono de la question suivante ne démarre qu'à ce moment-là.

Le chrono du navigateur n'est qu'un affichage, recalé sur `server_time`. À zéro, l'écran appelle `submitAnswer(..., null)` et le
serveur constate l'expiration (0 point). Si cet appel échoue (réseau), un bouton « Réessayer » le renvoie. Avant la réponse, la
page ne contient que le titre et l'illustration : ni date ni description. Le mode inversé n'a pas encore d'écran (issue #20).

Disposition : la frise occupe toute la scène de jeu ; la carte de la question (horizontale) est posée en haut, la saisie et la
correction en bas, sur le fond de la frise. Un clic hors des boîtes place la réponse. Les titres et descriptions du dataset sont
affichés avec une majuscule ; un événement sans dessin affiche un pictogramme neutre.

`/demo/partie` rejoue le même parcours avec un faux moteur dans le navigateur.
