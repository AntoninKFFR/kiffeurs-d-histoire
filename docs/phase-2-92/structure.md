# Structure retenue — préparation technique #92

Décisions d’Antonin, suite du SHA d’audit `ed5a682151318c68d006e2bf38662770b11b4f69`. Validation des orientations ; les futures cartes restent à valider par Max. Ce manifeste précède les contrats techniques.

18 nouveaux IDs stables **THM-047 à THM-064**, sans collision dans le canon ; nouveaux slugs figés `thm-xxx-sequence`. Les 41 anciens IDs/slugs/URLs et les 325 cartes sont conservés exactement. Aucun enfant n’a de cartes ou progression copiées ; ils sont tous **inactifs**.

| ID | Parent | Titre | Événements | Version |
| --- | --- | --- | ---: | --- |
| THM-047 | THM-006 | De la République à l’Empire : pouvoir, conquêtes et citoyenneté | 11 | sous-chapitres-v1 |
| THM-048 | THM-006 | Juifs et chrétiens dans l’Empire romain | 8 | sous-chapitres-v1 |
| THM-049 | THM-006 | La Chine des Han et les échanges entre mondes anciens | 5 | sous-chapitres-v1 |
| THM-050 | THM-012 | Voyages, circulations et diffusion des savoirs | 7 | sous-chapitres-v1 |
| THM-051 | THM-012 | Pouvoirs et transformations religieuses | 14 | sous-chapitres-v1 |
| THM-052 | THM-016 | La Première Guerre mondiale et ses conséquences | 17 | sous-chapitres-v1 |
| THM-053 | THM-016 | Crises politiques et sociales de l’entre-deux-guerres | 7 | sous-chapitres-v1 |
| THM-054 | THM-016 | La France défaite et occupée : Vichy, Résistance et Libération | 9 | sous-chapitres-v1 |
| THM-055 | THM-016 | La Seconde Guerre mondiale : extension et retournements militaires | 14 | sous-chapitres-v1 |
| THM-056 | THM-016 | Génocide, fin de guerre et recomposition du monde | 8 | sous-chapitres-v1 |
| THM-057 | THM-017 | Indépendances et affirmation de nouveaux États | 9 | sous-chapitres-v1 |
| THM-058 | THM-017 | La guerre froide : formation des blocs et crises | 15 | sous-chapitres-v1 |
| THM-059 | THM-017 | Construire l’Europe : de Schuman aux communautés | 5 | sous-chapitres-v1 |
| THM-060 | THM-017 | Nouveaux équilibres et fin de la guerre froide | 10 | sous-chapitres-v1 |
| THM-061 | THM-024 | Révolution française et Empire | 17 | sous-chapitres-v1 |
| THM-062 | THM-024 | Restauration, révolutions et nationalités | 9 | sous-chapitres-v1 |
| THM-063 | THM-025 | République, Empire et transformations sociales | 15 | sous-chapitres-v1 |
| THM-064 | THM-025 | Guerres, diplomatie et construction des États nationaux | 8 | sous-chapitres-v1 |

Les listes exactes, rubriques de THM-056, blocage Han et validations nulles sont dans [chapitres-v2.json](../../content/pedagogie/chapitres-v2.json). Ce fichier est interne : ses event_ids et empreintes ne passent pas dans le catalogue public.

Comptes vérifiés : 3+2+5+4+2+2 = **18** ; 41−6+18 = **53 actifs à terme** ; 41+18 = **59 stockés**. Aujourd’hui : **41 actifs et 18 inactifs**, aucun parent historique tant que tous ses remplaçants ne sont pas prêts.

Han reste orienté −206/220 avec interruption 9–25, sans changement canonique et avec blocage d’activation. Fachoda reste inchangé, correctif documentaire séparé. Sargon conserve −2334 CONVENTIONAL, sans fondation exacte. Les deux jalons Becquerel sont conservés dans le corpus ; l’emploi conjoint en test attend validation pédagogique.

Le catalogue et la progression distinguent actif/historique. Après le premier audit, le contrat permet plusieurs éditions internes immuables sous un même ID : les 104 ajouts des 27 chapitres non découpés ne nécessitent aucun nouveau chapitre. La recommandation conserve 59 unités et prévoit jusqu'à 86 éditions, sous réserve du second audit ; ces nombres ne sont pas des volumes définitifs du produit. Les scores restent attachés à leur édition, sans transfert automatique. Voir [second-audit.md](second-audit.md). Aucun SQL distant, activation réelle, merge de PR ni déploiement autorisé.
