# Han — décision et correction versionnée #117

La décision humaine du 15 octobre 2026 est consignée dans [#117](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/117#issuecomment-6180701113) et dans `content/pedagogie/decision-han-117.json`. Elle précède cette correction. Les résultats techniques doivent être rapportés séparément après exécution.

EVT-0040 représente la dynastie Han dans son ensemble : **−206 à 220**, `YEAR_RANGE`, `CONVENTIONAL`. Le texte mentionne l’interruption **entre 9 et 25 apr. J.-C.**, sans assimiler cette plage aux seules années du règne Xin. Les [Han occidentaux et orientaux](https://www.metmuseum.org/essays/han-dynasty-206-b-c-220-a-d) et l’[interrègne de Wang Mang](https://www.metmuseum.org/toah/ht/05/eac.html) sont distingués dans les sources institutionnelles utilisées pour la décision.

Le mode `RANGE` est conservé : le solo peut demander les deux bornes conventionnelles de l’ensemble ; le test pédagogique place les périodes à leur début et utilise −206. Il ne présente pas l’exercice comme la datation d’un règne continu. Aucun mois ni jour n’est ajouté. Wudi reste EVT-0041, avec ses bornes −141/−87 et sa carte historique `CARD-006-han` inchangées.

## Audit des occurrences

| Ensemble | Traitement |
| --- | --- |
| `kiffeurs-events-v18.csv` | Seuls début, fin, statut et texte de date de EVT-0040 changent. |
| `kiffeurs-gameplay-v18.csv` | Seul le statut de EVT-0040 devient CONVENTIONAL. |
| `kiffeurs-curriculum-links-v18.csv` | Mise en cohérence du texte de date candidat ; rattachement et libellé conservés. |
| `kiffeurs-ready-collection-events-v18.csv` | Mise en cohérence des deux textes de date de EVT-0040 ; collections conservées. |
| `kiffeurs-event-tags-v18.csv` | Statut EXACT → CONVENTIONAL ; anciennes bornes du premier siècle remplacées par les siècles des nouvelles bornes : IIIe av. J.-C. et IIIe apr. J.-C. Les autres tags, dont ceux de Wudi, sont conservés. |
| Alias, descriptions, sources, collections, niveaux et couvertures sémantiques | Identités, sources et rattachements conservés. Aucun nouvel événement créé. Les classements sémantiques généraux ne sont pas redéfinis par cette correction de dates. |
| `cartes-sous-chapitres.csv` | Source brute approuvée #92 conservée comme archive. Le chargeur courant applique exclusivement `cartes-han-117.csv` aux cinq lignes de THM-049 et vérifie leur delta exact. |
| `cartes-v1.csv`, complétions, manifeste #111, dossiers d’audit et de phases 2–4 | Archives et contenu approuvé conservés. Leurs descriptions du blocage correspondent à l’état de cette livraison antérieure. |
| Importeurs, catalogues, export des empreintes | Même jeu courant de 188 cartes ; correction explicite des seules dates et positions nécessaires de THM-049. Le chargeur refuse toute autre réécriture, notamment de Wudi. |
| Réponses de parties et instantanés publiés | Aucune mise à jour. Les anciennes parties restent corrigées selon leur instantané, y compris 9/25 si elles avaient posé cette ancienne période. |
| Illustrations | Réutilisation des SVG déjà validés. Les 534 fichiers sont comparés aux octets du SHA humain #92 ; aucun SVG modifié. |

La recherche couvre `content`, `scripts`, `src`, `tests`, `supabase` et `docs` pour EVT-0040 et `han-canon-incoherent`. Le contrôle du delta compare toutes les lignes des cinq CSV canoniques au main publié, et refuse une différence hors des champs et tags autorisés de EVT-0040. Les deux vérificateurs Python conservent leurs empreintes de référence : ils valident exactement les corrections Somme et Han, puis rétablissent leurs anciennes valeurs sur une copie uniquement pour vérifier l’empreinte historique globale.

## Versions et conditions d’activation

Avant #117, THM-047/048/049 disposent de 24 cartes privées (11/8/5), mais d’aucune édition publiée. La migration corrige donc leur brouillon avant leur **première publication** ; elle ne remplace aucune édition existante. Les 83 éditions précédentes restent immuables. Si un brouillon différent ou une édition Han incohérente apparaît entre-temps, la transaction refuse de continuer et exige un nouvel audit.

THM-049 doit contenir exactement les cinq événements réels suivants, dans l’ordre : Qin (−221), ensemble Han (−206), Wudi (−141), mission de Zhang Qian (−138), fin des Han (220). Le test Année pose cinq questions ; Mois/Jour restent indisponibles. Le seuil du moteur reste inchangé.

La correction de données et la première activation des trois enfants passent dans une même transaction de publication. Seul le motif `han-canon-incoherent` est retiré après vérification du canon et des cinq cartes. Tous les autres blocages et les refus des RPC existantes restent opérants. L’activation partielle du groupe est interdite.

## Vérifications requises

Le scénario `test-han-117-local.ts`, appelé uniquement depuis la fixture Docker/PostgREST vérifiée, doit prouver :

- refus atomique d’une approbation de catalogue incorrecte, sans correction partielle ;
- correction du brouillon historique 9/25, permutation des positions et publication des 24 cartes ;
- conservation intégrale des 83 éditions, des anciennes questions/réponses, scores et progressions ;
- idempotence, désactivation et republication conservant les 86 instantanés publiés ;
- cinq vraies questions Année, réponses par les RPC et score de précision à 100 % ;
- vraie question période −206/220 et correction par la RPC ;
- projection anonyme des 24 cartes sans identifiants d’événement ni sources privées ;
- catalogue de 59 routes et 617 empreintes, parcours navigateur aux largeurs 1280 et 375, test Han, bilan et relance dans la même édition ;
- maintien des archives et du test historique du parent, sans transfert artificiel de progression.

Les fixtures peuvent utiliser des joueurs synthétiques uniquement dans leur base locale aléatoire. Leurs attestations portent explicitement la mention « fixture » et ne valent aucune validation humaine ni résultat de production.

Exécution : `npx tsx scripts/test-import-sous-chapitres-http-local.ts --container <conteneur-local-labellisé> --corpus-phase3 --release92 --han117 --build-phase3`. Compléter par lint, typecheck, build, tests unitaires, tests SQL généraux, E2E et `git diff --check`.

## Sauvegarde, publication et repli

1. Vérifier le projet `bskyfdjwcdvzhlugtknb`, main, les PR concurrentes, le canon et les RPC courants. Aucune commande globale `db push` ou `apply_migration`.
2. Exécuter la requête de sauvegarde **en lecture seule** fournie par le dry-run `scripts/release-han-117.ts`. Elle couvre les quinze tables de contenu, éditions et joueurs de #92 ainsi que les seuls enregistrements canon/réponses/tags EVT-0040 et EVT-0041. Conserver le JSON hors Git et hors journaux publics ; vérifier le SHA256 du fichier relu.
3. Le manifeste privé contient `projectId`, `fichier` et `sha256`. Le constructeur exige une sauvegarde complète de moins de quinze minutes, compare intégralement les 325 cartes historiques et refuse une cible voisine ou une phrase d’autorisation d’un autre corpus.
4. Après tous les contrôles verts, émettre le SQL avec `--emettre-publication --sauvegarde <manifeste-privé> --autorisation <phrase-du-corpus-courant> --verification <preuve-technique-réelle>`. Le constructeur ne contacte aucun serveur. Ne jamais utiliser une preuve de fixture comme preuve de production.
5. Exécuter exclusivement cette transaction dans `histoire`. Elle inclut `20261014232713_correction_han_117.sql`, s’inscrit dans `histoire.migrations_appliquees` et invoque l’activation existante. Ne pas rejouer la migration #111. Comparer les états et conserver le résultat privé : 86 éditions, trois enfants actifs, cinq candidats THM-049. Toute erreur annule la transaction entière.
6. Exporter ensuite l’état réellement publié et ses instantanés ; régénérer les seules projections et empreintes publiques, puis tester le build. Ne pas inventer un état publié dans un manifeste avant la réussite de la transaction.
7. Fusionner uniquement après réussite Supabase et CI verte sur le dernier SHA, puis vérifier le déploiement automatique du commit et les 59 routes, 54 archives et 617 illustrations publiques. Conserver la preuve de déploiement et les résultats navigateur.
8. En cas de repli, `--emettre-rollback` exige les mêmes protections de cible et sauvegarde ; la RPC désactive le groupe, réactive le parent et garde les trois enfants historiques avec leurs éditions et résultats. Elle conserve le canon corrigé. Exporter l’état de repli et déployer sa projection ; ne supprimer ni restaurer destructivement les parties, cartes ou éditions. Une republication doit retrouver les mêmes instantanés.

Aucune opération ne doit écrire dans les schémas `public`, `auth` ou de Contrée. Les données des joueurs ne sont jamais exportées dans les preuves publiques.
