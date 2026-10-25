# Kiffeurs d'Histoire

Jeu web de dates historiques : placer des événements sur une frise, en solo, en lobby, en 1v1 classé, et réviser le programme de terminale.

Stack : Next.js (App Router, TypeScript, Tailwind) sur Vercel, Supabase (Postgres, Auth, Realtime, Storage). Architecture détaillée dans [docs/architecture.md](docs/architecture.md).

Feuille de route V1.3 : issue de suivi #20. Les feuilles de route V1 et V1.1 de l'ancien dépôt sont archivées dans [docs/archives-github/](docs/archives-github/README.md). Pour prendre une étape (humain ou agent IA), suivre la section « Traiter une issue » de [CLAUDE.md](CLAUDE.md).

Comptes partagés, pseudo global, inscription/reset et sauvegarde des parties :
[docs/comptes.md](docs/comptes.md). La migration #24 et ses fixtures sont testées
uniquement en local/CI ; aucune base distante n’est modifiée par cette livraison.

Se tester sur un chapitre et suivre sa progression (#23) : [docs/progression.md](docs/progression.md).

Profil, historique privé et statistiques :
[docs/profil-statistiques.md](docs/profil-statistiques.md). La migration #25 est
appliquée sur KFFR le 8 octobre 2026 après GO explicite, puis vérifiée sur l’aperçu
avec une session réelle et une partie filtrée complète. La PR reste à relire.

## Démarrer en local

Prérequis : [Node.js 22](https://nodejs.org), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour la base locale), Git.

```bash
git clone <url-du-depot>
cd kiffeurs-histoire
npm install

# 1. Base de données locale (Docker doit être lancé)
npm run db:start          # démarre Supabase en local et applique migrations + données de test
                          # note l'« API URL » et la « Publishable key » affichées

# 2. Variables d'environnement
cp .env.example .env.local
# colle la Publishable key dans .env.local

# 3. Application
npm run dev               # http://localhost:3000
```

La page d'accueil liste les événements de test : si tu les vois, l'app parle bien à la base.
Le tableau de bord Supabase local est sur http://127.0.0.1:54323 (tu peux y créer un utilisateur de test dans *Authentication* pour essayer la connexion).

## Commandes utiles

| Commande | Effet |
|---|---|
| `npm run dev` | Lance le site en local |
| `npm run lint` / `npm run typecheck` | Vérifications avant de pousser (la CI fait pareil) |
| `npm run db:start` / `npm run db:stop` | Démarre / arrête la base locale |
| `npm run db:reset` | Recrée la base locale depuis les migrations + `supabase/seed.sql` |
| `npm run db:new nom_du_changement` | Crée un nouveau fichier de migration vide |
| `npm run db:test-securite` | Vérifie sur la base locale que le navigateur ne peut lire ni les dates, ni les alias, ni les descriptions |
| `npm run db:test-score` | Vérifie sur la base locale le calcul du score (exemple du PRD, dates av. J.-C., chrono) |
| `npm run db:test-solo` | Vérifie le moteur solo avec/sans compte, les filtres, le chrono et les autorisations ([contrat RPC](docs/solo-serveur.md)) |
| `npm run db:test-solo-retention` | Vérifie l'expiration à 24 h, la purge/cascade et le budget anonyme sans modifier les parties connectées |
| `npm run db:test-inverse` | Vérifie le mode inversé, les dates distinctes, la tolérance, le score et la sécurité des questions |
| `scripts/tests-sql.sh` | Sans Docker, sur un Postgres vide : applique migrations + seed et lance tous les tests SQL (c'est ce que fait la CI) |
| `npm run test:e2e` | Après `npm run db:start` : importe le dataset et les cartes dans la base locale, crée un compte fictif, compile le site et joue les parcours V1 dans Chromium, en 1280 px et 375 px (solo libre, solo scolaire, mode inversé, apprendre puis se tester, connexion puis statistiques), plus le test « aucune réponse visible dans le réseau avant la correction ». Tests dans `e2e/`, lancés à chaque PR par la CI |

## Travailler à deux

1. Pars toujours de `main` à jour : `git checkout main && git pull`.
2. Crée une branche : `git checkout -b ma-fonctionnalite`.
3. Commit, pousse, ouvre une Pull Request. La CI vérifie lint, types et build ; Vercel publie une URL de prévisualisation.
4. L'autre relit, puis on merge dans `main`, qui part en production.

## La base de données (important)

Il n'y a qu'un projet Supabase : celui de **KFFR contrée** (`bskyfdjwcdvzhlugtknb`, propriétaire Antonin). Il sert au site de production, aux prévisualisations Vercel et aux PC de dev. Ses comptes joueurs sont partagés avec KFFR contrée.

- Toutes nos tables sont dans le schéma `histoire`. On ne touche jamais aux schémas `public`, `private` ni `auth` (ceux de KFFR).
- Une modification de la base = un fichier de migration (`npm run db:new ...`), relu en PR, puis appliqué sur KFFR **avant** de fusionner la PR (sinon le site en ligne lit une structure qui n'existe pas encore).
- Chaque migration se termine par une ligne dans le registre : `insert into histoire.migrations_appliquees (version, nom) values ('<version>', '<nom>');`
- On n'édite jamais les tables depuis le tableau de bord Supabase.
- Pour essayer sans risque, on utilise la base locale (`npm run db:start`), pas KFFR.

### Appliquer une migration sur KFFR

**Pas de `supabase db push` vers le projet KFFR.** Sa liste de migrations (`supabase_migrations.schema_migrations`) appartient au dépôt [Contree-KFFR](https://github.com/AntoninKFFR/Contree-KFFR) : y inscrire nos versions bloquerait les prochains `db push` d'Antonin. Nos migrations sont suivies dans `histoire.migrations_appliquees` à la place.

Pour chaque migration pas encore présente dans ce registre (`select version from histoire.migrations_appliquees`) :
1. Vérifier que le fichier ne touche qu'à `histoire` (et aux extensions `unaccent`/`pg_trgm` du schéma `extensions`). Pas besoin de feu vert si c'est le cas.
2. L'exécuter tel quel dans une transaction (l'agent Claude via le connecteur Supabase, ou le *SQL Editor* du projet KFFR), dans l'ordre des versions. Le fichier inscrit lui-même sa ligne dans le registre.
3. Vérifier que KFFR contrée fonctionne toujours.

Une fois au départ, dans le tableau de bord du projet KFFR (Antonin) :
- *Project Settings → Data API → Exposed schemas* : ajouter `histoire`, sans retirer les schémas déjà exposés ;
- *Authentication → URL Configuration → Redirect URLs* : ajouter `https://k-iffeur-d-histoire.vercel.app/**` et `https://*-kffrh.vercel.app/**` (ne pas changer la *Site URL*, c'est celle de KFFR).

## Déploiement Vercel

1. Sur vercel.com, *Add New → Project*, importer ce dépôt GitHub (Vercel détecte Next.js tout seul).
2. Dans *Settings → Environment Variables*, ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : celles du projet KFFR pour les trois environnements (*Production*, *Preview*, *Development*).
3. Inviter Antonin/Maxou dans l'équipe Vercel pour que chacun voie les déploiements.
