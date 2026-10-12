# Audit #92 — cartes d’apprentissage et structure des chapitres

**PROPOSITION NON VALIDÉE — AUDIT PHASE 1B — V2**

Audit du 12 octobre 2026 pour Antonin et Max. Base Git vérifiée : `main`, `c28d11eabe8aea1917f86b36839c289c899070ca`. Branche documentaire : `issue-92-cartes-chapitres`. Aucune carte, illustration, migration, fonction de jeu ou donnée joueur modifiée. Aucun SQL de production, import, merge ou déploiement exécuté.

## Mise à jour V2

La [PHASE 1B](phase-1b-v2.md) corrige EVT-0115 : THM-017-S3 **5 événements**, S4 **10**. Elle revoit historiquement les 21 séquences, compare les deux options THM-012 sans choisir, chiffre les remèdes aux cinq séquences au seuil et précise Han/Fachoda/Sargon/Becquerel. Les inventaires de phase 1 restent valables : les sources sont inchangées. Les 21 séquences et les 56 unités actives sont le scénario de référence, conditionnel aux décisions ; les alternatives modifient ces totaux.

## A. Synthèse exécutive

Le programme des **41 chapitres pédagogiques** contient **479 événements uniques**, distribués dans **534 rattachements événement/chapitre**. Les **325 cartes** se répartissent en **303 cartes événementielles** couvrant **266 événements uniques**, et **22 cartes de contexte** sans événement. Les API publiques KFFR confirment les 41 chapitres, 534 liens et 325 cartes ; leurs champs publics comparés correspondent au dépôt.

Il manque **231 cartes événementielles si chaque rattachement reçoit sa carte** : **229 rattachements jouables** et deux non jouables. Ces manques concernent **224 événements distincts** ; onze ont déjà une carte dans un autre chapitre. Il reste donc **213 événements uniques sans aucune carte**, dont **211 jouables**. Ne pas convertir « 213 événements » en « 213 cartes à produire » : certains doivent être expliqués dans plusieurs contextes scolaires.

| Chiffre de l’issue | Résultat du contrôle | Interprétation exacte |
| --- | --- | --- |
| 41 chapitres | 41 | Nombre de chapitres actifs du catalogue |
| 517 événements rattachés | 517 rattachements jouables ; 479 événements uniques ; 534 rattachements totaux | 517 est la somme des volumes YEAR par chapitre, pas une union d’événements |
| 325 cartes | 325 | 303 événementielles + 22 contextes |
| 288 événements couverts | 288 rattachements couverts jouables ; 251 événements uniques couverts jouables | 266 événements uniques couverts au total, y compris les non jouables |
| 229 événements à couvrir | 229 rattachements jouables sans carte | 211 événements uniques jouables sans aucune carte ; 231 manques par chapitre avec les non jouables |

**Six chapitres dépassent 20 événements** : THM-006 (24), THM-012 (21), THM-016 (55), THM-017 (39), THM-024 (26), THM-025 (23). La proposition les répartit en **21 séquences de 5 à 17 événements**, soit **56 unités actives** si les six parents deviennent des références historiques. Les parents ne doivent pas être supprimés. Les listes exactes, justifications et simulations sont dans [decoupage.md](decoupage.md) et [decoupage-propose.csv](decoupage-propose.csv).

**Trois tests restent indisponibles** : THM-004, THM-005 et THM-046, chacun avec quatre événements couverts jouables à l’année. **18 des 21 séquences proposées n’auraient pas encore de test** avec les seules cartes existantes : le découpage ne doit pas être activé avant complétion. Après complétion, le filtre mécanique permet cinq questions ou plus partout ; **la section Chine demeure bloquée éditorialement par l’anomalie Han**, et n’en aurait que quatre si ce repère était exclu.

**Fragilité V2 : cinq séquences ont exactement cinq événements à l’année** (006-S3, 012-S2, 017-S3, 024-S2, 025-S2). Une exclusion suffit à désactiver leur test ; les regroupements proposés ne sont pas adoptés.

Risques majeurs : suppression en cascade de la progression ; invisibilité des anciennes lignes dans le profil ; contraintes d’import limitées à 12 cartes ; perte des anciens liens lors d’une synchronisation ; micro-dates surreprésentées ; couverture du programme insuffisante malgré une couverture complète des événements actuels.

Ordre recommandé : valider périmètre et partitions, arbitrer Han/Fachoda et les repères discutables, préparer la compatibilité historique, débloquer les trois tests, compléter les gros thèmes de 3e, puis les autres niveaux. Les illustrations suivent les décisions éditoriales.

## B. Inventaire fiable du programme

L’[inventaire lisible des 41 chapitres](inventaire.md) donne tous les titres, niveaux, volumes, tests et event_id manquants. [chapitres.csv](chapitres.csv) ajoute les trois précisions, les cartes sans date structurée et les URLs actuelles. [programme-complet.csv](programme-complet.csv) décrit les **534 paires**, leurs cartes, dates, textes déjà disponibles et supports documentaires.

Le CSV curriculum comporte 705 lignes : 534 rattachements à un chapitre et un événement, 58 lignes événementielles sans chapitre, 113 sans événement. Son union plus large contient **495 événements**, dont **16 hors des 41 chapitres**. Ce périmètre plus large, notamment les repères de niveau CM1, ne doit pas être ajouté artificiellement au catalogue pédagogique. Le canon comprend 2 001 événements ; le PRD garde les anciens effectifs 2 000/46, antérieurs au nettoyage des chapitres et à l’ajout de Çatalhöyük.

Ces limites de périmètre sont inventoriées intégralement dans [rattachements-sans-chapitre.csv](rattachements-sans-chapitre.csv) et [libelles-sans-evenement.csv](libelles-sans-evenement.csv), afin de ne pas assimiler une entrée du programme sans événement à une carte événementielle manquante.

**47 événements appartiennent à plusieurs chapitres**, représentant 55 rattachements supplémentaires par rapport à l’union. [evenements-multi-chapitres.csv](evenements-multi-chapitres.csv) distingue pour chacun les chapitres couverts et non couverts. Les 303 cartes événementielles correspondent ici à 303 paires distinctes : aucun doublon de carte pour une même paire détecté.

Contrôles structuraux : aucun identifiant canonique dupliqué, lien événement/chapitre dupliqué après redirection, chapitre/événement orphelin dans les liens, carte hors rattachement, ou date de carte différente de son canon. Aucun écart détecté entre les comptes recalculés et `n`/`t` du catalogue Solo, ni entre les titres/niveaux du catalogue Apprendre et les thèmes. Cela ne certifie pas la justesse historique des dates.

Les 2 634 liens événement/source ont également été rapprochés des 821 sources et des événements : aucun identifiant source ou événement orphelin ; aucune cible canonique de redirection orpheline.

Deux anomalies éditoriales sont conservées dans [ecarts-sources.csv](ecarts-sources.csv) :

- **EVT-0040 / Han** : le titre et date_text décrivent la dynastie de −206 à 220 ; les bornes stockées décrivent 9–25. La future carte et la section Chine exigent un arbitrage canonique séparé. Ne pas reprendre ces bornes sous le titre actuel. L’audit mécanique le compte comme jouable, comme le catalogue.
- **EVT-0475 / Fachoda** : date_text et bornes sont 10 juillet–3 novembre 1898, mais la description courte indique 18 septembre–4 novembre. La carte existante suit le canon, ce qui n’efface pas la contradiction documentaire.

La Somme, EVT-0210, est déjà corrigée en plage dans le canon et sa carte ; ne pas rouvrir la correction #63 sans motif nouveau. THM-012 est intitulé « Événements complémentaires directement utiles au thème 3 » dans le dépôt : ce n’est pas un titre officiel du programme.

## C. Événements manquants et état des informations

Deux fichiers complémentaires : [evenements-uniques-sans-carte.csv](evenements-uniques-sans-carte.csv), **213 lignes**, et [cartes-manquantes-par-chapitre.csv](cartes-manquantes-par-chapitre.csv), **231 lignes**. Le second est la liste de travail pour produire des cartes contextualisées ; le premier évite les doubles recherches historiques. Les event_id exacts sont également listés par chapitre dans l’inventaire Markdown.

Chaque ligne fournit : événement, chapitre/niveau, date textuelle et toutes ses composantes, statut/précision, description existante et fichier d’origine, validation documentaire, références de date/prose/programme, réserves, jouabilité A/M/J, illustration existante et éventuelle carte dans un autre chapitre. La classification est documentaire, cumulable et explicitée dans [methodologie.md](methodologie.md).

Pour les 213 événements sans aucune carte, le dépouillement signale **20 vérifications historiques ciblées** et **trois recherches/clarifications complémentaires de date** : début de la préhistoire (EVT-0339), Rome archaïque (EVT-0025), Han (EVT-0040). Les deux premières entrées ne doivent pas recevoir de date ponctuelle artificielle. Des sources institutionnelles pour la prose existent déjà ; les sources de date recensées pour ces deux processus sont insuffisantes pour fabriquer une question automatique. Han exige une clarification du canon, pas la simple rédaction d’un texte.

« Documentaire exploitable » signifie que des matériaux existent, sans réserve bloquante détectée par les critères appliqués. Cela ne dispense pas de lire les passages des sources, contrôler leurs liens et faire relire la carte. Une description courte n’est pas une carte de 60–120 mots. Les enrichissements complémentaires, libellés vides et processus sont marqués pour arbitrage de rattachement ; ils ne deviennent pas des repères obligatoires par simple présence dans le dépôt.

| Lot actuel, avant découpage | Rattachements sans carte |
| --- | ---: |
| CM2 | 4 |
| 6e | 29 |
| 5e | 31 |
| 4e | 19 |
| 3e | 79 |
| Seconde | 9 |
| Première générale | 33 |
| Terminale générale | 13 |
| Première HGGSP | 7 |
| Terminale HGGSP | 7 |
| **Total** | **231** |

Il ne s’agit pas d’une liste des lacunes de tout le programme officiel. Les réserves de [lacunes-v1.md](../../content/pedagogie/lacunes-v1.md) restent valables : THM-027 est très militaire ; THM-028 couvre mal stalinisme et génocides ; THM-029 est concentré sur l’Indochine ; THM-031 sur le tunnel sous la Manche. THM-037–046 ont aussi des axes sans repères événementiels. Ajouter une carte à chaque événement existant ne suffit pas à corriger ces déséquilibres. Un enrichissement du corpus doit être validé séparément.

## D. Découpage proposé et programmes officiels

| Parent | Volumes proposés | Logique |
| --- | --- | --- |
| THM-006, 6e | 11 / 8 / 5 | Pouvoir romain ; juifs et chrétiens ; Chine et échanges |
| THM-012, 5e | 7 / 5 / 9 | Circulations ; transformations religieuses ; pouvoirs monarchiques, avec réserves sur les rappels médiévaux |
| THM-016, 3e | 17 / 7 / 9 / 14 / 8 | Grande Guerre et conséquences ; crises politiques ; France occupée ; guerre mondiale ; génocide et fin du conflit |
| THM-017, 3e | 9 / 15 / 5 / 10 | Indépendances ; blocs et crises ; construction européenne ; recompositions et fin de la guerre froide |
| THM-024, Première | 15 / 5 / 6 | Révolution ; Empire/restauration ; nationalités |
| THM-025, Première | 10 / 5 / 8 | République/Empire ; industrialisation ; guerre et diplomatie |

Ces partitions conservent chaque événement du parent une seule fois. Cette propriété ne valide pas leur cohérence historique : la revue V2 signale notamment le mélange de THM-016-S5, les discontinuités de THM-012-S3, Vienne avant Waterloo et les doublons de processus. Les choix de regroupement restent ouverts. Les 35 autres chapitres sont identifiés séparément dans [decoupage.md](decoupage.md). THM-028 est à 20 exactement, THM-005 à 19 : aucun ne franchit le seuil demandé.

La vérification des sources actuelles confirme que **l’ancien programme de CM2/6e reste applicable en 2026–2027** ; le nouveau programme entre en vigueur pour ces classes en 2027–2028. La proposition de 6e doit donc rester rattachée à l’ancien programme pour ce millésime. [Calendrier officiel Éduscol](https://eduscol.education.gouv.fr/4791/ressources-d-accompagnement-du-programme-d-histoire-et-geographie-au-cycle-3), [arrêté du 28 mai 2026](https://www.education.gouv.fr/bo/2026/Hebdo22/MENE2608631A).

Références consultées : [programme du cycle 3 applicable](https://eduscol.education.gouv.fr/media/100806/download?attachment=), [ressource 5e thème 3](https://eduscol.education.gouv.fr/sites/default/files/document/c4his5th3transformationsdeleuropeetouverturesurlemonde-dmindd593827pdf-78216.pdf), [ressource 3e thème 1](https://eduscol.education.gouv.fr/sites/default/files/document/c4his3th1leuropetheatremajeurguerrestotales-dm593802pdf-78228.pdf), [ressource 3e thème 2](https://eduscol.education.gouv.fr/sites/default/files/document/c4his3th2lemondedepuis1945593805pdf-78231.pdf), [programme Première générale, annexe 2](https://eduscol.education.fr/document/23413/download).

Les titres S1…S5 sont des propositions éditoriales, pas de nouveaux intitulés officiels ni identifiants approuvés. Les distributions exactes et points de validation sont exclusivement dans le dossier de proposition ; aucune nouvelle section n’existe en production.

## E. Audit technique

### Format et rédaction des cartes

[reference-cartes.md](reference-cartes.md) décrit le contrat complet. Corps constatés : **71–91 mots**, médiane **83** ; limite de validation : 60–120. Les moyennes montent de 75,7 mots au CM2 à 87,3 en Terminale HGGSP. La prose explique un mécanisme, apporte une nuance puis formule une notion à retenir ; elle évite les métadonnées techniques et les dates supplémentaires non sourcées. Le vocabulaire varie avec les classes, sans mesure automatique de compréhension.

Les dates événementielles doivent reprendre le canon composante par composante ; les statuts EXACT, CONVENTIONAL, APPROXIMATE, DISPUTED et TRADITIONAL restent distincts en interne. Aucune année zéro, aucun premier janvier inventé, aucune transformation d’un siècle textuel en borne numérique. Les sources doivent être relues pour la date et pour la prose, sans afficher leur jointure interne au navigateur.

### Découvrir, Me tester, bilan et Rejouer

`get_chapter_cards` expose une projection de 14 champs, ordonnée, sans event_id ni sources. La page est statique, ISR horaire, et les routes sont listées au build avec `dynamicParams=false`. Une carte sans début structuré reste accessible dans la liste ; elle n’est pas placée artificiellement sur la frise. Il y en a **22 : 13 événementielles et neuf contextes**. Les contextes avec bornes structurées ne sont pas pour autant jouables : ils n’ont pas d’event_id.

`TesterChapitre` utilise `catalogue.chapitres[id].t` ; seuil **5**, nombre **min(10, disponibles)** pour la précision choisie. L’élève peut sélectionner Année/Mois/Jour ; une précision sous le seuil est désactivée. `lireChoix` valide le test pédagogique pour un seul chapitre et un jeu de dates. Certaines valeurs de test invalides peuvent retomber dans un choix scolaire ordinaire ; conserver le contrôle côté serveur et prévoir un test explicite de ces cas avant migration.

`start_chapter_test` est distinct de `start_game`. Il sélectionne les événements présents dans `chapter_cards`, avec `playable=true`, mode YEAR/MONTH/DAY/RANGE, début d’année présent, mois/jour selon la précision. Le SQL sélectionne des événements, donc une deuxième carte du même événement n’ajoute pas une question. La date posée est le **début**, y compris pour une plage. L’ajout de questions début/fin dans #94 n’a pas modifié cette fonction : la note `periods` du contrat indique explicitement qu’elle est sans effet en test.

| Test indisponible | Cartes totales | Jouables A/M/J | Cause | Déblocage possible sans inventer un événement |
| --- | ---: | --- | --- | --- |
| THM-004 | 7 | 4/0/0 | Dates/processus non automatiques | Carte EVT-0553, sous les conditions Sargon déjà validées ; conserver la borne conventionnelle et les variantes Louvre/Met |
| THM-005 | 8 | 4/1/1 | Plusieurs cartes ont un statut/processus non automatique | Compléter un des dix événements jouables manquants ; Périclès est un exemple disponible, à traiter comme période biographique |
| THM-046 | 6 | 4/4/2 | Deux contextes ; EVT-0323 omis | Compléter EVT-0323, en distinguant sa communication de la plage EVT-0322 ; arbitrage de redondance indispensable |

Le bilan conserve le choix compact d’origine. Rejouer le transmet à `lancer` ; Revoir le chapitre utilise `cheminChapitre`. Le profil relit les parties sans réenregistrer un test. Enregistrer le test exige le marqueur `context.origin='test_chapitre'`, un seul chapitre, le propriétaire et une partie terminée d’au moins cinq questions.

**Limite d’idempotence existante** : `last_game_id` bloque le double enregistrement consécutif du même bilan, mais pas forcément A → B → A. La migration ne doit pas amplifier ce comportement. Prévoir une vérification séparée avec un registre unique de parties enregistrées si l’on exige une idempotence durable ; ne pas recalculer les compteurs historiques pendant cet audit.

La simulation après découpage donne les trois précisions dans [decoupage-propose.csv](decoupage-propose.csv). Trois sections seulement ont déjà cinq questions : THM-016-S1, THM-024-S1, THM-025-S1. À terme, toutes atteignent mécaniquement cinq questions à l’année, **sous réserve de correction/validation Han et de création des cartes**. L’objectif n’est pas que toutes aient un test au jour : beaucoup de repères ne se connaissent qu’à l’année.

### Préservation de la progression et compatibilité

Voir [progression-et-migration.md](progression-et-migration.md) pour la comparaison et le plan détaillé. La clé de `learning_progress` est `(user_id, chapter_id)` ; la FK vers `chapters` est **ON DELETE CASCADE**. Supprimer un parent peut supprimer découvert, meilleur score, difficulté, horodatage, compteur et dernière partie. Les fonctions de progression exigent que le chapitre existe encore ; les jeux enregistrent sa clé et son libellé dans leur contexte. `last_game_id` n’est pas une FK vers games.

Retirer seulement un ancien ID du JSON est également dangereux : `progressionDepuisLignes` filtre les ID inconnus. Les données survivraient en base mais disparaîtraient du profil. Les statistiques pédagogiques utilisent le même catalogue comme dénominateur. Les slugs sont figés et comprennent le THM : changer un titre ne doit pas changer l’URL. Les anciens choix stockés, URLs de parties et identifiants de carte restent à résoudre.

**Recommandation : évolution additive, parents et résultats historiques conservés, enfants indépendants.** Préserver les anciens chapter_id, slugs, cartes, liens et contextes de parties ; créer les nouvelles unités avec des IDs stables et sans progression initiale. Une relation parent/enfant sert à la navigation et à l’affichage historique, jamais à copier des scores. Séparer les chapitres actifs du registre complet des IDs résolubles. Les anciens tests et Rejouer restent sur leur périmètre initial. L’ancien score est affiché comme acquis sur ce périmètre, sans prétendre certifier un enfant ou un corpus enrichi.

Cette stratégie permet de préserver les données par construction. Son efficacité devra être démontrée avec les invariants de la PR technique ; **aucune migration n’est exécutée ni garantie par un essai de production pendant cette phase**. Les anciens enfants ne doivent pas être renommés arbitrairement pour faire passer un import.

### Imports, catalogues et SQL

`scripts/import-cartes.ts` exige actuellement 5–12 cartes, ordre continu et préfixe `CARD-<numéro du chapter_id>-…`. Plusieurs chapitres non découpés auront aussi plus de 12 cartes après complétion ; THM-014 pourrait atteindre 21 cartes avec ses cinq contextes pour 16 événements. Le plafond de cartes et le plafond d’événements doivent être distingués. Les tests `cartes.test.ts`, catalogue et pages contiennent les effectifs 41/325/5–12 à actualiser après validation, jamais pour masquer une perte de données.

`replace_chapter_cards` supprime/remplace les seules cartes des chapitres présents dans le lot, en transaction et sous verrou ; un chapitre absent du lot n’est pas supprimé. Un lot mal ciblé peut néanmoins enlever des cartes historiques. La FK composite `(event_id, chapter_id)` exige que le rattachement existe avant une carte. Préparer les liens avant les cartes, puis publier le catalogue et les pages en cohérence. Aucun appel d’import pendant cet audit.

`import-dataset.ts` upsert les chapitres mais synchronise les liens événement/chapitre sur le corpus importé. De nouveaux liens absents du manifeste canonique seraient candidats à suppression et pourraient rencontrer les FK des cartes. Conserver et protéger explicitement liens historiques et enfants dans une source versionnée validée ; tester la réimportation, le rollback et les verrous sur une fixture locale. L’import du canon ne doit pas écraser les corrections administratives globales.

Le catalogue Solo est généré par `build-catalogue-solo.ts`, avec redirections et déduplication avant compte ; `n/b` couvre tous les événements du chapitre et `t/tb` ses cartes jouables. Le catalogue Apprendre est un JSON commité de slugs figés ; aucun générateur dédié de ce fichier n’a été identifié. Les générateurs de relecture et de démo utilisent le CSV. Éviter une génération implicite de nouveaux slugs lors d’une réorganisation.

### Illustrations

Le stock contient **331 SVG**. Les **303 cartes événementielles** ont un dessin dédié, les **22 contextes** un motif. Un SVG est partagé par event_id entre plusieurs cartes ; sa route publique reste `/api/pedagogie/illustration/<card_id>`, avec lookup interne `server-only`. Pour les 224 événements concernés par les manques d’un ou plusieurs chapitres, **21 SVG existent déjà**, **203 dessins seraient à prévoir** si tous les rattachements sont conservés. [illustrations-a-prevoir.csv](illustrations-a-prevoir.csv) les liste exactement.

La méthode actuelle est un atelier SVG déterministe : `objets.ts` fournit les formes, `catalogue.ts` les scènes, `generer.ts` compose les objets et refuse de réécrire les références validées. `generer-cartes.ts` prépare seulement les silhouettes géographiques. Les planches et CSV assurent la relecture et les mutualisations. Aucun générateur n’a été exécuté pour cet audit.

Conventions : `content/illustrations/EVT-xxxx.svg`, viewBox 160×120, papier opaque, encre, trait de base 2 px, cinq couleurs maximum, aucun texte, contenu actif ou référence externe, poids ≤8 192 octets. `verifier-illustrations.py` contrôle le XML, nom, dimensions, palette, éléments/attributs interdits et empreintes des 120 références validées ; les tests de généralisation contrôlent aussi les duplications de dessins et les correspondances. La route refuse les SVG actifs/trop lourds/avec ID interne et sert un motif de repli.

Le PRD évoque Storage pour les illustrations d’événements de jeu, et `upload-illustrations.ts` traite ce dispositif. **Apprendre sert les SVG du dépôt par une route fondée sur card_id**, choix détaillé dans `docs/apprendre.md` ; ne pas publier un nom EVT ou une URL Storage dans les props pédagogiques. Une copie de carte destinée à un enfant nécessite une correspondance CSV valide, mais pas un deuxième SVG. Réutiliser les dessins présents après validation du contexte et éviter les scènes trop semblables entre micro-dates.

## F. Plan de réalisation par PR, après validation

1. **Validation documentaire de la structure** : Antonin/Max approuvent les partitions, le statut de THM-012, le millésime, les repères essentiels/approfondissements et la stratégie historique. Arbitrer Han et Fachoda dans une correction canonique dédiée avant leurs nouvelles cartes. Ne pas considérer le présent audit comme une approbation.
2. **Préparation technique de la compatibilité** : registre actifs/historiques, parent/enfant, IDs/slugs stables, protection des imports, choix des IDs de cartes pour copies historiques, plafond de cartes distinct des événements, profil et navigation. Préparer une migration additive et des fixtures/test de non-perte ; ne pas activer d’enfant incomplet. Sans modification des modes Solo libre/Inversé. Réserver un GO d’activation conforme aux règles applicables lors de cette future phase.
3. **Petit lot de déblocage** : THM-004, THM-005 et THM-046, avec relecture du statut Sargon, du choix de repère grec et de la redondance Becquerel. Ce lot peut précéder les gros imports une fois l’outillage prêt. Il ne remplace pas la complétion des autres cartes.
4. **Cartes primaire/collège** : 162 rattachements manquants avant retrait des éléments du petit lot ; prioriser les 79 manques de 3e, puis 6e/5e/4e et les quatre CM2. Diviser en PR 3e puis autres classes si la taille de relecture le justifie. Ne pas déployer un découpage qui supprime provisoirement les tests existants.
5. **Cartes lycée** : 69 rattachements manquants avant retrait du petit lot HGGSP ; séparation possible tronc commun (55) / HGGSP (14). Les lacunes de corpus non corrigées restent explicites. Relecture par niveau et source de date avant intégration.
6. **Illustrations et intégration par lot validé** : jusqu’à 203 nouveaux SVG et 21 réutilisations, ajustés après arbitrage des événements. Import/version du contenu, catalogues, relecture, cache et routes évoluent ensemble. Les phases cartes/illustrations peuvent être regroupées pour éviter des allers-retours de publication.
7. **Validation finale et activation** : comparaison exacte des projections et ensembles d’événements, cinq questions minimum par unité active, conservation des anciennes URLs/bilans/compteurs, tests de sécurité et réimport, relecture Antonin/Max. Seule la dernière PR d’implémentation utilise `Closes #92` après satisfaction des critères. Aucun merge pendant l’audit.

Tests à prévoir : partitions exactes sans pertes/doublons, ne tester que les cartes de l’unité, seuils 4/5/10/11, A/M/J et plages, contextes exclus, RPC/bilan/Replay visiteurs et comptes, anciens IDs résolus même archivés, nouvelle progression vide, snapshots historiques inchangés, comptes isolés par RLS, import hors périmètre refusé, réimport conservant anciens et nouveaux liens, cartes déplacées/copieuses et route SVG, profil actif/historique sans double comptage, absence d’event_id/sources dans HTML/RSC/props. Les SQL de test restent locaux/CI ; aucun test de partie n’est lancé sur KFFR ici.

## G. Décisions à trancher

**La liste exacte V2 est D1–D11 dans [phase-1b-v2.md](phase-1b-v2.md)** : elle précise les destinations THM-012, les alternatives aux cinq séquences fragiles, THM-016-S5, les quatre arbitrages et la compatibilité. Les questions générales ci-dessous restent le cadre de la phase 1 ; elles ne remplacent pas les arbitrages détaillés V2.

1. Valider les six partitions et les titres proposés ; conserver THM-012 comme parcours de compléments ou réaffecter ses rappels médiévaux ?
2. Exiger une carte pour chaque micro-date actuelle, ou distinguer repères essentiels et approfondissements, avec exceptions documentées au critère de couverture ?
3. Valider la conservation des parents, cartes et scores historiques avec progression vide pour les enfants, et leur affichage séparé dans le profil ?
4. Arbitrer Han/Fachoda, le cinquième repère de THM-046 et les conditions Sargon ; une simulation mécanique ne les valide pas.
5. Traiter les axes manquants du programme dans #92 ou dans une issue dédiée de corpus, sans les confondre avec les 231 cartes recensées ?

## Traçabilité et vérifications de cette phase

L’issue était libre lors du contrôle : aucun label en cours, assignation, commentaire, PR ouverte ou branche dédiée #92. Prise en charge déclarée pour **AntoninKFFR**, titre 🚧 et label en cours ; seule la ligne #92 et la date de mise à jour de la roadmap #98 ont été modifiées. L’issue reste ouverte et non cochée en attente de validation éditoriale.

Les effectifs et partitions ont été recalculés par des analyses lisant uniquement les sources ; seules les sorties documentaires de ce dossier sont enregistrées dans Git. [empreintes-sources.csv](empreintes-sources.csv) fige les fichiers de référence. Les programmes ont été consultés le 12 octobre 2026. Les réponses publiques KFFR ont été lues le **12 octobre à 18:12, heure de Paris** (16:12 UTC), par GET sur `get_chapter_cards`, `chapters`, `event_chapters`, `events` avec sélection limitée de champs publics. Aucun accès aux tables privées de réponses, comptes, parties ou progression.

Les champs privés de `event_answers` des événements sans carte et la définition SQL réellement installée n’ont pas été interrogés. Leur jouabilité/date est inférée du canon commité et des contrats de migration ; les compteurs du catalogue et les champs publics/flags correspondent. Aucun score utilisateur n’a été inspecté. Le dossier précise ces limites au lieu d’affirmer une vérification SQL de production.

Le résultat des contrôles locaux et du build de fixture est consigné dans [verification.md](verification.md). Ces vérifications ne démontrent pas une migration future : elles établissent l’état de référence et la cohérence des documents. Aucune PR d’implémentation n’a été ouverte.

**AUDIT #92 TERMINÉ — EN ATTENTE DE VALIDATION ÉDITORIALE**
