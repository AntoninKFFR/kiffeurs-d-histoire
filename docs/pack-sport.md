# Pack Sport — préparation #90

**Découpage provisoire, à valider par Max. Migration non appliquée sur KFFR.
GO SQL séparé après revue de la PR et tests GitHub.** Aucun événement, date ou
niveau n’est créé ou modifié. Aucun autre pack n’est modifié.

La [proposition publiée avant la migration](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/90#issuecomment-6108430425)
présente les six groupes. Le relevé en lecture seule du 11 octobre 2026 confirme
397 événements jouables `TAG-0145`, 24 packs sans enfants, migration #89 appliquée,
aucune surcharge `event_editorial_overrides` sur ces 397 événements. Les données
restent celles du relevé, même lorsqu’un tag importé contredit le statut courant.

## Dossier éditorial

- [Inventaire des 397 événements](../content/sport/inventaire-397.csv) : identifiant,
  titre courant, date courante, niveau, discipline, tous les tags, sources existantes,
  précisions jouables et sous-pack. Les sources viennent des CSV v18 ; il n’existe
  pas de table `histoire.sources` en production. Aucun nouveau lien inventé.
- [Effectifs et niveaux avant/après](../content/sport/effectifs.md).
- [Sept niveaux proposés](../content/sport/niveaux-proposes.csv), non appliqués.
- [Manifeste des packs et associations](../content/sport/packs-proposes.json).
- [Compléments sourcés, séparés](../content/sport/complements-proposes.md).
- `audit-base-2026-10-11.json` conserve le relevé privé utilisé pour générer les
  fixtures. Ni ce fichier, ni les sources, ni les associations ne sont importés
  dans un composant client. Seuls libellés, bornes arrondies et comptes aboutissent
  au catalogue statique. Les réponses restent corrigées par les RPC existantes.

Les groupes partitionnent les 397 identifiants. Le parent possède aussi les 397
associations directes, afin que `/admin/packs` offre un inventaire complet pour
Retirer/Remettre. L’union de 794 associations produit toujours 397 questions.
Un retrait sur Sport masque l’événement dans toute son union. Un retrait sur un
enfant ne retire pas l’association indépendante du parent. Modifier/Historique
restent globaux ; ouvrir l’enfant permet de gérer ses propres retraits.

Football regroupe les compétitions et finales, sans sous-pack Coupe du monde
redondant. JO réunit été et hiver. Tennis signifie aujourd’hui Wimbledon ;
Cyclisme signifie Tour de France ; Sports mécaniques signifie F1. Autres réunit
40 Super Bowls, dix éditions de Coupe du monde de rugby et quatre autres repères.
Max peut préférer un Rugby autonome (dix questions Expert à l’année) et renommer
Autres ; ne pas transformer cette proposition en découpage définitivement validé.

## Résultat de l’audit

397 identifiants uniques, aucun doublon exact titre/date. Les deux « Victoire de
la France à la Coupe du monde » concernent 1998 et 2018 : ne pas les fusionner.
Neuf éditions génériques de Mondial ont aussi une finale précise dans le corpus ;
ces objets ne sont pas des doublons sémantiques, mais partagent une année en inverse.
Les séries contiennent 367 éditions/saisons et trente autres repères.

Les 22 éditions du Mondial masculin jusqu’à 2022 sont représentées (21 éditions
et l’ouverture de 1930), comme les trente JO d’été jusqu’à 2024 (21 éditions et
neuf ouvertures), et les 24 JO d’hiver jusqu’à 2022 (23 éditions et Chamonix).
Les années annulées ne sont pas des lacunes à combler. Wimbledon, Tour, F1 et
Super Bowl sont des sélections non exhaustives ; ajouter mécaniquement chaque
édition ne fournirait pas de meilleurs repères Intermédiaire. Le dataset s’arrête
en 2025 ; les événements de 2026 sont hors de cet audit.

Points discutables gardés et signalés dans l’inventaire :

- EVT-0023 : -776 est une date traditionnelle, pas une date historique certifiée.
- EVT-0872 Everest, EVT-0966 échecs et EVT-0902 massacre de Munich : périmètre du
  sport à valider. Ils ne sont ni omis ni corrigés arbitrairement.
- EVT-1997 Tokyo 2020 et EVT-1996 Euro 2020 : tenue en 2021 correctement conservée.
- Les tags DATE_STATUS d’import peuvent différer du statut de l’événement courant.
  Le moteur lit l’événement et sa réponse ; ne pas écraser des corrections pour
  faire correspondre des métadonnées anciennes.
- Sources secondaires de série souvent uniques, QA V19 annoncée dans le README
  du dataset. Cet audit de classement ne certifie pas individuellement les 397
  dates à partir de sources primaires. Aucun changement de date démontré nécessaire.

## Disponibilité réelle

Sport garde **5 Débutant, 23 Intermédiaire exclusifs, 369 Expert**, soit 28 jusqu’à
Intermédiaire. Les sept propositions donneraient 5 / 30 / 362, soit 35 cumulés.
Elles doivent être relues, puis appliquées séparément par l’administration #104 :
elles affecteraient aussi les autres packs contenant ces événements. La présente
migration n’en applique aucune, pour préserver ces packs et les surcharges.

Football (13 jusqu’à Intermédiaire) et JO (11) permettent déjà dix questions à
l’année. Tennis et Cyclisme n’en ont qu’une, Autres deux, F1 zéro ; même les
propositions ne justifient pas dix partout. Les éditions numérotées restent
Expert. Pas de quota ni de fausse précision.

Classique : Sport 397 à l’année, 29 au mois, 29 au jour. **Tout reste plafonné à
100 questions**, contrat existant. SQL inverse : 131 années distinctes, 28 mois,
29 jours. **L’interface inversée demande uniquement la date exacte**, donc 29
questions Sport : Football 11, JO 12, Tennis 1, Cyclisme 1, F1 0, Autres 4.
À cinq questions seuls Football et JO sont activés ; Tout autorise un enfant
non vide, donc les groupes à une ou quatre dates sont utilisables ainsi. F1
reste indisponible en inverse ; ses saisons n’ont pas de jour à inventer.
La roulette suit les mêmes comptes ; Replay conserve l’identifiant du parent
ou de l’enfant. Ces limites sont explicitement à valider avec Max.

## Installation après GO

Migration : `supabase/migrations/20261011111510_pack_sport.sql`, exclusivement
des insertions dans `histoire.packs`, `histoire.pack_events` et le registre
`histoire.migrations_appliquees`. Aucun changement de schéma ou de RPC. Transaction
avec délais bornés et verrou des événements/associations pour un import concurrent.
Prévoir une courte fenêtre sans import. Aucun `db push` ni `apply_migration`.

Avant GO, vérifier en lecture seule : migration #89 présente, disponibilité de
`parent_id`, les **397 identifiants du manifeste présents et toujours jouables**,
absence de collisions pour COL-0105 à COL-0111 et leurs slugs. COL-0083 à COL-0104
sont déjà réservés dans les collections structurelles v18 ; ne pas les réutiliser.
Vérifier aussi les changements éditoriaux depuis le relevé et refaire les comptes
si nécessaire. La migration refuse un corpus partiel. Si aucun de ses événements
n’est présent (pile locale vide avant import), elle ne crée rien et ne s’enregistre
pas dans le registre Histoire ; la rejouer après import. Ce cas ne constitue pas
une installation de production réussie.

Idempotence : `ON CONFLICT DO NOTHING` conserve positions et métadonnées existantes,
ainsi que l’ensemble des retraits, corrections et audits. La répétition n’efface
pas une décision administrative et ne resynchronise pas les anciens packs.
L’import v18 synchronise seulement COL-0059 à COL-0082 : nouveaux packs et
associations restent hors de ses propriétaires. Le précontrôle de l’import refuse
une collision d’identifiant ou de slug Sport avant la première écriture, y compris
pour un futur dataset. Les futurs datasets devront
réserver COL-0105 à COL-0111 et conserver les identifiants sportifs ; si des événements
sont fusionnés/supprimés, une migration de contenu relue devra adapter le manifeste.
Ne pas introduire silencieusement ces identifiants dans `ready-collections`.

Après GO : vérifier 31 packs, six enfants de Sport, 794 associations directes,
union 397 avant retraits, trois décomptes selon le niveau et le sens, administration
et registre. La prévisualisation Vercel utilise KFFR partagé : **Sport n’y sera
pas jouable avant le GO SQL**, même si le catalogue statique est régénéré.

## Reproduction et vérifications

`npx tsx scripts/auditer-sport.ts` régénère l’inventaire, les propositions et les
effectifs depuis le relevé conservé, sans accès réseau/base. Puis
`npx tsx scripts/preparer-sport.ts supabase/migrations/20261011111510_pack_sport.sql`
régénère SQL et fixture. `npm run content:catalogue-solo` ajoute seulement ces
sept packs : les 24 anciens packs et les autres rubriques du catalogue sont inchangés.

- Vitest ciblé : 397 sources/associations, collisions d’identifiants, union,
  comptes/niveaux, propositions non appliquées, vraie navigation Sport et choix
  indisponibles, tests existants mémoire/roulette/replay/admin.
- `supabase/fixtures/sport_397.sql` charge les **événements existants**, uniquement
  dans le simulateur local vide. `scripts/tests-sql.sh` rejoue ensuite la migration
  deux fois. `supabase/tests/pack_sport.sql` couvre sept périmètres, deux sens,
  trois précisions, 5/10/20/Tout, réponses cachées, roulette, replay, admin et surcharges.
- `e2e/preparer.ts` installe le vrai contenu après l’import dans la pile locale.
  `e2e/sport.spec.ts` couvre PC/mobile, clavier, partie et Replay, restauration,
  réimport réel et migration répétée avec retrait préservé, 24 packs comparés avant/après.
- `npm run test:sous-packs-browser -- --sport` : vraie application Next compilée,
  API de fixtures locale sans clé KFFR, six lectures PC/mobile, focus, désactivation,
  absence de défilement global PC. Mesures dans `docs/captures/issue-90/mesures.json`.

Docker indisponible dans cette session : suites SQL et E2E réelles préparées pour
GitHub, non exécutées ici. Aucune suite longue locale, aucune attente de CI,
aucun SQL de production, aucune fusion. Validation éditoriale et GO restent requis.

Vérifications exécutées : 57 tests ciblés verts (contenu Sport, choix, catalogue,
composants sous-packs, Thème mystère et administration), lint, typecheck, build
Next, six parcours de lecture Chromium et `git diff --check`. PC : document
exactement 800 px pour une fenêtre de 800, et 768 px pour une fenêtre de 768,
dans les deux sens. Mobile : 375 px de largeur sans débordement, navigation
clavier et barre Jouer accessibles. Aucune modification CSS nécessaire.
Le build sans configuration Supabase échoue sur le pré-rendu pédagogique faute
de variables ; le runner de lecture fournit l’API de fixtures locale et compile
les 69 pages correctement. Aucun secret de production n’est utilisé pour ce contrôle.

### Correction de la CI SQL de la PR #108

Le run `38136006366` du commit `9e93fca` valide verifier, E2E et cartes locales,
dont le vrai réimport préservant les 24 packs et les retraits Sport. SQL échoue
dans `pack_sport.sql` sur la collision variable/colonne `niveau`. Les variables
des deux blocs sont désormais préfixées `v_` et les colonnes des sous-requêtes
qualifiées, sans changer les assertions métier. Les contrôles des 397 triplets
événement/sous-pack/position et des sept couples identifiant/slug sont renforcés.
Migration, import et contenu restent inchangés ; les deux applications successives
de la migration sont toujours exécutées par le simulateur CI.

Contrôles locaux de cette correction : neuf tests ciblés verts, lint, types,
build avec API de fixtures et `git diff --check`. Docker ne démarre pas et
PostgreSQL n’est pas installé dans Ubuntu/WSL : le test SQL complet ne peut pas
être relancé ici. Aucun accès à Supabase distant ; migration Sport toujours non
appliquée. La PR reste en brouillon, sans fusion ni attente du nouveau run GitHub.
