# Quatre niveaux de sélection — PR #109

Correctif sur `ux-simplification-choix-parties`, à partir de `bf615d8d4b195d56e44423c4092c0e48fc03c8b4`.
Expert ne doit plus désigner le même ensemble que Toutes les questions.

## Contrat des choix

| Carte | Filtre | Paramètres du choix |
| --- | --- | --- |
| Débutant | Niveau 1 | `niveau=1` |
| Intermédiaire | Niveaux 1 et 2 | `niveau=2` |
| Expert | Niveau 3 exclusivement | `niveau=3&expertOnly=1` |
| Toutes les questions | Niveaux 1, 2 et 3 | `niveau=3` |

Toutes les questions reste le défaut des nouveaux joueurs en Solo libre et Inversé.
Les anciennes URLs, préférences et parties `niveau=3` restent cumulatives. Les
anciens choix sans niveau gardent le défaut historique 1. Le lecteur accepte aussi
`expertOnly=true`, rejette les valeurs invalides et interdit Expert aux niveaux 1/2
et dans les choix scolaires. `0`/`false` conserve le comportement cumulatif.

Le flag suit l'état React, l'URL, le localStorage, les Server Actions, les décomptes,
le tirage et `games.context.replay_filters`. Le bilan préfère cet instantané lorsqu'il
contient le flag. Rejouer, Rejouer ce thème et Relancer la roulette conservent Expert.
Les questions période classiques restent automatiques ; une relance historique
explicitement désactivée reste compatible. Aucun contrôle scolaire n'est modifié.

Les quatre cartes tiennent sur une ligne à 1280×800 et 1366×768 ; elles sont en
grille 2 × 2 à 375 px. Les boutons ont des noms accessibles et `aria-pressed` distincts.
La longueur indisponible est désactivée à partir du décompte réel. Les tuiles de thème
affichent le décompte vivant de la sélection ; aucun total cumulatif statique n'est
présenté comme un total Expert.

## Migration préparée et compatibilité

[`20261011161927_niveaux_expert_exclusif.sql`](../supabase/migrations/20261011161927_niveaux_expert_exclusif.sql)
ajoute des surcharges dans `histoire`, avec un paramètre `p_expert_only` obligatoire.
Les définitions et signatures historiques restent intactes. Les appels sans Expert
utilisent encore les anciennes signatures, avec leurs arguments habituels.

- `solo_candidates` : projection privée des candidats historiques, filtrée par
  `events.niveau=3` pour Expert ; aucun accès direct accordé aux rôles clients.
- `available_questions` : comptes issus de cet ensemble, avec dates distinctes en inversé.
- `playable_packs` : mêmes comptes réels et bornes, hiérarchie conservée.
- `start_game` : filtre avant déduplication, périodes et tirage ; instantané explicite.
- `start_mystery_game` : éligibilité sur ces candidats, puis un seul appel de création.

Les surcharges exposées gardent `SECURITY DEFINER`, un `search_path` vide, les
validations, les rôles anon/authenticated et les déclencheurs de budgets existants.
Elles ne retournent pas les réponses privées. Les tables, RLS, scores, événements,
niveaux éditoriaux, associations et anciennes migrations restent inchangés. Les
limites d'inférence préexistantes des agrégats #93 sont documentées dans
[`audit-decompte-93.md`](audit-decompte-93.md) ; ce correctif ne les résout pas.

**Migration préparée, non appliquée sur Supabase distant.** Une autorisation SQL de
production distincte est requise après audit. La migration et ses dépendances doivent
être installées avant de déployer l'interface avec Expert : sans la nouvelle surcharge,
les décomptes/lancements Expert échouent, sans repli silencieux sur Tous les niveaux.
Les parcours historiques restent compatibles. Aucun `db push`, `apply_migration`,
accès Supabase distant ou changement dans `public`/`auth` n'a été effectué.

## Vérification SQL locale

Docker étant indisponible, PostgreSQL embarqué PGlite 0.5.8 a été installé dans un
répertoire temporaire hors dépôt. Le pilote charge toutes les migrations, les fixtures
existantes et leurs extensions `pg_trgm`/`unaccent` dans une base en mémoire sans réseau.
La migration Sport est rejouée uniquement dans cette base jetable, après sa fixture.

Résultat réel à précision Année en classique : **369 Expert / 397 Toutes les questions**.
À précision Jour en inversé : **6 / 29 dates distinctes**. Aucune soustraction de
totaux cumulatifs n'est utilisée. Un cas synthétique partageant la même date entre
un événement débutant et expert vérifie expressément ce point.

Reproduction PowerShell depuis la racine du dépôt :

```powershell
npm install --prefix (Join-Path $env:TEMP 'kiffeurs-expert-pglite') --save-exact @electric-sql/pglite@0.5.8 --ignore-scripts --no-audit --no-fund
node scripts/verifier-expert-sql-local.mjs
```

Le pilote accepte `KFFR_PGLITE_DIST` si le runtime est ailleurs. Aucun paquet de
test supplémentaire n'est ajouté à `package.json` ou au lockfile du projet.

Les six suites `niveaux_expert.sql`, `pack_sport.sql`, `sous_packs.sql`,
`questions_periode.sql`, `longueur_parties.sql`, `theme_mystere.sql` passent.
Le nouveau test parcourt les quatre cohortes, les sept packs Sport parent/enfants,
les deux sens, les trois précisions et les longueurs 5/10/20/Tout. Il contrôle
les tirages exclusifs, comptes, instantanés, dates distinctes, thèmes, périodes
historiques, périodes automatiques/désactivées, insuffisances, token invalide,
permissions privées, fin de partie et mystère créé une seule fois. Ses événements
synthétiques sont dans une transaction annulée, sans modifier le corpus Sport.

Ce test exécute réellement les fonctions PostgreSQL, mais ne simule pas PostgREST,
le service Auth ou la concurrence entre connexions. La suite SQL complète et les
E2E Supabase locaux, dont `e2e/niveaux-expert.spec.ts`, restent à GitHub avec Docker.
Le script SQL CI découvre automatiquement le nouveau fichier. Aucune CI n'est attendue.

## Vérifications de l'application

| Vérification exécutée | Résultat |
| --- | --- |
| Vitest ciblé | 160 tests, 14 fichiers, verts |
| `npm test` | 469 tests Vitest, 46 fichiers + 6 tests Node, verts |
| `npm run lint` et `npm run typecheck` | Verts |
| Build Next de production | Vert, avertissement préexistant de fallback Big Shoulders |
| Relecture Chromium avec API locale | Six parcours : classique/inversé × trois viewports, verts |
| `git diff --check` | Vert |

La relecture vérifie les quatre cartes, le défaut, Expert/RPC/mémoire, navigation
parent/enfant, mystère Expert et unique création, clavier, périodes, largeur et Jouer.
Les [52 captures et 12 mesures](captures/choix-ux/README.md) permettent la revue visuelle.
L'API de fixtures n'est pas une preuve de tirage SQL ; les suites ci-dessus le vérifient.

## Fichiers du correctif

Liste du correctif par rapport au commit audité `bf615d8` :

- Interface : `src/components/choix/ChoixSolo.tsx`, `communs.tsx`, `choix.module.css`,
  `src/components/partie/Bilan.tsx`, `src/app/partie/[id]/page.tsx`.
- Contrats : `src/lib/game/solo.ts`, `src/lib/solo/choix.ts`, `src/lib/solo/mystere.ts`.
- Serveur : `src/app/solo/actions.ts`, `disponibilite.ts`, `packs.ts`.
- SQL : nouvelle migration `20261011161927_niveaux_expert_exclusif.sql` et nouveau test
  `supabase/tests/niveaux_expert.sql`.
- Tests : `tests/niveaux-expert.test.ts`, `choix-ux.test.tsx`, `disponibilite.test.ts`,
  `mystere-composants.test.tsx`, `packs-serveur.test.ts`, `soloActions.test.ts`,
  `sous-packs-composant.test.tsx`, `e2e/niveaux-expert.spec.ts`.
- Pilotes : `scripts/verifier-expert-sql-local.mjs`, `scripts/verifier-sous-packs-local.ts`.
- Documentation : ce rapport, `docs/choix-parties.md`, `docs/theme-mystere.md`,
  `docs/captures/choix-ux/README.md` et `mesures.json` ; 46 PNG actualisés, six PNG Expert ajoutés.

Aucun changement du contenu Sport, de ses fixtures, de son catalogue, de sa migration
historique, des données pédagogiques ou de KFFR Contrée. Aucun SQL de production,
aucune fusion et aucune nouvelle PR.
