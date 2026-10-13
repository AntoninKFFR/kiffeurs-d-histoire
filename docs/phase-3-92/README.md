# Phase 3 intégrale — corpus privé de l'issue #92

Les deux CSV préparent **292 nouveaux enregistrements** : **104 complétions** dans **27 chapitres**, et **188 cartes** dans les **18 enfants THM-047 à THM-064**. Les enfants réunissent **127 rédactions nouvelles et 61 copies fidèles**, avec `source_card_id`. Les **231 manques** de l'audit sont tous couverts. Aucun événement ajouté au canon, aucun contenu publié, aucune activation distante, aucune nouvelle migration et aucun SVG produit.

Base de travail vérifiée : `a4759cea8bebd66003c2d69592bf8fd5af24b264`, fusion de #111. Branche unique : `issue-92-cartes-integrales`. La configuration Git Vercel interdit le déploiement de cette branche. Cette préparation réutilise les importeurs, éditions, instantanés et garde-fous de #111 ; elle ne change pas l'architecture applicative ou SQL.

## Relecture pour Antonin et Max

Commencer par le [recueil des 292 cartes](recueil-cartes.md), organisé par niveau puis chapitre. Chaque carte comporte son identifiant, la date canonique, le texte, l'idée à retenir, les notions, les sources du CSV, les appuis complémentaires consultés et les réserves utiles. Les copies sont présentées avec leur origine pour que la relecture soit exhaustive dans un seul document.

| Livrable demandé | Pièce disponible |
| --- | --- |
| A — Inventaire des 292 lignes | [inventaire-292.csv](inventaire-292.csv), plus les deux CSV complets de contenu |
| B — Couverture des 59 unités | [Table lisible](couverture-59-unites.md), [table complète avec événements et modes](couverture-59-unites.csv) |
| C — Recueil intégral | [recueil-cartes.md](recueil-cartes.md) |
| D — Sources et limites de consultation | [sources-par-carte.csv](sources-par-carte.csv), journaux `sources-*.json` |
| E — Cas sensibles et décisions | [evenements-sensibles.csv](evenements-sensibles.csv), [fiche Han](fiche-han.md), [fiche Fachoda et Becquerel](jalons-sensibles.md) |
| F — Campagne d'illustrations suivante | [par événement](illustrations-par-evenement.csv), [par carte](illustrations-par-carte.csv), [contraintes DA](illustrations.md) |
| G — Preuves techniques | [rapport des tests](tests-techniques.md), [résultat exhaustif du corpus](rapport-controles.json) |
| H — Historique intact | [325 empreintes de cartes](integrite-cartes-historiques.csv), [331 empreintes SVG](integrite-svg.csv) |
| I — Validation humaine | [liste exacte et dossiers](validation-humaine.md), [relecture des copies](relecture-copies.md), [audit indépendant](audit-editorial-independant.md) |

## Effectifs réels par niveau

| Niveau canonique actuel | Rédactions nouvelles | Copies fidèles | Total préparé |
| --- | ---: | ---: | ---: |
| CM2 | 4 | 0 | 4 |
| 6e | 29 | 8 | 37 |
| 5e | 31 | 8 | 39 |
| 4e | 19 | 0 | 19 |
| 3e | 79 | 22 | 101 |
| Seconde générale et technologique | 9 | 0 | 9 |
| Première générale | 33 | 23 | 56 |
| Terminale générale | 13 | 0 | 13 |
| Première HGGSP | 7 | 0 | 7 |
| Terminale HGGSP | 7 | 0 | 7 |
| **Total** | **231** | **61** | **292** |

Les rattachements et libellés officiels viennent du référentiel actuellement utilisé, sans mélange avec des programmes futurs. Le contrôle reconstruit les **534 couples historiques événement/chapitre** depuis les liens et redirections canoniques, déduit leurs manques par comparaison avec les 325 cartes, puis compare exactement les ensembles à l'audit et au manifeste #111. Les six parents découpés sont couverts par l'union de leurs enfants ; leurs cartes et tests initiaux restent conservés. Le détail des **231 destinations** est dans [couverture-231-manques.csv](couverture-231-manques.csv).

## Contenu et méthode

Les fichiers de livraison sont `content/pedagogie/cartes-completions.csv` (les 19 champs historiques) et `content/pedagogie/cartes-sous-chapitres.csv` (les mêmes champs, puis le champ de filiation prévu par #111). Les rangs sont continus et chronologiques par destination, sans transformer une année seule en premier janvier. Les **617 identifiants** de cartes anciennes et nouvelles sont distincts. Les 61 copies conservent tous les champs de leur origine, sauf leur nouvel identifiant, leur chapitre et leur rang ; aucune carte parent n'est déplacée ou réécrite.

`redaction-primaire.json`, `redaction-college.json` et `redaction-lycee.json` sont les sources de travail des **231 rédactions**, avec les intentions d'images. Ce ne sont pas des variantes concurrentes des copies historiques. L'assemblage matérialise les deux CSV selon le plan exact. Le recueil et les tableaux sont des projections de relecture de ces CSV.

Les journaux indiquent les passages réellement consultés, leur date, les affirmations soutenues et les limites : page complète utile, extrait, notice, transcription, original en fac-similé ou accès impossible. Une URL héritée n'est pas réputée fiable par sa seule présence. Les sources mal associées des copies restent dans leur champ historique pour préserver la fidélité ; des appuis distincts et des réserves explicites les accompagnent. Tous les URL des **231 nouvelles rédactions** ont une consultation attestée. Ce contrôle ne prétend pas certifier savamment chaque jour du canon : les divergences et précisions non corroborées restent à la relecture humaine.

La relecture indépendante porte sur 224 rédactions ; les sept dernières de THM-018 ont ensuite été lues par le coordinateur et confrontées aux sources dans `sources-finalisation.json`. Les deux collisions avec les mots interdits du validateur ont été corrigées dans la prose, sans changer ce validateur. Becquerel a été confronté aux pages originales 689–690 ; Han reste bloqué ; Sargon reste conventionnel ; les processus préhistoriques ne reçoivent aucune date ponctuelle inventée.

## Protection et reproduction

Les **325 cartes historiques** correspondent exactement aux empreintes #111. Le CSV correspond octet par octet au checkout de main : SHA256 `466e5e766ad6fc23471c99fe2f3407e791c772e70d98550fce413f02a2fb622c`. Le blob Git, normalisé en LF, vaut `3a44ce68f68ab47273ce7d4dd03e165bc72c1986493590f83e665e3f2ade95d7` ; l'écart provient exclusivement des fins de ligne CRLF de Windows. Le vérificateur compare les deux représentations, toutes les cartes, la liste et les octets des 331 SVG, ainsi que le diff des chemins protégés : canon, manifeste, code applicatif, SQL, audit et DA.

```sh
npx tsx scripts/phase3-pedagogie.ts --plan
npx tsx scripts/phase3-pedagogie.ts --assembler
npm run content:verifier-phase3
```

La première commande reconstruit le plan sans contenu ; la deuxième assemble les rédactions et les copies ; la troisième contrôle les CSV livrés et régénère les pièces de relecture. Ces commandes n'importent rien et n'ont aucun accès réseau. Les simulations d'import et de publication utilisent seulement un Postgres local labellisé, une base aléatoire jetable et PostgREST local. Les états exportés et catalogues sont restaurés après les tests, y compris en cas d'erreur.

La **validation de Max et Antonin reste nécessaire sur la totalité du corpus**. Aucun champ de validation du manifeste n'a été rempli. Les attestations artificielles des tests ne valent ni validation éditoriale ni validation des futures images. Toute publication, import distant ou campagne SVG relève d'une étape ultérieure explicitement autorisée.
