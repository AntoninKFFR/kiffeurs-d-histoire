# Vérification Han #117

Arbitrage humain : [commentaire du 15 octobre](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/117#issuecomment-6180701113). Cette décision est distincte des résultats techniques ci-dessous.

Code vérifié : `5f3dfb7ca41218c0e3c7594389d7717309b40ad3`. [CI de préparation](https://github.com/Zazou13015/KIffeur-d-Histoire/actions/runs/38657399016).

| Contrôle exécuté | Résultat observé |
| --- | --- |
| Vitest | 55 fichiers, 683 tests réussis ; une exclusion du scénario navigateur optionnel dans cette commande. |
| Import des descriptions | Six tests réussis. |
| Scénario navigateur des illustrations | Huit tests réussis lors de l’exécution dédiée, dont la vérification des 292 illustrations à deux largeurs. |
| Chapitres, alias et descriptions | Contrôles verts ; 44 cas négatifs refusés ; empreintes historiques conservées avec exceptions exactes Somme/Han. |
| Illustrations | 534 SVG : 331 anciens intacts, 203 nouveaux déjà approuvés, 82 réutilisations dans le corpus #92. Aucun SVG modifié pour #117. |
| Lint, typecheck, builds | Réussis dans le job de vérification et le rehearsal ; catalogues compilés de 56 puis 59 routes. |
| Tests SQL généraux et concurrence | Réussis. |
| Import SDK/PostgREST sur pile Supabase locale | Réussi. |
| Rehearsal #117 sur Postgres/PostgREST | Refus atomiques (canon divergent, catalogue invalide, blocage indépendant), correction du brouillon, publication idempotente des trois enfants, repli et republication réussis. |
| Conservation | 83 éditions antérieures, anciennes questions/réponses, scores et progressions comparés ; les 86 éditions après première publication restent identiques au repli et à la republication. Wudi, les 325 cartes historiques, les 61 filiations et les 722 rattachements sont conservés. |
| Questions réelles | THM-049 : cinq questions Année, bonnes réponses transmises aux RPC avec précision 100 %. Vraie question période Han : −206/220, précision 100 %. Ancien bilan : 9/25 conservé. |
| Navigateur local | 59 routes/projections, 292 SVG d’ajouts publics exacts, 24 images Han décodées à 1280 et 375 px, cinq questions, bilan et relance de la même édition ; archive legacy-v1 à six cartes conservée. |
| E2E général | 168 scénarios réussis ; 72 exclusions existantes de profils. Les cinq jobs de la CI de préparation sont verts. |
| Publication Supabase | Transaction réussie le 15 octobre 2026 : −206/220, CONVENTIONAL, trois enfants actifs, 24 cartes, 86 éditions, 53 unités actives et six historiques. |
| Export réel | 59 unités/routes publiques, 617 empreintes ; aucune projection de publication inventée. |
| Déploiement et parcours production | Références du commit déployé et contrôles après fusion dans le [suivi de la PR #118](https://github.com/Zazou13015/KIffeur-d-Histoire/pull/118). |

Le corpus de publication porte l’empreinte `a7d043416ee5a978db5d31309471d959caa1d2fb79fc59a678eaa3ad0b174630`. Sauvegarde privée capturée à 00:08:59 UTC, fichier relu et SHA256 vérifié : `1c23d63eeae2112ed807e4b3f6f8854cb7e27d422b892a551fb04e8bba9f003e`. SQL exécuté : SHA256 `6253288e0df494aefcafd5fbe7e58bccecfe9007449f48c5f2c29682bbd241dc`.

La comparaison intégrale après publication, capturée à 00:11:42 UTC, confirme l’identité des huit tables joueurs (`games`, `game_questions`, `game_question_editorial_snapshots`, `learning_progress`, `learning_progress_editions`, `players`, `kpi_games`, `solo_anonymous_limits`), des 83 anciennes éditions, des cartes hors THM-049, des données Wudi, des 722 rattachements et des 61 filiations. Les fichiers privés avant/après et l’export restent hors Git ; aucune donnée de joueur n’apparaît dans ce rapport.

La migration #111 n’a pas été rejouée ; aucun `db push`, `apply_migration` ni changement des schémas `public`, `auth` ou de Contrée. La validation des projections réellement exportées figure dans les checks de la PR #118 ; le bilan final de publication y conserve les preuves du déploiement et des parcours publics.
