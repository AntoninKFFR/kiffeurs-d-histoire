# V1.2 — Audit complet et plan (#122)

**16 octobre 2026, 00 h 05 (Paris)**. Main : `6a9cb8f448dd3d68e8e7f5fccfb6707f6e98c5f6`.
Audit et propositions uniquement : aucune publication, migration ou partie de test sur KFFR.

## Résultats mesurés

| Indicateur | Avant mesuré | Après production |
| --- | ---: | --- |
| Événements | 2 105 | Non publié |
| Débutant stockés / jouables | 260 / 238 | Non publié |
| Intermédiaire exclusifs stockés / jouables | 601 / 595 | Non publié |
| Expert exclusifs stockés / jouables | 1 244 / 1 241 | Non publié |
| Jouables globalement à l’année | 2 074 | Non publié |
| Packs actifs, dont enfants Sport | 37, dont 6 | Non publié |
| Packs sous 10 / sous 20 Débutant année | 20 / 23 | Non publié |
| Packs sans Débutant | 6 | Non publié |
| Retraits administratifs actuels | 0 | Non publié |
| Créations / rattachements manuels #120 | 0 / 0 | Non publié |

Les chiffres initiaux du 15 octobre sont confirmés par de nouvelles lectures. Mode expert est spécialisé : son unique Débutant ne constitue pas un défaut à corriger. **19 des 20 packs sous dix Débutant sont donc prioritaires.** Les contrats 50/100 dates et Mode expert restent intacts.

- [Matrice des 37 packs](matrice.md) : totaux, jouabilité, quatre cohortes, Inversé et longueurs.
- [Disponibilités exhaustives](disponibilites.csv) : **888 cellules**, soit 37 packs × 4 cohortes × 2 sens × 3 précisions. Chaque cellule donne 5/10/20/Tout et l’éligibilité du pack dans Mystère.
- [Couverture des 37 packs](couverture.csv) : associations directes, union, retraits, bornes, six tranches chronologiques et huit sujets importés dominants.

## Méthode

Transaction `REPEATABLE READ READ ONLY` pour la matrice, couverture et empreintes : [requête](audit.sql), [résultat](audit-rpc.json), [état initial](etat-initial.json). Les huit appels `playable_packs` utilisent les fonctions courantes, qui appellent `available_questions`, puis `solo_candidates`. Aucun simple comptage de `events.playable` n’est présenté comme jouabilité.

Débutant = 1 ; Intermédiaire = 1+2 ; Expert = 3 seul ; Tous = 1+2+3. L’Inversé déduplique **dans chaque cohorte**, jamais par soustraction des comptes cumulatifs. L’union récursive `pack_scope_events` respecte descendants actifs et retraits de branche. Sport a 794 associations parent/enfants, mais **397 événements uniques**, sans addition artificielle.

Les RANGE jouables comptent à partir du début de plage. Mois/Jour exigent les champs réellement présents. Les statuts approximatifs, conventionnels ou traditionnels sont conservés : une valeur renseignée ne constitue pas une nouvelle preuve historique.

5/10/20 exigent autant de candidats ; Tout exige un candidat et se plafonne à 100. Mystère applique les mêmes seuils aux packs. Les thèmes sémantiques participent aussi à la roulette réelle mais ne sont pas des packs de cet inventaire. Ce sont des **éligibilités mesurées**, pas des tirages ou parcours navigateur exécutés en production.

Un inventaire courant complet des 2 105 événements a été lu pour les réemplois et doublons. Il reste **hors Git** ; seules les dix lignes réemployées sont conservées individuellement. Il reproduit exactement les 888 agrégats avant projection. Aucun compte, réponse de joueur, résultat ou progression n’est extrait.

Les droits réels confirment absence de SELECT direct sur réponses/alias pour anon/authenticated. Le risque d’inférence par les décomptes à bornes libres décrit dans [l’audit #93](../audit-decompte-93.md) reste préexistant ; il n’est ni corrigé ni nouvellement introduit par cet audit.

## Blocages

1. **Napoléon : quatre questions tous niveaux**, donc cinq impossible. Trois rattachements Débutant porteraient l’ensemble à sept et Débutant à six : premier gain sans création.
2. **Sport : 397 questions, dont 369 Expert exclusif**, cinq Débutant. Tennis = 0/1/85 par niveaux exacts ; Cyclisme = 0/1/90 ; Mécaniques = 0/0/60. La majorité des questions sont des éditions/saisons génériques. Aucun reclassement en bloc.
3. **Fun : Pop culture et Dérape sans Débutant**, Films un seul, Inventions deux, Premières huit. #91 proposait tous ses nouveaux événements Intermédiaire ; le volume ajouté n’a donc pas ouvert ces choix Débutant.
4. Sciences et Espace : cinq Débutant chacun ; Sciences seulement trois au jour, Espace seulement trois années Débutant distinctes.
5. Révolution : 19 questions dont 13 Débutant ; Construction européenne : 19 dont cinq ; Décolonisation : huit Débutant ; Environnement : cinq.
6. Religions : 18 Débutant année mais huit jour ; Antiquité : 21 année mais sept jour. Les limites de sources doivent être respectées.

Une sélection strictement 1914–1918 ne peut fournir que cinq années distinctes ; le pack actuel en a six Débutant car il inclut son contexte, notamment 1919. De même, 1799–1815 ne donne que 17 années possibles : ne pas promettre 20 en Inversé année pour le périmètre napoléonien. Ajouter des dates dans une même année peut débloquer Solo et Jour, sans débloquer Inversé année.

## Couverture et équilibre

Les 37 lignes de couverture rendent l’audit intégral, y compris les packs déjà fournis.

- Sport : 270/397 événements commencent en 1901–2000, 108 après 2000. Tennis signifie actuellement Wimbledon, Cyclisme Tour, Mécaniques F1. B doit apporter championnes, Roland-Garros, autres courses, endurance/rallye/MotoGP, parasport et exploits de régions variées.
- Sciences commence en 1543, sans Antiquité/Moyen Âge dans ce pack ; Espace couvre 1610–2023. C doit diversifier astronomie, médecine, mathématiques et régions, en distinguant découverte/publication/attribution traditionnelle.
- Films couvre 1925–2011, dont 43/50 au XXe siècle. A1 ajoute six sorties françaises, quatre Ghibli, deux films asiatiques en prises de vues réelles et dix animations américaines. Le cinéma indien, africain, latino-américain et européen hors France reste à documenter en A2 : la diversité mondiale n’est pas déclarée résolue.
- Pop culture : 29/35 au XXe et six après 2000, aucun Débutant. A1 apporte BD, manga, jeux, musique, séries et objets. Les sorties de films restent dans leur pack distinct.
- Rois : 14/30 modernes, sept médiévaux, deux antiques, deux au XXe, cinq entre 1789 et 1900. Étendre autres cours et femmes de pouvoir, plutôt que multiplier les morts de souverains.
- Dérape : 1605–2006, sans Antiquité/Moyen Âge. Rechercher canulars et erreurs connus ; ne pas y rattacher Titanic/Tchernobyl uniquement pour gagner du Débutant.

Les sujets importés sont des métadonnées **incomplètes**, pas une certification éditoriale : une grande partie des ajouts #91 n’a pas de tags et certains anciens tags Sport surprennent. Le top huit ne prouve pas l’absence d’autres sujets. L’analyse régionale ci-dessus est qualitative ; aucun faux décompte géographique exhaustif n’est déduit de ces tags.

## Plan par pack

| Packs | Débutant année | Priorité et cible éditoriale |
| --- | ---: | --- |
| 50 / 100 incontournables | 50 / 100 | Contrats conservés, aucun ajout/reclassement de quota. |
| France / Europe | 96 / 161 | Rattachements pertinents et diversité ; volume suffisant. |
| Première Guerre mondiale | 9 | C : viser 20 questions accessibles si pertinentes ; accepter la limite des années. |
| Seconde Guerre mondiale | 20 | C : diversifier les perspectives ; seulement dix années D distinctes. |
| Guerre froide | 24 | C : régions/sujets ; ne pas élargir artificiellement la chronologie. |
| Révolution française | 13 | C : viser 20, jalons et acteurs connus ; éviter les votes voisins répétitifs. |
| Époque napoléonienne | 3 | A0 puis C : cinq d’abord, viser 20 questions, sans exiger 20 années distinctes. |
| Révolutions / Guerres et batailles | 26 / 65 | C : réemplois et diversité, pas de déficit de volume. |
| Espace / Sciences | 5 / 5 | C : viser 20 chacun, missions/périodes/pays variés. |
| Religions | 18 | C : viser au moins 20 à l’année, traditions variées, statuts de date explicites. |
| Droits et libertés | 24 | C : droits des femmes, droits sociaux, régions ; pas de besoin de quota. |
| Construction européenne | 5 | A0 puis C : dix puis vingt repères accessibles ; pas de procédures obscures artificiellement Débutant. |
| Décolonisation | 8 | C : viser 20 ; Afrique/Asie/Caraïbes/Océanie, dates d’indépendance désambiguïsées. |
| Environnement | 5 | C : viser 20, nature/protection/climat ; éviter une série de COP anonymes. |
| Mode expert — 50 dates | 1 | Contrat historique conservé ; ses 18 Expert exclusifs ne désignent pas tout le pack. |
| Antiquité / Moyen Âge / Moderne | 21 / 26 / 35 | C : diversité géographique/thématique ; aucun jour inventé. |
| XIXe / XXe | 35 / 102 | Rattacher les nouveautés dans leurs bornes, sans dupliquer l’événement. |
| Sport parent | 5 | B : viser 20+ via l’union des enfants, sans doubles comptes. |
| Football | 2 | B : viser 20 ; finales mémorables, football féminin, exploits. |
| Tennis | 0 | B : viser 20 ; Roland-Garros, championnes/champions, premières marquantes. |
| Jeux olympiques | 3 | B : viser 20 ; exploits, femmes, parasport, régions variées. |
| Cyclisme / Tour | 0 | B : viser 20 ; champions, femmes, classiques et autres grands tours. |
| Sports mécaniques | 0 | B : viser 20 ; F1 et autres disciplines, dates de courses attestées. |
| Autres sports/exploits | 0 | B : viser 20 ; basket/rugby/athlétisme/natation/parasport. |
| Grandes premières | 8 | A0 puis A2 : viser 20, premières importantes, pas chaque premier opus de franchise. |
| Inventions improbables | 2 | A1 puis A2 : viser 20 ; distinguer prototype, brevet, commercialisation. |
| Films cultes | 1 | A1 : 21 projetés ; A2 : cinémas mondial et européen hors France. |
| Pop culture | 0 | A0+A1 : 21 projetés, vingt années distinctes. |
| Rois, scandales, trahisons | 10 | A2 : viser 20, affaires connues et autres cours, légendes traitées comme telles. |
| Quand l’histoire dérape | 0 | A2 : viser 20 si corpus cohérent, sans changer artificiellement les niveaux. |

## Lots

| Lot | Périmètre | Nouveautés envisagées | État |
| --- | --- | ---: | --- |
| A0 | Dix rattachements, gains Napoléon/Premières notamment | 0 | [Liste sourcée à valider](lot-a0-reemplois.csv) |
| A1 | 22 films et 20 repères Pop culture, 40 D et deux I | 42 | [Liste détaillée à valider](lot-a1.csv) |
| A2 | Autres fun et cinéma mondial | 65–90 | Recherche à poursuivre |
| B | Six disciplines Sport et union parent | 90–130 | Plan seulement |
| C | Histoire/sciences, en lots indépendants | 110–170 | Plan seulement |

**307–432 événements envisagés**, si sources et pertinence le justifient. Les rattachements et révisions de niveaux ne sont jamais comptés comme nouveautés. Les listes de B/C ne sont pas prétendues déjà sourcées. Cibles de 20 conditionnées à la cohérence éditoriale, sans quota aveugle.

## Imports, publication et protection

Les migrations #90 `20261011111510`, #91 `20261015120156` et #120 `20261015201336` sont au registre courant. Certaines mentions « non appliquée » dans les anciennes documentations sont historiques. Fonctions, surcharges Expert, migrations, marqueurs #120 et import v18 ont été inspectés.

Aucun SQL d’insertion livrable en production à cette étape. Les identifiants A1-xxx sont des codes de proposition. EVT-2100…2203 reste réservé à #91, EVT-900000000000 et suivants à l’administration. Après validation : choisir une plage libre, réserver ces identifiants dans le précontrôle d’import, puis tester collisions et réimport.

Les événements nouveaux absents du v18 ne sont pas supprimés. **Les associations nouvelles vers les anciens packs seraient en revanche supprimées par leur synchronisation sans marqueur** : toutes devront figurer dans `admin_pack_additions`, avec provenance éditoriale documentée, sans usurper un auteur humain dans les audits. Les sources des créations seront conservées dans les métadonnées privées et le manifeste. Ne pas réécrire les sources manuelles ni les réservations Sport/fun existantes.

Les futures migrations : transaction, timeouts, préconditions, insertion sans écrasement, registre Histoire et répétition sans effet ; conserver retraits, surcharges, créations #120, événements, réponses et résultats historiques. Aucun ajout aux candidats pédagogiques figés ni aux données joueurs. Schéma `histoire` exclusivement ; aucun db push/apply_migration.

Après validation du contenu : PR par lot indépendant, risque de publication **élevé**, tests lint/types/build, contenu/doublons/sources, SQL idempotence/conservation/import, Solo/Inversé/Mystère/parents/enfants/5/10/20/Tout/confidentialité. **GO explicite du lot avant SQL KFFR**, puis RPC avant/après, CI requise sur le dernier commit, main/Max réinspectés, fusion et déploiement vérifié.

## Collaboration

[#122](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/122), assignée à Antonin et en cours, sert de suivi V1.2. #31/#98 sont closes ; leurs tâches humaines reportées #29/#88 ne sont pas cochées indûment.

Main actualisé, branches et derniers travaux inspectés, aucune PR ouverte au démarrage. Travaux de Max sur les habillages déjà intégrés par #110/#113/#115. Branche isolée `issue-122-audit-catalogue-v12` depuis main, sans toucher ses branches ni les modifications de consignes du checkout d’Antonin.

Voir [le dossier de validation](premier-lot.md), [les projections non publiées](projection.md) et [les vérifications](verification.md). Le tableau APRÈS production reste vide jusqu’à une publication validée.
