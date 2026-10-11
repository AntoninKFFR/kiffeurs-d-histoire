# Relecture des choix Solo libre et Inversé

Captures de la vraie application compilée avec les polices du projet, branchée
sur une API de fixtures locale. Aucune connexion à KFFR. Le catalogue Sport
et ses décomptes proviennent des fichiers inchangés de la PR #108.

Reproduire : `npx tsx scripts/verifier-sous-packs-local.ts --ux`.
Le script compile, lance Next et l'API locale, réalise les six parcours et ferme
ses processus. `--sans-build` réutilise uniquement un build avec ces fixtures.

| Viewport | Solo libre | Inversé |
| --- | --- | --- |
| 1280×800 | [Parent](parent-classique-1280.png), [Mystère](mystere-classique-1280.png) | [Parent](parent-inverse-1280.png), [Mystère](mystere-inverse-1280.png) |
| 1366×768 | [Sous-thèmes](sous-themes-classique-1366.png), [Mystère](mystere-classique-1366.png) | [Sous-thèmes](sous-themes-inverse-1366.png), [Mystère](mystere-inverse-1366.png) |
| 375×812 | [Parent](parent-classique-375.png), [Mystère](mystere-classique-375.png) | [Parent](parent-inverse-375.png), [Mystère](mystere-inverse-375.png) |

Les autres captures couvrent Général, Période, la liste complète, Football
sélectionné et la roulette pour les deux sens. Les captures mobiles sont en
page entière ; la barre collée en bas du viewport est mesurée séparément.

[Mesures JSON](mesures.json) : largeur document égale au viewport dans les
12 mesures ; hauteur document égale au viewport dans les 8 mesures PC ; bas du
bouton Jouer inférieur à la hauteur du viewport dans toutes les mesures.

Contrôles : navigation Entrée, sélection sans ouverture ni lancement, focus
du titre lors de l'exploration/du retour, enfants insuffisants désactivés,
absence d'erreur JavaScript, réglages du mystère, Passer vers la même partie,
une seule création, mémoire et lancement ultérieur du parent.
La relecture vérifie aussi que l'exploration et le retour gardent le parent choisi,
que le choix d'un enfant le remplace, et qu'une ancienne mémoire `periodes=0`
ne désactive pas les périodes d'une nouvelle partie classique (vérifié dans l'appel RPC).

Relecture visuelle : titres et comptes lisibles, focus visible, longueurs et
niveaux sans dépassement à 375 px, grilles défilantes, barre finale accessible.
Le contenu Sport, les fonctions SQL et le tirage réel ne sont pas modifiés.
