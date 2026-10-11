# Sous-packs jouables — #89

Un pack possédant des enfants ouvre une vue dédiée sur `/solo` et `/inverse` :
« Tout le pack », sous-packs, nombre de questions disponibles au niveau,
à la précision et dans le sens choisis. Un enfant insuffisant pour la longueur
est désactivé ; Tout permet une sélection non vide, avec le plafond existant de
100 questions. Retour remonte d’un niveau, puis vers la liste des packs.
Les boutons sont utilisables au clavier ; le focus suit le titre de navigation.

La liste vivante vient de `playable_packs`, sans cache partagé : les imports,
retraits et corrections éditoriales sont pris en compte au prochain chargement
ou changement de niveau. Une erreur affiche Réessayer et bloque le lancement.
Les précisions et longueurs réutilisent les comptes déjà lus. Le moteur revalide
au lancement : une modification concurrente peut rendre un choix insuffisant.
Les anciens packs restent plats (`parent_id = null`). Le contenu Sport est
préparé séparément dans [Pack Sport — #90](pack-sport.md).

La restauration valide le pack mémorisé dans le catalogue vivant : s’il est
supprimé ou inactif, retour en Général avec les réglages conservés et un message.
Un pack présent mais insuffisant reste sélectionné, avec Jouer désactivé ; une
panne de lecture garde le choix et propose Réessayer. Retour vers Tous les packs
ne réécrit pas la mémoire : un rechargement reprend le dernier choix lancé.

## Contrat SQL

Migration préparée : `20261010235740_sous_packs.sql`, exclusivement `histoire`,
après #87/#93/#95/#104. **Appliquée sur KFFR avant #90, PR #106 fusionnée.**
Aucun `db push` ni `apply_migration`. Le registre et le rechargement PostgREST
restent dans la transaction du fichier, suivant la procédure du README.

`packs.parent_id` référence un pack existant ; la suppression d’un parent lié
est refusée. Le trigger interdit auto-parenté et cycles, y compris sur plusieurs
lignes. Une ligne de verrou privée sérialise les mutations ; à isolation forte,
une transaction périmée est refusée plutôt que créer un cycle. Aucune RPC publique
ne permet de changer la hiérarchie. Son édition générale est hors de cette issue.

`pack_scope_events` est interne, INVOKER, `search_path` vide et EXECUTE retiré
aux rôles joueurs. Il traverse les descendants actifs et produit une union
d’identifiants sans doublon. Les branches inactives ne contribuent pas ; un
enfant actif reste jouable directement même si son parent est inactif.

Retraits : un état retiré sur le pack demandé exclut l’événement de toute son
union, même s’il est aussi associé à un enfant. Un retrait sur un descendant
masque cette branche et ses descendants ; une association indépendante dans
une autre branche peut encore contribuer. Jouer l’enfant n’applique pas les
retraits de ses ancêtres. Les états et audits #87 ne sont jamais réécrits.

`solo_candidates` réutilise cette union et garde les filtres actuels (niveau
cumulatif, précision, début de plage, années, programme). Les deux signatures
de `start_game` et `available_questions` restent inchangées. En inverse, les
dates affichées sont dédupliquées à la précision demandée. La roulette utilise
la même union avant de vérifier 5/10/20/Tout ; parents et enfants éligibles
constituent chacun un choix de thème. Rejouer le thème garde son identifiant ;
relancer la roulette refait un tirage avec les réglages mémorisés.

`playable_packs(niveau, direction, pack_id?)` expose uniquement identifiants,
titres, descriptions, parenté, trois décomptes et bornes de frise arrondies à la
dizaine avec marge. Aucune date précise par événement, alias ou identité privée.
Une projection TypeScript élimine les champs inattendus et refuse les données
invalides. La page de partie recharge les bornes de l’union depuis cette RPC.
L’URL, la mémoire et les filtres SQL conservent le pack choisi, sans ajouter un
second identifiant « sous-pack ». Le moteur reste seul juge de l’existence et
de la disponibilité d’un identifiant au format valide.

`next_question`, correction, autorisations, cookies, scores et instantanés #104
ne changent pas. Les limites de confidentialité préexistantes des décomptes
avec bornes temporelles libres restent décrites dans `audit-decompte-93.md` ;
cette issue n’ajoute pas de filtre temporel à la nouvelle RPC de catalogue.

## Administration et imports

`/admin/packs` affiche la parenté et le total jouable de l’union pour les parents.
L’inventaire et ses compteurs directs restent distincts de cette union.
Retirer/Remettre portent sur l’association du pack ouvert ; les événements
propres à un enfant se gèrent en ouvrant cet enfant. Modifier/Historique restent
globaux à l’événement, avec les autorisations et audits #104 existants.

L’import v18 ne fournit pas `parent_id` dans son upsert : la hiérarchie éditoriale
existante est préservée. Les packs absents du CSV et leurs associations ne sont
pas synchronisés ni supprimés. Les associations directes des packs présents
continuent de suivre le dataset ; surcharges globales et retraits persistent
via les mécanismes #87/#104. `build-catalogue-solo.ts` accepte une colonne
facultative `parent_id`, produit l’union récursive et refuse cycles/parents absents.
Le catalogue statique n’est pas la source des décomptes en jeu.

## Exemple et vérifications

`supabase/fixtures/sous_packs_existants.sql` est réservé à la pile locale jetable
de Playwright : Guerres et batailles, conflits avant/depuis 1800, enfant vide,
et Première Guerre mondiale comme enfant issu du dataset. Il ne crée aucune
date ni événement. Le découpage est démonstratif et n’est ni dans le seed ni
dans la migration. Les tests annulent/nettoient leur hiérarchie locale.

- Vitest ciblé : catalogue récursif, projection/erreurs serveur, navigation,
  focus, mémoire, relance, longueur, inverse, mystère et administration.
- `npm run test:sous-packs-browser` : build Next et six lectures Chromium
  (1280×800, 1366×768, 375×812 ; classique/inverse) avec API de fixtures locale,
  focus clavier, absence de débordement horizontal et de défilement PC.
- `supabase/tests/sous_packs.sql` : union, trois niveaux/précisions, longueurs,
  deux sens, plages, parenté invalide, retraits, inactivité, replay SQL,
  corrections/audits/import et réponses privées/autorisations.
- `scripts/tests-sous-packs-concurrence.sh` : deux parentés concurrentes.
- `e2e/sous-packs.spec.ts` : vraie pile Supabase jetable, parties/rejouer,
  mémoire, navigation PC/mobile/clavier et réimport complet du dataset.

Les suites SQL et Playwright complètes tournent en GitHub ; elles ne sont pas
lancées localement pour cette livraison. Docker est indisponible dans la session
locale. La CI n’est pas attendue et la PR reste en brouillon.
