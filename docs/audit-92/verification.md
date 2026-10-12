# Vérifications de l’audit #92

Effectuées le 12 octobre 2026 dans le worktree documentaire, base `c28d11eabe8aea1917f86b36839c289c899070ca`.

| Contrôle | Résultat réel |
| --- | --- |
| Recalcul des ensembles CSV et comparaisons n/t | 41 chapitres ; 534 paires ; 479 événements uniques ; 325 cartes ; 231 manques de paires ; 213 événements sans aucune carte |
| Partition des six parents | 21 sections, union exacte, aucun event_id perdu ou répété dans une partition, toutes ≤20 événements |
| Simulations de tests | 18 nouvelles sections sous le seuil avec les cartes actuelles ; au moins cinq à l’année après complétion mécanique. Han reste bloqué éditorialement |
| Lecture publique KFFR | 41 chapitres, 534 liens, 2 001 événements publics, 325 cartes ; aucune divergence sur les champs comparés |
| Sources et redirections | 2 634 liens / 821 sources ; zéro source/événement orphelin, zéro cible canonique orpheline |
| Validation indépendante des tableaux avec scripts/csv.ts et chargerCartes | Comptes, manques exacts, partitions, catalogue et liens des documents vérifiés ; aucune mutation de sources |
| npm run lint | Réussi, code de sortie 0 |
| npm run typecheck | Réussi, code de sortie 0 |
| Build de production par npx tsx scripts/build-apprendre-local.ts | Réussi, code de sortie 0, fixture HTTP pédagogique locale ; 41 routes de chapitre générées, aucun accès KFFR |
| Vitest ciblé sur contrats audités | Sept fichiers, **82 tests réussis**, zéro échec |
| Diff Git | Uniquement documents Markdown/CSV sous docs/audit-92 ; aucun changement de données sources, code ou migration |

La commande de build exécute `next build`, comme le script npm build, avec la fixture de CI existante. Elle est choisie pour éviter toute connexion au service partagé pendant le build. Un avertissement existant de police **Big Shoulders** (valeurs de substitution introuvables) est apparu ; il n’a pas fait échouer la compilation. Aucun correctif de police n’a été introduit dans cet audit.

Tests exécutés : `tests/cartes.test.ts`, `tests/choix.test.ts`, `tests/progression.test.tsx`, `tests/progression-serveur.test.ts`, `tests/apprendre-serveur.test.tsx`, `tests/illustrations-generalisation.test.ts`, `tests/bilan.test.ts`.

Les tests SQL locaux/CI ont été examinés mais **pas exécutés** : les fixtures existantes touchent notamment auth.users dans leur environnement local et cette phase n’a créé ni base jetable ni nouvelle migration. Aucun test connecté de partie, découverte ou progression n’a été lancé sur la production. Les contrats futurs de filiation et de migration ne sont pas implémentés, et ne sont donc pas annoncés comme testés.

Aucune PR ouverte pour cette phase, donc aucun résultat de CI GitHub n’est revendiqué. Les checks locaux démontrent un état de référence cohérent ; ils ne constituent pas une validation éditoriale des propositions ni une garantie d’une migration encore non écrite.
