# Inventaire pour la prochaine campagne DA

Les 292 lignes utilisent **285 événements distincts** : **82 SVG existants réutilisables** et **203 nouvelles illustrations à produire**. Les deux inventaires couvrent toutes les cartes et mutualisent les besoins par `event_id`. Aucune nouvelle image n'est produite dans cette PR ; les 331 SVG existants sont intégralement contrôlés par empreinte.

La direction artistique reste exactement celle validée dans #66. Références de travail protégées : `content/illustrations/reference-validee.json`, le catalogue de scènes, le stock `objets.ts`, les compositions de `generer.ts`, les planches `planches.mjs` et `docs/illustrations/generalisation/`. Les références DA proposées dans l'inventaire viennent exclusivement du stock, dont chaque nom est vérifié automatiquement.

La campagne suivante doit garder le **SVG 160 × 120**, le plafond **8 Ko**, la palette encre `#1d2a3a`, papier `#f3f2ec`, laiton `#b08a3e`, oxyde `#8a2f2b`, sauge `#7e8c7a`, les traits et compositions validés, et l'absence de texte. Comparer les futures planches avec les références DA existantes avant toute approbation.

Chaque ligne indique l'état actuel, le SVG réutilisable, la nécessité d'une nouvelle image, l'intention, les objets du stock et leurs SVG de référence, les cartes qui partagent l'événement et les vigilances historiques. Les scènes utilisant deux exemplaires d'un même objet suivent la composition existante ; elles ne demandent pas deux fichiers pour le même événement.

Les adaptations signalées restent des besoins de dessin à relire dans cette future campagne : outil en pierre et non métal, habitat archaïque et non palais monumental, galère antique et non vapeur, avion à hélices et non appareil à réaction. Aucun objet adapté ni changement du générateur n'est ajouté maintenant. Les violences et génocides utilisent des représentations retenues, sans victimes spectaculaires ni emblèmes décoratifs de propagande.

Les SVG réutilisables gardent leurs octets. Un éventuel défaut historique déjà présent doit être traité dans une correction explicitement validée, sans être masqué par cet inventaire. Le cas Han reste soumis au blocage de contenu même si sa scène peut être préparée : disposer d'une image n'autorise aucune activation.
