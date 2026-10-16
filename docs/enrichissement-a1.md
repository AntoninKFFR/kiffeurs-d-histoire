# V1.2 — A1, 42 repères cinéma et pop culture (#126)

**Validé par Antonin et appliqué sur KFFR le 16 octobre 2026 à 13 h 13 Paris.** Le [GO explicite A0/A1](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/122#issuecomment-6214257559) répond à la demande de validation éditoriale et de publication SQL. A0 #124 reste indépendant : dix réemplois, aucun événement nouveau. La fusion A1 attend les contrôles du commit intégrant le nouveau main A0.

La [liste détaillée soumise dans #122/#123](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/495c86b03366dfa6088b110a2648b0db2cca3cc9/docs/v1.2/lot-a1.csv) comporte descriptions, dates, niveaux motivés, territoires, sources consultées et preuves de datation. Le [manifeste A1](../content/enrichissement-v12/a1.json) reprend ces 42 propositions avec leurs identifiants EVT-2300 à EVT-2341. Aucun reclassement d’événement existant ; les deux classiques asiatiques en prises de vues réelles restent Intermédiaire.

## Gains confirmés par les RPC de production

| Réglage Débutant | Avant | A1 seul, simulation | A0 + A1, production |
| --- | --- | --- | --- |
| Films Solo année | 1 | 21 | 21 |
| Films Inversé année | 1 | 16 | 16 |
| Films Solo mois / jour | 1 / 1 | 20 / 19 | 20 / 19 |
| Pop Solo année | 0 | 20 | 21 |
| Pop Inversé année | 0 | 19 | 20 |
| Pop Solo mois / jour | 0 / 0 | 18 / 18 | 19 / 19 |

A1 seul ouvre 5/10/20/Tout en Solo année pour Films et Pop. Les comptes Inversé année sont des capacités RPC : **l’interface Inversé ne propose que les dates exactes (DAY)**. Avec A0+A1, elle offre donc 19 questions pour Films et Pop, soit 5/10/Tout, et laisse vingt désactivé. La vingtième année Pop apportée par l’iPhone ne débloque pas vingt dans cette interface. Aucun millésime ni jour supplémentaire inventé pour contourner cette limite.

Le total global passe de 2 105 à 2 147 ; Débutant de 260 à 300, dont 238 à 278 jouables. Les 86 associations couvrent Films, Pop, Inventions improbables, France, Europe et XXe siècle. Les contrats 50/100 incontournables et Mode expert sont préservés. Aucun lien scolaire ni progression pédagogique ajouté.

Après A0 puis A1, le registre contient les deux versions, 42 nouveaux événements et 86 nouveaux liens protégés sont présents. Les 888 cellules RPC sont exactement conformes au dossier projeté ; toutes les anciennes lignes des 35 tables histoire contrôlées sont inchangées. Réponses et alias restent privés pour anon/authenticated. [Preuves et limites de publication](publication-v12-a0-a1.md).

Grande Vadrouille conserve décembre 1966 sans jour ; Belle au bois dormant, Lucky Luke et Wannabe restent à l’année. Les territoires figurent dans les titres des films et autres sorties géographiques. Les statuts et précisions ne prétendent pas résoudre les arbitrages documentaires du dossier initial.

## Migration et réimport

`20261016095716_enrichissement_v12_a1.sql`, créée avec `npm run db:new -- enrichissement_v12_a1`, est générée par `scripts/enrichissement-a1.ts`. Transaction et délais bornés ; verrou #120 avant les verrous de contenu pour sérialiser les créations. Vérifier #91/#120 et les six packs actifs, slugs et parentés attendus. Une pile vide diffère sans inscrire la version ; réappliquer après import.

Tout identifiant occupé, titre normalisé identique ou proximité ≥ 0,6 avec la même date fait refuser l’ensemble avant insertion. Ce garde-fou utilise la normalisation réelle de #120 ; il complète la relecture sémantique et ne la remplace pas. La vérification en lecture seule du 16 octobre à 11 h 55 Paris a confirmé les 42 identifiants libres, 2 105 événements, zéro création/retrait manuel, sans A0 installé. Le contrôle de doublons a été réexécuté contre le catalogue vivant : aucun signal bloquant.

Uniquement des INSERT dans events, event_answers, event_aliases, pack_events, admin_pack_additions et migrations_appliquees du schéma histoire. Aucune ancienne ligne réécrite. Les nouvelles associations suivent les positions existantes et sont protégées par les marqueurs privés #120. Aucun auteur humain ni audit d’administration inventé. Les sources et preuves résident dans les notes privées ; aucune capacité API, politique ou droit modifié. Le manifeste est réservé aux scripts/tests, jamais importé par l’application.

Le registre rend une répétition sans effet, y compris après correction ou retrait. Le futur import qui réutilise un identifiant A1 est refusé avant tout upsert ; une migration de réconciliation explicite serait nécessaire. Le v18 courant ne contient aucun de ces identifiants et conserve les événements, réponses, alias, marqueurs, positions et associations.

## Vérification

- 36 tests ciblés : manifeste, précision, sources, niveaux, réservations, SQL déterministe, contrats Sport/fun et disponibilité.
- SQL jetable : migration exacte deux fois, refus du pack inactif/collision/doublon/quasi-doublon, 42 ajouts et 86 protections ; empreintes de toutes les anciennes lignes de toutes les tables histoire, y compris créations #120, audits et joueurs, identiques.
- Six packs × quatre cohortes × deux sens × trois précisions × 5/10/20/Tout : comptes RPC, véritables parties, niveaux, appartenance et dates distinctes ; Mystère, refus des longueurs impossibles, parent/enfant et retrait prioritaire.
- Réponses, sources et alias confidentiels avant correction ; SELECT direct interdit à anon/authenticated. Édition et retrait administratifs après application, puis répétition conservant la correction.
- E2E préparés : Films et Pop Débutant joués jusqu’au bilan puis Rejouer, 20 Solo et 10 Inversé, PC/mobile. Vrai réimport SDK/PostgREST avec correction/retrait et empreintes A1 ; dataset hostile utilisant EVT-2300 refusé avec toutes les tables histoire inchangées.
- lint, types, contrôle de gel #92 et build Next local réussis (141 pages, avertissement Big Shoulders préexistant). Les quatre nouveaux fichiers SQL sont autorisés individuellement par le gel, aucun dossier entier n’est exclu.

Le scénario A1 s’exécute après fun dans le job SQL natif. La préparation E2E applique A1 après le véritable import et les packs ; Docker local indisponible sur ce PC, résultats natifs et E2E à confirmer en CI sur le dernier commit.

```powershell
npx tsx scripts/enrichissement-a1.ts
npx vitest run tests/enrichissement-a1.test.ts tests/fun-contenu.test.ts tests/sport-contenu.test.ts tests/disponibilite.test.ts tests/longueur.test.ts tests/mystere.test.ts --maxWorkers=2
node scripts/verifier-enrichissement-a1-local.mjs
```

## Publication après GO

Risque élevé : base de production partagée. Validation du contenu A1, GO et cinq contrôles du commit `23c33ff` obtenus avant publication. La tête intégrant main A0 doit encore avoir sa propre CI verte avant fusion (verifier, SQL natif, imports réels et E2E ; aucun échec terminé). Réinspecter main, PR et travaux de Max, puis réactualiser identifiants, doublons, corrections et retraits.

Après GO seulement : relever les empreintes et RPC avant, exécuter le fichier SQL exact dans histoire (aucun db push/apply_migration), confirmer registre et 42 ajouts/86 protections, contrôler l’intégrité de l’existant et mesurer les disponibilités RPC. Appliquer avant fusion, vérifier compatibilité avec main et CI du commit final, fusionner, vérifier Vercel et parcours, puis consigner l’après mesuré dans #122. Les prévisions ci-dessus ne sont pas un résultat de production.
