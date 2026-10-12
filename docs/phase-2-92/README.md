# Issue #92 — phase 2, préparation technique

**Préparée pour audit indépendant, sans GO SQL.** Cette branche part de l'audit `ed5a682151318c68d006e2bf38662770b11b4f69`, conservé sur `issue-92-cartes-chapitres`. Les orientations validées par Antonin sont versionnées dans [structure.md](structure.md) et [le manifeste interne](../../content/pedagogie/chapitres-v2.json). La validation des futures cartes par Max reste nécessaire.

Le dépôt et les fixtures représentent **59 unités : 41 anciens chapitres actifs et 18 enfants inactifs**. Aucun enfant n'est présent dans le registre public, les choix scolaires, les pages générées ou les RPC publiques de cartes. Les **53 unités actives** sont une cible après publication complète : 35 chapitres inchangés + 18 séquences ; les 6 parents demeureront historiques. Aucune nouvelle carte pédagogique ni illustration n'a été produite. Les CSV canoniques, les 325 cartes et les SVG existants sont inchangés.

## Contrats et architecture A–K

| Exigence | Contrat implémenté |
| --- | --- |
| A. Parent/enfant | `histoire.pedagogical_units.parent_id` référence le parent permanent. Les corpus enfants partitionnent exactement les 6 corpus parents, sans trou ni doublon. Les rattachements parents restent présents. |
| B. IDs stables | THM-047 à THM-064 ; slugs explicites, uniques et conservés. Aucune allocation à partir d'un index de catalogue. |
| C. Anciens IDs | Les 41 IDs, titres, niveaux et slugs restent résolubles. Un chapitre publié, ses cartes et ses liens sont protégés contre suppression, ajout ou mutation incompatible. |
| D. États | `actif`, `historique`, `inactif`. Une publication remplace un parent par tous ses enfants dans une seule transaction. Un retour arrière réactive le parent et conserve les enfants publiés comme historiques. |
| E. URLs | Le résolveur et les paramètres statiques incluent les unités actives et historiques. Les brouillons n'ont pas de route disponible. Un ancien choix enregistré reste interprétable. |
| F. Tests/bilans | Les tests d'un ID enregistré utilisent les dates, titres et explications de ses cartes publiées. `games.context.content_version` identifie l'édition. Les réponses de `game_questions` demeurent des instantanés ; bilan et Rejouer conservent le chapitre d'origine. |
| G. Scores | Aucune modification du schéma, des politiques ou des données de `learning_progress`. Les enfants démarrent sans ligne ni score. Le profil compte les actifs et affiche séparément les résultats historiques, avec précision et difficulté conservées. |
| H. Volume | Le plafond d'import passe de 12 à 64 cartes par unité, en conservant les validations de texte, date, ID, source, ordre chronologique et ordre continu. Un brouillon peut être incomplet ; sa publication exige une couverture complète et au moins 5 questions jouables à l'année. |
| I. Imports | Préflight du manifeste et de la migration avant écriture. Une base déjà peuplée est enregistrée/protégée avant les upserts. RPC atomiques pour les liens, les lots de cartes et leur filiation. Un lot historique identique est un no-op ; une différence est refusée. |
| J. Catalogues | Registre public limité aux métadonnées d'unités disponibles. Aucun corpus, event_id, réponse, source ou empreinte privée. Le catalogue Solo conserve ses décomptes et plages générales existantes ; les décomptes des tests suivent les dates apprises. |
| K. Versions | Un ID publié désigne une version et un corpus immuables (`legacy-v1` ou `sous-chapitres-v1`). Une édition modifiant ce corpus devra recevoir un nouvel ID/version et laisser l'ancienne URL historique disponible. Aucun ancien score ne sera réinterprété. |

Les trois rubriques de THM-056 restent distinctes dans le manifeste privé et en base : génocide (2), diplomatie alliée (2), fin de guerre (4). L'URSS reste en THM-060 ; la construction européenne est autonome en THM-059.

## Migration préparée, jamais appliquée à distance

[20261012180633_preparation_sous_chapitres.sql](../../supabase/migrations/20261012180633_preparation_sous_chapitres.sql) contient une transaction limitée à `histoire`, avec délais de verrouillage/exécution et registre de migration. Elle crée deux tables privées : `pedagogical_units` et `pedagogical_card_lineage`. Elle ajoute les protections de contenu, les RPC d'enregistrement, synchronisation, import, publication/retour arrière et export, puis adapte la disponibilité des RPC publiques. Les fonctions historiques renommées restent privées. Les RPC de bilan et d'enregistrement de score sont conservées.

La migration seule n'insère ni chapitre enfant ni carte. `register_pedagogical_structure` matérialise ensuite les 18 enfants et les **188 nouveaux rattachements**, conservant les 534 anciens : **722 liens**. Aucun appel d'activation n'est présent dans l'import. Les anciennes cartes sont protégées par leur empreinte en base ; les empreintes SHA-256 du manifeste contrôlent séparément l'intégrité des lignes CSV.

Les futures copies de cartes ont leur propre `card_id` et une origine explicite `source_card_id` vérifiée (même événement, parent attendu). Une carte parent n'est jamais déplacée. Les illustrations continuent à utiliser le SVG de l'événement existant ; aucune copie de fichier n'est nécessaire. Le fichier facultatif `content/pedagogie/cartes-sous-chapitres.csv` n'existe pas dans cette livraison.

## Activation future et retour arrière

1. Auditer cette PR, notamment les droits SQL, la conservation de progression et les éditions immuables. Obtenir un **GO SQL distinct** avant toute commande distante. Le présent travail n'autorise aucune exécution distante, même en lecture.
2. Après ce GO seulement, sauvegarder et comparer les 41 IDs, les cartes, les rattachements, la progression, les parties et leurs réponses. Vérifier la conformité de la base au manifeste. Appliquer la migration et enregistrer immédiatement la structure sur la base existante, avant une réimportation canonique. Vérifier 59/325/722, 41 disponibles, 18 inactifs et la conservation exacte de l'historique. Cette procédure distante doit être préparée et auditée dans le lot de GO ; elle n'a pas été exécutée ici.
3. Produire les cartes dans les lots éditoriaux ultérieurs, relire avec Max, vérifier les illustrations et leur réutilisation. Corriger Han dans un lot documentaire séparé ; tant que son blocage reste ouvert, THM-049 ne peut pas être publié. Conserver temporairement Fachoda, Sargon CONVENTIONAL et les deux objets Becquerel sans ajustement artificiel de dates.
4. Sur une répétition locale, importer les cartes et la filiation, contrôler chaque couverture et les questions jouables. Attester le contenu par son empreinte exacte ; consigner les validations d'illustrations et de catalogue par un identifiant de preuve de revue. Ces attestations sont réservées à l'opérateur autorisé : le SQL ne remplace pas la relecture humaine.
5. Préparer et vérifier le catalogue du groupe complet. Publier via `set_pedagogical_group_active` uniquement si tous les enfants du parent passent les contrôles : aucun blocage, couverture exacte, 5 questions minimum, empreinte approuvée identique, preuves d'illustrations et de catalogue présentes. Aucun score parent n'est copié.
6. Exporter les états contrôlés, régénérer les catalogues, vérifier pages/RPC/progression/bilans et coordonner leur mise en service avec une autorisation de déploiement distincte. L'export fourni est volontairement **local uniquement**. Le contrôle CI `build-structure-pedagogique --check` fige l'état de préparation à 41 visibles ; le lot d'activation devra le remplacer par une vérification de son export attesté. Ne pas utiliser le générateur de préparation pour écraser un registre publié.
7. Pour revenir à l'ancien parcours, appeler le retour arrière du groupe, exporter et régénérer les catalogues. Le parent redevient actif ; les enfants déjà publiés restent historiques, avec leurs cartes, URLs et résultats. Ne pas supprimer les tables, cartes ou lignes de progression comme mécanisme de rollback. Le retour arrière SQL de publication est testé ; l'orchestration distante et le déploiement restent hors phase 2.

## Limites et risques explicites

- Les 231 cartes manquantes par rattachement restent à produire. Les tests existants de THM-004, THM-005 et THM-046 restent indisponibles ; aucun quota n'a été artificiellement rempli.
- Les 41 versions historiques sont figées, y compris les 35 chapitres non découpés. Leur enrichissement futur nécessite un lot d'édition explicite avec nouveaux IDs, manifeste et URLs historiques. Cette phase ne fournit pas un éditeur général de versions ni un transfert automatique de progression.
- L'import global du dataset conserve son fonctionnement par lots : il n'est pas une transaction unique pour événements, alias, packs et tags. Les opérations pédagogiques critiques sont atomiques et refusent les mutations d'historique. Une erreur en dehors de ces opérations peut laisser d'autres lots déjà importés ; la reprise idempotente et les contrôles de sauvegarde restent nécessaires.
- Le plafond SQL de 64 et les contraintes de table protègent la forme des lots ; les validations éditoriales détaillées et la chronologie sont effectuées par le validateur TypeScript. L'accès `service_role` reste un accès administratif de confiance.
- Les tests de publication utilisent uniquement des fixtures techniques temporaires en transaction annulée, reprenant des textes existants. Ils ne constituent aucune validation éditoriale ou d'illustration.
- Les fixtures jetables créent des stubs `auth`/`public` nécessaires aux tests, dans leur base locale propre ; **la migration livrée ne modifie que `histoire`**. Aucun accès au projet Supabase partagé ni à KFFR Contrée.
- La PR #110 a été examinée ; aucun de ses fichiers de frise/habillages n'est modifié. Aucun merge, déploiement, SQL distant ou activation réelle.
- `vercel.json` désactive les déploiements automatiques pour cette seule branche de préparation, conformément à la [configuration Git officielle Vercel](https://vercel.com/docs/project-configuration/git-configuration). Le comportement des autres branches n'est pas modifié.

Erratum documentaire : `CARD-006-han` est la carte de **Wudi (EVT-0041)**, et non celle de la dynastie Han **EVT-0040**, actuellement sans carte. Le paragraphe V2 est corrigé uniquement dans cette branche de préparation ; la branche d'audit et son SHA restent conservés. Les partitions et les décomptes approuvés ne changent pas.

## Fichiers et validation

- Manifeste interne et décisions : `content/pedagogie/chapitres-v2.json`, `docs/phase-2-92/structure.md`, erratum V2.
- Contrats/imports : `scripts/structure-pedagogique.ts`, générateur/export local, `fichiers-pedagogiques.ts`, `import-cartes.ts`, `import-dataset.ts`, `build-catalogue-solo.ts`.
- Application : registre `structure.json`, catalogue pédagogique, pages Apprendre, choix scolaire, progression du profil, résolution des illustrations et périmètre de tracing Next.
- SQL/tests : migration préparée, deux suites locales #92, contrôles Docker, adaptations des régressions cartes/Somme, tests unitaires structure et affichage historique.
- Intégration : scripts npm, job CI local #92 et désactivation du déploiement de cette branche.

Les commandes, la matrice des 16 exigences et les limites de vérification sont détaillées dans [preuves.md](preuves.md).
