# Vérifications — audit et proposition #122

Exécutées le 16 octobre 2026, sur main de référence `6a9cb8f`, dans la branche isolée. Les changements concernent documentation, propositions et génération hors ligne ; aucune migration ni code de l’application modifié.

| Contrôle | Résultat |
| --- | --- |
| Audit Supabase courant | Huit appels playable_packs en transaction de lecture seule ; 37 packs chacun, 888 cellules |
| Reproduction hors ligne | 888/888 cellules identiques aux RPC avant enrichissement, y compris parents et dates inversées |
| Cohortes et seuils | Contrats cumulatifs/exclusifs, Inversé ≤ Solo, 5/10/20/Tout et plafond 100 contrôlés |
| Proposition | 42 événements, descriptions, motifs des niveaux, sources/preuves, territoires, calendrier, associations et packs protégés vérifiés |
| Réemplois | Dix liens absents de l’état courant, sources v18 conservées et références institutionnelles complémentaires |
| Doublons | 2 105 titres courants ; normalisation SQL, trigrammes dès 0,6, puis relecture des treize proximités et recherche sémantique ; remplacement ABBA contrôlé séparément, zéro proximité |
| Confidentialité directe | SELECT event_answers/event_aliases refusé à anon/authenticated selon les privilèges courants ; limite d’inférence préexistante documentée |
| Conservation de KFFR | [Empreintes finales](controle-final.json), le 16 octobre à 00 h 21 Paris, strictement identiques : événements, réponses, associations, retraits ; 2 105 événements toujours présents |
| npm run lint | Réussi |
| npm run typecheck | Réussi |
| Build Next de production | Réussi via le pilote existant build-apprendre-local.ts, même commande Next que npm run build ; API HTTP de fixtures locale, 141 pages, aucun secret KFFR |
| Vitest ciblé | 47 tests réussis dans sept fichiers : fun-contenu, sport-contenu, disponibilite, niveaux-expert, longueur, mystere, admin-creation |
| SQL local | Toutes les suites du pilote verifier-admin-sql-local.mjs et fun/scenario.sql réussies sur PostgreSQL WASM jetable |
| git diff --check | Réussi |

Le build conserve l’avertissement préexistant de fallback Big Shoulders. Le générateur MJS important le lecteur CSV TypeScript commun signale le typage de module implicite avec Node 22 ; aucune dépendance ni configuration du projet changée pour cela.

## Reproduction

Depuis la racine du checkout :

```powershell
node scripts/auditer-catalogue-v12.mjs
node scripts/preparer-enrichissement-v12.mjs
```

Ces commandes régénèrent matrice, couverture et inventaires de relecture, sans réseau. Les agrégats proviennent du résultat SQL enregistré. Pour refaire les projections et la comparaison complète, fournir explicitement un export administratif courant hors Git :

```powershell
node scripts/preparer-enrichissement-v12.mjs --inventaire CHEMIN_ABSOLU_EXPORT_LOCAL.json
```

L’export utilisé dans cette session reste hors dépôt : `C:\Users\Antonin\.codex\tmp\v12-current-inventory.json`. Le script refuse une projection dont les comptes de départ ne reproduisent pas les RPC enregistrées. Ne pas utiliser cet export ancien pour une insertion future : relire KFFR et les ajouts/retraits/corrections au moment du lot.

```powershell
npm run lint
npm run typecheck
npx tsx scripts/build-apprendre-local.ts
npx vitest run tests/fun-contenu.test.ts tests/sport-contenu.test.ts tests/disponibilite.test.ts tests/niveaux-expert.test.ts tests/longueur.test.ts tests/mystere.test.ts tests/admin-creation.test.ts --maxWorkers=2
node scripts/verifier-admin-sql-local.mjs
git diff --check
```

Le pilote SQL utilise le runtime facultatif PGlite déjà disponible hors dépôt ; procédure dans [niveaux-expert](../niveaux-expert.md). La matrice distante se reproduit avec [audit.sql](audit.sql), en lecture seule dans le schéma histoire.

## Portée et suite

Le simulateur SQL vérifie le moteur existant, pas l’insertion d’A1 : aucune migration de ce lot n’existe encore. Aucun test de concurrence multiprocessus, transport Supabase ou nouveau parcours E2E n’est revendiqué. Pour les futures PR de publication : tests SQL/idempotence/empreintes, vrais imports avec réservations et marqueurs de protection, corrections/retraits/créations #120, parties Solo/Inversé/Mystère/parents/enfants/longueurs, confidentialité et E2E Supabase restent nécessaires avant GO SQL/fusion.

CI de cette PR de préparation à consulter sur son dernier commit. Risque faible pour documentation et scripts hors ligne sans écriture de base : verifier requis pour une éventuelle fusion, aucun test terminé en échec admissible. Les publications de contenu sont des opérations distinctes à risque élevé. Cette PR reste en brouillon, en attente de validation du premier dossier ; aucun déploiement de nouveau contenu n’est à vérifier.
