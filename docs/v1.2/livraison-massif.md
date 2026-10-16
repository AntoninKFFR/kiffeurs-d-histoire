# Livraison V1.2 Massif — proposition pour relais ChatGPT

160 nouveaux événements distincts : **128 Débutant, 30 Intermédiaire, 2 Expert**. Quatre groupes de 40, une seule migration, une seule PR. Identifiants EVT-2500 à EVT-2659. Les 511 associations nouvelles concernent ces événements ; sept liens supplémentaires réutilisent six événements existants sans les modifier.

**État : non publié sur KFFR. Codex ne doit appliquer aucun SQL distant ni fusionner cette PR.** ChatGPT doit auditer le commit de la PR, vérifier KFFR, obtenir le GO d’Antonin et effectuer la publication. La fusion et le contrôle du déploiement restent à reprendre après confirmation explicite de cette publication.

## Fichiers de référence

- [Manifeste complet : descriptions, sources, preuves, niveaux, alias et associations](../../content/enrichissement-v12/massif.json).
- [Liste éditoriale des 160 événements](catalogue-massif.md).
- [SQL unique à auditer](../../supabase/migrations/20261016124921_enrichissement_v12_massif.sql), version de registre **20261016124921**.
- [Générateur déterministe](../../scripts/enrichissement-massif.ts) : reprendre A0/A1, sans connexion à une base.
- [Différentiel des vraies RPC, quatre cohortes et deux sens](differentiel-massif.json).

## Comptes simulés

Base : main 34a6298677be0fd7cd69730417a9f9706cf80666, A0 et A1 déjà inclus. L’inventaire privé vérifié et les rapports de #122 sont réutilisés dans PostgreSQL WASM jetable ; aucune nouvelle lecture/écriture de production. Les anciennes lignes et les champs utiles aux RPC sont reproduits pour le calcul différentiel. Ce résultat reste une **simulation**, à confronter aux données réelles lors du relais.

| Mesure | Avant | Après simulé |
|---|---:|---:|
| Événements globaux | 2 147 | 2 307 |
| Événements classés Débutant | 300 | 428 |
| Débutant jouables | 278 | 406 |

Les rattachements sont comptés directement par pack : un même événement peut figurer dans plusieurs lignes. Sport est l’union dédupliquée de ses sous-packs. « Inversé » ci-dessous signifie **DAY**, seule précision proposée par son interface. Les valeurs Inversé YEAR/MONTH figurant dans le JSON sont des capacités RPC, sans prétendre à une option d’interface.

| Pack | Nouveaux D/I/E | Réemplois | Solo YEAR D avant → après | Inversé DAY D avant → après | Nouvelles longueurs Solo / Inversé |
|---|---:|---:|---:|---:|---|
| France | 43/5/0 | 0 | 103 → 146 | 84 → 121 | — / — |
| Europe | 70/17/1 | 0 | 175 → 245 | 138 → 194 | — / — |
| Époque napoléonienne | 13/3/0 | 0 | 6 → 19 | 6 → 19 | 10 / 10 |
| Guerres et batailles | 5/2/0 | 0 | 65 → 70 | 54 → 57 | — / — |
| Espace | 13/2/0 | 0 | 5 → 18 | 4 → 17 | 10 / 5, 10 |
| Sciences | 9/7/1 | 0 | 5 → 14 | 3 → 8 | 10 / 5 |
| Religions | 3/3/0 | 0 | 18 → 21 | 8 → 9 | 20 / — |
| Droits et libertés | 4/0/0 | 0 | 24 → 28 | 21 → 25 | — / — |
| Construction européenne | 4/0/0 | 2 | 6 → 10 | 6 → 8 | 10 / — |
| Décolonisation | 1/0/0 | 0 | 8 → 9 | 8 → 9 | — / — |
| Environnement | 3/2/0 | 1 | 5 → 9 | 4 → 7 | — / 5 |
| Antiquité | 5/2/0 | 0 | 21 → 26 | 7 → 7 | — / — |
| Moyen Âge | 5/3/0 | 0 | 26 → 31 | 15 → 16 | — / — |
| Époque moderne | 5/2/0 | 0 | 35 → 40 | 24 → 28 | — / — |
| XIXe siècle | 14/3/0 | 0 | 35 → 49 | 31 → 44 | — / — |
| XXe siècle | 73/14/1 | 0 | 123 → 196 | 111 → 171 | — / — |
| Sport | 35/4/1 | 0 | 5 → 40 | 4 → 39 | 10, 20 / 5, 10, 20 |
| Football | 6/0/0 | 0 | 2 → 8 | 2 → 8 | 5 / 5 |
| Tennis | 7/1/0 | 0 | 0 → 7 | 0 → 7 | 5 / 5 |
| Jeux olympiques | 9/0/0 | 0 | 3 → 12 | 2 → 11 | 5, 10 / 5, 10 |
| Cyclisme / Tour de France | 5/1/0 | 0 | 0 → 5 | 0 → 5 | 5 / 5 |
| Sports mécaniques | 3/2/1 | 0 | 0 → 3 | 0 → 3 | — / — |
| Autres sports et exploits | 8/0/0 | 0 | 0 → 8 | 0 → 8 | 5 / 5 |
| Grandes premières | 21/3/1 | 0 | 13 → 34 | 12 → 32 | 20 / 20 |
| Inventions improbables | 12/3/0 | 0 | 3 → 15 | 3 → 10 | 5, 10 / 5, 10 |
| Sorties de films cultes | 13/2/0 | 0 | 21 → 34 | 19 → 32 | — / 20 |
| Pop culture | 13/0/0 | 0 | 21 → 34 | 19 → 24 | — / 20 |
| Rois, scandales et trahisons | 10/2/0 | 0 | 10 → 20 | 10 → 19 | 20 / — |
| Quand l’histoire dérape | 4/6/0 | 4 | 0 → 6 | 0 → 6 | 5 / 5 |

Les longueurs sont 5, 10 et 20. « Tout » est proposé dès un candidat, avec le plafond métier existant de 100 par partie. Les tests jouent ces quatre longueurs et vérifient le refus lorsque le compte est insuffisant.

Le seuil de 20 Débutant YEAR est désormais atteint dans Grandes premières, Films cultes, Pop culture, Rois et Sport. Restent notamment sous 20 : Napoléon 19, Espace 18, Inventions 15, Sciences 14, Construction européenne 10, Décolonisation 9, Environnement 9, Football 8, Tennis 7, Cyclisme 5, Sports mécaniques 3, Autres sports 8 et Dérape 6. Sports mécaniques reçoit aussi deux Intermédiaire et un Expert : son niveau Débutant reste insuffisant pour une partie de cinq. Aucun reclassement des événements existants n’a été effectué pour masquer ces limites.

Les huit packs sans rattachement nouveau conservent leurs comptes. Les contrats 50 dates, 100 dates et Mode expert ne reçoivent aucun ajout. Les deux guerres mondiales et la Révolution française ne sont pas enrichies dans cette livraison centrée sur les manques prioritaires.

## Relecture historique et doublons

- Chaque ligne contient l’URL réellement consultée, sa preuve de datation et une justification individuelle du niveau. Les films indiquent leur territoire de sortie ; Piège de cristal conserve la sortie américaine initiale limitée.
- Les jours divergents pour le drapeau européen et Erasmus restent au mois. Les comics conservent l’année, sans confondre couverture et mise en vente. Akira reste à l’année ; aucune date fine n’est ajoutée au-delà de la source.
- Mont-Saint-Michel : date traditionnelle. Notre-Dame et Louvre : débuts conventionnels. Les dates antiques respectent les années historiques négatives sans année zéro.
- On distingue le sacre de la proclamation de l’Empire, le premier traitement à l’insuline de son amélioration ultérieure, l’atterrissage de Pathfinder du déploiement de Sojourner, le Grand Chelem de Graf de son titre olympique, le passage de Kipchoge sous deux heures d’un record homologué.
- Le contrôle de titres et alias normalisés couvre le v18, ses ajouts d’alias, les packs fun, A1 et les nouvelles lignes entre elles. Le roman La Communauté de l’anneau reçoit un alias qualifié pour le distinguer du film existant.
- La comparaison sémantique au relevé courant a retenu deux proximités explicitement relues : Hubble/James-Webb sont deux missions différentes ; les premiers points de Lombardi au GP d’Espagne sont un exploit distinct de la ligne générique « saison de F1 1975 ». Pompéi a été écarté comme création ; le Conseil de l’Europe est réutilisé au niveau Expert actuel.

## Préservation et vérifications

La migration insère uniquement dans histoire.events, event_answers, event_aliases, pack_events, admin_pack_additions et migrations_appliquees. Aucun DDL, UPDATE, DELETE, GRANT ou changement de mécanisme de jeu. Les réponses et preuves restent dans les tables privées.

Transaction, verrou administratif #120, verrous de contenu, délais bornés, refus des identifiants occupés et des titres proches à date identique. Les six événements réutilisés doivent correspondre au relevé éditorial ; une correction, une date ou un niveau différent entraîne un refus avant tout ajout. Les liens sont ajoutés en fin de pack sans déplacer les anciens. Le marqueur #120 les protège au réimport. Les retraits et audits administratifs restent intacts. Une répétition après publication revient immédiatement sans réécrire les corrections.

Validations locales :

- Tests éditoriaux/déterminisme/réservations A0+A1+Massif et invariants fun : 12 tests verts.
- Migration réelle dans PostgreSQL WASM jetable : refus des collisions/doublons/dérives, répétition, empreintes de toutes les anciennes lignes des 35 tables histoire, ajouts manuels, corrections/retraits, sources privées, RPC et parties Solo/Inversé/Mystère.
- 29 packs concernés × quatre cohortes × deux sens × trois précisions : comptes comparés aux candidats réels ; parties jouées aux quatre longueurs à YEAR en Solo et DAY en Inversé.
- Lint, typecheck et gel pédagogique : verts. Compilation Next : verte via le serveur de fixture publique existant scripts/build-apprendre-local.ts. Le premier build sans serveur local a échoué avec ECONNREFUSED ; aucun problème de compilation du code.
- Docker est arrêté sur ce poste. Les scénarios navigateur et le vrai réimport HTTP sont préparés pour la CI unique du commit final. Le test de réimport existant couvre désormais les 202 créations A1+Massif et les deux plages réservées.

La première CI a validé les quatre jobs hors navigateur et 199 parcours sur 202. Trois anciens tests A0 supposaient encore qu’une partie aléatoire de cinq questions contiendrait forcément A0 ; cette hypothèse cesse d’être vraie avec les 13 nouveaux Débutant Napoléon. Les tests de tirage A0/A1 couvrent désormais l’ensemble des enrichissements, tandis que leurs tests de réimport continuent de vérifier chaque ancien ajout individuellement. Une nouvelle CI est nécessaire après cette correction de tests ; le SQL reste inchangé. L’aperçu Vercel a également échoué : ses logs n’ont pas pu être lus (connecteur 403, scope CLI kffrh inaccessible). Sa cause reste à établir avant toute fusion.

**Risque élevé selon AGENTS.md (données Supabase partagées).** Tous les jobs CI pertinents, dont SQL/sécurité et E2E, doivent réussir sur le commit exact ; aucun contrôle échoué ou requis en attente ne permet une fusion. Consulter les résultats liés à la PR.

## Relais de publication

1. Lire le manifeste et le SQL sur le SHA exact indiqué dans la PR et le message de livraison ; ne pas utiliser un extrait ni une autre branche.
2. Vérifier l’état réel de KFFR, le registre, les packs, l’absence de collision EVT-2500…EVT-2659 et la correspondance des six événements réutilisés. Préserver une preuve des compteurs et empreintes antérieurs selon la procédure de #122. Toute dérive nécessite relecture avant application.
3. Après le GO explicite d’Antonin, ChatGPT applique uniquement supabase/migrations/20261016124921_enrichissement_v12_massif.sql, par le transport SQL autorisé de la conversation principale. Aucun db push ni apply_migration. Les fixtures et scénarios de test ne doivent jamais être appliqués sur KFFR.
4. Contrôler le registre, les 160 nouvelles lignes, les 511 liens plus sept réemplois, les données antérieures et les compteurs réels face à ce différentiel ; signaler les écarts plutôt que remplacer les corrections.
5. Transmettre ici le SHA audité, la confirmation d’application et ses résultats. Codex pourra alors vérifier main/Max/CI puis reprendre la fusion et le contrôle du déploiement.
