# V1.2 — Deuxième lot massif : dossier de relais SQL

Refs #122 — issue à conserver ouverte. **Non publié en production.** Codex prépare ; ChatGPT applique le SQL après validation d’Antonin. Aucune fusion avant confirmation explicite de l’application sur KFFR.

## Périmètre et risque

**Risque élevé** selon AGENTS.md : ajout de contenu Supabase. Exiger les cinq jobs CI verts sur le dernier commit exact avant une future fusion, les contrôles de production de ChatGPT et la confirmation d’application SQL. Aucun changement de schéma, de moteur, de difficulté existante, de sécurité, d’interface ou de données joueurs.

Main de référence : `d5710fb36b4ef11a7ddc52c04c3ee0113aa9750e`. Actualisé avec origin ; aucune PR concurrente ouverte lors de la préparation. Les travaux intégrés de Max sont préservés.

## Contenu relu

- **151 événements nouveaux** (EVT-2800 à EVT-2950) : **122 Débutant / 27 Intermédiaire / 2 Expert**.
- **513 associations** concernant les nouveautés, plus **3 nouveaux rattachements** d’événements existants ; 25 packs visés. Les associations ne sont pas comptées comme événements.
- **144 DAY / 2 MONTH / 5 YEAR** ; aucun mois ou jour ajouté sans preuve.
- Groupes internes : 86 sport, 24 fun, 41 histoire/sciences. En comptant les rattachements croisés, 36 nouveautés rejoignent au moins un pack fun. Les objectifs de répartition restent indicatifs ; priorité aux six sous-packs sportifs et à la qualité.
- [Fiches complètes : descriptions, datations, niveaux, sources et packs](catalogue-massif2.md), [manifeste](../../content/enrichissement-v12/massif2.json). 170 URL documentaires distinctes, sources sportives et scientifiques officielles, archives, musées et documents originaux privilégiés.

Les recherches dans le relevé des 2 307 événements ont notamment écarté l’indépendance de la Namibie, les victoires mondiales de 1998/2018, l’Everest, Bannister, les découvertes ADN déjà présentes, le génome humain, les films déjà livrés et plusieurs canulars. Les finales mémorables sont distinguées des lignes génériques d’ouverture/édition de compétition. Les faits de 1815 distinguent débarquement, retour à Paris et abdication. Aucun ancien niveau n’est abaissé.

Précisions limitées : Beryl Burton et Althea Gibson à l’année, Elsy Jacobs au mois, Suzanne Lenglen à l’année, révélation de Piltdown au mois, Sokal et Ada Lovelace à l’année. Les films précisent le territoire ; aucune date de censure ni de festival n’est assimilée à une sortie nationale. L’erreur d’enveloppe des Oscars utilise la date locale de la cérémonie, distincte de la publication du communiqué. Cassini utilise le temps universel. Le cas Sokal et l’expérience de Miller restent Expert. La notice de Miller est vérifiée via OpenAIRE et une référence universitaire ; l’éditeur bloque la consultation automatisée du DOI.

## Projection locale AVANT / APRÈS

Relevé privé existant rechargé en mémoire puis migrations A0/A1/#128 ; aucune nouvelle lecture ou écriture de production et aucun audit général relancé. Cette projection est à confirmer par ChatGPT sur KFFR avant publication.

| Indicateur | Avant | Après projeté |
|---|---:|---:|
| Événements | 2307 | 2458 |
| Classés Débutant | 428 | 550 |
| Débutant jouables | 406 | 528 |

L’Inversé de l’interface utilise **DAY exclusivement**. Ses comptes ci-dessous sont les **dates distinctes au jour**, jamais le nombre d’années. « Tout » reste soumis au plafond existant de 100 questions.

| Pack | Nouveautés | Réemplois | Solo Débutant YEAR | Solo Débutant DAY | Inversé Débutant DAY |
|---|---:|---:|---:|---:|---:|
| France | 55 | 0 | 146 → **192** | 123 → **168** | 121 → **166** |
| Europe | 88 | 0 | 245 → **318** | 195 → **266** | 194 → **264** |
| Époque napoléonienne | 1 | 0 | 19 → **20** | 19 → **20** | 19 → **20** |
| Espace | 6 | 0 | 18 → **24** | 18 → **24** | 17 → **23** |
| Sciences | 15 | 0 | 14 → **23** | 8 → **16** | 8 → **16** |
| Religions | 3 | 0 | 21 → **23** | 9 → **11** | 9 → **11** |
| Droits et libertés | 17 | 0 | 28 → **39** | 25 → **35** | 25 → **35** |
| Construction européenne | 5 | 0 | 10 → **13** | 8 → **11** | 8 → **11** |
| Décolonisation | 12 | 0 | 9 → **17** | 9 → **17** | 9 → **17** |
| Environnement | 9 | 0 | 9 → **14** | 7 → **12** | 7 → **12** |
| XIXe siècle | 3 | 0 | 49 → **52** | 44 → **46** | 44 → **46** |
| XXe siècle | 77 | 0 | 196 → **255** | 174 → **232** | 171 → **229** |
| Sport | 86 | 0 | 40 → **118** | 39 → **116** | 39 → **115** |
| Football | 14 | 0 | 8 → **21** | 8 → **21** | 8 → **21** |
| Tennis | 16 | 0 | 7 → **21** | 7 → **20** | 7 → **20** |
| Jeux olympiques | 10 | 0 | 12 → **21** | 11 → **20** | 11 → **20** |
| Cyclisme / Tour de France | 17 | 0 | 5 → **20** | 5 → **20** | 5 → **20** |
| Sports mécaniques | 18 | 0 | 3 → **20** | 3 → **20** | 3 → **20** |
| Autres sports et exploits | 16 | 0 | 8 → **22** | 8 → **22** | 8 → **22** |
| Grandes premières | 16 | 0 | 34 → **49** | 32 → **47** | 32 → **47** |
| Inventions improbables | 9 | 2 | 15 → **25** | 10 → **20** | 10 → **20** |
| Sorties de films cultes | 3 | 0 | 34 → **34** | 32 → **32** | 32 → **32** |
| Pop culture | 8 | 0 | 34 → **42** | 24 → **32** | 24 → **32** |
| Rois, scandales et trahisons | 2 | 1 | 20 → **22** | 19 → **21** | 19 → **21** |
| Quand l’histoire dérape | 7 | 0 | 6 → **10** | 6 → **10** | 6 → **10** |

### Longueurs nouvellement disponibles dans l’interface

| Pack | Solo YEAR | Inversé DAY |
|---|---|---|
| Époque napoléonienne | 20 | 20 |
| Espace | 20 | 20 |
| Sciences | 20 | 10 |
| Religions | — | 10 |
| Construction européenne | — | 10 |
| Décolonisation | 10 | 10 |
| Environnement | 10 | 10 |
| Football | 10, 20 | 10, 20 |
| Tennis | 10, 20 | 10, 20 |
| Jeux olympiques | 20 | 20 |
| Cyclisme / Tour de France | 10, 20 | 10, 20 |
| Sports mécaniques | 5, 10, 20 | 5, 10, 20 |
| Autres sports et exploits | 10, 20 | 10, 20 |
| Inventions improbables | 20 | 20 |
| Rois, scandales et trahisons | — | 20 |
| Quand l’histoire dérape | 10 | 10 |

Les six sous-packs Sport disposent désormais d’au moins 20 dates distinctes Débutant au jour ; le sous-pack JO a été complété par une fiche supplémentaire sourcée sur Alain Bernard après la première projection à 19. Napoléon atteint 20, Inventions atteint 20 au jour et Espace dépasse 20 en Inversé. Sciences débloque 20 en Solo à l’année.

### Limites conservées

- Sciences : 23 en Solo YEAR, 16 dates distinctes en Inversé DAY ; 20 reste indisponible dans le mode insuffisant.
- Religions : 23 en Solo YEAR, 11 dates distinctes en Inversé DAY ; 20 reste indisponible dans le mode insuffisant.
- Construction européenne : 13 en Solo YEAR, 11 dates distinctes en Inversé DAY ; 20 reste indisponible dans le mode insuffisant.
- Décolonisation : 17 en Solo YEAR, 17 dates distinctes en Inversé DAY ; 20 reste indisponible dans le mode insuffisant.
- Environnement : 14 en Solo YEAR, 12 dates distinctes en Inversé DAY ; 20 reste indisponible dans le mode insuffisant.
- Quand l’histoire dérape : 10 en Solo YEAR, 10 dates distinctes en Inversé DAY ; 20 reste indisponible dans le mode insuffisant.

Les autres packs spécialisés et les contrats 50/100/Expert sont conservés. Les événements anciens restent inchangés ; les limites mathématiques ou éditoriales ne sont pas masquées par des changements de seuil. [Résultats détaillés des quatre cohortes, deux sens et trois précisions](differentiel-massif2.json).

## Vérifications

- Tests unitaires ciblés : trois contrôles verts (manifeste/date/territoire, génération SQL/réservations, titres et alias des lots antérieurs).
- PostgreSQL WASM jetable : migration réelle, refus de collision et de quasi-doublon, préconditions, empreintes des tables antérieures, ajouts manuels conservés, sources/réponses privées, marqueurs de réimport, idempotence après correction et retrait.
- RPC réels : quatre cohortes (Débutant, Intermédiaire cumulé, Expert exclusif et tous niveaux), trois précisions, deux sens, longueurs 5/10/20/Tout, Mystère et périmètres parent/enfant.
- Le vrai import HTTP et les scénarios navigateur sont prolongés pour les 151 nouveaux identifiants ; trois sous-packs prioritaires ont chacun un parcours de 20 questions dans les deux sens, sur les deux formats d’écran. Leur résultat final relève de la CI.
- Lint, typecheck et build de production verts, ce dernier via la fixture publique locale du dépôt. Seul avertissement du build : valeurs de repli absentes pour la police Big Shoulders, sans échec de compilation. Aucun E2E complet local répété : Docker local est arrêté, la CI utilise les piles jetables habituelles.
- CI complète demandée sur le commit final ; les cinq jobs doivent être verts avant toute fusion future. Aucun accès Vercel demandé.

## SQL à transmettre à ChatGPT

- Fichier : [`supabase/migrations/20261017172349_enrichissement_v12_massif2.sql`](../../supabase/migrations/20261017172349_enrichissement_v12_massif2.sql).
- Version du registre : **20261017172349** ; nom **enrichissement_v12_massif2**.
- SHA-256 du fichier SQL : `660d18e3740c4c8350a97f076d24a08c82361f3ebe527dbd25d75f2dd89294c0`.
- Commit exact : utiliser le SHA de tête de la PR, fourni dans le relais GitHub.
- Prérequis : #91, #120 et #128 déjà enregistrés ; ne jamais rejouer #128 pour cette livraison.
- Transaction unique, verrous bornés, uniquement des INSERT dans histoire et registre histoire.migrations_appliquees. Aucune commande db push/apply_migration, aucune connexion KFFR par Codex, aucune fusion ni publication du site à cette étape.

ChatGPT doit vérifier le commit exact, le registre, les 151 identifiants libres et les snapshots des trois réemplois, appliquer ce fichier après GO, puis contrôler le différentiel, l’intégrité antérieure, les réponses et les associations. La livraison reste en attente de cette confirmation ; #122 reste ouverte pour les ajouts suivants.
