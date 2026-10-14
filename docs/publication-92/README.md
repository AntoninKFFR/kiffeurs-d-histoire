# Publication intégrale de l’issue #92

Corpus humainement approuvé : `31ab0d56dd87a3400101e112005d63292c544853`, 292 cartes, 203 SVG nouveaux et 82 réutilisés. La preuve est la [consigne humaine](preuve-humaine.json), distincte des attestations techniques des fixtures. Le manifeste de préparation des phases 2–4 reste figé.

Le 14 octobre 2026, Antonin a confirmé dans ce chat la liaison GitHub → Vercel et le déploiement automatique de main administré par Max. Le dernier déploiement GitHub Production de main `a4759ce` est également marqué réussi : deployment `7025438675`. La fusion attend la réussite de la publication Supabase, des vérifications et de la CI de la PR #116.

## Procédure et protections

`scripts/release-pedagogique-92.ts` reste en **dry-run par défaut**. Ce mode valide le corpus et produit seulement des requêtes de lecture. Le script n’ouvre aucune connexion réseau et ne lit aucune clé. L’émission du SQL de publication exige l’identifiant exact `bskyfdjwcdvzhlugtknb`, son origine HTTPS canonique, une autorisation explicite, la preuve humaine au SHA exact et une sauvegarde privée vérifiée de moins de quinze minutes.

La migration `20261012180633` doit déjà être enregistrée ; elle n’est jamais réexécutée. Les corps des six RPC existantes sont comparés à ceux du corpus approuvé. Les 325 cartes historiques et le canon des 285 événements sont comparés avant publication. Un nouveau blocage, un corpus divergent ou un refus RPC annule toute la transaction.

La transaction importe les enfants inactifs par `import_pedagogical_cards`, avec les 61 filiations ; prépare les 27 complétions par `stage_pedagogical_completion` ; renseigne les validations des quinze enfants éligibles ; active leurs cinq groupes par `set_pedagogical_group_active` ; publie les 27 éditions par `publish_pedagogical_completion`. Une copie déjà publiée identique est vérifiée puis ignorée, car le contrat existant interdit sa réimportation. Les protections LOCAL des importeurs restent intégralement présentes.

Les trois enfants de THM-006 restent inactifs, et `han-canon-incoherent` reste présent sur THM-049. Les 188 cartes sont importées, mais les 24 cartes du groupe Han ne deviennent pas publiques. Aucun changement de canon ni de schéma n’est effectué ; aucun `db push`, `apply_migration`, accès en écriture à Contrée, `public` ou `auth`.

La sauvegarde contient quinze tables du schéma histoire, dont les cartes, éditions, filiations, rattachements, progressions, parties et questions. Son JSON privé reste hors du dépôt et hors des logs ; seuls son SHA et ses effectifs peuvent figurer dans le rapport. Les huit tables de données joueurs, les 41 éditions initiales, les 722 liens et les unités Han sont comparés dans la transaction, avant et après publication. Les écritures concurrentes des joueurs restent libres et ne sont jamais restaurées depuis une ancienne sauvegarde.

## Retour arrière

`sqlRollback92` utilise uniquement les 27 appels `rollback_pedagogical_completion` et les cinq désactivations de groupes. Il conserve cartes, éditions publiées, filiations, progressions et parties. Les anciennes éditions redeviennent courantes ; les enfants publiés deviennent historiques. La transaction compare toutes les données conservées et Han ; elle refuse toute perte. Une republication identique reste possible.

Pour émettre le SQL, fournir une nouvelle sauvegarde vérifiée et la même preuve avec `--emettre-rollback` à la place de `--emettre-publication`. Les deux options sont exclusives. L’export accepte aussi le repli complet : 41 unités actives, quinze historiques et trois Han inactives. Les 593 empreintes et les 56 anciennes/nouvelles URLs publiées restent conservées.

Après tout retour arrière, réexporter l’état réel et régénérer les trois artefacts de catalogue, puis publier leur commit. Ne pas restaurer les tables joueurs depuis la sauvegarde : leurs données peuvent avoir évolué entre-temps.

## Export et contrôles

L’export utilise `export_pedagogical_structure` et les instantanés des éditions effectivement publiées. Il produit `content/pedagogie/etats-publies-92.json`, `content/pedagogie/cartes-publiees.json` et `src/lib/apprendre/structure.json`. Le générateur existant produit ensuite `src/lib/solo/catalogue.json`. Aucun état ne vient d’une activation manuelle du manifeste.

Effectifs attendus après publication : 513 lignes `chapter_cards`, 61 filiations, 83 éditions publiées, 51 unités actives, cinq historiques et trois inactives ; 56 routes publiques. Les 104 complétions vivent dans les éditions, pas dans les cartes historiques. Les empreintes publiées couvrent 593 identifiants de cartes distincts.

Le rehearsal PostgreSQL jetable exécute le SQL réellement destiné à la release : refus Han avec annulation complète, publication, réexécution identique, retour arrière et republication. Les contrôles SDK/PostgREST, RLS, scores, anciennes parties, bilans et routes du corpus intégral restent exécutés. Aucun résultat de fixture n’est présenté comme une publication réelle.

L’état effectif de la publication et les résultats des contrôles sont consignés dans le rapport de release après leur exécution.

Après le déploiement, `scripts/verifier-publication-92.ts <origine-https> <dossier-de-preuves>` contrôle 56 routes courantes, 54 routes d’éditions, 571 SVG exacts, 22 motifs et les 24 refus Han. Il examine des pages et des images décodées dans Chromium à 1280 et 375 px et conserve les captures. Il lit uniquement les routes publiques ; les tests complets de création, correction, bilan et relance sont réalisés dans les fixtures locales et la CI.
