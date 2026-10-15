import { readFileSync,writeFileSync } from 'node:fs';
import manifeste from '../content/fun/manifeste.json';
const lignes=['Proposition #91 du 15 octobre 2026, avant génération/application de la migration de contenu.',
  '', 'Les six thèmes sont décidés par Antonin dans [#86](https://github.com/Zazou13015/KIffeur-d-Histoire/issues/86#issuecomment-6191269403). **La liste ci-dessous reste à valider par Maxou avant migration**, conformément à la partie humaine de cette issue. Aucune validation de Maxou n’est supposée.',
  '',readFileSync('content/fun/effectifs.md','utf8'),
  'Six packs autonomes, sans sous-packs de faible volume. Rubrique « Pour le fun » dans le sélecteur existant de Solo libre et Inversé ; mêmes contrôles de disponibilité, longueurs et replay que Sport. Les dates et réponses restent privées.',
  '', '**Audit préalable :** 2 001 événements KFFR lus sans écriture, 31 packs actifs constatés, aucune PR ouverte ni avance de la branche récente de Max sur main. Sélection de 101 événements existants uniques, préservés sans modification globale, et 104 ajouts proposés : 205 événements uniques pour 210 associations. Aucun film du pack cinéma dans Pop culture.',
  '', '**Datation :** territoire de sortie explicite pour les films, distinction entre production, première, sortie nationale et ressortie. Les 30 classiques AFI sont volontairement à l’année : leurs fiches mêlent ouvertures locales/nationales et premières. Les films français utilisent la sortie France d’Unifrance ; Ghibli la sortie japonaise. Pas de jour ajouté sur la base d’un simple millésime.',
  '', '**Jouabilité :** chacun a au moins 30 questions au niveau Toutes les questions, et au moins 10 jusqu’à Intermédiaire à l’année. Les niveaux exclusifs et les dates distinctes de l’inverse sont indiqués dans le tableau. On ne reclasse pas artificiellement les événements existants pour remplir Débutant ; les groupes insuffisants restent désactivés. Films : 50 questions dont 12 au jour, donc partie inversée de dix possible jusqu’à Intermédiaire.',
  '', '**Points de relecture :** sources historiques v18 conservées pour les événements réemployés (certaines sont secondaires, pas une nouvelle certification primaire). Les corrections éditoriales et retraits administratifs restent prioritaires ; toute divergence du relevé au moment d’appliquer impose une nouvelle vérification. Apollo 11 EVT-0893 est exclu à cause de l’ambiguïté alunissage/premiers pas UTC ; EVT-0928 est exclu car non jouable dans KFFR. Aucun changement aux anciens packs, aux comptes, aux parties ou à Contrée. Les catastrophes et conflits sont racontés sobrement.',
  '', '**Publication :** risque élevé (contenu Supabase + sélection). Lint, types, build, tests de contenu/import/catalogue, composant, navigateur et SQL requis ; CI pertinente verte sur le dernier commit. Migration `histoire` seulement, transactionnelle, sans `db push`/`apply_migration`. Application KFFR et fusion uniquement après validation de cette liste et contrôles. #86 reste ouverte pour son volet habillages non consigné.',
  '', '### Liste détaillée à valider', 'Les autres sources, descriptions et preuves de datation figurent dans `content/fun/inventaire.csv` de la branche `issue-91-packs-fun`.'];
for(const p of manifeste.packs){
  lignes.push('',`#### ${p.title}`,p.description,'','| Événement | Date | Niveau | Source |','| --- | --- | --- | --- |');
  for(const a of manifeste.associations.filter(a=>a.pack_id===p.id)){
    const e=manifeste.events.find(e=>e.id===a.event_id)!;
    const date=[e.start_day,e.start_month,e.start_year].filter(v=>v!==null).join('/');
    lignes.push(`| ${e.titre_question??e.title} (${e.id}${e.nouveau?', ajout proposé':''}) | ${date} | ${['','Débutant','Intermédiaire','Expert'][e.niveau]} | [source](${e.sources[0]}) |`);
  }
}
writeFileSync('content/fun/proposition-91.md',lignes.join('\n')+'\n');
console.log(`${lignes.join('\n').length} caractères ; aucun SQL généré ou exécuté.`);
