# Multijoueur (V1.3)

Roadmap : issue de suivi #148. Règles de jeu décidées par Maxou : #130 (à reporter dans `docs/prd.md`).
Ce document sert de référence aux issues V1.3 ; chaque issue y ajoute ce qu'elle construit (tables, RPC, mesures).

## Maquettes validées (#131, 22 octobre 2026)

Validées par Maxou le 22 octobre 2026, sans changement demandé. Elles font foi pour tous les écrans multijoueur :
un écran ou un élément visuel qui n'y figure pas est d'abord montré **en images dans la conversation** et validé
par Maxou avant d'être codé.

Les émotes (😂, ⚔️…) des maquettes sont **provisoires** : les vrais dessins sont ceux de #132 (plus bas).
Les illustrations des cartes viennent des illustrations existantes du jeu. Les pseudos, scores et salons sont des exemples.

| Écran | PC (1366 × 768) | Téléphone | Issues |
| --- | --- | --- | --- |
| Accueil « Jouer à plusieurs » : créer un salon, rejoindre avec un code JJ/MM/AAAA, parties ouvertes, amis, invitation reçue | [accueil-pc](maquettes/v1.3/accueil-pc.png) | [accueil-tel](maquettes/v1.3/accueil-tel.png) (375 × 740) | #134, #137, #139 |
| Salon : code, joueurs (couronne, invités), amis à inviter, réglages de l'hôte, émotes et phrases, Lancer | [salon-pc](maquettes/v1.3/salon-pc.png) | [salon-tel](maquettes/v1.3/salon-tel.png) (375 × 740) | #136, #138, #139 |
| Partie Convivial en mode visible : chrono, « X / 5 ont validé », curseurs des autres, classement posé sur la frise | [partie-pc](maquettes/v1.3/partie-pc.png) | [partie-tel](maquettes/v1.3/partie-tel.png) (667 × 375) | #140, #141 |
| Révélation : réponses de tous avec points gagnés, bonne réponse, classement ▲▼ | [revelation-pc](maquettes/v1.3/revelation-pc.png) | — | #142 |
| Fin de partie : podium, classement final, coup de maître et plus gros raté, retour au salon | [podium-pc](maquettes/v1.3/podium-pc.png) | — | #143 |
| Vote : trois propositions (pack, période, thème), votes visibles, chrono 15 s | [vote-pc](maquettes/v1.3/vote-pc.png) | — | #144 |
| Roulette Mystère : bande qui défile, barre dorée, même tirage pour tout le salon | [roulette-pc](maquettes/v1.3/roulette-pc.png) | — | #144 |
| Pick & ban (1 contre 1) : 7 propositions, bannissements alternés, tour chronométré | [pickban-pc](maquettes/v1.3/pickban-pc.png) | [pickban-tel](maquettes/v1.3/pickban-tel.png) (667 × 375) | #145 |

Les écrans sans maquette téléphone suivent la même logique que leur version PC et la partie sur téléphone
(frise au centre, classement réduit aux trois premiers, actions en bas, rien ne défile).

Les sources HTML des maquettes (couleurs et polices de la charte) sont dans `maquettes/v1.3/sources/`.
Elles ne sont pas du code du jeu : on s'en inspire, on ne les importe pas.

## Chat restreint : émotes et phrases (#132, 22 octobre 2026)

Validés par Maxou le 22 octobre 2026. Pas de texte libre dans les salons : on n'envoie qu'une émote ou une phrase
de ce catalogue. Le catalogue est dans `src/lib/multi/chat-catalogue.ts` ; les 16 émotes sont des dessins encre
(64 × 64, moins de 2 Ko) dans `public/emotes/<id>.svg`. Les 25 phrases sont classées en 5 familles (saluer,
encourager, taquiner, féliciter, réagir).

Le client envoie seulement l'identifiant (`berezina`, `napoleon-rire`…) ; le serveur refuse tout identifiant
absent du catalogue (#138). Les identifiants sont stables : on peut en ajouter, jamais en renommer ni en réutiliser.

## Salons en base (#133)

Migration `20261022090000_salons_multijoueur.sql`, schéma `histoire` seulement. Tests : `supabase/tests/salons.sql`
(lancés par `scripts/tests-sql.sh` en CI). Les tables sont fermées au navigateur : il passe uniquement par les RPC.

| Table | Contenu |
| --- | --- |
| `salons` | Code (une date, affichée JJ/MM/AAAA), mode `convivial` ou `un_contre_un`, visibilité `prive` ou `ouvert`, nombre de places (2 à 10, 2 en 1 contre 1), réglages, état `attente` ou `partie`, `version` (augmente à chaque changement) |
| `salon_membres` | Compte (`user_id`) **ou** invité (hash de son jeton secret), pseudo, ordre d'arrivée, couronne d'hôte |
| `salon_exclus` | Comptes expulsés d'un salon |
| `salon_essais_code` | Codes faux essayés (anti-devinette) |
| `parties_multi`, `parties_multi_questions`, `parties_multi_reponses` | Parties, questions (bonne réponse privée) et réponses horodatées par le serveur. Structure seulement : les RPC de jeu arrivent avec #140 |

**Code de partie** : une vraie date tirée au hasard entre l'an 1000 et 2025, hors d'une courte liste de dates trop
connues (14/07/1789, 11/11/1918, 08/05/1945…), unique parmi les salons existants. Un salon est supprimé quand son
dernier membre part, ou après 2 heures sans activité : son code redevient libre. Saisie acceptée : `14/07/1789`,
`14.07.1789` ou `14-07-1789`.

**RPC** (les invités passent leur jeton dans `p_jeton` ; les comptes sont reconnus par leur connexion)

| RPC | Qui | Effet |
| --- | --- | --- |
| `creer_salon(p_mode, p_visibilite, p_max_joueurs, p_reglages)` | compte | Crée le salon, le créateur a la couronne. Renvoie `salon_id`, `membre_id`, `code` |
| `rejoindre_salon(p_code, p_pseudo)` | tous | Rejoint par code. Un invité donne un pseudo (2 à 20 caractères, unique dans le salon) et reçoit un `jeton` à garder. Code faux : `{"erreur": "code_inconnu"}` |
| `rejoindre_salon_par_lien(p_salon_id, p_pseudo)` | tous | Pareil, avec l'identifiant du salon contenu dans le lien d'invitation |
| `etat_salon(p_salon_id, p_jeton)` | membre | Salon, réglages et membres (pseudo, hôte, invité, ordre). Jamais de jeton ni d'identifiant de compte |
| `modifier_salon(p_salon_id, p_jeton, p_reglages, p_visibilite, p_max_joueurs)` | hôte | Change les réglages entre deux parties ; `p_reglages` remplace les clés données |
| `expulser_membre(p_salon_id, p_membre_id, p_jeton)` | hôte | Retire un membre ; un compte expulsé ne revient pas dans ce salon |
| `quitter_salon(p_salon_id, p_jeton)` | membre | Si l'hôte part, la couronne passe au joueur arrivé juste après lui |

Règles appliquées en base :
- Un compte est dans un seul salon à la fois : en créer ou en rejoindre un autre le fait quitter le précédent.
- Les invités n'entrent pas en 1 contre 1. On n'entre pas pendant une partie, ni dans un salon complet.
- **Anti-devinette** : 20 codes faux par 10 minutes et par appelant (le compte, sinon l'adresse IP) ; au-delà, refus
  pendant quelques minutes.
- Réglages (valeurs par défaut entre parenthèses) : `questions` 5, 10 ou 20 (10), `precision` `YEAR`, `MONTH` ou
  `DAY` (`YEAR`), `questions_periode` (non), `mode_visible` (non), `mode_chrono` (non), et `contenu` :
  - `choix` : `direct`, `mystere`, `vote` (Convivial seulement) ou `pick_ban` (1 contre 1 seulement) ; par défaut
    `direct` en Convivial et `pick_ban` en 1 contre 1 ;
  - `categories` : `pack`, `periode` et/ou `theme` ;
  - `cible` : `{"type": …, "id": …}` en choix direct.

  Toute autre clé est refusée.
- Erreurs : `42501` accès refusé (connexion requise, pas hôte, exclu, salon inexistant), `22023` paramètre invalide,
  `55000` salon complet ou partie en cours, `53400` trop d'essais de code.

## Invités sans compte (#134)

Migration `20261022110000_invites_salons.sql`, tests `supabase/tests/invites.sql`. Aucune connexion anonyme Supabase,
aucun compte créé, rien dans `auth` ni `public`.

- **Entrée** : seulement par code ou par lien (`rejoindre_salon`, `rejoindre_salon_par_lien`). Pas de création de salon,
  pas de 1 contre 1, et la liste des parties ouvertes (#137) leur sera refusée côté serveur.
- **Jeton** : 64 caractères aléatoires, rendus une seule fois ; la base n'en garde que le hash et une date d'expiration
  (**24 h**). Le site le range dans un cookie httpOnly `histoire-salon-<uuid>` (24 h, `sameSite=lax`) : le JavaScript
  de la page ne le voit jamais. Toutes les actions passent par `src/app/multi/actions.ts` (`rejoindreParCode`,
  `rejoindreParLien`, `etatSalon`, `battementSalon`, `quitterSalon`), qui lisent ce cookie.
- **Pseudo** : 3 à 16 caractères (lettres, chiffres, espaces, `-`, `_`, `.`, `'`), espaces en trop retirés, unique
  dans le salon, marqué « invité » à l'affichage. Refusés : grossièretés (même déguisées : `c0nn4rd`, accents), et noms
  qui feraient passer l'invité pour l'équipe ou l'hôte (`Admin`, `KFFR`, `Hôte`…). Règle en SQL
  (`histoire.refus_pseudo_invite`), copie côté navigateur pour prévenir avant l'envoi (`src/lib/multi/salon.ts`).
- **Usurpation** : sans le jeton, impossible d'agir à la place d'un invité ; un jeton ne vaut que pour son salon ;
  un invité n'est jamais hôte. Un compte qui ouvre un lien entre avec son pseudo KFFR, sans jeton.
- **Temps réel** : l'invité rejoint le canal `histoire-salon:<uuid>` de son salon, dont il connaît l'uuid ; l'uuid des
  autres salons ne lui est jamais donné.
- Les écrans (pseudo sous le code, page du lien) suivent la maquette `accueil` et arrivent avec #136 et #137.

## Temps réel (#135)

**Canal** (`src/lib/multi/canal.ts`) : un seul canal Supabase Realtime par salon et par onglet, nommé `histoire-salon:<uuid du salon>`. Presence (clé = identifiant du membre) dit qui est là ; Broadcast (événement `evt`) porte les curseurs du mode visible, le chat restreint et l'avis « le salon a changé, rechargez ». Le canal est public, car les invités n'ont pas de session et nous ne touchons pas aux règles du schéma `realtime` : il ne transporte donc rien de secret, et tout ce qui arrive est filtré (`lireEvenement` ; le chat n'accepte que les identifiants du catalogue). En cas de coupure, le canal se réabonne seul après 0,5 s, 1 s, 2 s… jusqu'à 8 s.

**Battement de présence** (`battement.ts`, action `battementSalon`, RPC `histoire.battement_salon`) : chaque onglet signale sa présence toutes les 10 s, et aussitôt quand il redevient visible (téléphone sorti de veille). Un membre silencieux depuis **plus de 30 s** est retiré du salon (la couronne passe au suivant) ; en dessous, il retrouve sa place telle quelle. Le battement renvoie aussi la version du salon, ce qui rattrape un avis `salon_change` perdu pendant la coupure.

**Horloge** (`horloge.ts`, RPC `histoire.heure_serveur`) : 5 allers-retours au démarrage ; on garde le plus rapide et on en déduit l'écart entre l'horloge du navigateur et celle du serveur. Les comptes à rebours s'affichent en heure du serveur (`resteAvant`), donc tombent à zéro en même temps chez tout le monde ; c'est la base qui refuse une réponse en retard.

**Affichage optimiste** (`optimiste.ts`) : le clic s'affiche tout de suite chez le joueur, la RPC part ensuite ; si le serveur refuse, l'affichage est annulé.

**Plafond de connexions** (table `histoire.limites_temps_reel`) : l'offre gratuite donne 200 connexions temps réel, partagées avec la contrée. Le multi s'arrête à **120 membres connectés** : au-delà de 110, on ne crée plus de nouveau salon (erreur 53400, « trop de monde, réessaie dans un instant »), les 10 places restantes servant à rejoindre les salons existants. Les deux nombres se changent en base sans déploiement.

**Page de test** : `/multi/test-latence` (liée nulle part, non indexée). Ouvrir la même adresse dans deux onglets ou sur deux appareils ; chaque onglet envoie un message par seconde, les autres le renvoient, la page affiche l'aller simple (médiane et 95 %) et l'écart avec l'horloge du serveur. `?salon=xyz` pour isoler un essai.

**Mesures** : objectif, aller simple médian sous 0,2 s.

| Date | Conditions | Aller simple médian | 95 % | Écart d'horloge |
|---|---|---|---|---|
| à faire | deux navigateurs, KFFR | | | |

La synchronisation des chronos est vérifiée par les tests (`tests/multi-temps-reel.test.ts` : écart estimé à moins de 0,3 s malgré un réseau irrégulier), et la reconnexion après 10 s de coupure par `supabase/tests/temps_reel.sql`.

## Écran du salon (#136)

- `/multi` : accueil « Jouer à plusieurs » (colonne « Créer un salon », compte requis ; les autres colonnes : #137).
- `/multi/salon/<uuid>` : l'écran du salon, et aussi le **lien d'invitation** (« Copier le lien ») : un compte y entre
  aussitôt avec son pseudo KFFR, un invité choisit d'abord son pseudo.
- Composants : `EcranSalon` (affichage seul, d'après les maquettes salon-pc et salon-tel), `SalonEnDirect` (état,
  canal, battement), `RejoindreInvite`, `CreerSalon` (`src/components/multi/`). Aperçu avec des joueurs fictifs :
  `/apercu/salon` (hôte) et `/apercu/salon?vue=joueur`.
- Synchronisation : après chaque action réussie, l'écran recharge l'état et diffuse `salon_change` ; les autres
  rechargent en le recevant, ou au battement suivant s'ils l'ont manqué. Point vert = présent sur le canal.
- Les réglages sont modifiables par l'hôte seul (désactivés chez les autres, refusés en base). Sur téléphone, ils sont
  résumés ; l'hôte les ouvre en plein écran avec « Modifier ».
- La fenêtre « Choisir le contenu » (packs, périodes, thèmes du solo) n'était pas dans les maquettes : montrée à Maxou
  en images avant fusion.
- « Lancer la partie » est actif pour l'hôte à partir de 2 joueurs ; il sera branché sur la partie avec #140.
- Le chat (#138) et les amis (#139) prendront la place prévue dans les maquettes.

## Rejoindre avec un code et parties ouvertes (#137)

Migration `20261022120000_parties_ouvertes.sql`, tests `supabase/tests/parties_ouvertes.sql`.

- **Accueil** `/multi` (maquettes accueil-pc et accueil-tel) : Créer un salon, Rejoindre avec un code, Parties ouvertes.
  La colonne Amis arrive avec #139. Sur téléphone, « Créer un salon » déplie le choix du mode, et la liste des parties
  défile seule : la page, elle, ne défile pas. Aperçu avec des salons fictifs : `/apercu/multi` (`?compte=0` : invité).
- **Code** : trois cases JJ / MM / AAAA, pavé numérique sur téléphone, mêmes corrections qu'en partie (`corrigerCases` :
  mois 13 → 12, 31/02 → 28 ou 29). Sans compte, le pseudo est demandé dans la même colonne.
- **Parties ouvertes** : RPC `parties_ouvertes()`, comptes seulement (un invité reçoit 42501). Salons `ouvert` des
  2 dernières heures, sans code ni identifiant de compte ; un compte exclu ne voit plus le salon. Rafraîchie toutes
  les 5 s quand la page est visible. Bouton « Rejoindre », « Attendre » si une partie est en cours, « Revenir » si on
  y est déjà, « Complet » sinon.
- **Partie en cours** : on peut entrer dans un salon (s'il reste une place) pendant une partie ; on attend dans le
  salon. Ce joueur est marqué « en attente » (`salon_membres.en_attente`, posé par la base) ; entre deux parties, l'hôte
  l'**accepte** (`accepter_membre`) ou le **refuse** (`expulser_membre`). Décision de Maxou, 22 oct. Migration
  `20261022130000_arrivee_en_partie.sql`. Les joueurs d'une partie seront ceux présents et acceptés à son lancement (#140).
- **Lien d'invitation** : `/multi/salon/<uuid>` (#136) plutôt que `/salon/<code>` : l'uuid ne se devine pas, alors qu'un
  lien avec le code contournerait la limite d'essais de codes.
