# Kiffeurs d'Histoire : architecture technique

*Proposition du 3 octobre 2026, pour Maxou et Antonin. À valider ensemble avant le premier commit.*

## 1. En bref

- **Front + API** : Next.js (App Router, TypeScript) hébergé sur **Vercel**, un déploiement de prévisualisation par pull request.
- **Base, comptes, temps réel, fichiers** : **Supabase** (Postgres, Auth, Realtime, Storage).
- **Comptes partagés avec KFFR contrée** : oui, c'est possible. La voie recommandée est d'**utiliser le même projet Supabase que KFFR**, avec un **schéma Postgres dédié** (`histoire`) pour les tables du nouveau jeu. Les joueurs se connectent avec le même email et le même mot de passe, sans migration.
- **Temps réel** (lobby, 1v1) : Supabase Realtime (Presence + Broadcast) pour la synchro, mais **le serveur reste l'arbitre** : scores, chronos et bonnes réponses sont calculés en base, jamais côté navigateur.

## 2. Partager les comptes avec KFFR contrée

**Décision #24 (7 octobre 2026)** : même projet et même Auth. Le pseudo global
vient exclusivement de `public.profiles.username`, déjà présent dans Contrée.
Histoire peut lire/modifier la propre ligne du joueur sous les RLS existantes,
sans aucune migration dans `public`. `histoire.players.display_name` est legacy,
inutilisé pour l’identité et non synchronisé. Voir [Comptes et sauvegarde](comptes.md).

Dans Supabase, les comptes vivent dans la table `auth.users` **d'un projet**. Deux projets Supabase distincts ne partagent rien nativement. Il y a donc trois options.

### Option A (recommandée) : même projet Supabase, schéma séparé

Kiffeurs d'Histoire se branche sur le projet Supabase de KFFR contrée. Ses tables vont dans un schéma `histoire` (et non `public`), pour ne jamais marcher sur celles de KFFR.

| Pour | Contre |
|---|---|
| Mêmes identifiants immédiatement, zéro code d'authentification à écrire | Les deux jeux partagent les quotas (taille de base, connexions temps réel, utilisateurs actifs) et la facture |
| Un seul profil joueur possible pour les deux jeux (pseudo, avatar, amis) | Une migration ratée ou une requête lourde sur un jeu peut ralentir l'autre |
| Une seule config d'emails, de providers OAuth (Google, Discord…) | Il faut de la discipline : migrations versionnées dans Git, RLS sur chaque table |

À faire concrètement :
1. Avoir accès (vous deux) à l'organisation Supabase de KFFR.
2. Créer le schéma `histoire`, et l'ajouter dans *Settings → API → Exposed schemas* pour que le client JS puisse l'interroger (`supabase.schema('histoire').from(...)`).
3. Ajouter les domaines de Kiffeurs d'Histoire (prod + `*.vercel.app` des previews) dans *Auth → URL Configuration → Redirect URLs*.
4. Partager une table `public.profiles` (pseudo, avatar) entre les deux jeux si KFFR n'en a pas déjà une ; les données propres à chaque jeu restent dans leur schéma.
5. Développer en local avec `supabase start` (Docker) pour ne **jamais** tester des migrations sur la base de prod de KFFR.

**Connexion automatique ?** Même identifiants ne veut pas dire déjà connecté : la session est un cookie lié au domaine. Si les deux jeux sont sur des sous-domaines du même domaine (ex. `contree.kffr.fr` et `histoire.kffr.fr`), on peut régler le cookie Supabase sur `.kffr.fr` et un joueur connecté sur l'un l'est aussi sur l'autre. Sur deux domaines différents, il retape juste son mot de passe une fois.

### Option B : projets séparés, KFFR comme fournisseur d'identité (SSO)

Kiffeurs d'Histoire garde son propre projet Supabase et affiche un bouton « Se connecter avec KFFR ». Le projet KFFR joue le rôle de serveur OAuth/OpenID (Supabase propose une fonction « OAuth Server », encore récente : à vérifier au moment de l'implémentation).

| Pour | Contre |
|---|---|
| Isolation totale : quotas, pannes et migrations indépendants | Bien plus de travail : flux OAuth, création d'un compte miroir côté Histoire au premier login, synchro du profil |
| Chaque jeu peut avoir son plan Supabase | Deux projets à payer et administrer ; fonctionnalité Supabase encore jeune |
| | Les nouveaux joueurs d'Histoire doivent quand même créer un compte « KFFR » |

### Option C : copier les comptes (déconseillé)

On peut importer les utilisateurs de KFFR (avec leurs hashs de mot de passe bcrypt) dans un nouveau projet. Mais dès qu'un joueur change son mot de passe sur un jeu, l'autre n'est plus à jour. À éviter.

### Recommandation

**Option A**, tant que les deux jeux restent de taille modeste. Elle répond exactement à votre besoin pour presque zéro effort. Points à vérifier avant de foncer :
- le **plan Supabase** : KFFR est en **gratuit** (confirmé par Maxou le 3 oct. 2026). Limites partagées entre les deux jeux : 500 Mo de base, 50 000 utilisateurs actifs/mois, 200 connexions Realtime simultanées, 2 millions de messages Realtime/mois, pause après une semaine sans activité. Suffisant pour développer et lancer le solo ; à revoir (Pro à 25 $/mois) quand le lobby et le 1v1 auront du monde ;
- que les migrations de KFFR soient déjà versionnées (sinon, faire un `supabase db pull` pour figer l'existant avant d'ajouter quoi que ce soit).

Si un jour un des jeux grossit beaucoup, on pourra passer à l'option B : les tables du schéma `histoire` se déplacent facilement, et la clé commune reste l'`id` utilisateur.

## 3. Vue d'ensemble

```
Navigateur (Next.js / React)
   │  pages, frise interactive, saisie des réponses
   │
   ├──► Vercel : Next.js (Server Components, Route Handlers / Server Actions)
   │        logique de jeu « courte » : démarrer une partie, valider une réponse
   │
   └──► Supabase (projet partagé avec KFFR)
            Auth      : comptes communs
            Postgres  : schéma `histoire` + fonctions SQL (RPC) pour le jeu
            Realtime  : Presence (qui est dans le lobby) + Broadcast (événements de partie)
            Storage   : illustrations des événements
            pg_cron   : clôture des manches expirées, saisons de classement
```

Vercel exécute des fonctions courtes et ne garde pas de connexion WebSocket ouverte : c'est pour ça que le temps réel passe par Supabase Realtime et non par Next.js.

## 4. Modèle de données (schéma `histoire`)

**Contenu historique** (aligné sur le dataset v18 d'Antonin, migration `modele_dataset_v18`, issue #5)

Les identifiants et les codes du dataset sont repris tels quels (`EVT-0173`, `THM-001`, `COL-0059`, `TAG-0001`, `DAY`, `YEAR_RANGE`…), pour que chaque nouvel import d'Antonin mette simplement la base à jour.

| Table | Contenu | Navigateur |
|---|---|---|
| `events` | `id` (`EVT-xxxx`), `title`, `event_type` (POINT, EVENT, PERIOD, PROCESS), `precision` (DAY, MONTH, YEAR, DAY_RANGE, YEAR_RANGE, CENTURY, PERIOD_TEXT, MIXED_RANGE), `date_status`, `playable`, `playable_mode` (DAY, MONTH, YEAR, RANGE, NOT_AUTOMATIC), `importance` et `difficulty` (1 à 5), `image_path`, `source_status` | lisible |
| `event_answers` | La réponse : `start_year/month/day`, `end_year/month/day` (année négative = av. J.-C., jamais 0), `date_text`, `secondary_dates`, `calendar_system`, `description` (elle cite la date dans 3 cas sur 4), `notes` | **fermée** |
| `event_aliases` | Formulations acceptées pour le mode inversé | **fermée** |
| `levels` | Les 11 niveaux, du CM1 à la Terminale HGGSP (`id`, libellé du dataset, cycle, ordre), remplis par la migration | lisible |
| `event_levels` | Niveaux où l'événement est au programme (`levels_seen`) | lisible |
| `chapters` | Les 46 chapitres du programme (« thèmes » dans le dataset) : niveau, année scolaire, tronc commun ou HGGSP, titre | lisible |
| `event_chapters` | Lien événement ↔ chapitre, avec le statut (`PROGRAMME_BO`, `REPERE_EDUSCOL`…) | lisible |
| `packs`, `pack_events` | Les 24 packs prêts à jouer (50 incontournables, Guerre froide, Antiquité…) et leurs événements ordonnés | lisible |
| `tags`, `event_tags` | Tags de thème, géographie, siècle, série (JO, Coupes du monde…) | lisible, **sauf les tags de siècle sur un événement** (ils donnent presque la réponse) |

Règles :
- #89 préparée : `packs.parent_id` et union récursive active sans doublon,
  commune aux deux sens et à Thème mystère. Retraits par branche, catalogue
  vivant sans réponses privées ; [contrat des sous-packs](sous-packs.md).
- On stocke **année/mois/jour en entiers** plutôt qu'un type `date` Postgres : plus simple pour les dates av. J.-C., les dates connues seulement à l'année, et le calcul d'écart.
- Tout ce qui donne la réponse vit dans `event_answers` et `event_aliases` : RLS active, aucune policy, aucun droit pour `anon` ni `authenticated`. Seules des fonctions SQL `security definer` les lisent : `check_event_answer(id, réponse)` aujourd'hui (mode inversé), la correction des dates et l'affichage de la description après réponse avec le moteur de jeu (étape 2.1).
- Les autres tables ont la RLS active avec une lecture publique.
- Vérification : `supabase/tests/reponses_invisibles.sql` (voir README).
- Les périodes (siècle, millénaire) se calculent depuis l'année, pas besoin de les stocker.
- #21 : les 325 cartes des 41 chapitres sont importées en production KFFR (#59). `chapter_cards` reste interne et privée : RLS active sans policy publique, aucun droit direct anon/authenticated. `get_chapter_cards(p_chapter_id)` (`security definer`, `search_path` vide) expose une projection pédagogique ordonnée sans `event_id` ni sources, empêchant la jointure API événement → bonne date ; aucun droit supplémentaire sur `event_answers`/`event_aliases`. Import atomique réservé à service_role via `replace_chapter_cards`. La Somme et sa carte sont corrigées en plage après GO humain et #63. `/demo/pedagogie` conserve la relecture autonome du CSV au build. #22 ajoute `/apprendre` et les pages chapitre statiques, réutilise la frise et sert les illustrations par une URL publique fondée sur card_id, sans accès privilégié en base : [écran Découvrir](apprendre.md).

**Joueurs et parties**
- `player_stats` : statistiques solo par joueur et par thème (précision moyenne, meilleur score).
- `ratings` : classement 1v1 **par thème** (`user_id`, `theme_id`, `rating`, `games_played`, saison).
- `matches`, `match_rounds`, `round_answers` : parties multijoueurs, manches, réponses avec **horodatage serveur**.
- `lobbies`, `lobby_members` : salons casual.
- `matchmaking_queue` : file d'attente du classé.
- `learning_progress` : cartes vues, chapitres terminés, résultats aux tests.

Préparation #92, **non appliquée en production** : le registre pédagogique ferme les chapitres non enregistrés après son initialisation. Les éditions privées figent les cartes et les candidats des tests publiés, indépendamment des corrections ultérieures du canon. La complétion des chapitres non découpés conserve les IDs et URLs ; ses résultats vivent dans `learning_progress_editions`, sans transférer les scores initiaux. Les anciennes parties conservent leur édition pour Bilan et Rejouer. Le contrat, les volumes conditionnels, les limites et la séquence migration → manifeste → publication sont détaillés dans [le second audit #92](phase-2-92/second-audit.md) et [le plan de déploiement](phase-2-92/README.md).

Toutes les tables ont la RLS activée : un joueur lit le contenu historique, mais n'écrit que ses propres lignes, et uniquement via des fonctions SQL contrôlées pour tout ce qui touche au score.

## 5. Les modes de jeu, côté technique

### Saisie et frise
- Frise zoomable « façon Google Maps » : rendu SVG ou Canvas avec `d3-zoom` (ou équivalent) pour le zoom/pan, de l'échelle millénaire jusqu'au jour. Trois façons de répondre (clavier, calendrier, clic sur la frise) qui produisent toutes le même objet `{year, month?, day?}`.
- Illustrations simples (SVG/PNG légers) stockées dans Supabase Storage, servies via CDN.

### Correction des fautes (mode inversé)
Normalisation côté serveur : minuscules, suppression des accents (`unaccent`), des articles en tête (« la », « le », « l' », « les »), de la ponctuation. Puis comparaison floue avec l'extension Postgres `pg_trgm` (similarité ≥ **0,75**, décision produit appliquée par la migration #14) contre le titre et les alias. La réponse attendue n'est jamais envoyée au navigateur avant la correction.

L'étape 2.3 étend le moteur solo avec `games.direction = date | inverse`
(`date` par défaut). Les filtres et le chrono sont communs ; le tirage inverse
ne retient qu'un événement par date affichée, à la précision de la difficulté.
`next_question` publie seulement cette date et le chrono ; `submit_answer`
appelle le correcteur interne après contrôle de la partie/question, puis la
formule de points commune avec précision 100/0. Aucun oracle d'alias n'est
réouvert. Contrat et tests du seuil 0,75 : [Solo serveur](solo-serveur.md).

### Difficulté et score
L'écart se calcule dans l'unité de la difficulté (années, mois ou jours). Solo : pourcentage de précision dérivé de l'écart. 1v1 : l'écart retire des points de vie. Une seule fonction SQL de scoring, partagée par tous les modes, pour que les règles soient identiques partout.

En place depuis l'étape 2.1 (migration `20261006210000_score.sql`, tests `supabase/tests/score.sql`) :
- `histoire.scoring_settings` : une ligne de réglages (E₀ par unité, poids précision/rapidité, durée du chrono), lisible par le navigateur, modifiable par une simple mise à jour.
- `histoire.date_gap(...)` : écart en années (`YEAR` = Facile), mois (`MONTH` = Moyen) ou jours (`DAY` = Difficile), dates av. J.-C. comprises, sans année 0.
- `histoire.score_points(précision, secondes)` : la formule commune des points ; le mode inversé l'appelle avec 100 ou 0.
- `histoire.score_answer(...)` : unité utilisée, écart, précision et points d'une réponse datée.
- Événement connu moins précisément que la difficulté (ex. connu à l'année, posé en Difficile) : l'écart est compté dans l'unité disponible, avec l'E₀ de cette unité. Le tirage (2.2) doit éviter de poser ces questions ; ce n'est qu'un filet de sécurité.
- Ces fonctions ne sont pas appelables par le navigateur : les RPC de partie (`security definer`) s'en servent.

### Solo
Pas de temps réel. Le serveur tire les questions, le client répond, une RPC `submit_answer` corrige et enregistre.

En place depuis l'étape 2.2 : `games` et `game_questions` privées (RLS, aucune
lecture/écriture directe), RPC `start_game`, `next_question`, `submit_answer`,
`finish_game`. Identité connectée issue de `auth.uid()` ; accès anonyme par secret
aléatoire de session `httpOnly` côté Next.js, dont seule l'empreinte est en base.
Le correcteur inversé sans partie `check_event_answer` devient interne pour
éviter de sonder les alias datés. Contrat, chrono et tests : [Solo serveur](solo-serveur.md).

Les parties anonymes expirent à 24 h et sont purgées automatiquement lors des
appels de jeu, avec suppression des questions par cascade. Un budget global SQL
de 1 000 parties / 10 000 questions anonymes borne le stockage, y compris pour
des appels directs et concurrents. Les parties connectées ne sont pas concernées.
La purge est opportuniste : sans trafic, les lignes expirées restent présentes,
mais sont inaccessibles. Aucun planificateur distant n'est ajouté.

### Lobby casual (beaucoup de joueurs)
- **Presence** Realtime sur le canal `lobby:<id>` : liste des joueurs connectés.
- L'hôte lance la manche → RPC qui crée la manche en base → **Broadcast** « nouvelle question » à tous.
- Chaque réponse passe par la RPC `submit_answer` ; le classement de la manche est diffusé à la fin.

### 1v1 classé
- **Matchmaking** : insertion dans `matchmaking_queue`, une fonction SQL apparie deux joueurs de niveau proche (verrou `FOR UPDATE SKIP LOCKED` pour éviter les doubles appariements).
- **Pick & ban** : tours de sélection stockés dans `matches`, chaque choix validé par RPC puis diffusé.
- **Chrono et règle des 10 secondes** : la manche a une `deadline` en base. Quand le premier joueur répond, la RPC fait `deadline = least(deadline, now() + 10 s)`. Le client affiche le compte à rebours mais c'est l'heure du serveur qui fait foi ; une réponse arrivée après la deadline est refusée. La clôture se déclenche soit par la deuxième réponse, soit par un appel `close_round` qui vérifie que la deadline est passée (filet de sécurité avec `pg_cron` si les deux joueurs se déconnectent).
- **Classement par thème** : Elo ou Glicko-2 mis à jour en fin de partie dans la même transaction que le résultat.
- **Anti-triche** : la bonne date n'est révélée qu'à la clôture ; un joueur ne peut ni lire la réponse de l'adversaire avant la fin de la manche, ni écrire son score directement.

### Partie pédagogique
Contenu majoritairement statique (chapitres, cartes) : pages Next.js générées et mises en cache, donc rapides et peu coûteuses. Le mode « se tester » réutilise le moteur solo filtré sur un chapitre ; « affronter ses camarades » réutilise le lobby, avec un code de salon à partager en classe.

### Indicateurs de réussite
Journal durable `kpi_games` (trigger sur `games`, survit à la purge des anonymes), vues `kpi_*`
réservées à `admin_indicateurs()` et page `/admin/indicateurs` pour les comptes de `admins`.
Détails : [Indicateurs](indicateurs.md).

### Administration des packs (#87, #104)

#120 ajoute une recherche serveur paginée, un rattachement multiple et une création
atomique sourcée, ainsi qu’un accès depuis le profil décidé par une RPC booléenne.
Les sources/audits restent privés ; une séquence et des marqueurs d’association
préservent les ajouts aux imports. Migration préparée, non appliquée :
[Administration des questions](administration-questions.md).

`/admin/packs` réutilise `histoire.admins` et des RPC réservées aux administrateurs.
L’état privé par association et l’audit conservent les retraits/réintégrations.
Le helper de candidats et la roulette filtrent les seules associations retirées ;
les autres thèmes et chapitres restent disponibles. #87 est appliquée et #103
fusionnée. #104 ajoute les corrections globales titre/niveau, des surcharges
par champ préservées par un trigger d’import, et un audit complet privé.
Les titres affichés et réponses inversées acceptées sont figés par question
pour préserver les parties existantes. Migration #104 préparée, non appliquée
sur KFFR : [Administration des packs](admin-packs.md).

## 6. Organisation du code et travail à deux

```
kiffeurs-histoire/
  app/                  pages Next.js (solo, lobby, classé, apprendre, profil)
  components/           frise, cartes, saisie de date…
  lib/supabase/         clients navigateur / serveur (@supabase/ssr)
  lib/game/             règles partagées (calcul d'écart, normalisation)
  supabase/
    migrations/         SQL versionné (schéma histoire, RLS, fonctions)
    seed.sql            jeu de données d'événements pour le dev
  content/              événements et programme sous forme de fichiers (JSON/CSV) à importer
```

- **GitHub** : branche `main` protégée, chacun travaille sur une branche et ouvre une PR que l'autre relit.
- **Vercel** : chaque PR obtient une URL de preview ; `main` part en production automatiquement.
- **Supabase** : toutes les modifications de base passent par des fichiers de migration (`supabase migration new …`), appliquées en prod par une GitHub Action ou à la main après merge. Personne ne modifie le schéma de prod depuis le tableau de bord, d'autant plus que la base est partagée avec KFFR.
- **Variables d'environnement** : URL et clé publique Supabase dans Vercel ; la clé `service_role` uniquement côté serveur, jamais dans le code client ni dans Git.

## 7. Ordre de construction suggéré

1. Socle : repo, Next.js, branchement Supabase KFFR, connexion avec un compte KFFR existant.
2. Contenu : modèle `events`, import d'une première centaine d'événements, illustrations.
3. Mode solo + frise zoomable (le cœur du jeu, à rendre agréable avant tout le reste).
4. Partie pédagogique (programme de terminale) : c'est la fonctionnalité que vous jugez « hyper importante ».
5. Mode inversé avec correction des fautes.
6. Lobby casual (premier usage du temps réel).
7. 1v1 classé : matchmaking, pick & ban, rangs par thème.

## 8. Questions ouvertes

- Les migrations de KFFR contrée sont-elles dans Git ? (dossier `supabase/migrations` dans son dépôt)
- Les deux jeux seront-ils sous le même nom de domaine ? Pas prioritaire selon Maxou.
- D'où viendra le contenu historique (rédaction maison, sources libres type Wikidata) et qui le valide pour la partie pédagogique ?
