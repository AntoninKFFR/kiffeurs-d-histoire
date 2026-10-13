# Relecture éditoriale indépendante — phase 3, issue #92

Audit indépendant réalisé le 13 octobre 2026 sur **224 rédactions intégralement relues** et les 76 entrées du journal collège alors disponibles. Les observations ci-dessous décrivent cet état intermédiaire. La [finalisation du coordinateur](audit-finalisation.md) complète ensuite les sept cartes de THM-018, les consultations manquantes et les preuves sur les 292 CSV assemblés. La portée de cette lecture indépendante n'est pas élargie rétrospectivement ; elle ne vaut pas validation humaine ou autorisation de publication.

## Ce qui a réellement été examiné

Les titres, corps, idées à retenir et concepts de chaque entrée de `redaction-primaire.json` (64), `redaction-lycee.json` (69) et `redaction-college.json` (91) ont été lus intégralement, par chapitre, sans échantillonnage. Chaque couple parent/événement a été rapproché de `cartes-manquantes-par-chapitre.csv` et de l’objet/date du canon `kiffeurs-events-v18.csv`. Les 224 couples appartiennent à l’inventaire des manques ; aucune redondance de couple n’a été trouvée. Les sept couples absents correspondent exactement à THM-018, et non à des événements supplémentaires.

Ont également été lus : la demande jointe intégrale, `reference-cartes.md`, `style-par-niveau.csv`, `arbitrages-documentaires-v2.md`, la fiche Han, les passages pertinents du manifeste des enfants et du validateur de prose, et le texte historique de Fachoda. Les journaux `sources-primaire.json` (71 entrées), `sources-lycee.json` (73 entrées) et `sources-college.json` (76 entrées) ont été lus intégralement, y compris leurs statuts d’accès et leurs réserves.

Une déclaration « consultée » du rédacteur n’est pas une deuxième consultation indépendante. Les pages effectivement rouvertes par cet audit sont précisément consignées dans `sources-audit.json`, avec les passages et limites de lecture. Les autres sources sont appréciées à partir de leur journal explicite, sans déclaration fictive de lecture intégrale. Les sources inaccessibles, notices bibliographiques, transcriptions et extraits indexés restent distingués des originaux.

## Résultat pédagogique de la lecture

La prose relue explique généralement un mécanisme identifiable : participation civique, concentration du pouvoir, conquête, négociation, ratification, investissement, coordination militaire ou construction d’un savoir. Elle reste centrée sur l’objet de chaque événement. Les dates vivent dans le canon et ne sont pas ajoutées dans les phrases de l’élève. Les changements de régime, lois et traités distinguent utilement annonce, adoption, signature, application et effets réels.

Les cartes CM2 utilisent des actions et institutions expliquées concrètement. Les textes de sixième distinguent vestiges, traditions, croyances et connaissances historiques ; les notions de cité, empire, fonctionnaire et magistrat restent accessibles. Les textes de cinquième relient pouvoir, religion et institutions sans nationalismes anachroniques. Les cartes de quatrième et troisième explicitent les exclusions, la violence des rapports coloniaux, les intérêts des acteurs et les limites des résultats militaires ou juridiques.

Au lycée, les textes rendent perceptibles ruptures et continuités : maintien des formes républicaines sous Auguste, institutions séparées des couronnes unies, concurrence des légitimités, finance et industrialisation, défaite et mutation politique. Les cartes HGGSP problématisent démocratie, frontières, souveraineté, rapports de puissance, coopération, environnement et instrumentation scientifique. Les variantes d’un événement partagé par plusieurs niveaux sont adaptées au chapitre ; aucun simple changement de titre sur un corps identique n’a été constaté dans les nouvelles rédactions.

Les ouvertures et enchaînements varient naturellement selon le sujet. La fréquence des distinctions entre étapes est justifiée par les objets très fins du canon ; elle ne constitue pas un remplissage. Chaque corps contient un contexte, des acteurs et un effet intelligible sans devoir lire la carte précédente. Aucun texte générique interchangeable, causalité automatique de guerre, estimation controversée de victimes présentée comme certaine, ou fusion abusive de processus n’a été identifié dans ces 224 rédactions. Ce constat concerne la prose lue, pas une certification savante de chaque composante calendaire.

## Corrections réparables signalées

| Parent / événement | Observation exacte | Correction proposée | État |
| --- | --- | --- | --- |
| THM-021 / EVT-0158 | Concept `tolerance`, sans accent. | `tolérance`. | Correction constatée dans le fichier actuel. |
| THM-016 / EVT-0109 | Takeaway `Le programme du CNR` déclenche `le programme` dans le validateur, bien que le fait soit correct. | `À retenir : Les orientations du CNR relient libération nationale, retour de la démocratie et réformes sociales.` | Signalé au coordinateur ; à revérifier après correction. |
| THM-017 / EVT-0546 | `Le bilan humain exact` déclenche le mot technique `EXACT` avec comparaison insensible à la casse. Le sens historique est correct. | `Le nombre précis de victimes demeure difficile à établir, en raison notamment du contrôle de l’information.` | Signalé au coordinateur ; à revérifier après correction. |

Ces collisions doivent être résolues dans la prose, sans affaiblissement du validateur. Aucune modification de canon n’est requise pour ces corrections.

## Vérifications formelles indépendantes

Le décompte est celui du validateur existant : mots séparés par les espaces.

| Fichier relu | Corps | Minimum | Maximum | Résultat |
| --- | ---: | ---: | ---: | --- |
| primaire | 64 | 78 | 87 | Tous entre 60 et 120 mots. |
| lycée | 69 | 76 | 89 | Tous entre 60 et 120 mots. |
| collège, état initial | 91 | 73 | 87 | Tous entre 60 et 120 mots. |

Les 224 takeaways commencent exactement par `À retenir : `. Les concepts contiennent des notions utiles et reliées à la prose. Aucun chiffre ni siècle en chiffres romains n’a été détecté dans titre/corps/takeaway/concepts. Le contrôle des expressions techniques a donné les deux collisions ci-dessus et aucune autre. Ces contrôles ne remplacent ni la lecture ni la validation des fichiers CSV assemblés.

## Cas sensibles et réserves humaines

**Han — THM-006/EVT-0040, enfant THM-049.** La nouvelle prose décrit les deux périodes et la rupture, sans présenter les Han comme un pouvoir continu ni les bornes 9/25 comme celles de toute la dynastie. La fiche documentaire décrit explicitement l’incohérence. Le canon lu conserve 9/25, `YEAR_RANGE`, `EXACT`, malgré son texte −206/220 ; `git diff` ne montre aucune modification de ce CSV. THM-049 reste inactif avec `han-canon-incoherent` et validations nulles. Les deux pages du Met ont été rouvertes et soutiennent les périodes et l’interrègne. Aucun déblocage ou redatage n’est permis par cette relecture. La validation humaine de l’objet, des bornes, du statut et de l’admissibilité reste nécessaire ; le seuil ne doit pas dicter l’histoire.

**Sargon — THM-004/EVT-0553.** La prose exprime une convention de datation du règne et une construction du pouvoir, sans fondation exactement connue. Le Louvre lu donne −2334/−2279 comme rubrique de datation d’un objet ; le Met donne une autre chronologie reconstruite et indique une ville possiblement antérieure. Le canon −2334/CONVENTIONAL est inchangé. L’écart des sources est conservé et expliqué ; aucune nouvelle autorisation n’est nécessaire pour respecter la convention déjà acceptée.

**Becquerel — THM-046/EVT-0323.** Le corps décrit la note du 23 mars, l’électroscope, la décharge et la comparaison d’absorption. Il ne la présente pas comme la première découverte et ne déplace pas son jour vers le 2 mars. Après un accès web limité à la couverture et des captures sans image, le PDF original a pu être téléchargé nativement, rendu par Poppler puis examiné visuellement en entier pour pp. 689–690. Ces pages prouvent le jour de séance et tous les éléments expérimentaux mobilisés dans la carte. La réserve de collation de ce passage est donc résolue par cette consultation supplémentaire, documentée avec empreinte dans `sources-audit.json`. Les pp. 691–694 ne sont pas déclarées examinées visuellement. EVT-0322 conserve la série 24 février–23 mars et EVT-0323 le jalon du 23 mars ; leur emploi conjoint en test reste une décision pédagogique humaine.

**Fachoda — EVT-0475.** La carte historique `CARD-026-fachoda-imperialisme` a été lue et son fichier est inchangé selon le diff. La biographie du Sénat effectivement rouverte distingue ordre d’évacuation le 3 novembre et règlement diplomatique ultérieur. Ce passage ne prouve ni l’arrivée britannique ni le départ physique. Les contradictions arrivée/confrontation/décision/départ/règlement ne sont pas harmonisées dans le canon. La future copie enfant doit conserver exactement le texte et les dates historiques ; ce contrôle sera effectué sur le CSV assemblé. La rectification documentaire reste séparée de la copie.

**Préhistoire — THM-004/EVT-0339 ; Rome archaïque — THM-005/EVT-0025.** Les corps traitent des processus et des preuves, sans borne ponctuelle inventée. La République traditionnelle est bien présentée comme une tradition, et non comme la création instantanée d’institutions attestées.

Les journaux lus contiennent aussi des réserves documentaires précises qui ne doivent pas être effacées pour annoncer une validation générale :

| Événement | Réserve à conserver | Conséquence de l’audit |
| --- | --- | --- |
| EVT-0371, Zhang Qian | −138 dans le canon, autre borne −139 signalée ; l’UNESCO consulté soutient les réseaux, pas le départ précis. | Corps prudent et utile ; année à relire savamment avant publication. |
| EVT-0065, Nantes | La page du Musée protestant rouverte soutient le compromis mais pas le 13 avril ; un autre article journalisé donne le 30 avril. | Aucun redatage silencieux ; relecture du jalon et de ses pièces. |
| EVT-0424, Jamestown | Le NPS relu donne le choix du site le 13 mai, canon de fondation le 14. | Distinguer les étapes et corroborer le jour ; récit non contradictoire. |
| EVT-0389, Éphèse | La fin de la période est assortie d’une réserve dans la synthèse confessionnelle utilisée. | Ne pas transformer la clôture en certitude indépendante de la source. |
| EVT-0385, Rubicon | Jour précis soutenu surtout par complément secondaire et tradition calendaire. | Corpus inchangé ; relecture documentaire du jour souhaitable. |
| EVT-0421, Augsbourg ; EVT-0415, mariage Isabelle/Ferdinand | Jour surtout soutenu par synthèse secondaire ; précision institutionnelle à compléter. | Corps nuancés ; ne pas certifier le jour au-delà des sources effectivement lues. |
| EVT-0146, Sixtine | Jour du contrat soutenu par secondaire ; page Vatican surtout contexte et inauguration. | Pas de fusion contrat/inauguration ; source du contrat à retrouver. |
| EVT-0171, Madame Roland | Arrestation nocturne entre le 31 mai et le premier juin, écrou le premier juin. | Canon 31 mai conservé ; qualification précise du jalon à valider. |
| EVT-0195, Crédit mobilier ; EVT-0227, Exposition universelle | Compléments archivistiques/patrimoniaux souhaitables ; les notices consultées ne sont pas des actes originaux entièrement examinés. | Prose satisfaisante ; garder les limites documentaires. |
| EVT-0450, royaume grec | Appui secondaire pour le jour, distinct de la reconnaissance antérieure de l’indépendance. | La prose respecte cette distinction. |
| EVT-0514, El-Alamein | Le National Army Museum rouvert date la bataille du 23 octobre au 4 novembre, canon jusqu’au 11 novembre. | Contradiction documentaire confirmée ; objet/borne à valider humainement, sans redatage de la carte. |
| EVT-0543, Afghanistan | Le journal de l’Office of the Historian signale le 24 décembre pour les premiers mouvements, canon le 25. | Début formel, arrivée initiale et coup contre Amin à distinguer. |
| EVT-0528, Suez ; EVT-0532, baie des Cochons ; EVT-0536, Prague | Accord de cessez-le-feu du 6 versus borne du 7 ; résumé de deux jours versus fin du 20 ; début du 5 janvier non donné par la page lue. | Conserver les réserves sur les composantes non soutenues ; prose respectant les étapes. |

La formule de THM-017/EVT-0535 selon laquelle la deuxième attaque du Tonkin n’a pas eu lieu a été confrontée à la notice et à la transcription des National Archives, effectivement lues. Leur commentaire cite la conclusion du rapport NSA ultérieur : la distinction entre affrontement réel et attaque alléguée est donc soutenue par une institution archivistique, au-delà du résumé initial du journal collège. La résolution politique originale ne constitue pas une preuve que l’attaque alléguée a eu lieu.

Une réserve documentaire n’est pas automatiquement une erreur de prose ou un blocage d’activation supplémentaire. Han possède un blocage explicite dans le manifeste ; les autres décisions relèvent de leur dossier réel et de la validation humaine, sans ajout de règles techniques par cet audit.

## Couverture de lecture, par chapitre

Chaque nombre désigne des **rédactions nouvelles effectivement lues**, et non les cartes historiques du chapitre ou ses copies enfants.

| Niveau | Parents relus et nombre de corps | Total lu | Appréciation |
| --- | --- | ---: | --- |
| CM2 | THM-001 : 2 ; THM-003 : 2 | 4 | Citoyenneté et coopération expliquées concrètement. |
| 6e | THM-004 : 2 ; THM-005 : 11 ; THM-006 : 16 | 29 | Processus, traditions et empire différenciés ; réserves Han et chronologies conservées. |
| 5e | THM-007 : 4 ; THM-009 : 7 ; THM-010 : 1 ; THM-011 : 6 ; THM-012 : 13 | 31 | Vocabulaire accessible, pouvoirs et religions contextualisés. |
| 4e | THM-013 : 6 ; THM-014 : 11 ; THM-015 : 2 | 19 | Représentation, esclavage, communications et exclusions expliqués. |
| 3e | THM-016 : 44 ; THM-017 : 28 | 72 | Mécanismes de guerre, violence de masse, décolonisation et institutions nuancés ; deux collisions de validateur à corriger. |
| Seconde | THM-019 : 1 ; THM-020 : 2 ; THM-021 : 5 ; THM-022 : 1 | 9 | Continuités institutionnelles, mécénat, circulations et dynasties lisibles. |
| Première générale | THM-024 : 15 ; THM-025 : 11 ; THM-026 : 5 ; THM-027 : 2 | 33 | Souveraineté, nationalités, institutions, économie et guerre reliées. |
| Terminale générale | THM-028 : 11 ; THM-029 : 1 ; THM-031 : 1 | 13 | Crise, régimes, étapes de défaite et infrastructures distingués. |
| Première HGGSP | THM-036 : 4 ; THM-038 : 3 | 7 | Démocratie, légitimation et frontières problématisées. |
| Terminale HGGSP | THM-041 : 3 ; THM-042 : 1 ; THM-045 : 2 ; THM-046 : 1 | 7 | Puissance, coopération, environnement et construction des savoirs développés. |
| À compléter en 3e | THM-018 : 7 absentes à cet instant | 0 | EVT-0007, EVT-0008, EVT-0130, EVT-0131, EVT-0135, EVT-0531, EVT-0539. |

## Limites et vérifications encore nécessaires

Les 224 objets de rédaction ne comportent pas encore les identifiants finaux, dates structurées, rangs et filiations des CSV. Il serait donc faux de certifier à ce stade les 292 enregistrements, les 61 copies, leurs rangs ou la couverture finale des 59 unités. Le fichier historique et le canon sont inchangés dans les diffs examinés ; la preuve d’identité au SHA de référence et le contrôle complet des copies reviennent à l’assemblage final.

Il reste à relire les sept cartes THM-018 dès leur arrivée, les corrections ci-dessus et les copies finales sensibles. Au dernier rapprochement carte/journal, six URLs sont encore absentes de `sources-college.json` pour EVT-0468 (Gettysburg), EVT-0085 (Dreyfus), EVT-0103 et EVT-0106 (même page Assemblée), EVT-0509 (RAF Museum), EVT-0541 (TheoryChina). Ce résultat décrit le fichier encore en évolution ; il ne certifie pas que ces pages n’ont jamais été consultées. Le rédacteur doit journaliser exactement les accès et passages réellement lus.

Aucune source inaccessible n’est déclarée lue. Aucun SQL, import distant, migration, activation, publication, SVG, PR ou modification de code/contenu n’a été effectué par cet audit ; ses seuls livrables sont ce rapport et son journal de consultation.
