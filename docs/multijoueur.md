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
