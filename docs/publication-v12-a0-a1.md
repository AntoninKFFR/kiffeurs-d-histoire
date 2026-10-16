# Publication KFFR — premiers lots V1.2 A0 et A1

Le 16 octobre 2026, Antonin a répondu **« JE VALIDE »** à la demande de validation des contenus A0/A1 et de GO pour leur publication SQL. [Autorisation consignée dans #122](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/122#issuecomment-6214257559), [compte rendu d’application](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/122#issuecomment-6214295740).

Les fichiers SQL exacts des commits validés `f2b0978` (A0) et `23c33ff` (A1), avec cinq jobs CI verts chacun, ont été appliqués dans l’ordre sur KFFR. Registre histoire : A0 `20261015222704` à 13 h 13 min 11 s Paris ; A1 `20261016095716` à 13 h 13 min 51 s. Aucun db push/apply_migration, aucun DDL ou changement de droits, aucune écriture hors histoire. Les en-têtes de proposition des migrations/manifeste sont des instantanés historiques et ne sont pas réécrits après application.

## Mesures de production à 13 h 14 Paris

| Mesure | Avant | Après A0 + A1 |
| --- | ---: | ---: |
| Événements | 2 105 | 2 147 |
| Débutant stockés / jouables | 260 / 238 | 300 / 278 |
| Packs actifs | 37 | 37 |
| Packs sous 10 Débutant année | 20 | 17 |
| Packs sous 20 Débutant année | 23 | 21 |
| Packs sans Débutant | 6 | 5 |
| Associations ajoutées et protégées | 0 | 96 (A0 10 + A1 86) |

Mode expert, volontairement spécialisé, reste inclus dans les comptes de déficit : les priorités éditoriales sous dix passent donc de 19 à 16.

| Pack Débutant | Solo année avant → après | Inversé année avant → après | Solo mois / jour après |
| --- | --- | --- | --- |
| Napoléon | 3 → 6 | 3 → 5 | 6 / 6 |
| Construction européenne | 5 → 6 | 5 → 6 | 6 / 6 |
| Grandes premières | 8 → 13 | 8 → 12 | 12 / 12 |
| Inventions improbables | 2 → 3 | 2 → 3 | 3 / 3 |
| Films cultes | 1 → 21 | 1 → 16 | 20 / 19 |
| Pop culture | 0 → 21 | 0 → 20 | 19 / 19 |

Les parties Débutant Solo de 5/10/20/Tout sont désormais disponibles à l’année pour Films et Pop. **L’interface Inversé utilise exclusivement DAY (date exacte), sans choix année/mois** : Films et Pop y ont chacun 19 dates distinctes et permettent 5/10/Tout, mais pas 20. Les comptes Inversé année 16 et 20 du tableau sont des capacités RPC, pas des réglages proposés par l’interface. A0 ouvre cinq Napoléon et dix Grandes premières dans les deux sens. Aucun seuil, année ou jour inventé.

Le contrôle du site public confirme Films Solo année 21 avec vingt sélectionnables, puis Pop Inversé date exacte 19 avec vingt désactivé. Le premier compte rendu avait confondu capacité RPC à l’année et option d’interface ; cette interprétation et le test E2E sont corrigés. Le produit continue d’appliquer sa règle existante, sans modification du moteur.

## Intégrité et vérification

Les huit appels à playable_packs (quatre cohortes × deux sens) donnent 888 cellules année/mois/jour, **toutes égales aux projections approuvées**. Les compteurs sont mesurés en production, distincts de la simulation préparatoire.

Des empreintes de toutes les anciennes lignes de 35 tables histoire ont été comparées avant A0, après A0 et après A1. Seuls les nouveaux identifiants, liens/marqueurs des lots et leurs deux inscriptions au registre sont exclus : **aucune autre ligne modifiée**, y compris réponses, alias, positions, corrections/retraits, créations manuelles, audits, cartes pédagogiques et données joueurs. Les relevés complets restent dans l’espace de travail privé. Zéro retrait/création manuel au moment du contrôle ; les scénarios jetables vérifient aussi leur préservation lorsqu’ils existent.

42 nouveaux événements, 86 liens A1 et 96 marqueurs A0+A1 confirmés. SELECT des réponses et alias reste interdit à anon et authenticated. Aucune nouvelle capacité API ou import client du manifeste. Les réimports SDK/PostgREST et refus des identifiants réservés ont été vérifiés dans les CI natives ; aucun réimport global n’est lancé sur KFFR pour ce contrôle.

A0 #125 fusionné dans main au commit `14b68df`. A1 intègre ce main avant sa dernière CI ; les deux suites et leurs parcours sont ainsi vérifiés ensemble. Le test de SQL déterministe neutralise seulement CRLF/LF dans ses lectures locales, sans modifier une migration appliquée. Le contrôle de déploiement et le suivi d’issue sont consignés dans les PR et #122 après fusion.

## Déficits encore ouverts

Seize packs thématiques restent sous dix Débutant année ; vingt sous vingt, en excluant le contrat Mode expert. Sport et ses sous-packs, les autres fun, Sciences/Espace et plusieurs périodes restent à enrichir. Les lots A2/B/C sont encore à sourcer puis à soumettre : ce premier déploiement ne clôt pas la V1.2 ni #122.
