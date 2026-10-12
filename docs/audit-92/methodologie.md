# Méthode et limites de l’audit

Base commise : `c28d11eabe8aea1917f86b36839c289c899070ca`. Les analyses ont lu les sources sans les modifier ; les programmes et issues ont été lus en ligne. Les seuls changements Git sont des documents d’audit. Scripts temporaires d’analyse hors dépôt ; aucun générateur de contenu ou import exécuté.

## Ensembles et calculs reproductibles

1. Lire les CSV avec un vrai parseur : virgules, guillemets échappés et cellules multilignes. Lire les JSON des deux catalogues.
2. Construire `canon(event_id)` à partir de event-redirects, selon la règle utilisée dans build-catalogue-solo et import-dataset.
3. Pour chaque theme_id actif, former l’ensemble `E_chapitre` des event_id canoniques des curriculum-links dont theme_id et event_id sont renseignés.
4. Former `C_chapitre` des lignes cartes-v1 pour ce chapitre, et `V_chapitre` de leurs event_id non vides distincts. Les lignes sans événement sont des contextes.
5. Manques par chapitre = `E_chapitre − V_chapitre`. Nombre de cartes = nombre de lignes, pas cardinalité de V. Les manques globaux sans aucune carte = union(E) − union(V). L’union des manques par chapitre est un troisième ensemble : des événements peuvent manquer ici et être couverts ailleurs.
6. Jouabilité YEAR = playable TRUE, playable_mode YEAR/MONTH/DAY/RANGE, start_year renseigné. MONTH ajoute start_month ; DAY ajoute start_month et start_day. Ces règles reproduisent le générateur et le contrat start_chapter_test. La présence d’une année seule ne suffit pas.
7. Compter chaque ensemble dédupliqué pour n et t, comparer aux JSON. Un chapitre dispose d’un test à une précision s’il a au moins cinq membres jouables dans V ; questions = min(10, volume). Zéro dans le tableau « questions » signifie indisponible, pas un test de zéro question.
8. Pour chaque partition proposée, vérifier : union des sections = E_chapitre, intersection vide entre sections, IDs existants, aucune section >20. Simuler présents et complets par précision. « Complet » est une hypothèse d’une carte par événement de section ; elle ne vaut pas validation historique.

Réconciliation : 534 paires = 303 paires couvertes + 231 manques ; 517 paires jouables = 288 couvertes jouables + 229 manques jouables. Union : 479 = 266 + 213 ; 462 jouables = 251 + 211. L’union des manques par chapitre a 224 membres, dont onze déjà couverts ailleurs. 47 événements multi-chapitres créent 55 paires supplémentaires. Aucune addition naïve des manques par chapitre n’est présentée comme un nombre d’événements uniques.

## Classification documentaire

Description disponible : ajouts de descriptions en priorité, sinon description_short du canon. Conserver le fichier d’origine et antonin_validation. Consulter aussi la revue de sources de descriptions, notes canoniques, liens/sources, propositions validées de rattachement et audit qualité scolaire.

La colonne « vérification historique requise » signale : réserve documentaire restant ouverte, description absente, aucun support historique recensé, statut de date autre qu’EXACT, source_status SUPPORTED_C, ou l’anomalie Han/Fachoda connue. C’est un filtre de priorité, pas une certification du reste du corpus.

« Source complémentaire de date requise » signale l’absence de support HISTORICAL dont scope contient DATE/PERIOD, avec URL et mapping_confidence A/B, ainsi que Han, dont la contradiction oblige à clarifier le passage et les bornes. Les liens institutionnels de prose pour les processus non jouables restent utiles ; ils ne justifient pas une date ponctuelle.

« Rattachement à revoir » signale libellé officiel vide, statut ou sous-section complémentaire/enrichissement/contexte, ou les deux processus manquants sans question de date pertinente. Les enrichissements sont des matériaux, pas des obligations BO. Les drapeaux sont cumulables. Dans le fichier d’événements uniques, les colonnes de contexte prennent le premier chapitre ; les ensembles chapitres/niveaux sont complets. Pour comparer tous les rattachements, utiliser le fichier par chapitre.

Aucune URL historique n’est inventée. Les références existantes sont reportées avec leurs identifiants et support_scope, même si elles sont secondaires ou insuffisantes. Leur existence dans le dépôt ne signifie pas qu’elles ont toutes été ouvertes, qu’elles sont vivantes ou qu’elles prouvent toutes les assertions. Les sources officielles de programme ont été ouvertes ; la future production doit relire chaque passage de date et de prose.

## Contrôle public KFFR

GET public de get_chapter_cards pour chacun des 41 IDs ; GET paginé de chapters, event_chapters et events (id/title/playable/playable_mode). Clé publique obtenue par le connecteur Supabase, non enregistrée dans le rapport. Aucune session utilisateur, aucun SQL ni mutation distante. Lecture achevée le 12 octobre 2026 à 16:12 UTC/18:12 Paris.

Comparer les paires exactes, IDs/titres de chapitres et événements, flags/modes publics, ainsi que les 14 champs de chaque carte publique au CSV (conversion null/entiers et tableau de concepts). Résultat : aucune divergence sur ces contrôles. Les dates privées d’événements sans carte et le contenu de la table privée chapter_cards ne sont pas interrogés ; ni la définition SQL déployée, ni l’historique des parties/joueurs.

La cohérence de jouabilité est donc exacte pour les fichiers et contrats de référence, avec corroboration publique des flags et des cartes. Elle ne démontre pas par une requête privée que toutes les réponses de production sont identiques. Aucun lancement de partie sur KFFR n’a servi de test, puisqu’il écrirait des parties.

## Sources et vérification locale

[empreintes-sources.csv](empreintes-sources.csv) fournit les SHA-256 de la base éditoriale et des principaux contrats techniques. Les documents obligatoires CLAUDE, PRD, architecture, apprendre, progression, issues #92/#98 et le CSV complet ont été lus. Les scripts d’import/catalogue/illustrations, migrations/tests et composants du parcours ont été inspectés.

Les guides Next.js 16.3.8 installés ont été consultés pour les routes dynamiques ; aucune modification de code Next n’a été écrite. Les contrôles lint, types et build utilisent le worktree dédié. Le build de CI `build-apprendre-local.ts` remplace uniquement la RPC pédagogique par une fixture HTTP locale ; il ne se connecte pas à KFFR. Aucun test SQL n’est exécuté dans la base partagée.

## Fichiers à utiliser

| Fichier | Unité et finalité |
| --- | --- |
| chapitres.csv / inventaire.md | 41 chapitres, volumes et IDs manquants, URLs |
| programme-complet.csv | 534 paires actuelles, matériaux déjà disponibles |
| rattachements-sans-chapitre.csv | 58 liens événementiels de niveau hors rattachement à un chapitre, dont 16 événements extérieurs au catalogue |
| libelles-sans-evenement.csv | 113 libellés du programme sans événement ; aucune date ou carte inventée pour les compléter |
| cartes-manquantes-par-chapitre.csv | 231 cartes événementielles potentielles, contexte scolaire détaillé |
| evenements-uniques-sans-carte.csv | 213 recherches événementielles sans carte nulle part |
| evenements-multi-chapitres.csv | 47 événements mutualisés, couvertures partielles |
| decoupage.md / decoupage-propose.csv | Six partitions, 21 séquences, simulations A/M/J et validations |
| cartes-contexte.csv | 22 contextes ; aucune question de test déduite |
| illustrations-a-prevoir.csv | 224 événements concernés par un manque de rattachement, 21 réutilisations / 203 créations possibles |
| ecarts-sources.csv | Anomalies éditoriales Han/Fachoda ; absence de divergence structurelle/public séparément décrite |
| style-par-niveau.csv / reference-cartes.md | Statistiques et contrat rédactionnel existant |
| progression-et-migration.md | Comparaison de stratégies, option additive, invariants |
| verification.md | Résultats réellement exécutés et limites |

Les tableaux CSV contiennent des cellules multilignes et des listes `;` : les ouvrir avec import CSV UTF-8 standard. Ils constituent des documents d’audit internes et ne doivent pas être embarqués dans des props publiques de l’application, car ils relient event_id et dates.
