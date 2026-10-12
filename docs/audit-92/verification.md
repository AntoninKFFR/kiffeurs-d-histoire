# Vérifications de l’audit #92

## PHASE 1B — V2, 12 octobre 2026

La V2 est vérifiée contre les sources inchangées et la proposition V1 du commit `93bbcae96ea70673882679156c9419b40686faac`. L’analyse indépendante utilise `scripts/csv.ts` et `chargerCartes` du dépôt ; les scripts temporaires ne sont pas livrés comme code d’application.

| Demande / contrôle V2 | Résultat |
| --- | --- |
| 1. Correction URSS | Seul EVT-0115 change de section de référence : S3 = 5, S4 = 10 ; cartes actuelles = 2/2 ; A/M/J actuel = 2/2/2 chacun ; complet = 5/5/5 et 10/10/10 ; partitions exactes |
| 2. Revue historique | 21/21 séquences analysées, constats et actions non vides ; dates de début canoniques exposées, Han exclu du tri et signalé ; revue humaine distincte de la partition |
| 3. THM-012 | Deux orientations comparées sans choix automatique ; correspondance des 21 IDs vérifiée ; simulation d’intégration dédupliquée = THM-009/010/011 à 17/11/26 |
| 4. Tests fragiles | Cinq sections exactement à 5 ; retrait d’un jouable → 4 et test indisponible ; huit unités alternatives chiffrées avec IDs exacts et A/M/J ; partitions alternatives 17/9 et 6/8 vérifiées ; 18/21 tests actuellement indisponibles |
| 5. Arbitrages documentaires | Han/Fachoda/Sargon/Becquerel : faits, limites de sources, correction justifiée et choix pédagogique séparés ; fac-similés Becquerel lus, note du 23 mars vérifiée ; PDF ANOM intégral inaccessible, limite annoncée |
| Simulation Becquerel | THM-046 actuel 4/4/2, complet 5/5/3 ; pas de test Jour ; pas de redatation pour atteindre le quota |
| 6. Compatibilité | Conservation additive confirmée, anciennes cartes/URLs/scores et réponses figées ; progression indépendante des nouvelles unités ; volumes 56/62 conditionnels |
| Intégrité | Toutes les empreintes de empreintes-sources.csv sont identiques ; seul EVT-0115 est déplacé dans les listes de référence ; cartes/IDs/métriques recalculés et liens Markdown contrôlés |
| npm run lint, npm run typecheck | Relancés en PHASE 1B : tous deux réussis, code 0 |
| Build par npx tsx scripts/build-apprendre-local.ts | Relancé en PHASE 1B : réussi, code 0 ; next build avec fixture pédagogique locale, sans accès KFFR ; avertissement Big Shoulders inchangé |
| Périmètre Git | Seulement documents sous docs/audit-92, aucune modification source/code/SQL ; aucune PR, migration, carte, illustration, fusion ou publication du site |

Les 82 tests de contrats ci-dessous datent de la PHASE 1 : ils ne sont pas annoncés comme relancés en PHASE 1B. L’audit V2 n’a pas introduit d’implémentation nécessitant de nouveaux tests applicatifs. Les assertions d’analyse vérifient les comptes, les partitions et l’intégrité ; la relecture historique et les décisions humaines ne sont pas « prouvées » par ces assertions.

La branche documentaire est poussée et **le même commentaire de proposition #6128517451** est mis à jour, sans nouveau commentaire ; le SHA annoncé et le contenu publié sont contrôlés après publication. L’issue reste ouverte et en cours pour la validation éditoriale. Aucun résultat de CI GitHub ni test de migration future n’est revendiqué.

## PHASE 1 — état de référence

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
