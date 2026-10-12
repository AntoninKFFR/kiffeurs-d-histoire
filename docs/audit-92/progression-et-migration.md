# Préserver la progression — stratégie proposée, aucune migration exécutée

**PROPOSITION NON VALIDÉE — AUDIT PHASE 1B — V2**

## Ce que les données actuelles signifient

`learning_progress` contient une ligne `(user_id, chapter_id)` avec `discovered_at`, `best_accuracy`, `best_difficulty`, `best_tested_at`, `tests_count`, `last_game_id`. Découvert signifie que le chapitre a été ouvert : aucun journal par carte ni preuve de maîtrise de toutes ses cartes. Le meilleur score porte sur un test de 5 à 10 événements appris, à une précision donnée ; il ne certifie pas l’ensemble d’un grand corpus et ne peut être projeté sur chaque fragment.

La FK vers `chapters` est ON DELETE CASCADE. `chapter_cards` référence aussi un chapitre et une paire event_chapters ; supprimer un lien supportant une carte échoue tant que celle-ci existe. Les jeux gardent la clé, le libellé et le niveau du chapitre dans `context.chapters`, sans FK sur ce JSON. Les questions gardent leurs réponses et titres figés ; aucune reconstruction depuis le canon courant ne doit modifier un ancien bilan. `last_game_id` n’a pas de FK vers une partie.

`record_chapter_test` exige encore l’existence de l’ancien chapitre ; `progressionDepuisLignes` ignore un ID hors catalogue. Le profil utilise CHAPITRES pour résoudre les liens, grouper par niveau et annoncer les volumes. Une suppression SQL peut perdre les données ; un simple retrait du JSON peut les rendre invisibles. La session anonyme utilise la même clé de chapitre dans `histoire-progression-session` et n’est pas transférée au compte à la connexion.

## Comparaison des options

| Option | Avantage | Risque | Conclusion |
| --- | --- | --- | --- |
| Remplacer les parents par les enfants et supprimer les anciens IDs | Schéma/listes simples | Cascade de progression ; rupture du contexte et des URLs ; impossibilité de comparer le score | À exclure |
| Réutiliser l’ID du parent pour le premier enfant | Préserve une ligne et une URL | Attribue un ancien score à un périmètre différent ; les autres enfants restent arbitrairement traités | À exclure sans conservation/version du périmètre, qui annule sa simplicité |
| Répartir les scores anciens d’après les questions historiques | Exploite certains résultats existants | Tests incomplets par section, échantillons trop petits, découverte non suivie par carte ; déduction fragile | Pas de certification d’enfant ; éventuellement analyse informative séparée, jamais transfert automatique |
| Ajouter enfants et relation de filiation, conserver les parents/cartes historiques | Anciennes données inchangées, nouveaux résultats honnêtes, anciens liens résolus | Nécessite registre historique, navigation adaptée, protection d’import et gestion de copies de cartes | **Option recommandée** |
| Créer des unités virtuelles avec table d’association aux cartes | Mutualise une même carte sans copie | Plus de changements de contrats get_chapter_cards/start_chapter_test et de relations de progression | Alternative ultérieure si la mutualisation est prioritaire |

## Option recommandée : conservation additive

1. **Conserver les six parents** et leurs slugs, cartes existantes, event_chapters et progrès. Les 35 autres chapitres gardent leurs identifiants. Ne supprimer aucune ligne historique, ne renommer aucune clé de contexte. Sauvegarder les associations versionnées afin qu’un import ne les retire pas.
2. **Créer les unités validées avec des IDs stables nouveaux (21 dans le scénario de référence)**, après approbation des partitions ; leur filiation n’a qu’un rôle éditorial/navigation. Les suffixes S1… de l’audit ne sont pas des IDs approuvés. Stocker leur millésime/périmètre et leur statut actif/historique.
3. **Démarrer les enfants sans progression** : aucun discovered_at, score, best_tested_at ou tests_count copié. L’interface peut annoncer qu’un ancien thème avait été découvert/testé, sans afficher ces acquis comme ceux des enfants.
4. **Maintenir deux ensembles** : registre de tous les IDs résolubles et liste des unités actives du parcours. Les RPC/actions/bilans acceptent le registre complet ; le sélecteur pédagogique courant montre les unités actives. Les URLs anciennes restent des pages historiques avec lien vers leurs enfants, sans redirection aveugle vers un fragment. Leurs cartes et leurs tests conservent le périmètre initial.
5. **Préserver les cartes historiques** : card_id est une clé globale, donc la même ligne ne peut appartenir à deux chapter_id. Pour conserver une page parent et une page enfant avec les contrats actuels, matérialiser les copies nécessaires sous de nouveaux card_id stables tout en conservant les anciens. Copie du contenu relu, sans nouvelle date et sans nouveaux SVG ; un manifeste de filiation garde la correspondance. L’autre option est une association de cartes mutualisées, qui demande plus de changement technique. Ne pas simplement déplacer les lignes puis promettre que les liens API anciens fonctionneront.
6. **Séparer l’affichage des statistiques** : les acquis historiques restent visibles avec leur périmètre et leur difficulté ; le parcours actif a son propre dénominateur et compte seulement des unités actives réellement découvertes/testées. Ne pas faire disparaître un ancien acquis en remplaçant le catalogue et ne pas compter un parent + tous ses enfants comme des acquisitions transférées.
7. **Traiter aussi les enrichissements sans découpage** : pour les 35 IDs conservés, un score obtenu avant complétion reste historique. Il ne signifie pas maîtrise des nouveaux événements. Au minimum, afficher le millésime de contenu ; si un meilleur score par version est souhaité, introduire un stockage additif dédié et préserver la ligne legacy, sans écrasement ni réinitialisation arbitraire. C’est une décision produit à prendre avant la PR technique.

Avec cette option et les 21 séquences de référence, 56 unités actives sont envisagées et les six parents restent résolubles, soit 62 chapitres stockés si les enfants sont matérialisés dans chapters. Ce volume ne vaut pas approbation des IDs ou des contraintes d’import. Les copies historiques entraînent un stock supérieur au minimum de 231 nouvelles explications ; elles ne sont pas de nouvelles recherches événementielles.

## Ordre d’une future migration et garde-fous

Avant tout SQL : geler le manifeste approuvé, vérifier le SHA de main, tester sur des fixtures locales entièrement dédiées à Histoire. Préparer un export de sauvegarde limité à histoire selon l’autorisation de cette future mission ; aucun export de joueurs n’est réalisé ici.

Dans une transaction additive : créer métadonnées de filiation/statuts et enfants, ajouter les nouveaux liens, puis les cartes complètes. Les anciens lots de chapter_cards sont exclus de `replace_chapter_cards`. Ne pas rendre actifs des enfants avec moins de cinq cartes événementielles jouables. Le corpus Han est un blocage explicite, pas une date à corriger silencieusement dans un lot de cartes.

Publier catalogue complet/actif, pages, aliases de compatibilité et cache de manière coordonnée, après préparation de la base conformément aux règles du dépôt applicables à la future mission. Éviter un mélange ISR d’ancien catalogue et nouvelles données ; invalider les tags nécessaires ou déployer avec versions cohérentes. Ne changer ni les réponses, ni les règles de score, ni les modes Solo libre et Inversé.

Le rollback commence par la désactivation des enfants et le retour au parcours précédent ; les parents sont toujours présents. Ne pas supprimer un enfant ayant reçu des résultats. Conserver les nouvelles données comme historiques et résoudre ses URL. Un rollback de catalogue qui rend de nouveaux IDs inconnus perdrait seulement l’affichage, mais resterait un défaut de préservation à tester.

`import-dataset` et la source versionnée de structure doivent être adaptés ensemble : une réimportation ne doit ni retirer les liens protégés des parents ni effacer ceux des enfants. L’upsert des chapitres seul n’est pas une protection contre la synchronisation des associations. Prévoir la permutation de sort_order, les lots concurrents et le rejet d’un manifeste incomplet.

## Invariants à démontrer avant activation

- À contenu historique constant, toutes les anciennes lignes learning_progress et tous leurs champs sont inchangés ; toutes les parties/questions et leurs contextes sont inchangés.
- Aucun enfant ne possède de résultat artificiellement attribué. Un test d’enfant ajoute uniquement la progression de cet enfant et ne modifie pas celle du parent.
- Ancienne URL de chapitre, ancienne URL de partie, API d’illustration par ancien card_id, Revoir le chapitre et Rejouer résolvent encore le périmètre historique.
- Connexion/progression RLS : un joueur ne lit jamais celle d’un autre ; un visiteur ne reçoit aucune donnée privée ; aucun nouveau accès aux réponses, sources ou event_id dans la projection publique.
- Découverte reste idempotente ; un bilan ne produit pas de double comptage selon le contrat retenu. Vérifier aussi A → B → A et appels concurrents, actuellement non garantis par le seul last_game_id.
- Le dénominateur de parcours et les groupes par classe distinguent historique/actif. Les clés de session anciennes continuent de s’afficher sans transfert automatique vers le compte ou les enfants.
- Réimport, échec transactionnel et rollback ne suppriment ni lien historique ni donnée utilisateur. Aucun test ne touche public, auth ou private en production ; les fixtures locales actuelles simulant auth.users ne sont pas exécutées ici.

Cette stratégie expose des conditions vérifiables de conservation ; elle ne prétend pas qu’une migration a été testée ou exécutée pendant l’audit. La volumétrie et le nombre réel de joueurs concernés n’ont pas été consultés, conformément à la contrainte de cette phase.

## Confirmation PHASE 1B

Le déplacement de EVT-0115 ne concerne que les documents : CARD-017-fin-urss reste attachée à THM-017 dans les sources et dans le périmètre historique. Les anciens chapitres, IDs, slugs, URLs, cartes, liens événementiels, scores et parties restent conservés. Les nouvelles unités, y compris un éventuel regroupement des alternatives V2, commencent avec une progression indépendante. Aucun score ni découverte n’est partagé par héritage de filiation.

Les nombres 56 actifs/62 stockés sont conditionnels au scénario de 21 nouvelles unités ; les alternatives THM-012 ou les regroupements exigent un nouveau manifeste et un nouveau total. Un test regroupé doit porter sur tous les événements effectivement accessibles et appris dans cette unité, jamais sur des événements supplémentaires cachés dans un parent. Les futurs arbitrages de dates Han/Fachoda/Becquerel doivent être versionnés : ne pas réinterpréter les réponses figées des anciennes parties ni certifier la nouvelle version par un ancien score. Aucun contrat futur de conservation n’est annoncé comme implémenté.
