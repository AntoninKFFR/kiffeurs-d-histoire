// Génération hors ligne des agrégats de l'audit #122, sans connexion ni réponse individuelle.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = 'docs/v1.2/';
const audit = JSON.parse(readFileSync(base+'audit-rpc.json','utf8'));
const etat = JSON.parse(readFileSync(base+'etat-initial.json','utf8'));
const csv = rows => rows.map(row => row.map(v => '"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const elig = n => [5,10,20].filter(x=>n>=x).join('/')+(n>0 ? (n>=5?'/':'')+'Tout('+Math.min(100,n)+')' : 'aucune');
const rows=[['pack_id','pack','parent_id','cohorte','sens','precision','questions_disponibles','longueur_5','longueur_10','longueur_20','tout','taille_tout','mystere_5','mystere_10','mystere_20','mystere_tout']];
assert.equal(audit.rpc_matrix.length,8);
for (const m of audit.rpc_matrix) {
  assert.equal(m.packs.length,37);
  assert.equal(new Set(m.packs.map(p=>p.id)).size,37);
  for (const p of m.packs) for(const d of ['YEAR','MONTH','DAY']){
    const n=p.comptes[d];
    assert(Number.isInteger(n)&&n>=0);
    rows.push([p.id,p.titre,p.parent_id,m.label,m.dir,d,n,n>=5,n>=10,n>=20,n>0,Math.min(100,n),n>=5,n>=10,n>=20,n>0]);
  }
}
assert.equal(rows.length-1,888);
const compte=(id,c='debutant',sens='date')=>audit.rpc_matrix.find(m=>m.label===c&&m.dir===sens).packs.find(p=>p.id===id).comptes;
for(const p of etat.packs) for(const d of ['YEAR','MONTH','DAY']) for(const c of ['debutant','intermediaire_cumule','expert_exclusif','tous']){
  assert(compte(p.id,c,'inverse')[d]<=compte(p.id,c,'date')[d]);
}
for(const p of etat.packs) for(const d of ['YEAR','MONTH','DAY']){
  assert(compte(p.id,'debutant')[d]<=compte(p.id,'intermediaire_cumule')[d]);
  assert.equal(compte(p.id,'intermediaire_cumule')[d]+compte(p.id,'expert_exclusif')[d],compte(p.id,'tous')[d]);
}
writeFileSync(base+'disponibilites.csv',csv(rows));
writeFileSync(base+'couverture.csv',csv([
['pack_id','pack','parent_id','associations_directes','union_active_apres_retraits','retraits_directs','non_jouables_dans_union','min_annee','max_annee','avant_476','476_1491','1492_1788','1789_1900','1901_2000','apres_2000','themes_importes_top8'],
...audit.coverage.map(p=>[p.id,p.title,p.parent_id,p.direct,p.effective_memberships,p.removed_direct,p.not_playable,p.chronology.min,p.chronology.max,p.chronology.antiquite,p.chronology.moyen_age,p.chronology.moderne,p.chronology['1789_1900'],p.chronology['1901_2000'],p.chronology.apres_2000,(p.topics??[]).map(t=>t.name+':'+t.n).join(' ; ')])
]));
const table=['| Pack | Union | Jouable | D | I (1+2) | E seul | Tous A/M/J | Inversé D A/M/J | Longueurs D Solo année |',
'| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |',
...audit.coverage.map(p=>{const all=compte(p.id,'tous'),d=compte(p.id),i=compte(p.id,'intermediaire_cumule'),x=compte(p.id,'expert_exclusif'),iv=compte(p.id,'debutant','inverse');return '| '+[p.title+(p.parent_id?' (enfant)':''),p.effective_memberships,all.YEAR,d.YEAR,i.YEAR,x.YEAR,['YEAR','MONTH','DAY'].map(k=>all[k]).join('/'),['YEAR','MONTH','DAY'].map(k=>iv[k]).join('/'),elig(d.YEAR)].join(' | ')+' |';})];
writeFileSync(base+'matrice.md','# Matrice de tous les packs actifs\n\nRelevé SQL : '+audit.at+'. A/M/J = année/mois/jour. I est cumulatif ; E est exclusif. Longueurs et Mystère pour les 888 cellules : [CSV](disponibilites.csv). Tout est plafonné à 100.\n\n'+table.join('\n')+'\n');
console.log('37 packs, 8 cohortes/sens, 888 cellules : contrats arithmétiques validés. CSV et matrice régénérés.');
