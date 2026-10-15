# Ajouter et créer des questions — #120

Depuis **Profil → Mon espace administrateur → Gestion des packs et questions**,
ouvrir le pack concerné puis **Ajouter des questions**. Les comptes sont autorisés
par `histoire.admins`, vérifié en SQL à chaque lecture et écriture. Aucun email,
pseudo ou droit stocké dans le navigateur ne sert d’autorisation. Le profil lit
seulement un booléen, sans charger dates, indicateurs ou liste des administrateurs.
En cas d’indisponibilité de ce contrôle, la section reste masquée et le profil reste utilisable.

## Questions existantes

La recherche serveur combine titre (sans accents ni articles initiaux), niveau
exact et bornes d’années inclusives ; un intervalle qui croise la période est inclus.
Les années avant J.-C. sont négatives, sans année zéro. **Rechercher** renvoie
20 résultats et une indication de page suivante, jamais toute la base au navigateur.
Chaque résultat donne titre, date, niveau et packs associés, y compris les retraits.
La sélection est conservée entre pages, jusqu’à 100 questions par opération.

Une question déjà active dans le pack est désactivée dans la sélection. Une
question retirée propose une réintégration conservant le journal #87. L’ajout
ne crée aucun événement et ne supprime aucune autre association. Un rattachement
direct au parent rejoint son union ; un rattachement à l’enfant reste soumis aux
retraits et aux règles de parenté existants. Un retrait explicite du parent
continue de masquer sa question, y compris si elle est active dans un enfant.

La confirmation met à jour questions, compteurs directs et union parent dans le
même résultat SQL. Les autres onglets relisent l’état à leur prochaine navigation.
Les disponibilités Solo, Inversé et Mystère lisent déjà la base : aucun catalogue
à régénérer. Le scolaire et la progression pédagogique ne reçoivent aucun lien
automatique vers ces nouvelles questions.

## Créer une question

Renseigner titre, description pédagogique, niveau, pack et au moins une source.
Les sources peuvent être des URL ou des références documentaires (auteur, ouvrage,
édition, page), jusqu’à dix. Le statut accepte Exact, Conventionnel, Traditionnel,
Approximatif et Discuté. Une sortie de film exige un territoire et une année ;
la source doit justifier cette date dans ce territoire, ajouté au titre joué pour
éviter l’ambiguïté. L’administrateur reste
responsable de la vérification historique : le formulaire ne certifie pas le contenu des sources.

L’année est obligatoire pour une date connue. Mois et jour restent facultatifs.
Une fin permet les périodes : `YEAR_RANGE`, `DAY_RANGE` ou `MIXED_RANGE` sont
déduits des seules valeurs renseignées. Une date ponctuelle donne `YEAR`, `MONTH`
ou `DAY`. Une période uniquement textuelle est enregistrée en `PERIOD_TEXT` /
`NOT_AUTOMATIC` et reste non jouable. La précision n’est jamais complétée au hasard.
Les validations partagent les règles de calendrier existantes : années signées,
aucune année zéro, jours réels et fin postérieure ou égale au début.

**Vérifier les doublons** consulte les titres correspondants. À l’enregistrement,
un titre normalisé identique (accents, articles, ponctuation et casse neutralisés)
est refusé dans toute la base, même si les dates diffèrent. Un titre très proche (similarité trigramme
≥ 0,8) portant exactement les mêmes dates est également refusé. Préciser le titre pour
deux événements distincts homonymes ; préférer rattacher la question existante.
Ce contrôle est sérialisé entre administrateurs pour empêcher deux créations simultanées.

La création SQL englobe événement, réponse privée, sources, association et audit
dans une seule transaction. Une erreur annule tout. Le client conserve le même
UUID de demande pour réessayer une saisie identique après coupure : le serveur
confirme la création existante sans dupliquer événement ni audit. Le même UUID
avec une autre saisie ou un autre administrateur est refusé. Fermer puis rouvrir
le formulaire crée une nouvelle demande, mais le contrôle de titre reste actif.

## Historique, sécurité et imports

**Historique → Création, sources et rattachements** donne l’auteur, l’heure serveur,
le pack, les sources et le territoire éventuel. Les corrections titre/niveau
conservent leur propre historique #104. La création et chaque nouveau rattachement
ont une trace dans `admin_content_audit` ; les réintégrations depuis l’ajout sont
inscrites dans les deux journaux appropriés. Aucun audit en cas de no-op.

Trois nouvelles tables privées, RLS activée, aucun droit API direct :
`admin_event_creations`, `admin_pack_additions`, `admin_content_audit`.
Les RPC sont exclusivement accordées à `authenticated` et vérifient réellement
`auth.uid()` dans `admins`. `search_path` vide ; aucun secret privilégié dans
l’application. `service_role` reçoit seulement la lecture des marqueurs de
rattachement nécessaires à l’import. Les réponses de jeu et leurs instantanés
restent ceux des moteurs existants, sans changement de règles ni recalcul historique.

Les identifiants manuels sont alloués par une séquence à partir de
`EVT-900000000000`, compatibles avec la contrainte numérique historique. Cet espace
est réservé : l’import v18 rejette un CSV qui l’utilise avant tout upsert de contenu.
Il conserve les événements absents du CSV, leurs réponses et leurs sources.
Les rattachements ajoutés ou réintégrés ici sont marqués dans
`admin_pack_additions` ; la synchronisation des packs ne les retire plus lorsque
le CSV les ignore. Les retraits #87 et surcharges #104 continuent de s’appliquer.
Un futur importeur doit respecter cet espace réservé et ces marqueurs. Pour
reprendre une création manuelle dans un dataset, conserver son identifiant via
une procédure dédiée relue ; ne pas créer une seconde version sous un autre id.
Les sauvegardes doivent inclure ces tables privées et la séquence.

## Mise en service et validation

Migration versionnée : `20261015201336_administration_questions.sql`, créée avec
`npm run db:new administration_questions`, transaction, timeouts et registre
`histoire.migrations_appliquees`. Elle ne modifie aucun ancien événement, partie,
compte, réponse ou permission existante. Elle ajoute des RPC d’écriture privilégiées :
GO explicite d’Antonin avant application sur KFFR, puis fusion seulement après les
contrôles requis. Aucun `db push` ni `apply_migration`.

Avant application : vérifier que toutes les migrations antérieures sont inscrites,
que `admin_*` #87/#104 et `verifier_date_reponse` existent, que l’espace numérique
réservé est vide, et relever comptes de lignes/empreintes du contenu et des parties.
Après : vérifier registre, RLS, ACL des cinq RPC et tables, invariance des anciennes
données, refus anonyme/joueur et booléen administrateur. Faire le parcours réel
avec une session administrateur sur l’aperçu puis sur la production ; ne pas
insérer de questions de test dans la base partagée. KFFR Contrée reste à vérifier.

Tests : `tests/admin-creation.test.ts`, `tests/admin-ajout-composant.test.tsx`, profil
et administration existants ; `supabase/tests/administration_questions.sql` ;
`scripts/tests-creation-admin-concurrence.sh` (deux transactions PostgreSQL réelles) ;
`e2e/admin-creation.spec.ts` en PC/mobile, clavier/focus et historique.
Le test HTTP d’import existant vérifie aussi création, sources, association et
retrait après réimport du vrai v18, puis nettoie sa fixture.
Le gel pédagogique #92 conserve son contrôle exhaustif ; seuls les douze fichiers
SQL/UI d’administration sont admis explicitement en plus des exceptions existantes.

Sur cette machine sans Docker, `node scripts/verifier-admin-sql-local.mjs` exécute
les migrations, leurs fixtures et les tests SQL sur PostgreSQL WASM jetable.
Il réutilise le runtime optionnel décrit dans `docs/niveaux-expert.md` ; il ne
prouve pas la concurrence multiprocessus ni le transport Supabase. Ces contrôles
restent obligatoires dans les jobs CI PostgreSQL, HTTP et E2E.

La migration a été appliquée sur KFFR le **15 octobre 2026 à 22 h 48 (Paris)**,
après le GO explicite d’Antonin dans le chat, via le fichier SQL transactionnel
exact du commit de code validé `ac42dcc`. Le registre confirme
`2026-10-15T20:48:44.107421Z`. Aucun `db push` ni `apply_migration`.
Les empreintes des 2 105 événements/réponses, 37 packs et 5 040 associations sont
strictement identiques avant/après. RLS et ACL réelles contrôlées ; rôle sans
entrée dans `admins` refusé sur recherche, ajout, création et historique.

Sur l’aperçu avec le vrai compte Antonin : connexion Google normale, profil et
ses deux accès, inventaire des packs, recherche serveur paginée et filtres antiques,
question déjà rattachée désactivée. Une soumission de création reprenant un titre
existant est refusée comme doublon : aucune création, association ni entrée d’audit
et séquence toujours inutilisée. Aucun contenu de test n’a été ajouté à KFFR.
Preuves : [relevé SQL](captures/issue-120/migration-kffr.json) et
[refus réel du doublon](captures/issue-120/apercu-refus-doublon.jpg).

Les avis Supabase attendus sont documentés : tables privées avec RLS sans policy
API ([avis 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy))
et RPC `SECURITY DEFINER` accordées à `authenticated`, avec autorisation interne
dans `admins` ([avis 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)).
Les fonctions nouvelles restent interdites à `anon` et `service_role` ; aucune
permission sensible n’est élargie hors de `histoire`.

La compilation de l’aperçu est confirmée par GitHub/Vercel. Le connecteur Vercel
renvoie 403 sur l’équipe `kffrh` et les CLI en cache n’ont pas de session ; aucun
accès aux journaux Vercel n’est revendiqué. L’état courant de publication et les
vérifications après fusion sont consignés dans la
[PR unique #121](https://github.com/Zazou13015/KIffeur-d-Histoire/pull/121).

Vérifications locales du 15 octobre 2026 : lint et types réussis ; 699 tests Vitest
et six tests d’import des descriptions réussis (deux workers, après dépassement
du délai de trois tests lourds au premier lancement parallèle) ; toutes les
suites SQL du simulateur et le scénario fun réussis sur PostgreSQL WASM.
La commande `npm run build` sans configuration locale échoue faute de variables
Supabase ; le même build Next réussit avec l’API de fixture du script de relecture.
Ce script vérifie les vraies routes compilées, actions serveur et rendu à
1280, 375 et 320 px, sans erreur JavaScript ni débordement, avec captures dans
`docs/captures/issue-120/`. Il simule le transport SQL et complète les tests SQL ;
il ne remplace pas les tests Supabase/PostgreSQL et E2E de la CI.
