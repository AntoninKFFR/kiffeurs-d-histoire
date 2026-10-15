# Administration des packs — #87 et corrections éditoriales #104

L’ajout de questions existantes, la création sourcée et l’accès depuis le profil
sont décrits dans [Administration des questions — #120](administration-questions.md).
Ce guide complète les contrats historiques ci-dessous.
Le registre KFFR a été consulté le 15 octobre 2026 : #104, #89 et #91 y sont
appliquées. Les mentions « préparée/non appliquée » des sections anciennes
décrivent leur état lors de rédaction, pas l’état actuel de la production.

#89 préparée ajoute la parenté dans la liste et un total de questions incluant
les descendants. L’inventaire direct et ses actions restent inchangés ; ouvrir
un enfant pour gérer ses associations. Un retrait dans le parent masque aussi
son union, un retrait enfant reste limité à sa branche. Contrat et fixtures :
[Sous-packs jouables](sous-packs.md). Aucun SQL #89 appliqué pendant la livraison.

`/admin/packs` permet à Maxou et Antonin de relire les packs existants et de retirer
ou remettre leurs questions. #104 ajoute la correction globale du titre et du
niveau, avec historique complet. Le lien se trouve sur `/admin/indicateurs`.
Les comptes autorisés restent exclusivement ceux de `histoire.admins` ; aucune
nouvelle liste de comptes ni permission fondée sur les métadonnées du navigateur.

## Relecture des 24 packs

1. Se connecter avec un compte administrateur et ouvrir le lien des indicateurs.
2. Choisir un pack dans la colonne gauche. L’URL `?pack=<id>` permet de partager
   cette sélection entre administrateurs et de la retrouver après rechargement.
3. Lire chaque question : titre, identifiant, date (y compris les plages et les
   dates antiques), niveau éditorial et statut. Tous les événements associés sont
   présents, même ceux non jouables ou sans date exploitable.
4. Rechercher un titre, sélectionner un niveau exact, ou afficher uniquement les
   questions retirées/jouables. Ces filtres se combinent. Ils ne font aucun appel
   à la base. Le niveau de relecture est exact ; en jeu, Intermédiaire inclut
   aussi Débutant et Expert inclut les trois niveaux, comme auparavant.
5. Cliquer « Retirer », saisir éventuellement un motif (1 000 caractères maximum),
   puis confirmer. « Annuler » ou Échap ferme la confirmation sans rien écrire.
6. Une question retirée garde sa ligne, une étiquette « Retirée », et l’action
   « Remettre ». La dernière modification précise l’heure Europe/Paris,
   l’identifiant du compte administrateur et le motif. L’historique complet reste
   conservé en base, même après réintégration ; cette issue ne crée pas de CMS
   ni d’écran général d’historique.
7. Cliquer « Remettre » pour annuler un retrait. Une question globalement non
   jouable ne devient pas jouable par cette action. Les dates et les packs ne
   sont pas éditables. La correction des titres et niveaux est décrite ci-dessous.

En cas d’erreur, la page garde l’état précédemment confirmé et propose de
réessayer. Le motif reste dans la confirmation. Une coupure après validation SQL
peut laisser le résultat incertain : réessayer la même opération actualise l’état
sans ajouter une seconde entrée d’audit. Un succès actualise questions et
décomptes ensemble. Les autres onglets se mettent à jour au rechargement ou au
prochain changement de pack ; aucun abonnement ou sondage permanent.

## Portée du retrait et décomptes

Le retrait porte sur `(pack_id,event_id)` uniquement. Ni événement ni association
ne sont supprimés. Un événement retiré du pack A reste disponible dans B,
dans ses thèmes, en sélection générale et dans ses chapitres scolaires ou cartes
pédagogiques. Les parties déjà lancées conservent leur tirage et leur correction.
Les nouveaux lancements lisent les retraits validés en base au moment du tirage.

`solo_candidates` exclut les associations retirées lorsque `p_pack_id` est fourni.
Les deux signatures de `start_game`, les sens date/inverse, `available_questions`
et les relances classiques partagent donc le même état. La déduplication des dates
inversées et le plafond de 100 questions pour Tout sont inchangés.
`start_mystery_game` filtre aussi les associations de packs **avant** ses décomptes
et son tirage : un pack vide ou insuffisant après retrait n’entre pas dans la
roulette. Ses thèmes restent éligibles indépendamment. « Rejouer ce thème »
revalide le pack annoncé ; « Relancer la roulette » repart des candidats actuels.

La colonne de packs donne le total associé, le nombre retiré et les questions
réellement jouables à l’année, tous niveaux ; un pack inactif affiche zéro jouable.
Le choix 5/10/20/Tout utilise déjà les trois disponibilités dynamiques de #93 :
aucune régénération de `catalogue.json` n’est nécessaire après relecture. Ce
catalogue conserve seulement son rôle éditorial et ses bornes de frise.
`start_chapter_test`, qui sélectionne les événements des cartes et aucun pack,
reste inchangé. Les retraits ne touchent pas les apprentissages ni progressions.

## SQL, sécurité et coût

Migration #87 : `20261010210813_admin_packs.sql`, appliquée sur KFFR selon la
confirmation d’Antonin. #103 est fusionnée. Elle a été créée avec `npm run db:new`.
Elle dépend des fichiers #93 et #95, ne modifie aucune ancienne migration et
s’inscrit dans `histoire.migrations_appliquees` dans sa transaction.

- `pack_event_status` : état privé, clé primaire d’association. La RPC vérifie
  et verrouille l’association réelle. Il n’y a pas de cascade depuis le contenu :
  les imports par upsert ou suppression/réinsertion d’association gardent les
  retraits. Une association disparue conserve son état privé pour son éventuel
  retour, sans influer sur les décomptes tant qu’elle est absente.
- `pack_event_audit` : journal des transitions, compte issu de `auth.uid()`, date
  serveur, opération et motif. Pas de cascade vers ce journal.
- Les deux tables ont la RLS active, aucun droit ni policy pour les rôles API ;
  aucune écriture directe, même depuis un compte administrateur authentifié.
- `admin_list_packs` et `admin_pack_questions` contrôlent `auth.uid()` et
  l’appartenance à `admins` avant toute lecture privée. Les wrappers de retrait
  et réintégration exécutent le helper interne qui fait le même contrôle **avant**
  tout accès aux associations. Les fonctions ont un `search_path` vide et leurs
  droits EXECUTE sont retirés à PUBLIC/anon ; les quatre RPC sont accordées à
  authenticated avec autorisation réelle en SQL. Le helper n’a aucun EXECUTE API.
- Le verrou `FOR UPDATE` sur l’association sérialise les opérations concurrentes.
  Seules les transitions effectives écrivent un audit ; état et audit sont atomiques.
- Les réponses privées passent uniquement dans la projection administrateur.
  Un visiteur est redirigé vers la connexion ; un joueur reçoit 404. Une révocation
  de droits est contrôlée de nouveau sur chaque lecture/action. `no-store` évite
  tout cache de données administrateur partagé. Aucune clé privilégiée nécessaire.
- Deux RPC métier pour ouvrir un pack : décomptes de l’ensemble, puis questions
  du seul pack sélectionné. Les liens n’ont pas de préchargement des 24 packs.
  Une mutation fait un seul aller-retour et renvoie questions/décomptes actualisés.
  Les scans de candidats sont groupés ; l’audit récent utilise un index par
  association. Pas d’appel par ligne, ni de recalcul sur la saisie des filtres.

## Corriger le titre et le niveau — #104

Cliquer « Modifier » sur une question, y compris retirée. Le formulaire reprend
son titre canonique et son niveau (Débutant, Intermédiaire, Expert). Le titre est
obligatoire, limité à 500 caractères ; le motif est facultatif, limité à 1 000.
« Annuler » et Échap ferment sans écrire, puis rendent le focus au bouton.
« Enregistrer » bloque les doubles clics pendant la requête. Un succès actualise
la liste et les décomptes de tous les packs ; les filtres continuent à s’appliquer.
Si une question quitte le niveau filtré, elle disparaît de cette sélection.

Le titre et le niveau sont les propriétés globales de l’événement. La correction
vaut dans tous ses packs et dans les nouveaux tirages généraux, classiques,
inversés et mystère. Le scolaire et les tests pédagogiques utilisent ce titre,
mais leur sélection reste fondée sur les chapitres, indépendamment du niveau
éditorial. Les cartes pédagogiques ont leurs propres titres et textes rédigés :
ils ne sont pas réécrits par cette action. Dates, descriptions, illustrations,
alias explicites, retraits, programmes et indicateurs restent inchangés.

Le titre classique avant réponse reste masqué (chiffres, mois, siècles). Après
correction du titre canonique, l’ancien `titre_question` importé est écarté afin
de ne pas afficher un libellé rédigé devenu incohérent. Les nouvelles parties
inversées acceptent le nouveau titre et les alias explicites du dataset, avec le
seuil habituel 0,75. L’ancien titre n’est pas ajouté automatiquement aux alias.

« Historique » charge à la demande toutes les corrections de cet événement,
récentes en premier : compte administrateur, date/heure Europe/Paris, titre et
niveau avant/après, motif. Il est également accessible dans le formulaire.
Cet historique global est distinct de « Dernière modification », qui reste
l’audit du retrait ou de la remise dans le pack sélectionné.

### Persistence, atomicité et parties existantes

- `event_editorial_overrides` conserve les surcharges humaines par champ.
  Corriger seulement le niveau laisse le titre importable, et réciproquement.
  Le trigger privé BEFORE INSERT/UPDATE sur `events` réapplique ces surcharges,
  y compris pendant l’upsert de `scripts/import-dataset.ts`. Les futurs imports
  actualisent les autres champs sans créer de faux audits administrateur.
  Aucune modification du CSV ni procédure manuelle après chaque import.
- `admin_edit_event` vérifie réellement `auth.uid()` dans `admins`, puis verrouille
  l’événement global avec `FOR UPDATE`. État, surcharge et audit sont écrits dans
  la même transaction. La réponse renvoie questions/décomptes/historique ensemble.
  Aucun administrateur ni horodatage n’est fourni par le navigateur.
- Les valeurs attendues du formulaire détectent un onglet devenu obsolète :
  la correction est refusée et demande de recharger, sans perdre la saisie.
  Un retry dont les valeurs sont déjà enregistrées confirme l’état sans nouvelle
  écriture ni audit. Aucun audit lorsqu’aucun champ ne change réellement.
- `event_editorial_audit` conserve toutes les valeurs avant/après, indexées par
  événement et id décroissant ; pas de suppression en cascade du journal.
  `admin_event_history` impose la même autorisation SQL à chaque consultation.
- `game_question_editorial_snapshots` fige dès le tirage le titre masqué/rédigé et,
  pour le sens inverse seulement, le titre canonique et les alias acceptés.
  Le backfill couvre les parties encore en cours à l’application de #104.
  `next_question` et `submit_answer` lisent ces instantanés, avec les mêmes
  signatures, verrous de session, chronos et règles de score. Aucune question,
  réponse, date, description ou score existant n’est réécrit. Les instantanés
  sont purgés en cascade avec les questions, selon la rétention existante.
- Les trois nouvelles tables sont privées, RLS active sans policy API ni droits
  anon/authenticated. Les helpers/triggers n’ont aucun EXECUTE API. Les deux
  RPC sont accordées uniquement à authenticated avec contrôle administrateur.
  `search_path` vide, aucune clé service_role dans l’application.
- Aucun appel par ligne ni polling. Un historique n’est lu qu’à son ouverture ;
  une sauvegarde prend un aller-retour. Les accès aux surcharges et instantanés
  utilisent leurs clés primaires ; les alias sont copiés uniquement en inverse.

## Mise en service de #104 : GO SQL séparé

**Migration #104 non appliquée : `20261010232237_corrections_editoriales.sql`.**
Créée avec `npm run db:new`, transaction et registre `histoire.migrations_appliquees`.
Aucun SQL distant exécuté. Antonin doit donner un GO explicite séparé après revue
et CI verte. Le backfill lit les questions des parties actives et leurs alias ;
le volume et la durée restent à vérifier avant application (timeout SQL 60 s).
Ne pas fusionner avant cette étape ; ne pas utiliser `db push`/`apply_migration`.

Le dépôt contient déjà [l’audit du décompte public](audit-decompte-93.md) : les
décomptes exacts avec bornes libres et les refus de lancement peuvent permettre
d’inférer les années. Antonin a explicitement accepté ce risque résiduel le
10 octobre 2026 pour ce jeu sans cashprize. Cette décision ne bloque donc pas
la fusion de #103 et aucune refonte de sécurité n’est ajoutée à cette issue.
L’audit reste conservé comme référence du risque connu ; son acceptation ne
signifie pas que l’inférence a été corrigée. Les nouvelles dates/RPC
administrateur restent réservées aux comptes autorisés.

Maxou et Antonin devront tester avec leurs vrais comptes sur l’aperçu après le
GO SQL #104, puis réaliser la relecture éditoriale des 24 packs (#88).

## Vérifications

Tests ajoutés : `supabase/tests/admin_packs.sql` (automatiquement pris par la CI
SQL sur Postgres vide), trois fichiers Vitest `admin-packs-*` et le parcours
Playwright `e2e/admin-packs.spec.ts`. Les suites existantes de scolaire,
pédagogique, longueurs et mystère restent actives.

Le SQL vérifie comptes admin/joueur/anonyme, accès direct refusé, dates réservées,
état/audit/idempotence, deux signatures de tirage et deux sens, 5/10/20/Tout,
roulette vide/insuffisante, réintégration, autres packs/thèmes/chapitres et
instantanés. Il utilise les comptes du simulateur existant, sans toucher auth.
`scripts/tests-admin-packs-concurrence.sh` vérifie deux retraits puis deux remises
simultanées : une seule transition par opération et une seule ligne d’état.
Vitest vérifie aussi les refus de page, les actions, les erreurs SQL/réseau,
recherche/filtres, confirmation/annulation, double clic et décomptes actualisés.
Playwright couvre le parcours administrateur et le refus non administrateur,
le rechargement, l’audit, Échap et une coupure réseau.

Vérifications exécutées : 15 tests Vitest ciblés réussis, lint des fichiers TS/TSX
modifiés, `tsc --noEmit` et `git diff --check`. Pas de suite longue, build,
pile SQL locale ou test distant ; pas
d’attente de GitHub Actions/Vercel. Les résultats complets restent à relire avant
mise en service ; leur réussite n’est pas présumée.

Pour #104 : `supabase/tests/corrections_editoriales.sql` couvre titre/niveau,
validation, refus anon/joueur, accès direct privé refusé, audit complet, no-op,
conflits, upsert avec surcharges partielles, deux sens et 5/10/20/Tout,
roulette, scolaire, pédagogique, retrait/remise et scores existants intacts.
Les fixtures `corrections_avant_migration.sql` / `corrections_apres_migration.sql`
sont exécutées autour de la nouvelle migration par le simulateur CI vide :
elles prouvent le backfill d’une partie créée avant les nouveaux triggers.
`scripts/tests-corrections-concurrence.sh` confronte deux corrections réelles,
une seule validée et auditée, l’autre refusée pour conflit. Ces scripts sont
réservés au Postgres local du simulateur, jamais à KFFR.

Les parcours Playwright admin existants restent actifs, complétés par édition,
annulation/focus, niveau, motif, historique, autre pack, rechargement, no-op et
reprise réseau sur ordinateur/mobile. Vitest couvre ces composants et les
actions serveur : 22 tests ciblés réussis. SQL, E2E et suites longues non lancés
localement ; la CI reste à exécuter et relire, sans attente automatique.
Lint ciblé, `tsc --noEmit` et `git diff --check` passent. Une vérification Chromium
isolée des vrais composants, avec actions simulées et 250 questions, passe à
1280×800, 375×812 et 320×568 : édition, Échap, retour du focus et historique.
Elle ne remplace pas les E2E de la vraie route et de Supabase préparés pour la CI.
