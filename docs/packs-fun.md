# Packs fun — #91

Statut au 15 octobre 2026 : **liste validée par Antonin et migration appliquée à KFFR**. Son GO « tout est validé », transmis dans le chat, est [consigné dans #91](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/91#issuecomment-6193428564) ; il n’est pas attribué à Maxou. Le choix des six thèmes est consigné sur [#86](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/86#issuecomment-6191269403). La [proposition exhaustive](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/91#issuecomment-6191550991) a été publiée avant génération du SQL.

Le registre KFFR atteste l’application de `20261015120156` le 15 octobre 2026 à 15 h 38 (Paris). Les six packs ont respectivement 35, 30, 50, 35, 30 et 30 questions ; les 104 ajouts sont présents. Les empreintes des 2 001 événements et réponses antérieurs, des 31 packs et de leurs 4 830 associations sont identiques avant/après. Les réponses et alias restent privés. Le fichier SQL conserve son en-tête de proposition historique : une migration appliquée ne se réécrit pas. La [PR #119](https://github.com/Zazou13015/KIffeur-d-Histoire/pull/119) suit la fusion et le contrôle du déploiement.

## Corpus et sources

| Pack | Questions | Ajouts proposés | Au jour | Inverse au jour |
| --- | ---: | ---: | ---: | ---: |
| Grandes premières | 35 | 0 | 35 | 35 |
| Inventions improbables | 30 | 22 | 12 | 12 |
| Sorties de films cultes | 50 | 46 | 12 | 12 |
| Pop culture | 35 | 18 | 27 | 27 |
| Rois, scandales et trahisons | 30 | 0 | 29 | 29 |
| Quand l’histoire dérape | 30 | 18 | 18 | 18 |

210 associations, 205 événements uniques : 101 réemployés et 104 proposés. Aucun recouvrement cinéma/Pop culture. Six packs autonomes ; aucun sous-pack n’est nécessaire pour ces volumes. Les 31 packs antérieurs restent inchangés. La rubrique « Pour le fun » s’appuie sur les seuls identifiants éditoriaux de `content/fun/packs.json`. Il n’y a aucune nouvelle colonne, table, RPC, règle de jeu ou permission.

L’inventaire `content/fun/inventaire.csv` donne titre, date structurée, niveau, description, URLs et preuve de datation pour chaque association. Les 30 fiches individuelles AFI sont relevées dans `sources-films-afi.json`. Films français : sortie France d’Unifrance, distincte de l’année de production. Ghibli : sortie japonaise du studio. Les autres films précisent le territoire américain ; les fiches AFI mélangent sorties locales, nationales et premières, donc ces 30 classiques restent à l’année. Les sources Disney ne justifient ici que le millésime retenu, sans reprendre les dates de ressortie.

Les sources historiques v18 sont conservées pour le réemploi, y compris leurs limites documentaires et statuts. Les ajouts sont marqués `SUPPORTED_B`, sans prétendre à une certification nouvelle du dataset. Les notes de source des ajouts vivent dans `event_answers.notes`, privé, et dans les fichiers de relecture. Le navigateur ne reçoit que les métadonnées publiques et les compteurs agrégés ; aucun manifeste de réponses n’est importé dans le composant.

Les niveaux existants ne sont pas modifiés. Les ajouts proposés sont Intermédiaire. Jusqu’à Intermédiaire, chaque pack remplit dix questions à l’année et au jour en inverse. Certains sont insuffisants en Débutant ou Expert exclusif : le sélecteur affiche les effectifs réels et désactive les longueurs impossibles. Le mode Inversé déduplique les dates comme pour Sport. Les retraits administratifs réduisent les compteurs vivants sans être remplacés par des quotas statiques.

Exclusions documentées : EVT-0893, ambiguïté entre alunissage le 20 juillet et premiers pas le 21 en UTC ; EVT-0928, non jouable dans KFFR. Aucune correction globale ne fait partie de #91. Les canulars sont présentés comme faux ; les catastrophes, sans plaisanterie sur les victimes.

## Génération et import

La branche part de `main` 1a073fc. L’audit initial a lu les 2 001 événements KFFR sans écriture ; seuls les 101 réemployés sont conservés dans le relevé versionné. Le manifeste est produit hors ligne :

```sh
npx tsx scripts/preparer-fun.ts
npx tsx scripts/proposer-fun.ts
npx tsx scripts/migration-fun.ts supabase/migrations/20261015120156_packs_fun.sql
npm run content:catalogue-solo
```

Le fichier de migration a été créé par `npm run db:new -- packs_fun`. Le catalogue compte 37 packs et ajoute les 104 événements aux agrégats général/périodes ; les 31 packs existants restent identiques. Aucun artefact pédagogique n’a besoin d’être changé.

Les packs et événements fun ont leurs propriétaires distincts. L’import v18 synchronise ses seuls propriétaires et préserve donc ces ajouts ; `verifierReservationsFun` refuse avant la première écriture les collisions avec COL-0112…0117, leurs slugs et EVT-2100…2203. Les surcharges #104 et les retraits #87 restent prioritaires. Un futur dataset souhaitant absorber ces identifiants demande une migration explicite.

## Migration et publication

**Risque élevé**, car la base KFFR est partagée. La migration est du DML exclusivement `histoire`, en une transaction avec délais de verrouillage/exécution bornés. Aucun `db push`, `apply_migration`, SQL dans public/auth/private ni accès aux joueurs. Une pile vide diffère l’installation jusqu’après import local. Un corpus partiel, une date/jouabilité modifiée ou une collision d’identifiants fait échouer toute la transaction.

La première application insère uniquement les nouveaux événements, réponses et alias, six packs et leurs associations, puis sa propre ligne dans `histoire.migrations_appliquees`. Aucun upsert sur les événements réemployés. La présence de cette ligne rend les répétitions sans effet : aucune restauration d’un retrait, aucune remise à zéro d’une correction. Ne jamais modifier le contenu d’une version déjà appliquée.

Avant publication : validation de la liste par Maxou sur #91, revue du commit et CI pertinente verte, réinspection des travaux de Max et du `main` récent. Relire en lecture seule les prérequis et les retraits/corrections courants ; refaire l’audit si l’état diffère. Exécuter le fichier SQL tel quel sur KFFR, dans la transaction qu’il contient, selon le README. Vérifier le registre, les six périmètres via `playable_packs`, une partie réelle et l’accessibilité des anciens packs. Fusion seulement après application et vérifications conformes. Contrôler ensuite le déploiement, les parcours Solo/Inversé et les anciennes fonctionnalités.

La validation humaine et l’application SQL sont désormais acquises. Pour toute nouvelle publication, le même prérequis de validation reste applicable. #86 reste ouverte pour la consignation manquante des décisions d’habillage ; #91 et la roadmap sont finalisées après fusion et contrôle du déploiement.

## Vérifications

Les tests de contenu comparent les 31 anciens packs au commit de référence et vérifient volumes, sources, précisions, séparation cinéma/Pop culture et collisions d’import. Le composant est testé avec compteurs réduits et sans packs fun avant migration. `scripts/verifier-sous-packs-local.ts --fun` vérifie les vraies routes Next avec une API de fixtures locale, à 1280, 1366 et 375 px, en Solo et Inversé : rubrique, clavier, longueurs, persistance et débordements.

Le scénario `supabase/tests/fun/scenario.sql`, appelé à la fin de `scripts/tests-sql.sh` sur un Postgres jetable, installe les 101 événements de fixture puis rejoue la migration. Il vérifie parties filtrées dans les deux sens, roulette, anciennes données intactes, retraits/corrections/audits conservés et réponses privées. **La fixture ne doit jamais être appliquée à KFFR.** Les scénarios Playwright `e2e/fun.spec.ts` utilisent une vraie pile Supabase locale, jouent cinq films puis testent le replay et la mémoire sur PC/mobile. Le scénario E2E de réimport vérifie aussi que le corpus fun survit à un véritable import v18.
