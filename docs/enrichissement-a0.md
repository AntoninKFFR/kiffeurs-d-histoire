# V1.2 — Lot A0 : dix rattachements existants (#124)

**Validé par Antonin, appliqué sur KFFR le 16 octobre 2026 à 13 h 13 Paris, puis fusionné par #125.** Le [GO explicite A0/A1](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/122#issuecomment-6214257559) répond à la demande de validation éditoriale et de publication SQL. Ce lot ne crée aucune question et ne reclassifie aucun événement. Il reste indépendant d’A1.

La [liste éditoriale complète](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/495c86b03366dfa6088b110a2648b0db2cca3cc9/docs/v1.2/lot-a0-reemplois.csv) a été publiée dans #122 avant génération du SQL. Le [manifeste de ce lot](../content/enrichissement-v12/a0.json) reprend ces dix liens, les sources institutionnelles et l’instantané courant. Aucune proposition A1 n’est incluse ici.

## Résultat mesuré après A0 seul

| Pack | Tous niveaux avant → mesuré | Débutant Solo année | Débutant Inversé année |
| --- | --- | --- | --- |
| Grandes premières | 35 → 40 | 8 → 13 | 8 → 12 |
| Pop culture | 35 → 36 | 0 → 1 | 0 → 1 |
| Construction européenne | 19 → 20 | 5 → 6 | 5 → 6 |
| Époque napoléonienne | 4 → 7 | 3 → 6 | 3 → 5 |

Les nouveaux rattachements ouvrent cinq questions Débutant Napoléon dans les deux sens et dix Grandes premières dans les deux sens. Année/mois/jour demeurent ceux du canon : Gutenberg reste approximatif à l’année ; le vote national et le vote municipal ont la même année mais des jours différents. Après A0 seul, les totaux restent 2 105 événements et 260 Débutant, dont 238 jouables.

Les RPC de production à 13 h 13 Paris ont confirmé tous les nombres du tableau, les dix liens et dix marqueurs. Le registre contient `20261015222704`. Les anciennes lignes des 35 tables histoire contrôlées, y compris réponses, alias, audits, corrections et joueurs, sont identiques avant/après. A1, appliqué ensuite, porte notamment Pop à 21 questions Débutant Solo et 20 années distinctes en Inversé : [mesure combinée](publication-v12-a0-a1.md).

## Migration et préconditions

`20261015222704_enrichissement_v12_a0.sql` a été créée avec `npm run db:new -- enrichissement_v12_a0`. Le générateur déterministe est `scripts/enrichissement-a0.ts`.

- Transaction, délais bornés, verrous sur le contenu concerné ; aucun schéma hors histoire.
- Vérifier #120, les dix événements, les quatre packs actifs/slugs/parenté, et les titres, niveaux, dates, descriptions et jouabilité du relevé. Toute dérive exige un nouvel audit ; elle n’est jamais écrasée.
- Ajouter seulement les liens manquants à la suite des positions actuelles ; une association manuelle déjà présente garde sa position.
- Inscrire les dix liens dans `admin_pack_additions`, sans fabriquer un auteur ni un audit d’administration. Le v18 préservera ainsi ces associations même vers les anciens packs.
- Aucun UPDATE/DELETE/DDL/GRANT et aucune réécriture d’événement, réponse, alias, source, retrait, correction ou donnée joueur.
- Un retrait antérieur reste retiré, même si son association physique avait disparu. Les compteurs suivent l’union métier, jamais la présence physique seule.
- Inscription dans `histoire.migrations_appliquees` ; rejouer une version inscrite ne fait rien, même après correction ou retrait ultérieur.
- Pile vide : différer sans s’inscrire, puis réappliquer après import. Corpus partiel ou pack inactif : échec intégral.

Les réponses, alias et marqueurs restent privés au même titre qu’avant ; aucune nouvelle capacité API. Le manifeste est un document de relecture, importé uniquement par les scripts/tests, jamais par le code client.

## Vérification

`supabase/tests/enrichissement_a0/scenario.sql` s’exécute après les tests historiques et fun sur une base jetable :

- refus d’un corpus partiel, d’une date modifiée et d’un pack inactif, dans des sous-transactions annulées ;
- migration réelle répétée, retrait et position préexistants conservés ;
- empreintes de **toutes les autres tables histoire**, y compris réponses, sources de création manuelle #120, audits et données joueurs, identiques avant/après migration ;
- les quatre cohortes, deux sens, trois précisions, 5/10/20/Tout : vrais tirages éligibles et refus des longueurs impossibles ; niveau et appartenance, déduplication inversée, projection next_question, Mystère ;
- parent/enfant et priorité d’un retrait du parent ; réponses/alias/marqueurs inaccessibles au rôle anon ;
- nouvelle correction et nouveau retrait après application, puis répétition sans aucune modification.

La fixture `supabase/fixtures/enrichissement_a0.sql` sert exclusivement au simulateur local. Elle aligne le niveau du seed Gutenberg (Expert par défaut) sur le relevé réel Débutant **avant** les empreintes. Ce n’est ni un reclassement de production ni une modification de la migration.

`e2e/enrichissement-a0.spec.ts` prépare une vraie partie Débutant Napoléon de cinq questions en Solo et Inversé sur PC/mobile, vérifie qu’un nouveau rattachement est tiré, joue les corrections et Rejouer. Un autre scénario exécute le vrai import v18 par le SDK/PostgREST et contrôle les dix liens, marqueurs, positions et retrait. Ces tests utilisent exclusivement Supabase local. Ils sont exécutés par la CI, sans Docker local disponible sur ce PC.

Reproduction :

```powershell
npx tsx scripts/enrichissement-a0.ts
npx vitest run tests/enrichissement-a0.test.ts tests/fun-contenu.test.ts tests/sport-contenu.test.ts tests/disponibilite.test.ts tests/longueur.test.ts tests/mystere.test.ts --maxWorkers=2
node scripts/verifier-admin-sql-local.mjs --a0-seul
```

Le pilote sans `--a0-seul` exécute aussi toutes les suites historiques et fun. Le job PostgreSQL natif découvre explicitement le scénario A0 à la suite de fun. La préparation E2E rejoue A0 après le vrai import et les contenus Sport/fun, afin de ne pas déclarer la migration installée sur une pile vide.

Le premier passage CI (`e33c9c3`, run 38818387114) a réussi PostgreSQL natif, les imports et les 184 E2E, dont les six parcours A0 PC/mobile. Le job `verifier` a révélé le gel historique de tout le dossier Supabase par #92 : ses quatre nouveaux fichiers A0 sont désormais nommés individuellement parmi les exceptions, comme #91 et #120. Aucun dossier n’est exclu ; les moteurs et le corpus pédagogique restent contrôlés. Le passage local du contrôle de gel, lint, typecheck et build a réussi après cette correction. Les résultats du dernier commit restent à vérifier avant toute publication.

## Publication après validation seulement

Risque élevé : contenu de la base partagée. La validation du contenu et le **GO explicite du lot A0** ont été obtenus ; les cinq contrôles du commit `f2b0978` ont réussi avant publication/fusion. Protocole conservé : exiger verifier, SQL, vrais imports et E2E sur la tête exacte ; aucune annulation/absence n’est un succès. Réinspecter main, les PR et les travaux de Max, puis relire les préconditions et retraits/créations courants.

Après GO : relever les empreintes et disponibilités vivantes, exécuter uniquement le fichier transactionnel exact (aucun db push/apply_migration), vérifier registre, liens/marqueurs, invariance des anciens contenus et nouvelles disponibilités avec les RPC, fusionner puis vérifier le déploiement. Mettre à jour #122 avec un **après mesuré**, distinct des projections ci-dessus.
