@AGENTS.md

# Kiffeurs d'Histoire

- Langue du projet : français (interface, commentaires, commits).
- Le projet Supabase de production est **partagé avec KFFR contrée** (mêmes comptes joueurs).
  Toutes les tables de ce jeu vivent dans le schéma `histoire` ; ne jamais créer ni modifier quoi que ce soit dans `public` ou `auth`.
- Toute modification de base passe par un fichier dans `supabase/migrations/` (`npm run db:new <nom>`), jamais par le tableau de bord.
- Une seule base : le projet Supabase KFFR (`bskyfdjwcdvzhlugtknb`), pour la production, les aperçus Vercel et le développement (décision de Maxou et Antonin, 7 oct. 2026). Plus de base de test.
- L'agent applique lui-même les migrations sur KFFR, sans demander de confirmation, tant qu'elles ne touchent qu'au schéma `histoire` (et aux extensions `unaccent`/`pg_trgm` du schéma `extensions`). Tout ce qui sort de ce périmètre est interdit.
- Jamais de `supabase db push` ni d'`apply_migration` sur KFFR (ils écrivent dans l'historique de migrations de KFFR contrée). Chaque migration s'inscrit elle-même dans `histoire.migrations_appliquees` et s'exécute en SQL, dans une transaction. Procédure : `README.md`.
- **Appliquer la migration sur KFFR avant de fusionner la PR qui la contient** : Vercel met `main` en ligne dès la fusion, et le site casse si la base n'a pas suivi.
- Les réponses aux questions (dates, alias) ne doivent jamais être lisibles depuis le navigateur : la correction se fait en SQL (`security definer`).
- Périmètre produit (ce que fait la V1, ce qui vient après) : `docs/prd.md`. Le lire avant de développer une fonctionnalité ; ne rien construire hors du périmètre V1 sans accord.
- Architecture détaillée : `docs/architecture.md`.
- Multijoueur (V1.3) : règles dans `docs/prd.md`, maquettes validées et chat restreint dans `docs/multijoueur.md`. Amis, présence et invitations sont ceux de KFFR contrée : on **appelle** leurs RPC (contrat dans #149), on n'écrit jamais dans leurs tables ; toute évolution côté `public` se fait dans le dépôt de la contrée, par Antonin. Salons et parties vivent dans `histoire`.
- **Visuels d'abord** : toute image, maquette, émote ou proposition visuelle est montrée en images dans la conversation et validée par Maxou avant d'être codée. Un écran absent des maquettes de `docs/multijoueur.md` est d'abord montré en images.
- Charte graphique « Cabinet de curiosités » : https://claude.ai/artifact/SGJG157QiCPsPsM3vRKTUQ. Couleurs et polices dans `src/app/globals.css` (classes `bg-encre`, `text-oxyde`, `font-date`…), motifs dans `public/motifs.svg`, écran de partie dans `src/components/partie/` (aperçu sur `/apercu`).

## Traiter une issue

1. **Vérifier que personne ne la traite déjà** : l'issue ne doit pas porter le label `en cours`, ni être assignée à quelqu'un, et aucune PR ouverte ne doit la viser (`Closes #<numéro>` ou branche `issue-<numéro>-…`). Si c'est le cas, ne pas la prendre : le dire à Maxou.
2. **Se déclarer, c'est le premier geste de l'agent, avant tout code** : dès qu'il prend une issue, l'agent passe lui-même l'issue « en cours » sans attendre qu'on le lui demande. Il pose le label `en cours`, ajoute 🚧 au début du titre de l'issue (pour la repérer dans la liste), s'assigne l'issue (Maxou ou Antonin, selon pour qui il travaille) et ajoute 🚧 devant la ligne de l'étape dans l'issue de suivi de la roadmap concernée (#31 pour la V1, #98 pour la V1.1, #148 pour la V1.3) (en modifiant son corps : `- [ ] 🚧 #<numéro> …`). Le label reste jusqu'à la fusion ou la fermeture de la PR (voir « Libérer l'issue » plus bas).
3. Lire l'issue en entier, puis ses dépendances (« Dépend de ») : si l'une n'est pas fermée, le signaler avant de commencer.
4. Lire `docs/prd.md` et `docs/architecture.md` pour la partie concernée ; ne rien ajouter hors du périmètre de l'issue.
5. Une branche par issue, partie de `main` à jour : `issue-<numéro>-<slug>` (ex. `issue-12-frise-zoom`).
6. Respecter chaque critère d'acceptation ; ce qui relève de la « Partie humaine » est signalé, pas fait à la place de l'humain.
7. Ne jamais créer ni modifier quoi que ce soit dans les schémas `public` ou `auth` (ils appartiennent à KFFR contrée).
8. Avant de pousser : `npm run lint`, `npm run typecheck`, `npm run build`.
9. Ouvrir une PR avec le modèle du dépôt, qui contient `Closes #<numéro>`, et la mener jusqu'à une CI verte.

## Libérer l'issue

- PR fusionnée : l'issue se ferme toute seule (`Closes #…`), et le robot `.github/workflows/suivi-issue.yml` retire le label `en cours` et le 🚧, puis coche l'étape dans l'issue de suivi de la roadmap concernée (#31 pour la V1, #98 pour la V1.1, #148 pour la V1.3) avec le numéro de PR (il ne le fait que si la PR contient `Closes #<numéro>`). L'agent vérifie que c'est bien fait et complète ce que le robot ne fait pas. Sans robot, il fait lui-même, sans attendre qu'on le lui demande, les trois gestes suivants :
  1. retirer le label `en cours` de l'issue et le 🚧 de son titre ;
  2. dans l'issue de suivi de la roadmap concernée (#31 pour la V1, #98 pour la V1.1, #148 pour la V1.3), cocher l'étape (`- [x] #<numéro> …`), retirer le 🚧 de sa ligne et y ajouter le numéro de la PR fusionnée ;
  3. mettre à jour la date « Dernière mise à jour » de cette issue de suivi.
  Si l'agent n'est pas là quand la PR est fusionnée (fusion par Maxou ou Antonin), le premier agent qui s'en aperçoit fait ces gestes ; au début de chaque issue, il vérifie donc que l'issue de suivi de la roadmap concernée (#31 pour la V1, #98 pour la V1.1, #148 pour la V1.3) reflète bien l'état des issues fermées et corrige l'écart. Avant de modifier cette issue de suivi, relire son contenu actuel (Maxou et Antonin peuvent l'avoir changé) et ne toucher que les lignes concernées.
- PR fermée sans fusion, ou travail abandonné : retirer le label `en cours`, le 🚧 du titre et l'assignation, et dire en commentaire pourquoi.
- Une issue qui garde `en cours` sans PR ni activité depuis plusieurs jours est probablement oubliée : demander à Maxou ou Antonin avant de la reprendre.
