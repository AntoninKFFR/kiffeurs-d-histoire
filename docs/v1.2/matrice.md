# Matrice de tous les packs actifs

Relevé SQL : 2026-10-15T22:05:02.639175+00:00. A/M/J = année/mois/jour. I est cumulatif ; E est exclusif. Les 888 cellules sont des capacités RPC ; l’interface Inversé propose uniquement DAY (date exacte), donc 592 cellules correspondent à un réglage proposé. Le [CSV](disponibilites.csv) distingue explicitement seuils RPC et longueurs de l’interface. Tout est plafonné à 100.

| Pack | Union | Jouable | D | I (1+2) | E seul | Tous A/M/J | Inversé D A/M/J | Longueurs D Solo année |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 50 dates incontournables | 50 | 50 | 50 | 50 | 0 | 50/50/50 | 46/50/50 | 5/10/20/Tout(50) |
| 100 dates incontournables | 100 | 100 | 100 | 100 | 0 | 100/99/99 | 82/98/99 | 5/10/20/Tout(100) |
| France | 382 | 382 | 96 | 197 | 185 | 382/189/184 | 66/75/78 | 5/10/20/Tout(96) |
| Europe | 987 | 987 | 161 | 435 | 552 | 987/483/472 | 122/126/127 | 5/10/20/Tout(100) |
| Première Guerre mondiale | 32 | 32 | 9 | 25 | 7 | 32/32/32 | 6/9/9 | 5/Tout(9) |
| Seconde Guerre mondiale | 40 | 40 | 20 | 37 | 3 | 40/39/39 | 10/17/18 | 5/10/20/Tout(20) |
| Guerre froide | 55 | 55 | 24 | 49 | 6 | 55/55/55 | 17/22/23 | 5/10/20/Tout(24) |
| Révolution française | 19 | 19 | 13 | 15 | 4 | 19/19/19 | 5/9/12 | 5/10/Tout(13) |
| Époque napoléonienne | 4 | 4 | 3 | 4 | 0 | 4/4/4 | 3/3/3 | Tout(3) |
| Révolutions et insurrections | 98 | 98 | 26 | 63 | 35 | 98/77/75 | 18/20/21 | 5/10/20/Tout(26) |
| Guerres et batailles | 259 | 259 | 65 | 164 | 95 | 259/201/197 | 49/54/54 | 5/10/20/Tout(65) |
| Espace | 24 | 24 | 5 | 16 | 8 | 24/24/24 | 3/3/4 | 5/Tout(5) |
| Sciences | 71 | 71 | 5 | 42 | 29 | 71/56/52 | 4/5/3 | 5/Tout(5) |
| Religions | 90 | 90 | 18 | 57 | 33 | 90/58/55 | 18/10/8 | 5/10/Tout(18) |
| Droits et libertés | 87 | 87 | 24 | 56 | 31 | 87/74/74 | 19/20/21 | 5/10/20/Tout(24) |
| Construction européenne | 19 | 19 | 5 | 13 | 6 | 19/19/19 | 5/5/5 | 5/Tout(5) |
| Décolonisation | 31 | 31 | 8 | 16 | 15 | 31/31/31 | 5/8/8 | 5/Tout(8) |
| Environnement | 30 | 30 | 5 | 23 | 7 | 30/27/26 | 5/4/4 | 5/Tout(5) |
| Mode expert — 50 dates | 50 | 50 | 1 | 32 | 18 | 50/29/29 | 1/0/0 | Tout(1) |
| Antiquité | 94 | 94 | 21 | 52 | 42 | 94/23/20 | 18/8/7 | 5/10/20/Tout(21) |
| Moyen Âge | 102 | 102 | 26 | 62 | 40 | 102/60/55 | 21/16/15 | 5/10/20/Tout(26) |
| Époque moderne | 151 | 151 | 35 | 93 | 58 | 151/97/92 | 26/24/24 | 5/10/20/Tout(35) |
| XIXe siècle | 265 | 265 | 35 | 128 | 137 | 265/175/172 | 25/32/31 | 5/10/20/Tout(35) |
| XXe siècle | 996 | 996 | 102 | 319 | 677 | 996/441/439 | 53/91/94 | 5/10/20/Tout(100) |
| Sport | 397 | 397 | 5 | 28 | 369 | 397/29/29 | 5/4/4 | 5/Tout(5) |
| Football (enfant) | 49 | 49 | 2 | 13 | 36 | 49/11/11 | 2/2/2 | Tout(2) |
| Tennis (enfant) | 86 | 86 | 0 | 1 | 85 | 86/1/1 | 0/0/0 | aucune |
| Jeux olympiques (enfant) | 57 | 57 | 3 | 11 | 46 | 57/12/12 | 3/2/2 | Tout(3) |
| Cyclisme / Tour de France (enfant) | 91 | 91 | 0 | 1 | 90 | 91/1/1 | 0/0/0 | aucune |
| Sports mécaniques (enfant) | 60 | 60 | 0 | 0 | 60 | 60/0/0 | 0/0/0 | aucune |
| Autres sports et exploits (enfant) | 54 | 54 | 0 | 2 | 52 | 54/4/4 | 0/0/0 | aucune |
| Grandes premières | 35 | 35 | 8 | 27 | 8 | 35/35/35 | 8/8/8 | 5/Tout(8) |
| Inventions improbables | 30 | 30 | 2 | 30 | 0 | 30/12/12 | 2/2/2 | Tout(2) |
| Sorties de films cultes | 50 | 50 | 1 | 50 | 0 | 50/12/12 | 1/1/1 | Tout(1) |
| Pop culture | 35 | 35 | 0 | 31 | 4 | 35/27/27 | 0/0/0 | aucune |
| Rois, scandales et trahisons | 30 | 30 | 10 | 24 | 6 | 30/29/29 | 10/10/10 | 5/10/Tout(10) |
| Quand l’histoire dérape | 30 | 30 | 0 | 26 | 4 | 30/18/18 | 0/0/0 | aucune |
