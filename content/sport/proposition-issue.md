Proposition **provisoire, à valider par Max**, publiée avant la migration #90.

Audit en lecture seule de KFFR le 11 octobre 2026 : **397 événements jouables TAG-0145**, 24 packs existants sans enfants. Aucun changement de date, de niveau ou d’événement proposé dans la migration ; aucun SQL de production exécuté.

| Sous-pack | Description | Questions | D / I / E | Année / Mois / Jour |
| --- | --- | ---: | --- | --- |
| Football | Mondiaux, Euros et grandes victoires | 49 | 2 / 11 / 36 | 49 / 11 / 11 |
| Tennis | Débuts du tournoi et éditions de Wimbledon | 86 | 0 / 1 / 85 | 86 / 1 / 1 |
| Jeux olympiques | Jeux antiques, été, hiver, performances et faits marquants | 57 | 3 / 8 / 46 | 57 / 12 / 12 |
| Cyclisme / Tour de France | Premier départ et éditions du Tour | 91 | 0 / 1 / 90 | 91 / 1 / 1 |
| Sports mécaniques | Saison inaugurale et saisons de F1 | 60 | 0 / 0 / 60 | 60 / 0 / 0 |
| Autres sports et exploits | Rugby, Super Bowl, basket, athlétisme, alpinisme, échecs | 54 | 0 / 2 / 52 | 54 / 4 / 4 |

Les niveaux indiqués sont exclusifs ; Intermédiaire tire D + I. Les précisions sont cumulatives. « Tout le pack Sport » garde **397 identifiants uniques**, avec une association directe à chacun afin de garder l’inventaire administratif complet. En inverse les dates distinctes donnent 131 / 28 / 29 questions pour Sport, et non 397 à l’année.

Justification : pas de sous-pack Coupes du monde redondant avec Football ; réunir JO été/hiver ; ne pas isoler quatre Records/exploits. Le groupe Autres reste le point principal à discuter : un Rugby autonome aurait dix éditions, toutes Expert à l’année. Tennis et Cyclisme reflètent le corpus existant, sans prétendre couvrir toutes les compétitions.

Sept propositions Expert → Intermédiaire, **non appliquées** : EVT-0952 Bannister, EVT-0954 premier sacre mondial de Pelé, EVT-0965 Brésil 1970, EVT-0966 Fischer–Spassky, EVT-1303 naissance du championnat F1, EVT-1444 Fosbury, EVT-1768 Sydney 2000. Elles donneraient Sport **5 / 30 / 362**, soit 35 jusqu’à Intermédiaire. Football et JO ont déjà respectivement 13 et 11 événements jusqu’à Intermédiaire ; le reste n’atteint pas dix et les longueurs doivent rester désactivées. Les éditions génériques ne deviennent pas faciles pour remplir un quota.

Audit : aucun doublon exact titre/date ; deux titres identiques de victoires françaises correspondent à 1998 et 2018. Une édition et sa finale restent des événements distincts, avec déduplication des dates en inverse. Les séries ne sont pas toutes exhaustives ; les Mondiaux masculins (22 éditions jusqu’à 2022), JO d’été (30 jusqu’à 2024) et d’hiver (24 jusqu’à 2022) sont couverts avec les premières éditions et ouvertures déjà présentes. Pas de création d’éditions annulées. Tokyo 2020 et Euro 2020 jouent bien en 2021.

À relire : date traditionnelle -776 ; échecs, Everest et tragédie de Munich dans Sport ; tags de statut issus de l’import pouvant différer des corrections globales. Les sources existantes sont conservées dans l’inventaire, souvent secondaires (QA V19 prévue par le dataset). Cet audit de classement n’équivaut pas à une certification primaire individuelle des 397 dates.

Compléments séparés, à valider, sans ajout dans cette migration :

- Victoire de Yannick Noah à Roland-Garros, **5 juin 1983**, Tennis, Intermédiaire : [Roland-Garros officiel](https://www.rolandgarros.com/en-us/article/rg2023-yannick-noahs-1983-victory-match-by-match).
- Record de Bolt sur 100 m en 9,58 s, **16 août 2009**, Autres sports et exploits, Intermédiaire : [World Athletics](https://worldathletics.org/athletes/jamaica/usain-bolt-14201847?__nextLocale=en).
- Premier titre européen de la France, **27 juin 1984**, Football, Intermédiaire : [FFF, fiche du match](https://www.fff.fr/selection/matchs/737-france-espagne.html). Distinguer la finale de l’édition générique EVT-1592.
- Premier Grand Prix du championnat mondial F1 à Silverstone, **13 mai 1950**, Sports mécaniques, Intermédiaire : [résultats F1 officiels](https://www.formula1.com/en/results/1950/races). Distinguer le Grand Prix de la saison EVT-1303.
- Première finale mondiale gagnée par l’Uruguay, **30 juillet 1930**, Football, Intermédiaire : [AUF, fiche officielle](https://www.auf.org.uy/copa-mundial-uruguay-1930uruguay-vs-argentina1930-07-30/). Distinguer la finale de l’ouverture EVT-0806.

Préparation prévue : identifiants COL-0105 à COL-0111 (COL-0083 à COL-0104 déjà réservés aux séries du dataset), manifeste et inventaire CSV exhaustif, migration idempotente exclusivement `histoire`, fixtures locales et tests ciblés. Les associations Sport seront hors des 24 propriétaires synchronisés par l’import v18 ; retraits et corrections persistantes restent intacts.

**À valider par Max : six catégories et leur nom, autonomie éventuelle du Rugby, sept niveaux, périmètre des trois événements discutables et compléments. GO SQL séparé après revue de la PR et tests GitHub. PR en brouillon, migration non appliquée, aucune attente de vocal pour préparer la technique.**
