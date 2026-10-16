## V1.2 — Audit terminé, premier dossier en attente de validation

Audit courant du **16 octobre 2026, 00 h 05 Paris**, via les fonctions métier KFFR. **Aucun contenu publié ni donnée joueur modifiée.**

| Mesure | Avant courant | Après production |
| --- | ---: | --- |
| Événements | 2 105 | Non publié |
| Débutant stockés / jouables | 260 / 238 | Non publié |
| Packs actifs, dont enfants | 37, dont 6 | Non publié |
| Packs sous 10 / sous 20 Débutant année | 20 / 23 | Non publié |
| Packs sans Débutant | 6 | Non publié |
| Retraits administratifs présents | 0 | Non publié |

Les 20 packs sous dix incluent Mode expert, volontairement spécialisé : **19 priorités éditoriales**, sans modifier ce contrat. Les 50/100 incontournables restent préservés.

### Livrables consultables

- [Rapport et plan pour tous les packs](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/issue-122-audit-catalogue-v12/docs/v1.2/rapport.md)
- [Matrice des 37 packs](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/issue-122-audit-catalogue-v12/docs/v1.2/matrice.md)
- [888 combinaisons niveau/sens/précision, longueurs et Mystère](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/issue-122-audit-catalogue-v12/docs/v1.2/disponibilites.csv)
- [Couverture chronologique et sujets, parents/enfants et retraits](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/issue-122-audit-catalogue-v12/docs/v1.2/couverture.csv)
- **[Premier dossier A0/A1 à valider](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/issue-122-audit-catalogue-v12/docs/v1.2/premier-lot.md)** : liste exhaustive avec sources et arbitrages
- [A0 : dix rattachements existants, CSV sourcé](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/issue-122-audit-catalogue-v12/docs/v1.2/lot-a0-reemplois.csv)
- [A1 : 42 nouveaux événements, CSV détaillé](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/issue-122-audit-catalogue-v12/docs/v1.2/lot-a1.csv)
- [Projections, distinctes d’un après publié](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/issue-122-audit-catalogue-v12/docs/v1.2/projection.md)
- [Vérifications et limites](https://github.com/Zazou13015/KIffeur-d-Histoire/blob/issue-122-audit-catalogue-v12/docs/v1.2/verification.md)

### Constats qui guident le plan

Napoléon : quatre questions tous niveaux, donc cinq impossible. Sport : 397 événements dont 369 Expert exclusif, seulement cinq Débutant ; Tennis et Cyclisme en ont zéro, Mécaniques n’a aucune précision mois/jour. Pop culture et Dérape : zéro Débutant ; Films : un ; Inventions : deux. Sciences/Espace : cinq chacun.

Les comptes inversés sont des dates distinctes, calculées dans chaque cohorte. Une période 1914–1918 ne peut donner cinq années supplémentaires ; 1799–1815 ne peut offrir vingt années distinctes. Aucune règle ni seuil modifié pour masquer ces limites.

### Premier dossier proposé — non appliqué

**A0** : dix rattachements, sans nouvel événement ni changement de niveau/date/titre.
**A1** : 42 nouveaux événements sourcés, 22 films et 20 repères Pop culture ; 40 Débutant et deux Intermédiaire.

| Pack Débutant | Solo année avant → projeté | Inversé année avant → projeté |
| --- | --- | --- |
| Films cultes | 1 → 21 | 1 → 16 |
| Pop culture | 0 → 21 | 0 → 20 |
| Grandes premières | 8 → 13 | 8 → 12 |
| Époque napoléonienne | 3 → 6 | 3 → 5 |
| Construction européenne | 5 → 6 | 5 → 6 |

Les deux lots porteraient le corpus à 2 147 événements, dont 300 Débutant, 278 jouables. Ce sont des projections après reproduction exacte des 888 agrégats courants, pas des résultats de publication. Dates non établies laissées à l’année/mois ; pas de reclassement massif. ABBA/Eurovision écarté comme quasi-doublon, remplacé par Dancing Queen.

### Lots suivants envisagés

A2 autres fun/cinéma mondial : 65–90 nouveaux événements ; B Sport : 90–130 ; C histoire/sciences : 110–170. Avec A1 : **307–432 nouveautés envisageables**, conditionnées à la qualité et aux sources. B/C restent un plan, pas des listes déjà vérifiées.

### Suivi

- [x] Lire consignes, PRD, architecture, sous-packs, imports et migrations #90/#91/#120.
- [x] Actualiser main, inspecter PR/issues/branches et travaux récents de Max ; isoler le travail.
- [x] Audit des 37 packs via RPC : niveaux exacts/cumulés, précision, deux sens, dates distinctes, 5/10/20/Tout, Mystère, retraits, couverture.
- [x] Chercher les réemplois, construire le plan par pack.
- [x] Constituer et publier le premier dossier sourcé.
- [ ] **Validation éditoriale d’Antonin sur A0 et A1**, ou corrections par code.
- [ ] Migrations et tests des lots validés ; protection des nouveaux identifiants et associations au réimport.
- [ ] GO explicite du lot avant SQL de production, puis mesures avant/après.
- [ ] CI requise sur le dernier commit, compatibilité main/Max, fusion et déploiement vérifié.
- [ ] Lots A2/B/C et mise à jour des déficits restants.

Garde-fous : histoire exclusivement, aucun db push/apply_migration, préservation des corrections/retraits/créations #120 et des données joueurs. Les rattachements vers les packs du v18 devront être protégés par admin_pack_additions. Aucun identifiant définitif ni migration d’insertion alloué à cette phase.

Contrôles locaux : lint/types/build Next (API de fixtures), 47 tests ciblés, toutes les suites SQL existantes et scénario fun sur PostgreSQL WASM, 888 cellules reproduites, doublons SQL et contrôle final des empreintes KFFR identiques. E2E/import réel des futurs lots à exécuter avant leur publication.

Main de référence 6a9cb8f ; aucune PR ouverte au démarrage ; derniers travaux Max intégrés. Aucune de ses branches modifiée. #31/#98 closes, réserves humaines conservées. **Cette issue principale reste ouverte jusqu’à la livraison des lots validés.**
