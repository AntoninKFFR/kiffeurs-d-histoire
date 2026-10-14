# Phase 4 — les 203 illustrations de l’issue #92

Cette campagne complète les images des **292 cartes préparées en phase 3** : **203 nouveaux SVG** et **82 réutilisations intactes**, mutualisés pour **285 événements**. Le stock contient désormais **534 SVG**, dont les **331 anciens restent identiques octet par octet** au SHA `41060638e7c3e75f89669d68ecc7c5734f0627d0` et à la base main de #111. La branche reste `issue-92-cartes-integrales`, dans la seule PR draft #116.

Toutes les nouvelles images sont **en attente de validation par Max et Antonin**. La préparation ne modifie ni cartes, ni dates, ni canon, ni stock graphique #66. Le blocage Han est conservé. Aucun import distant, SQL de production, déploiement, fusion ou fermeture de #92.

## Relecture des dessins réels

Ouvrir les [17 planches comparatives](planches.md), puis leurs versions natives **160 × 120**, et la [vue d’ensemble des 203 dessins](vue-ensemble-203.png). Chaque planche commence par **quatre SVG effectivement validés**, protégés par `reference-validee.json`. Le format comparatif reprend exactement les dimensions et la grille de #66. Les étiquettes et titres sont hors des SVG.

Les 203 nouveaux dessins apparaissent une seule fois dans [l’index principal](planches-index.csv). Les versions natives et la vue d’ensemble servent à relire ce même inventaire. La [relecture indépendante](relecture-independante.md) décrit les 203 sujets réellement examinés et les corrections. La [liste humaine](validation-humaine.md) garde les réserves par événement.

## Inventaires et preuves

| Pièce | Contenu |
| --- | --- |
| [285 événements](inventaire-285-evenements.csv) | Cartes associées, titre, fichier, origine, poids, SHA, intention, références DA et vigilances |
| [203 nouveaux SVG](nouveaux-203-svg.csv) | Liste exacte des créations, sans doublon ni fichier inutilisé |
| [82 réutilisations](reutilisations-82-svg.csv) | SVG préexistants réutilisés avec leurs empreintes |
| [292 cartes](couverture-292-cartes.csv) | Correspondance exacte `card_id → event_id → SVG`, avec les 61 filiations |
| [331 anciens SVG](integrite-331-svg.csv) | Trois empreintes comparées : main, phase 3 et stock actuel |
| [Adaptations du stock](adaptations-stock.csv) | Formes ajoutées, références de facture graphique, réserves et événements utilisateurs |
| [285 rendus effectifs](rendus-svg.csv) | Dimensions natives, pixels dessinés et SHA du PNG réellement produit |
| [Contrôles automatiques](rapport-controles.json) | Effectifs, sécurité, intégrité, planches, rendu et reproduction |
| [Tests techniques](tests-techniques.md) | Exécutions, scénarios locaux et portée précise des preuves |

## Direction artistique et génération

La facture reste celle du « Cabinet de curiosités » validée lors de #66 : fond papier `#f3f2ec`, trait encre `#1d2a3a`, aplats laiton `#b08a3e`, oxyde `#8a2f2b` et sauge `#7e8c7a`, formes simples, extrémités arrondies, composition en vis-à-vis. Les formes du stock validé et sa compensation de largeur de trait sont réutilisées. Les adaptations vivent uniquement dans `phase4-objets.ts` ; `objets.ts`, `catalogue.ts`, `generer.ts`, `planches.mjs` et les anciennes planches restent intacts.

Les scènes sont explicites dans `phase4-scenes.ts`, liées à toutes les cartes correspondantes et à l’inventaire immuable de phase 3. Les bâtiments restent des évocations, pas des restitutions certaines. Les outils préhistoriques sont en pierre, les équipements antiques sont adaptés, les bateaux et avions suivent leur contexte. Les massacres et génocides sont évoqués avec retenue. Les documents comportent seulement des traits abstraits, sans texte, date ou identifiant.

L’extension est déterministe et locale. Elle compare d’abord les 331 anciens SVG au commit de référence, contrôle les 203 destinations et prépare tous les contenus avant de créer les fichiers avec `wx`. Elle **refuse toute relance qui écraserait un fichier**, avant la première écriture. Le mode de vérification recalcule les 203 dessins en mémoire et les compare aux octets livrés. Aucun service distant n’intervient.

```sh
npm run content:generer-phase4 -- --verifier
npm run content:planches-phase4
npm run content:verifier-phase4
npx tsx scripts/illustrations-pedagogiques/phase4-dossier.ts
```

La commande sans `--verifier` ne sert qu’à la première création lorsque les 203 fichiers sont absents. Ne pas relancer le générateur historique #66 ni l’upload Storage. Les documents de phase 3 décrivent l’état antérieur à cette campagne et restent conservés comme preuves.
