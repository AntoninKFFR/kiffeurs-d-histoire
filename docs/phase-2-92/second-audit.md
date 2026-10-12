# Second audit — contrats retenus avant GO SQL

## Complétion des chapitres non découpés

L'audit compte 35 chapitres non découpés, dont 27 ont 104 cartes manquantes par rattachement. Le gel de leurs cartes dans la première préparation exigeait de nouveaux IDs pour les compléter : cette limite est corrigée par des éditions internes sous le même `chapter_id`.

| Solution | Effets | Décision |
| --- | --- | --- |
| Ajouter directement aux 41 corpus et garder le même score | Peu de code, mais le score ancien devient implicitement celui d'un test plus large et Rejouer change de périmètre. | Rejetée. |
| Créer un chapitre de remplacement pour chacun des 27 | Progression indépendante facile, mais jusqu'à 86 unités stockées, nouveaux slugs et doublons de parcours. | Rejetée : multiplication inutile pour une simple complétion. |
| Éditions internes, mêmes IDs/URLs, instantanés privés | 59 unités dans la conception actuelle ; corpus et scores distingués par version. Les nouvelles cartes peuvent être importées en brouillon, puis publiées après validation. | Recommandée et implémentée dans la migration préparée. |

Les anciennes cartes restent dans `chapter_cards`, avec leurs IDs et tous leurs champs inchangés. Les éditions conservent un instantané privé des cartes et de leur admissibilité au test. Le lot de complétion contient uniquement les cartes supplémentaires ; il ne peut ni retirer ni réécrire les anciennes. Une édition incomplète n'est pas publique. Sa publication exige la couverture complète du corpus déjà enregistré, 5 questions jouables minimum et les preuves de contenu, illustrations et catalogue. Les réponses et l'admissibilité sont ensuite figées.

Les 104 cartes seront rédigées et validées dans des lots ultérieurs. Le plan exact est dérivé automatiquement des rattachements et des cartes existants, en excluant les six parents découpés. Aucun contenu nouveau n'est produit par cette préparation. Les fixtures de test reprennent des textes existants en mémoire, dans des transactions annulées.

Les nouveaux textes sont stockés dans l'édition privée, avec les cartes initiales reprises à l'identique. `chapter_cards` reste la référence des 325 cartes initiales et des futures cartes enfants ; les consommateurs publics utilisent les RPC, jamais un accès direct à ces tables. La complétion calcule son ordre d'affichage chronologique à partir de son tableau figé, sans modifier le `sort_order` original. Les SVG se résolvent par event_id côté serveur ; les cartes supplémentaires ne sont admises dans cette correspondance qu'après publication de l'édition.

L'import local retourne les empreintes à revoir. Le même fichier supplémentaire remplace seulement le brouillon privé de son chapitre ; il est donc repris dans son intégralité à chaque staging. Une erreur de lot est atomique pour ce chapitre ; l'import de plusieurs chapitres peut laisser des brouillons précédents, qui restent invisibles. Après publication, le même lot est un no-op, y compris si le canon a changé ; toute différence est refusée. L'export local vérifie les lignes CSV contre l'instantané publié avant de produire `cartes-publiees.json`. Ces empreintes privées autorisent les seuls octets déjà publiés à survivre aux futures corrections canoniques lors d'un build/réimport. Les décomptes de questions exportés viennent aussi de l'instantané, sans réponses ni dates individuelles.

Les pages et leurs formulaires sont liés à une version explicite. Le cache distingue les URLs RPC de chaque édition. Une page encore en cache ne lancera donc pas un test sur un périmètre plus récent. Les anciennes URLs principales restent disponibles, et les bilans des éditions antérieures renvoient vers `/edition/[version]`. Les résultats anciens sont rendus séparément, avec la difficulté et le meilleur score d'origine ; la complétion commence sans résultat. Les parties anonymes gardent leurs valeurs initiales dans la session, sous une clé distincte de celle de la complétion.

`legacy-v1` et `sous-chapitres-v1` restent les éditions initiales. `completion-v1` est réservée à la complétion des chapitres non découpés. Les 35 IDs/slugs restent stables. Les scores antérieurs restent dans `learning_progress` ; les nouveaux résultats sont stockés séparément, avec leur version, sans héritage automatique. Bilan et Rejouer relisent la version de la partie. Un rollback de publication remet l'édition initiale en service sans supprimer l'édition publiée ni ses résultats.

**Volumes conditionnels à valider lors du second audit :** 59 unités pédagogiques et, après toutes les publications envisagées, jusqu'à 86 éditions internes (59 initiales + 27 complétions). Il ne s'agit pas d'une cible définitive du produit : une décision éditoriale modifiant le découpage ou exigeant d'autres éditions changera ce second nombre. Aujourd'hui, les 18 enfants restent inactifs et aucune complétion éditoriale n'est importée ou publiée.

## Disponibilité et initialisation

Un marqueur privé est initialisé dans la même transaction que l'enregistrement complet du manifeste. Avant cet enregistrement, les anciens contrats restent utilisables pendant la séquence migration → manifeste. Après initialisation, seul un chapitre enregistré et non inactif est disponible. Un chapitre ajouté hors manifeste reste fermé, même avec des cartes ; une table de registre vide ne réouvre pas l'accès. Les tables et marqueurs privés sont inaccessibles à anon/authenticated.

## Tests historiques

Le test publié consulte son instantané privé : cartes, dates, titres, explications et admissibilité capturée lors de sa publication. Il ne consulte plus `events.playable`, `events.playable_mode` ou `event_answers` pour filtrer une édition publiée. Les futures corrections canoniques affectent les nouveaux contenus à valider, jamais les anciens tests, leurs bilans ou leurs scores.

La contrainte existante `playable = (playable_mode <> 'NOT_AUTOMATIC')` interdit de retirer la jouabilité sans modifier également le mode. Les régressions exercent une correction de date, un changement de mode automatique valide, puis le retrait complet (`false`/`NOT_AUTOMATIC`). Elles relisent le bilan initial, relancent son édition et comparent les réponses et la progression enregistrées avant les modifications. Le même contrôle couvre une complétion publiée, son réimport identique et son rollback. Les RPC de lancement ne retournent aucun candidat ni réponse ; les instantanés restent privés.

Le mécanisme de complétion proposé ne corrige pas les anciennes cartes : une révision éditoriale de leurs dates/textes demanderait une nouvelle édition et une extension explicite des contrats. Ce point reste à auditer avant un futur lot de correction. Les corrections canoniques seules n'altèrent pas les cartes et tests déjà publiés. Aucun backfill des anciennes parties ni changement arbitraire des anciens scores n'est prévu.

## Intégration

La branche a été rebasée sur `main` `2e09a4c257eb83ff4e401c65411dcc1229cc5a55`, qui inclut #110 et #113. Les trois commits d'audit/préparation ont été repris, sans modifier la branche d'audit `ed5a682`. La PR #111 sera reciblée vers `main`, en conservant les documents d'audit dans son diff et dans leur branche originale. Aucun merge de PR n'est effectué. Les fichiers d'habillage restent ceux de ce `main` ; lint, types, build et tests sont relancés sur l'intégration effective.

La migration n'a jamais été appliquée à distance : elle peut encore être corrigée en place. Avant GO SQL : audit de l'ensemble corrigé, sauvegardes et contrôle des données réelles, migration puis enregistrement immédiat du manifeste, contrôle restrictif et comparaison de l'historique. Les futures publications d'enfants et de complétions nécessitent les validations éditoriales et un lot d'activation/export/catalogue coordonné. La branche reste sans déploiement automatique et la PR reste DRAFT.
