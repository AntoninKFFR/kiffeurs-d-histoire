# Contrôles techniques — phase 4 #92

Exécutions locales du **14 octobre 2026**, sur `issue-92-cartes-integrales`, à partir du SHA `41060638e7c3e75f89669d68ecc7c5734f0627d0`. Les seuls services de données utilisés sont des fixtures locales jetables. Les résultats ci-dessous portent sur les 203 dessins finaux après correction visuelle.

| Contrôle réellement exécuté | Résultat |
| --- | --- |
| Génération initiale et reproduction | 203 fichiers créés avec `wx`, aucun des 331 anciens changé ; reproduction des 203 octet pour octet |
| Refus d’écrasement | Relance réelle refusée avec code 1 ; empreintes des 203 fichiers identiques avant/après ; test automatisé conservant aussi les 534 fichiers présents |
| `content:verifier-phase4` | 203 nouveaux, 82 réutilisés, 285 événements, 292 cartes, 331 anciens intacts contre les deux bases ; 534 SVG au total |
| XML Python et contrôles négatifs Vitest | 534 SVG, zéro problème ; rejet de XML malformé, texte, scripts, images externes, éléments actifs, mauvaise palette/dimensions et dépassement du poids |
| Poids des nouveautés | 620 à 1 751 octets ; 247 480 octets au total, tous sous 8 192 octets |
| Planches et rendu Sharp | 17 comparatifs et 17 natifs ; 203 identifiants indexés exactement une fois ; quatre références validées par planche ; 285 SVG réellement rendus en 160 × 120 avec empreintes PNG et pixels dessinés |
| Relecture visuelle | Tous les 203 dessins examinés sur les 34 PNG par l’auditeur ; 20 PNG affectés réexaminés après correction. Le coordinateur a également vu les 17 planches natives et le montage des corrections. Journal exhaustif de 203 lignes |
| `content:verifier-phase3` | Corpus conservé : 104 complétions, 188 enfants, 61 filiations, 231 manques couverts, 59 unités ; 325 anciennes cartes, canon, SQL et DA intacts. L’inventaire des besoins reste figé au SHA de phase 3 |
| `npm run lint` et `npm run typecheck` | Réussis ; Next typegen et TypeScript réussis |
| `vitest run --maxWorkers=2`, avec `PHASE4_BROWSER=1` | **53 fichiers, 672 tests réussis**, aucune assertion ancienne ni délai ancien affaibli |
| `tsx --test scripts/import-descriptions.test.ts` | **6 tests réussis** |
| GET historique conservé | Le vrai module GET est testé sur les **325 anciennes cartes** : **303 dessins dédiés et 22 motifs**, octets exacts, refus des identifiants invalides et absence de fuite |
| GET complet de fixture en mémoire | **292 vraies réponses GET** exactes par `card_id`, aucune redirection, source, identifiant événementiel ou chemin de fichier dans les réponses ; aucune écriture de catalogue ni activation SQL |
| Chromium sur cette fixture | **292 images × 2 largeurs = 584 rendus**, à 1 280 et 375 px ; décodage réussi, dimensions natives 160 × 120 et aucun débordement |
| Suite SQL locale intégrale | Migrations/fixtures/tests et quatre suites de concurrence réussis dans un Postgres 17 vide, labellisé `kffr.audit=issue92-phase2` |
| `test-sous-chapitres-local.ts` | Migration sans perte, historique/progression/scores/RLS conservés, anciens bilans et relance, disponibilité restrictive, erreurs atomiques et rollback réussis |
| Fixture SDK/PostgREST `--corpus-phase3 --build-phase3` | Les **104 vraies complétions + 188 enfants** importés, les 61 filiations et les réimportations contrôlées ; contenu et progression historique conservés ; catalogues régénérés puis restaurés ; rollback sans perte |
| Build complet contre PostgREST local | Compilation réelle, 56 routes/projections complètes, 534 SVG tracés, aucun fichier d’atelier embarqué |
| Navigateur sur ce build réel | **268 routes SVG publiques exactes**, toutes les cartes accessibles affichées aux deux largeurs ; **24 cartes des trois enfants Han refusées 404** ; aucune fuite ni erreur ; partie de huit questions, correction, bilan, relance `completion-v1`, archive `legacy-v1` à six cartes et chapitre Han inaccessible |
| Build initial `build-apprendre-local.ts` | Compilation/types et 69 pages statiques générées avec la fixture publique locale ; corpus initial restauré |
| `verifier-apprendre.ts` et démo | 41 chapitres, 325 cartes, 303 dédiées / 22 motifs ; HTML/RSC sans métadonnées privées ; cache et traçage de la totalité du stock contrôlés |

## Deux fixtures d’illustrations distinctes

Le test des 292 GET remplace **uniquement en mémoire, dans un fichier Vitest isolé**, la liste technique des chapitres pour rendre toutes les correspondances accessibles au vrai module de route et à son vrai lookup. Il ne publie aucune page et ne modifie aucun fichier ou blocage. Chromium lit les SVG de ce serveur HTTP temporaire à deux largeurs.

Le build complet, lui, utilise les états réellement exportés de PostgREST local. Il maintient les trois enfants Han fermés : 268 cartes ont des illustrations accessibles, 24 ont une réponse 404. Ces deux scénarios ne sont pas présentés comme équivalents. Le dessin d’EVT-0040 reste préparé, sans autoriser THM-049.

Les attestations et simulations d’activation/publication de la fixture préexistante servent seulement à exercer le moteur local. Elles n’ont aucune valeur éditoriale ni graphique. Les fichiers générés de l’application sont sauvegardés et restaurés ; aucune donnée distante n’intervient. Les tests vérifient également les refus de mutation historique et les réimportations interdites d’enfants déjà actifs.

## Incidents et limites

La première lecture de l’index Markdown prenait les identifiants de la colonne des références à cause d’une expression trop gourmande. Le contrôle a été corrigé pour lire la colonne exacte des nouveautés, puis renforcé : 17 pages, références Markdown/CSV concordantes et dimensions des PNG natifs. La totalité du contrôle passe après cette correction ; aucun SVG n’a été modifié pour contourner un test.

Une première capture PowerShell du refus d’écrasement perdait le code de retour dans un pipeline. La preuve a été refaite avec `spawnSync` et comparaison des empreintes, puis ajoutée comme test automatisé. Les corrections visuelles ont entraîné une régénération des seuls 203 nouveaux fichiers, avec sauvegarde préalable, protection SHA des anciens et mode de création `wx` inchangé.

Le lancement manuel supplémentaire de `next start` à 127.0.0.1 a été rejeté par la politique d’exécution (« blocked by policy »). Le contrôle HTTP manuel additionnel des 325 anciennes routes n’est donc pas revendiqué. Le vrai GET historique est intégralement vérifié dans les tests conservés, et les contrôles HTTP/navigateur du build complet ont effectivement réussi via le scénario local existant.

L’avertissement Next préexistant sur les métriques de police de secours Big Shoulders demeure. Il n’empêche ni compilation ni types ni rendu. La suite Vitest a été exécutée avec deux workers sur Windows comme en phase 3 ; les assertions et délais historiques restent inchangés.

Les tests ne certifient pas une restitution architecturale, un modèle technique précis, une date débattue ou l’approbation artistique. Les réserves et les validations de Max et Antonin restent explicites. Les résultats CI du SHA final sont accessibles dans la PR draft #116.

## Reproduction

```sh
npm run content:generer-phase4 -- --verifier
npm run content:planches-phase4
npm run content:verifier-phase4
npm run content:verifier-phase3
npm run lint
npm run typecheck
PHASE4_BROWSER=1 npx vitest run --maxWorkers=2
npx tsx --test scripts/import-descriptions.test.ts
python3 scripts/verifier-illustrations.py
npx tsx scripts/test-sous-chapitres-local.ts --container kffr-issue92-phase2
npx tsx scripts/test-import-sous-chapitres-http-local.ts --container kffr-issue92-phase2 --corpus-phase3 --build-phase3
npx tsx scripts/build-apprendre-local.ts
npx tsx scripts/verifier-apprendre.ts
npm run content:test-demo-pedagogie
```

Sous PowerShell, définir `$env:PHASE4_BROWSER='1'` avant Vitest puis retirer cette variable après. Utiliser le Python embarqué si l’alias Windows n’est pas installé. Le Postgres jetable doit être explicitement labellisé et local ; ne jamais employer une URL Supabase distante. La CI fournit les installations Chromium et les services nécessaires, récupère l’historique Git pour les comparaisons et conserve les suites anciennes.
