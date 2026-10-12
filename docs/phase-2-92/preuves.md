# Preuves locales — phase 2 #92

## Second audit : contrôles après intégration de main

Base intégrée : `2e09a4c257eb83ff4e401c65411dcc1229cc5a55`, #110 et #113 inclus par rebase. La branche d'audit `ed5a682` reste intacte. Les résultats du premier audit ci-dessous constituent l'historique ; les contrôles suivants sont ceux de la préparation corrigée.

- Plan exact : **27 chapitres non découpés / 104 ajouts**, comparé à l'inventaire CSV de l'audit. Validation TypeScript de toutes les fixtures, dates/textes incohérents refusés.
- PostgreSQL 17 : staging répété des 104 ajouts dans 27 éditions, sans nouveau chapitre ni modification des 325 cartes. Publication contrôlée d'une complétion, score initial 83 conservé et résultat nouveau 50 séparé ; idempotence et RLS A/B ; rollback sans perte. Aucun brouillon de complétion exposé.
- Véritable importeur de complétion → SDK → proxy HTTP local → PostgREST v14.10 → PostgreSQL : fichier temporaire de 104 fixtures importé deux fois ; 27 brouillons identiques, 59 unités et 325 cartes conservées. Le fichier temporaire est supprimé après le test. La fixture proxy ferme ses connexions avant les longs contrôles synchrones pour éviter un socket périmé ; aucun changement de transport dans l'application.
- Disponibilité : ancien chapitre accessible avant l'enregistrement ; après initialisation, historique/actif accessibles, 18 enfants inactifs fermés et chapitre hors registre fermé même avec une carte. anon/authenticated et refus des tables privées. Marqueur d'initialisation privé et permanent ; absence du marqueur interprétée comme initialisation restrictive.
- Immutabilité : corrections de date/mode et retrait canonique valides n'affectent pas l'édition initiale, l'ancien bilan, sa relance, les réponses enregistrées ou le score. Une complétion publiée reste rejouable après correction ; son réimport identique reste un no-op.
- Application : progression active/historique par édition sans transfert ; Rejouer conserve la version, même si une ancienne URL de lancement lui est donnée ; session anonyme isolée par édition. Les futurs exports conservés sont vérifiés contre les instantanés avant de produire leurs empreintes.
- Navigateurs locaux : Bilan, **66 cas/formats** et interactions, puis Sous-packs desktop/mobile réussis avec leurs builds. Le premier passage CI a révélé deux fixtures HTTP limitées à l'ancienne RPC de cartes ; elles acceptent maintenant aussi la RPC d'édition explicite, comme les fixtures Apprendre/Profil. Aucun assouplissement du contrat SQL ou des assertions navigateur.
- Suite SQL existante complète sur base jetable : réussie, y compris les quatre tests de concurrence et les modes Libre/Inversé. Build intégré : réussi, 41 routes initiales et 69 pages, seul avertissement Big Shoulders préexistant. Lint et types : réussis. Vitest : **51 fichiers, 576 tests réussis** ; import de descriptions : **6 tests réussis**. Registre préparé conforme au contrôle `--check`.

Les cartes, signatures et publications utilisés ci-dessus sont exclusivement des fixtures de contrats, avec des textes existants repris. Aucune nouvelle carte pédagogique ou illustration, aucun changement canonique dans le dépôt ni SQL distant.

La CI du nouveau SHA de PR est à consulter pour la vérification intégrée complète (Supabase et navigateur). Les nombres unitaires finaux et le lien de CI sont consignés dans la description de la PR #111 après vérification. Les tests de production, l'activation réelle, le déploiement et la migration distante restent non exécutés.

## Historique du premier audit

Contrôles du 12 octobre 2026, dans le worktree isolé. Toutes les exécutions SQL utilisent des bases jetables sur **PostgreSQL 17 local**, conteneur nommé et labellisé `kffr.audit=issue92-phase2`, sans adresse de base distante. Les helpers refusent un daemon Docker distant et suppriment leur propre base aléatoire après chaque exécution.

## Matrice obligatoire

| # | Garantie | Preuve exécutée |
| ---: | --- | --- |
| 1 | 41 chapitres conservés | Comparaison des anciennes lignes et URLs, manifeste complet et 41 pages générées. Fixture : 59 stockés, 41 visibles publiquement. |
| 2 | 325 cartes conservées | Empreintes des 325 lignes CSV ; comparaison JSON exacte en PostgreSQL avant/après migration et après deux imports réels via SDK/PostgREST. |
| 3 | Anciens rattachements | 534 liens conservés ; 188 liens ajoutés, total 722. Deux synchronisations identiques, sans retrait de liens parents/enfants. |
| 4 | Progression intacte | Instantané JSON intégral de `learning_progress` conservé après migration, enregistrement et réimports. Aucun changement de schéma/RLS de cette table. |
| 5 | Isolation des joueurs | PostgreSQL authentifié A voit sa ligne, B n'en voit aucune ; B ne peut pas enregistrer la partie de A. Tables privées refusées à visiteur et joueur. |
| 6 | Aucun héritage | Enfants sans ligne après import. Fixture publiée : parent 83/Mois/7 tests conservé, enfant découvert sans score puis résultat propre 50/Année. |
| 7 | Anciens liens | Comparaison de chaque ancien slug/résolveur ; conservation des 41 routes statiques. Retour arrière : les enfants publiés restent résolubles. |
| 8 | Anciens bilans | Réponses anciennes inchangées en PostgreSQL ; suites unitaires existantes de bilan et historique réussies. |
| 9 | Rejouer | Relance enregistrée conserve l'ID parent. Après correction canonique fictive, nouvelle partie du parent utilise les dates apprises ; ancienne partie conserve son instantané. |
| 10 | Aucun incomplet actif | 18 RPC de cartes vides, tests/découverte refusés, enfants absents du choix et du registre public ; publication refusée pour contenu manquant et blocage Han. |
| 11 | Aucun double compte | Export rejette publication partielle/parent et enfants actifs ensemble. Test UI : parent historique exclu du compteur actif, son 83/Mois affiché séparément ; enfant conserve son 50/Année. |
| 12 | Réimport sans perte | Import réel `scripts/import-dataset.ts` exécuté deux fois par SDK → HTTP local → PostgREST v14.10 → PostgreSQL 17 ; cartes exactes, effectifs 2001/59/325/722/18. Réenregistrement idempotent avant/après rollback. |
| 13 | Transactions/erreurs | Erreur volontaire dans la migration : aucun DDL/registre partiel. Lots invalides et erreur après staging enfant : aucune mutation persistante. Publication d'un groupe puis rollback SQL conserve URLs/cartes/scores ; transaction de fixture annulée. |
| 14 | Pas de fuite | 41 projections publiques exactes à 14 champs, sans event_id/source. Tables privées refusées. HTML/RSC vérifiés sans corpus, sources, chemins EVT ou métadonnées internes ; chaque page embarque uniquement ses cartes. Le registre public ne contient aucune date ou réponse. |
| 15 | Mode scolaire | Suites choix/progression/tests existants ; enfant inactif refusé, parent historique encore interprétable. Catalogue Solo régénéré : aucun changement de contenu JSON actuel. |
| 16 | Libre/Inversé | Suite SQL complète existante, tests unitaires Solo/Inversé et imports de descriptions réussis. La disponibilité pédagogique ne filtre que les demandes avec chapitre ; aucun changement du canon ou des comptes de ces modes. |

## Commandes et résultats

| Commande | Résultat |
| --- | --- |
| `npm run lint` | Réussi. |
| `npm run typecheck` | Réussi (Next typegen + TypeScript). |
| `npx vitest run --maxWorkers=2` puis `npx tsx --test scripts/import-descriptions.test.ts` | Suite complète : 48 fichiers Vitest, 481 tests ; 6 tests Node d'import de descriptions. `npm test` sans limite de workers a dépassé le délai du test existant de démo pédagogique sur cette machine ; la concurrence a été bornée pour la vérification finale, sans modifier les tests ni les délais. |
| `npx tsx scripts/build-structure-pedagogique.ts --check` | Registre de préparation conforme : 41 disponibles, 18 inactifs dans le manifeste privé. |
| `npx tsx scripts/build-apprendre-local.ts` | Build de production sur fixture HTTP locale, 69 pages dont 41 chapitres. Seul avertissement : fallback de police Big Shoulders déjà existant. |
| `npx tsx scripts/verifier-apprendre.ts` | 41 chapitres, 325 cartes, cache 3600 s et aucune métadonnée interne en HTML/RSC. |
| `npx tsx scripts/test-sous-chapitres-local.ts --container kffr-issue92-phase2` | Migration/erreurs/rollback, contenu historique, A/B, disponibilité, version des dates, publication complète et retour arrière sur fixtures temporaires. |
| `npx tsx scripts/test-import-sous-chapitres-http-local.ts --container kffr-issue92-phase2` | Deux véritables imports SDK/PostgREST, 41 projections de cartes exactes, accès privé refusé. Régression complète de migration Somme également réussie, rollback restaurant les 59 unités. |
| `bash scripts/tests-sql.sh` dans une base PostgreSQL 17 dédiée | Suite SQL existante complète réussie, y compris contrôles concurrents de claim, statut/audit, correction et cycle. |
| `npx tsx scripts/verifier-profil-local.ts` | Navigateur desktop et 375 px : onglets, vide, erreur, réessayer, compte, redirection anonyme. API locale de fixture ; ce test ne prétend pas exercer Supabase Auth distant. |
| Vérificateurs Python chapitres/alias/descriptions | Réussis : 41 chapitres, 534 liens, 2001 événements ; métadonnées/dates intactes. |
| `npm run content:audit-plages -- --strict` | Réussi, 2001 événements et zéro plage textuelle incorrectement représentée par un point dans ce contrôle conservateur. |
| `npm run content:relecture-cartes -- --check` | Relecture identique au CSV validé. |

Les helpers de publication reprennent des textes déjà existants uniquement en mémoire et dans une transaction annulée. Les identifiants de fixtures ne sont jamais enregistrés dans le contenu pédagogique du dépôt. Aucune preuve ne doit être interprétée comme une approbation de cartes à rédiger.

## Vérifications restantes

La pile complète Supabase et les scénarios Playwright bout en bout sont configurés dans la CI de la PR. Ils ne sont pas assimilés aux tests PostgreSQL/PostgREST locaux ci-dessus : leur résultat doit être consulté sur le SHA de PR. Les tests navigateur de bilan et sous-packs restent également dans le job existant. La CI doit être verte avant toute décision ultérieure.

Aucun test ni audit SQL sur le projet partagé, migration distante, test d'un compte de production, déploiement, merge ou activation réelle. Les sauvegardes et comparaisons d'état réel, validations éditoriales/SVG et orchestration de publication attendent les GO distincts. La preuve porte sur le corpus versionné et les fixtures contrôlées, pas sur un état distant inconnu.
