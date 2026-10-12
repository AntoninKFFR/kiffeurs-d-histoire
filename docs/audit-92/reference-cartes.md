# Fiche de référence des cartes — audit seulement

Référence : `content/pedagogie/cartes-v1.csv`, `scripts/import-cartes.ts`, migration `20261007102922_chapter_cards.sql`, `content/pedagogie/README.md`. Aucun texte pédagogique nouveau dans cette fiche.

## Contrat interne

CSV UTF-8, virgule, guillemets doubles échappés. Les listes sont séparées par `;`, sans élément vide ou doublon.

| Champ | Obligation et règle |
| --- | --- |
| card_id | Unique et stable, `CARD-XXX-slug` ; l’import TypeScript exige le numéro du chapter_id. Ne dépend pas du rang. |
| chapter_id | Chapitre canonique connu. |
| event_id | Obligatoire pour une carte événementielle ; vide uniquement pour un contexte temporel autorisé. Une carte événementielle doit avoir un lien canonique au chapitre. |
| start_year, start_month, start_day | Colonnes présentes ; valeurs nulles autorisées selon la précision. Exactement les composantes du canon pour un événement, jamais année zéro. Mois 1–12, jour 1–31 ; jour exige mois, mois exige année. |
| end_year, end_month, end_day | Colonnes présentes ; valeurs nulles possibles. Exactement le canon. Fin ≥ début, avec précautions pour les composantes non connues. |
| date_text | Texte non vide repris du canon, incertitudes et variantes incluses. |
| date_precision | Valeur canonique parmi DAY, MONTH, YEAR, DAY_RANGE, YEAR_RANGE, CENTURY, PERIOD_TEXT, MIXED_RANGE. |
| date_status | EXACT, CONVENTIONAL, APPROXIMATE, DISPUTED ou TRADITIONAL, repris du canon. |
| title | Non vide, naturel et adapté à la classe. |
| body | Non vide, 60–120 mots ; observé 71–91. Aucune donnée inventée pour combler la longueur. |
| takeaway | Commence exactement par `À retenir : ` ; une idée centrale avec sa nuance utile. |
| key_concepts | Liste de 1 à 6 notions, sans doublon/élément vide. |
| sort_order | Entier positif ; ordre 1…N continu, sans doublon dans le chapitre, chronologique pour les dates comparables. |
| official_wording | Cellule exacte du lien canonique. Peut être vide pour certains liens événementiels complémentaires ; un contexte exige un libellé temporel non vide. |
| sources | Au moins une URL HTTPS dans l’import des cartes, liste interne. Les supports de prose ne remplacent pas la vérification de la date canonique. |

Un contexte ne reçoit que la période autorisée par `periodeContexte(official_wording)`. Une plage d’années explicite devient YEAR_RANGE/CONVENTIONAL ; un siècle, une décennie ou une borne ambiguë restent PERIOD_TEXT/APPROXIMATE, sans fausse année. Un contexte sans période est refusé. Aucun contexte sans event_id n’est posé en test, même avec une année structurée.

Limite actuelle supplémentaire : 5–12 cartes par chapitre. Elle est un contrat d’import V1, pas une obligation du programme officiel. La future complétion doit l’adapter après validation ; le nombre de cartes peut dépasser celui des événements à cause des contextes.

## Style constaté

Les cartes utilisent des phrases déclaratives, expliquent les rapports entre acteurs et mécanismes, et distinguent ce qui est connu, traditionnel ou discuté. Les textes de l’élève évitent « cette carte », « le programme », dataset, base de données, statuts techniques et justifications d’import. Le validateur refuse les repères chiffrés supplémentaires et les siècles en chiffres romains dans titre/corps/takeaway/concepts : les dates sourcées vivent dans les champs dédiés.

La longueur n’est pas un indice suffisant de qualité. Les moyennes mesurées et exemples de notions existantes sont dans [style-par-niveau.csv](style-par-niveau.csv).

| Classe | Mots constatés | Moyenne | Vocabulaire à maintenir |
| --- | --- | ---: | --- |
| CM2 | 71–79 | 75,7 | Objets et actions concrets, citoyen et symbole expliqués en situation |
| 6e | 73–86 | 78,2 | Mythe/histoire, cité, religion, empire ; distinguer récits et preuves |
| 5e | 73–84 | 77,5 | Pouvoirs, croyances et institutions, définitions accessibles |
| 4e | 75–84 | 79,6 | Mécanismes économiques et politiques, violence et rapports sociaux |
| 3e | 76–90 | 81,9 | Guerre totale, régimes, souveraineté, coopération ; chaînes causales nuancées |
| Seconde | 79–86 | 83,0 | Changements d’échelle, circulations, ruptures et continuités |
| Première générale | 79–89 | 84,3 | Nation, représentation, industrialisation, acteurs collectifs |
| Terminale générale | 80–89 | 84,3 | Systèmes politiques, totalitarismes et rapports internationaux |
| Première HGGSP | 82–91 | 86,1 | Définitions problématisées : démocratie, puissance, information |
| Terminale HGGSP | 82–91 | 87,3 | Enjeux, usages politiques, coopération, mémoires et limites des institutions |

Cette appréciation qualitative provient de la lecture des cartes, sans score automatique de lisibilité. Une carte d’un autre niveau peut servir de matériau documentaire, sans copie automatique du vocabulaire ou du takeaway.

## Dates et sources

Les sources se trouvent dans les cartes existantes, `event-sources` + `sources`, les ajouts de descriptions et leur revue, ainsi que les dossiers de correction des chapitres. Distinguer support de date (`HISTORICAL`, scope DATE/PERIOD), support de récit, et source de programme (`CURRICULUM`). Une source générale ou un lien de programme ne prouve pas à lui seul une date précise.

- Tradition de Rome : ne pas transformer une tradition datée en preuve archéologique.
- Jérusalem : conserver le désaccord et la plage canoniques ; un test peut rester interdit malgré une année structurée.
- Sargon : la borne −2334 est conventionnelle, pas la date exacte de fondation de l’empire. Les conditions d’Antonin et variantes Louvre/Met sont à conserver.
- Préhistoire, processus urbains, siècles : aucune date ponctuelle ou borne numérique déduite.
- Calendriers/années avant J.-C. : conserver les composantes canoniques ; le passage en années astronomiques ne sert qu’à la frise.
- Han et Fachoda : incohérences ouvertes documentées ; ne pas écrire une carte qui les masque.

Les URLs disponibles dans les tableaux sont des références du dépôt. Elles n’ont pas toutes été ouvertes ni vérifiées vivantes pendant cette phase ; chaque passage utile doit être contrôlé lors de la rédaction et de la relecture. Aucune nouvelle source de date n’est inventée ici.

## Illustration attendue

Dessin SVG à l’encre sur papier, 160×120, ≤8 192 octets, cinq couleurs de charte au maximum, sans texte, sans contenu actif ni référence externe. Formes lisibles à petite taille, scène adaptée au contexte, réserve face aux anachronismes et à la représentation de violences. Un event_id peut partager un SVG entre classes après relecture ; un contexte sans événement conserve un motif. La route publique utilise le card_id, jamais le nom EVT ou une URL source.

La projection pédagogique publique reste celle des 14 champs autorisés. `event_id`, `official_wording`, `sources`, statuts techniques et fichiers internes restent privés dans les props et réponses publiques.
