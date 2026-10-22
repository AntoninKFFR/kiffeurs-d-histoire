# PRD : Kiffeurs d'Histoire

*Version du 5 octobre 2026, validée par Maxou et Antonin. Ce fichier est une copie : le PRD se discute et s'édite dans le document partagé [PRD : Kiffeurs d'Histoire](https://claude.ai/code/artifact/01d4550e-9ffd-4d7d-8741-b92a4c37cf0b), puis la version à jour est recopiée ici.*

## Vision et objectifs

Kiffeurs d'Histoire est un jeu web gratuit où l'on place des événements historiques sur une frise chronologique zoomable et illustrée. Il sert à la fois de jeu pour le grand public et d'outil de révision pour les collégiens et lycéens, sur la base des programmes de l'Éducation nationale.

La V1 a trois objectifs :

1. Rendre le geste central (situer un événement sur la frise) assez agréable pour qu'on enchaîne les parties.
2. Offrir aux élèves un moyen de réviser leur programme d'histoire en jouant.
3. Affiner la vision du gameplay avant de construire le multijoueur, qui sera le moteur de la rétention grand public.

## Publics cibles

Le jeu vise deux publics, avec un même moteur de jeu et un même contenu au départ.

| Public | Ce qu'il cherche | Modes V1 |
| --- | --- | --- |
| Grand public (ados et adultes curieux d'histoire) | Jouer librement, tester ses connaissances, plus tard se mesurer aux autres | Solo libre |
| Collégiens et lycéens | Réviser le programme de leur classe, sans sortir du cadre | Solo scolaire, Pédagogique |
| Professeurs (après la V1) | Faire jouer une classe et suivre les élèves | Aucun en V1 |

Le grand public joue avec moins de cadre : il choisit ses thèmes, ses périodes et sa difficulté. Le public scolaire reste cantonné au programme de son niveau.

## Périmètre de la V1

La V1 contient quatre modes solo et aucun multijoueur. Elle est gratuite, sans publicité, sans date de sortie fixée.

| Fonctionnalité | V1 | Plus tard |
| --- | --- | --- |
| Solo libre | Oui |  |
| Solo scolaire | Oui |  |
| Mode pédagogique (découvrir, puis se tester) | Oui |  |
| Jeu sans compte (solo et pédagogique) | Oui |  |
| Compte KFFR et sauvegarde de la progression | Oui |  |
| Navigateur web sur ordinateur | Oui, prioritaire |  |
| Affichage tablette et mobile | Anticipé dans la conception | Optimisé |
| Mode inversé (date donnée, événement à écrire) | Oui | Tolérance aux fautes affinée |
| Multijoueur casual (salon) | Non | V1.3 : Convivial, de 2 à 10 joueurs (voir « Multijoueur (V1.3) ») |
| 1 contre 1 (pick & ban) | Non | V1.3 : gagné aux points, sans rang ; classé avec rangs plus tard |
| « Affronter ses camarades » en pédagogique | Non | Plus tard (pas dans la V1.3) |
| Espace professeur | Non | Oui |
| Nouveaux packs de thèmes (inventions, dates françaises, etc.) | Ajoutés à tout moment, sans nouvelle version | Idem |
| Application mobile native | Non | Non prévu |

## Parcours joueur

On peut jouer dès la page d'accueil, sans compte. Le compte sert à garder sa progression.

1. **Accueil** : quatre entrées claires, Solo libre, Solo scolaire, Mode inversé, Apprendre (pédagogique), et un bouton Se connecter.
2. **Choix** : en solo libre, thème ou période, niveau et précision ; en scolaire et en pédagogique, le niveau (classe) puis le chapitre.
3. **Partie** : 10 questions par défaut (d'autres longueurs, comme 20 ou une période entière, seront proposées après les premiers tests), avec un chrono de 30 secondes chacune, chacune répondue sur la frise, au clavier ou au calendrier, suivie de la correction (bonne date, écart, courte explication).
4. **Fin de partie** : score en pourcentage de précision et récapitulatif des questions.
5. **Sans compte** : un message propose de se connecter pour sauvegarder ; rien n'est conservé après la fermeture.
6. **Avec compte** : le score, les chapitres vus et les statistiques sont enregistrés et visibles dans le profil.

## Cœur du jeu

Le joueur reçoit un événement illustré et doit le dater ; plus il est proche de la bonne date, plus il marque de points.

- **Frise** : graphiquement simple et sympathique, avec de petits dessins des événements, zoomable façon Google Maps du millénaire jusqu'au jour.
- **Trois façons de répondre**, équivalentes : taper la date au clavier, choisir dans un calendrier, cliquer sur la frise.
- **Précision demandée** : Année, Mois ou Jour. L'écart se mesure dans cette unité.
- **Niveau** (solo libre et mode inversé, 9 oct. 2026) : chaque événement est classé Débutant (dates connues de tous, programme scolaire), Intermédiaire ou Expert (dates de niche). Une partie Débutant ne tire que des événements Débutant, Intermédiaire tire Débutant et Intermédiaire, Expert tire tout. Classement dans `content/niveaux-evenements.csv`. Le mode scolaire suit le programme, sans niveau.
- **Score** : précision en pourcentage et points tenant compte du chrono (voir Score et chrono).
- **Correction** : après chaque réponse, la bonne date s'affiche sur la frise à côté de celle du joueur, avec une phrase d'explication.
- **Dates av. J.-C.** : gérées partout (affichage « 44 av. J.-C. », pas d'année 0).

## Score et chrono

Proposition à calibrer après les premiers tests : chaque question rapporte jusqu'à 100 points, dont 70 pour la précision et 30 pour la rapidité.

**Précision** (affichée en pourcentage) : 100 % pour la date exacte, puis elle baisse linéairement avec l'écart jusqu'à 0 % à l'écart maximal E₀ de la difficulté.

```latex
P = 100 \times \max\left(0,\ 1 - \frac{\text{écart}}{E_0}\right)
```

**Chrono** : 30 secondes maximum par question en solo. Sans réponse à 30 s, la question vaut 0. Plus on répond vite, plus le multiplicateur est haut.

```latex
\text{points} = P \times \left(0{,}7 + 0{,}3 \times \frac{t_{\text{restant}}}{30}\right)
```

| Précision | Unité | E₀ (écart qui vaut 0 %) |
| --- | --- | --- |
| Année | année | 50 ans |
| Mois | mois | 36 mois |
| Jour | jour | 90 jours |

Exemple : armistice de 1918 en précision Année, le joueur répond 1914 en 10 secondes. Écart de 4 ans, donc 92 % de précision ; il reste 20 s, donc multiplicateur 0,9 et 83 points.

En fin de partie : précision moyenne en pourcentage et total des points (1 000 au maximum pour 10 questions). Le mode inversé compte 100 % pour une bonne réponse, 0 % sinon, avec le même bonus de rapidité.

## Modes de la V1

Les quatre modes partagent le contenu et la frise, et les modes de datation partagent la saisie et le calcul du score ; seuls le choix des questions et l'accompagnement changent.

### Solo libre

- Pour le grand public : on joue contre soi-même, sans cadre scolaire.
- Filtres : général (tout mélangé), par période (siècle, décennie, millénaire, guerre mondiale) ou par thème, plus le niveau et la précision.
- Au lancement, le contenu disponible est celui de la base issue des programmes, rangé par thèmes et périodes ; chaque nouveau pack de thèmes y apparaît dès son ajout.

### Solo scolaire

- Pour les collégiens et lycéens : même jeu, mais limité strictement au programme.
- Filtres : niveau (de la 6e à la terminale), puis un ou plusieurs chapitres.
- La difficulté par défaut suit ce qu'on attend à l'examen (à confirmer avec la base d'Antonin).

### Mode inversé

- Le jeu donne une date (et la montre sur la frise), le joueur écrit l'événement correspondant.
- Correction tolérante : « Guerre froide » vaut « La guerre froide », les accents, la ponctuation et les fautes d'orthographe légères sont acceptés (comparaison floue contre le titre et les variantes acceptées).
- Mêmes filtres que le solo libre (thème, période) ou le solo scolaire (niveau, chapitre).
- Score : bonne ou mauvaise réponse ; à la correction, l'événement attendu s'affiche avec son explication.
- La correction existe déjà en base ; il reste l'interface et la partie.

### Pédagogique

1. **Découvrir** : une frise du chapitre avec de petites cartes cliquables posées dessus ; chaque carte donne une explication pour réviser.
2. **Se tester** : une partie solo scolaire sur ce chapitre, lancée depuis la frise.
3. **Affronter ses camarades** : prévu, mais arrive avec le multijoueur, après la V1.

Avec un compte, le joueur voit les chapitres découverts et son meilleur score de test par chapitre.

## Multijoueur (V1.3)

Décidé par Maxou le 21 octobre 2026. Roadmap : issue de suivi #148. La V1.2 est l'enrichissement du catalogue (#122). Maquettes validées, émotes et phrases du chat : `docs/multijoueur.md`.

**Deux modes**
- **Convivial** : de 2 à 10 joueurs. L'hôte fixe le maximum, 8 par défaut.
- **1 contre 1** : mode d'essai du futur classé. Il se gagne aux points, comme le Convivial, sans rang ni points de vie.

**Salon**
- Un salon est privé, ou **ouvert** : il apparaît alors dans le menu « Parties ouvertes ».
- Créer un salon demande un compte. Après chaque partie, tout le monde revient dans le salon.
- **Code de partie au format date JJ/MM/AAAA** (côté « RP »), avec un lien d'invitation.
- **Invités sans compte** : ils rejoignent seulement par code ou par lien, avec un pseudo temporaire. Ils n'ont accès ni aux parties ouvertes ni au 1 contre 1.
- **Amis** : ceux de KFFR contrée, avec une seule liste pour les deux jeux. On voit leur statut et on les invite directement depuis le salon.

**Réglages de l'hôte**
- Nombre de questions, précision Année / Mois / Jour, questions « période » oui ou non. Le mode inversé n'existe pas en multijoueur.
- Contenu : l'hôte choisit directement un thème, un pack ou une période, ou passe par le **Mystère** (roulette), ou par le **vote** (Convivial). Pour le Mystère, le vote et le pick & ban, il coche la ou les catégories proposées (pack, période, thème : 1, 2 ou 3).
- **Mode visible ou invisible** : en mode visible, on voit où les autres se placent. Le mode invisible est le réglage par défaut.
- **Mode chrono** (option, désactivé par défaut) : quand le premier joueur répond, les autres n'ont plus que 10 s.

**Déroulé d'une question**
- Chrono de 30 s. Dès que tous ont validé, on révèle les placements de chacun, puis la bonne date, puis le classement bouge.
- Score : même calcul qu'en solo, points cumulés sur la partie.
- Le classement reste toujours à l'écran ; un podium termine la partie.

**Pick & ban (1 contre 1)** : 7 propositions tirées des catégories cochées. Les joueurs bannissent à tour de rôle jusqu'à ce qu'il en reste une. L'hôte peut aussi choisir directement.

**Chat restreint** : émotes historiques et phrases toutes faites « RP » seulement, pas de texte libre.

**Supports et fluidité**
- Le multijoueur est jouable sur téléphone dès la V1.3.
- Objectif : moins de 0,2 s entre le clic d'un joueur et son affichage chez les autres.
- Le serveur reste l'arbitre du chrono, des réponses et des scores.

**Visuels d'abord** : toute image, maquette ou proposition visuelle est montrée en images dans la conversation et validée par Maxou avant d'être codée.

**Infrastructure de KFFR contrée** (décision de Maxou et d'Antonin, 22 octobre 2026)
- Les amis, la présence et les invitations sont ceux de la contrée. Antonin les ouvre à Histoire dans son dépôt (#149), et Histoire se contente d'appeler leurs fonctions.
- Les salons et les parties vivent dans le schéma `histoire`, avec du code copié et adapté de la contrée.

**Pas dans la V1.3** (carnet d'idées) : 1 contre 1 avec points de vie, classé avec rangs, pion avatar à skins et couronne du gagnant, « affronter ses camarades » en pédagogique, chat libre, mode histoire avec carte.

## Contenu

La V1 joue uniquement sur la base de questions déjà préparée par Antonin à partir des programmes d'histoire du collège et du lycée. Le contenu est organisé en packs de thèmes : un nouveau pack (grandes inventions, dates françaises, etc.) peut être ajouté ou mis à jour à tout moment, sans attendre une nouvelle version du jeu.

Chaque événement doit porter au minimum :

- un titre et une courte explication (affichée à la correction et sur les cartes) ;
- sa date (année, et mois et jour quand ils sont connus) et la précision disponible ;
- son rattachement au programme : niveau, chapitre ;
- un ou plusieurs thèmes ;
- une illustration simple (à produire si la base n'en a pas).

Pour le mode pédagogique, chaque chapitre a besoin en plus de cartes d'explication posées sur sa frise. La base d'Antonin (dataset v18, reçu le 5 octobre) compte 2 000 événements : 507 rattachés au programme du CM1 à la terminale (46 chapitres) et 1 493 de culture générale, déjà répartis en 24 packs prêts à jouer. Les variantes de titres des 394 événements scolaires qui n'en avaient pas ont été proposées par un agent (`kiffeurs-alias-additions-v18.csv`, à faire relire par Antonin) ; il manque encore des descriptions pour 304 événements, et aucune illustration n'est fournie. Les fichiers sont dans `content/dataset-v18/`. Les cartes pédagogiques seront rédigées par un agent IA. Les illustrations des événements sont des dessins simplifiés dans la charte graphique du jeu (voir « Illustrations » ci-dessous).

### Illustrations

Décision (validée par Maxou le 6 octobre 2026, issue 1.6, comparatif dans `docs/illustrations/`) : pas de photos ni d'images libres de droit dans l'interface. Chaque carte porte un dessin simple à l'encre (`#1D2A3A`) sur papier (`#F3F2EC`), avec les accents laiton et oxyde de la charte « Cabinet de curiosités ».

- Format : SVG, `viewBox="0 0 160 120"` (4:3), fond papier opaque, tracé de 2 px, 5 couleurs de la charte au maximum, aucun texte dans l'image.
- Poids maximal : 8 Ko par fichier (les exemples font moins de 1,5 Ko).
- Stockage : Supabase Storage, servi par CDN (voir `docs/architecture.md`) ; aucune licence tierce à suivre.
- Lancement : un événement sans dessin affiche le pictogramme de son thème (`public/motifs.svg`).

## Comptes, progression et supports

Les comptes sont ceux de KFFR contrée : un joueur KFFR se connecte avec les mêmes identifiants.

|  | Sans compte | Avec compte |
| --- | --- | --- |
| Solo libre, solo scolaire, pédagogique | Oui | Oui |
| Progression sauvegardée (scores, chapitres, statistiques) | Non | Oui |
| Rejoindre un salon multijoueur par code ou lien (V1.3) | Oui, avec un pseudo temporaire | Oui |
| Créer un salon, parties ouvertes, 1 contre 1, amis (V1.3) | Non | Oui |

**Supports** : navigateur web sur ordinateur en priorité. L'interface est conçue dès le départ pour s'adapter à la tablette et au mobile (frise tactile, pincer pour zoomer), sans application à installer.

**Profil** : un onglet Statistiques montre, pour un joueur connecté, ses parties jouées, sa précision moyenne et ses meilleurs scores par mode, par thème et par chapitre, ainsi que sa progression dans le mode pédagogique.

## Indicateurs de réussite

Aucun objectif chiffré n'est fixé pour l'instant ; ces mesures servent à juger si le gameplay est bon avant d'attaquer le multijoueur.

| Indicateur | Ce qu'il dit |
| --- | --- |
| Parties terminées par session | Le geste central donne envie d'enchaîner |
| Part des joueurs qui reviennent dans la semaine | Le jeu fidélise |
| Part des parties jouées en scolaire et en pédagogique | Les élèves s'en servent pour réviser |
| Part des joueurs sans compte qui en créent un | La sauvegarde de progression motive |
| Répartition des réponses entre frise, clavier et calendrier | Quelle saisie privilégier |
| Progression du score sur un même chapitre | Le jeu fait vraiment apprendre |

## Contraintes techniques

Le détail est dans le document d'architecture du dépôt (docs/architecture.md) ; voici ce qui contraint le produit.

- **Stack** : Next.js 16 sur Vercel, Supabase (Postgres, Auth, Storage), code sur GitHub.
- **Base partagée avec KFFR contrée** : tables du jeu dans le schéma `histoire` uniquement, quotas du plan gratuit partagés entre les deux jeux (500 Mo de base, 50 000 utilisateurs actifs par mois).
- **Pas de triche possible** : la bonne date n'est jamais envoyée au navigateur avant la réponse ; la correction et le score sont calculés côté serveur.
- **Progression sans compte** : gardée dans le navigateur le temps de la session seulement.
- **Coût** : la V1 doit tenir dans le plan gratuit Supabase et le plan gratuit Vercel.

## Après la V1

Aucun calendrier n'est fixé ; l'ordre ci-dessous suit les priorités exprimées.

1. **Multijoueur** : c'est la V1.3 (voir « Multijoueur (V1.3) »). Les invités sans compte y rejoignent un salon par code ou lien. « Affronter ses camarades » en pédagogique vient plus tard.
2. **1v1 classé** (après la V1.3) : pick & ban sur les thèmes, rangs par thème, points de vie perdus selon l'écart, temps limité avec la règle des 10 secondes après la première réponse. C'est le mode attendu pour fidéliser le grand public.
3. **Espace professeur** : créer une classe, faire jouer les élèves, suivre leurs résultats.

Les packs de thèmes ne dépendent pas de cette feuille de route : ils s'ajoutent quand ils sont prêts.

## Questions ouvertes

Ce PRD est validé à deux, par Maxou et Antonin. Restent ouverts :

- [ ] Dataset v18 : faire relire par Antonin les variantes de titres proposées (394 événements scolaires) et compléter les descriptions (304), remplir les 8 chapitres sans événement, et décider si les 1 000 ajouts en attente de relecture entrent dans la V1.
- [x] Illustrations : dessins simplifiés dans la charte graphique (validé par Maxou le 6 octobre 2026 ; voir « Illustrations »).
- [ ] Calibrer le score après les premiers tests : valeurs de E₀, part de la rapidité (30 %), durée du chrono (30 s).
- [ ] Longueurs de partie proposées en plus des 10 questions (20, période entière).
- [ ] Faut-il des meilleurs scores visibles par tous en solo pour le grand public ?
