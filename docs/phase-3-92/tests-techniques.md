# Rapport des contrôles techniques — phase 3 #92

Exécutions locales du 13 octobre 2026, sur la branche `issue-92-cartes-integrales`, base `a4759cea8bebd66003c2d69592bf8fd5af24b264`. Les fixtures n'utilisent aucune connexion distante ni aucun secret de production. Les scripts d'import reprennent le contrat #111. Les contrôles de cette phase sont également ajoutés à la CI de la PR.

| Contrôle réellement exécuté | Résultat observé |
| --- | --- |
| `phase3-pedagogie.ts --plan` | 231 couples manquants reconstruits indépendamment ; 104 complétions ; 188 enfants ; 61 origines ; 127 enfants nouveaux |
| Assemblage et `content:verifier-phase3` | Ensembles exacts, 104/188, 617 IDs uniques, rangs continus, prose 60–120 mots, dates et libellés validés par les importeurs existants ; toutes les nouvelles références journalisées |
| Intégrité | 325 empreintes de contenu et CSV identiques à main ; 331 SVG identiques ; canon/manifeste/code applicatif/SQL/DA inchangés |
| Couverture et images | 59 unités contrôlées ; 231 destinations retrouvées ; 292 besoins d'images reliés à 285 événements ; 82 réutilisations et 203 créations futures ; objets du stock reconnus |
| `npm run lint` | Réussi |
| `npm run typecheck` | Réussi avec Next typegen et TypeScript |
| Vitest, deux workers | **52 fichiers, 664 tests réussis**, assertions inchangées |
| `tsx --test scripts/import-descriptions.test.ts` | **6 tests réussis** |
| Vérificateurs Python chapitres/alias/descriptions | Réussis : référentiel actuel, 534 liens, 394 événements/1 379 alias, 304 descriptions et 39 contrôles négatifs |
| `build-structure-pedagogique.ts --check` | 41 historiques, 18 inactifs, 59 IDs ; projection initiale inchangée |
| Audit des plages et relecture historique | Zéro plage signalée par le détecteur conservateur ; recueil historique identique au CSV validé |
| `scripts/tests-sql.sh` | Suite intégrale des migrations, fixtures, tests SQL et quatre suites de concurrence réussie dans un Postgres 17 local vide |
| `test-sous-chapitres-local.ts` | Migration sans perte, 41/325 historiques, 59 unités/722 liens/18 inactifs ; éditions, RLS, scores, dates/modes/retrait canonique, anciens bilans et relance, erreurs atomiques et rollback réussis |
| `test-import-sous-chapitres-http-local.ts` sans phase 3 | Deux imports réels du dataset et 104 complétions techniques / 27 brouillons par SDK et PostgREST ; projections initiales exactes, données privées interdites |
| Même test avec `--corpus-phase3 --build-phase3` | **104 vraies cartes + 188 enfants**, **61 filiations**, idempotence et historique conservé, publication simulée de 27 éditions et activation simulée de 15 enfants, groupe Han refusé, export/catalogues/build/browser/rollback réussis |
| Build initial `build-apprendre-local.ts` | Réussi, 41 routes historiques et 325 cartes ; fixture de projection locale |
| Build intégral contre PostgREST réel | Réussi sur les états simulés : **56 routes accessibles**, 59 unités exportées, 3 enfants Han exclus |
| Navigateur intégral, Chromium | 56 routes HTTP et projections HTML/RSC exactes ; absence de métadonnées privées ; lecture desktop et 375 px, test réel de huit questions, correction, bilan, lien de relecture et relance `completion-v1` ; archive `legacy-v1` à six cartes ; route Han 404 |
| Vérificateurs Apprendre et démo | Réussis : 41 chapitres/325 cartes, cache et projections sans données privées, corpus initial restauré |
| Profil navigateur | Desktop/375 px, onglets, vide, erreur/réessai, compte et redirection anonyme réussis |
| Bilan navigateur | **66 cas/formats**, interactions et effets réels réussis ; build réussi |
| Sous-packs navigateur | Builds et parcours normal/inverse aux largeurs 1 280, 1 366 et 375 px réussis ; CTA visible et absence de débordement horizontal |

## Ce que prouve la simulation du vrai corpus

Le test crée une base aléatoire dans le seul conteneur local explicitement nommé et labellisé `kffr-issue92-phase2`, puis un PostgREST v14.10 local. Il importe le canon et le contenu original deux fois, compare les projections publiques, puis importe les 104 complétions et les 188 enfants deux fois. Il compare les contenus complets historiques avant et après, compte 513 lignes stockées dans `chapter_cards` (325 + 188) et 61 filiations ; les 104 complétions restent dans les éditions prévues par #111.

Une mutation réelle du corps d'une ancienne carte est refusée par SQL. Une progression historique et son score sont créés uniquement dans la fixture ; leur instantané complet reste identique après publication simulée et test d'une complétion. Le score de complétion est distinct. Les nouveaux enfants ne fabriquent pas de progression historique.

Les attestations `fixture-phase3` n'ont aucune valeur éditoriale ou graphique. Elles servent exclusivement à exercer le chemin technique. Le groupe THM-006 refuse l'activation et conserve `han-canon-incoherent` sur THM-049 ; ses trois enfants restent fermés. Les cinq autres groupes activent leurs quinze enfants, et les vingt-sept complétions sont publiées **dans cette base jetable seulement**.

Une complétion déjà publiée accepte un lot identique comme no-op. À l'inverse, le contrat #111 **refuse l'import d'un enfant actif, même identique** ; le test exige cette erreur et compare ensuite toutes les cartes pour prouver l'absence de mutation. L'idempotence des enfants est vérifiée avant leur activation. Il ne serait pas correct de présenter la protection des enfants actifs comme une réimportation réussie.

L'export et le générateur Solo existants produisent réellement les catalogues, avec seuil de cinq pour toutes les unités admissibles. Les fichiers générés sont sauvegardés puis restaurés, même en cas d'erreur. Le build est branché sur PostgREST local ; Chromium joue réellement une partie. Le rollback conserve cartes, filiations, progression et scores par édition. Les containers, réseau et base API temporaires sont supprimés.

## Incidents et limites explicites

Deux exécutions de Vitest avec sa parallélisation par défaut sur Windows ont dépassé le délai de cinq secondes d'un test DOM historique qui lit les 325 cartes. La suite complète a ensuite réussi avec `vitest run --maxWorkers=2` ; aucune assertion ni délai du test n'a été changé. Les six tests d'import de descriptions ont été exécutés séparément avec succès.

La première simulation de corpus s'est arrêtée au refus attendu de réimporter un enfant actif. Le scénario a été corrigé pour vérifier **l'erreur et l'identité des données**, conformément au SQL existant, puis entièrement rejoué avec succès. Aucune migration n'a été modifiée pour rendre l'import possible.

Les builds signalent l'avertissement existant de Next sur les métriques de police de secours `Big Shoulders`. Compilation, types et rendu passent. Cet avertissement ne concerne ni les données historiques ni la couverture.

Le premier job GitHub de vérification a réussi les tests unitaires, puis a échoué à lire le commit de référence #111 dans un checkout superficiel. Le job récupère désormais l'historique Git complet avant de comparer les octets. La référence et toutes les assertions d'intégrité restent inchangées ; aucune comparaison n'a été supprimée pour contourner cet échec.

Les scripts Python ont été exécutés avec le Python embarqué de l'environnement, l'alias `python` de Windows n'étant pas installé. Le détecteur de plages reste conservateur ; son résultat ne remplace pas la relecture documentaire. Les tests techniques ne certifient pas une datation historiquement contestée, une source non lue ou une illustration future.

## Commandes de reproduction locale

```sh
npm run content:verifier-phase3
npm run lint
npm run typecheck
npx vitest run --maxWorkers=2
npx tsx --test scripts/import-descriptions.test.ts
npx tsx scripts/test-sous-chapitres-local.ts --container kffr-issue92-phase2
npx tsx scripts/test-import-sous-chapitres-http-local.ts --container kffr-issue92-phase2
npx tsx scripts/test-import-sous-chapitres-http-local.ts --container kffr-issue92-phase2 --corpus-phase3 --build-phase3
npx tsx scripts/build-apprendre-local.ts
npx tsx scripts/verifier-apprendre.ts
npm run content:test-demo-pedagogie
npm run test:profil-browser
npm run test:bilan-browser
npm run test:sous-packs-browser
```

Le conteneur Postgres jetable doit porter le label `kffr.audit=issue92-phase2` et fonctionner sur un daemon Docker local ; la CI fournit le démarrage et le nettoyage. Pour `tests-sql.sh`, utiliser une **base vide locale distincte**, avec variables PG locales explicites, comme dans le job CI `tests-sql`. Ne jamais cibler un Postgres existant de production ou une URL distante.

La branche et la PR restent exclusivement éditoriales. Aucun import distant, SQL de production, activation distante, migration appliquée en production, déploiement, merge ou fermeture d'issue n'a été effectué.
