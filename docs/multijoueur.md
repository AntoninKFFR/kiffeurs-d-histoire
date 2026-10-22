# Multijoueur (V1.3)

Roadmap : issue de suivi #148. Règles de jeu décidées par Maxou : #130 (à reporter dans `docs/prd.md`).
Ce document sert de référence aux issues V1.3 ; chaque issue y ajoute ce qu'elle construit (tables, RPC, mesures).

## Maquettes validées (#131, 22 octobre 2026)

Validées par Maxou le 22 octobre 2026, sans changement demandé. Elles font foi pour tous les écrans multijoueur :
un écran ou un élément visuel qui n'y figure pas est d'abord montré **en images dans la conversation** et validé
par Maxou avant d'être codé.

Les émotes (😂, ⚔️…) et les illustrations des cartes sont **provisoires** : les vrais dessins viennent de #132
et des illustrations existantes du jeu. Les pseudos, scores et salons sont des exemples.

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
