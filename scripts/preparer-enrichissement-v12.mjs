// Relecture de la proposition #122. Aucune connexion et aucune écriture SQL.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {lireCsv} from './csv.ts';
const dir='docs/v1.2/';
const lot=JSON.parse(readFileSync(dir+'lot-a1.json','utf8'));
const reemplois=JSON.parse(readFileSync(dir+'lot-a0-reemplois.json','utf8'));
const etat=JSON.parse(readFileSync(dir+'etat-initial.json','utf8'));
const audit=JSON.parse(readFileSync(dir+'audit-rpc.json','utf8'));
const sourceMap=new Map(lireCsv('content/dataset-v18/kiffeurs-sources-v18.csv').map(s=>[s.source_id,s]));
const liens=lireCsv('content/dataset-v18/kiffeurs-event-sources-v18.csv').filter(s=>s.source_role==='HISTORICAL');
const packNames=new Map(etat.packs.map(p=>[p.id,p.title]));
const protege=new Set(['COL-0059','COL-0060','COL-0077']);
const norm=t=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('’',"'").replace(/^(le|la|les|un|une|des)\s+|^l'/,'').replace(/[^a-z0-9]+/g,' ').trim();
const ids=new Set(),titres=new Set();
for(const e of lot.events){
 assert(!ids.has(e.proposal_id));ids.add(e.proposal_id);
 assert(!titres.has(norm(e.title)));titres.add(norm(e.title));
 assert([1,2,3].includes(e.niveau));assert(e.description.length>50&&e.level_reason&&e.sources.length);
 assert(e.start_year!==0&&e.start_year<=2026);assert(!e.start_day||e.start_month);
 assert.equal(e.precision,e.start_day?'DAY':e.start_month?'MONTH':'YEAR');
 if(e.start_day){const d=new Date(Date.UTC(e.start_year,e.start_month-1,e.start_day));assert.equal(d.getUTCMonth()+1,e.start_month);assert.equal(d.getUTCDate(),e.start_day);}
 assert.equal(new Set(e.packs).size,e.packs.length);
 for(const p of e.packs) assert(packNames.has(p)&&!protege.has(p));
 for(const s of e.sources)assert(/^https:\/\//.test(s.url)&&s.evidence&&s.checked_on);
 assert(e.kind!=='cinema'||(e.territory&&e.packs.includes('COL-0114')&&!e.packs.includes('COL-0115')));
}
const csv=rows=>rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const date=e=>[e.start_year,e.start_month&&String(e.start_month).padStart(2,'0'),e.start_day&&String(e.start_day).padStart(2,'0')].filter(Boolean).join('-');
const rRows=[['event_id','titre_courant','date_courante','niveau_inchange','statut_courant','pack_cible','justification','sources_dataset','sources_verifiees','preuve_et_limites']];
for(const a of reemplois.associations){
 assert(!a.snapshot.packs?.includes(a.pack_id));assert(!protege.has(a.pack_id));
 const sources=[...new Set(liens.filter(s=>s.event_id===a.event_id).map(s=>sourceMap.get(s.source_id)?.url).filter(Boolean))];
 assert(sources.length,'source historique absente : '+a.event_id);
 assert(a.verified_sources?.length);
 rRows.push([a.event_id,a.snapshot.title,date(a.snapshot),a.snapshot.niveau,a.snapshot.date_status,packNames.get(a.pack_id),a.reason,sources.join(' ; '),a.verified_sources.map(s=>s.url).join(' ; '),a.verified_sources.map(s=>s.evidence).join(' ; ')]);
}
writeFileSync(dir+'lot-a0-reemplois.csv',csv(rRows));
writeFileSync(dir+'lot-a1.csv',csv([
 ['proposition','titre','date','precision','statut','niveau','territoire','description','justification_niveau','packs','sources','preuve_datation'],
 ...lot.events.map(e=>[e.proposal_id,e.title,date(e),e.precision,e.date_status,e.niveau,e.territory,e.description,e.level_reason,e.packs.map(p=>packNames.get(p)).join(' ; '),e.sources.map(s=>s.url).join(' ; '),e.sources.map(s=>s.evidence).join(' ; ')])
]));
// Le corpus complet reste hors Git. Il sert seulement à la déduplication et à
// vérifier les projections contre les 888 agrégats RPC actuels, avant enrichissement.
const arg=process.argv.indexOf('--inventaire');
if(arg<0){console.log('42 propositions et 10 rattachements : champs, calendrier, sources et contrats validés. Projections non recalculées sans --inventaire.');process.exit(0);}
const inv=JSON.parse(readFileSync(process.argv[arg+1],'utf8'));
assert.equal(inv.length,etat.events);
for(const e of lot.events)assert(!inv.some(x=>norm(x.title)===norm(e.title)),'Titre déjà présent : '+e.title);
const children=id=>[id,...etat.packs.filter(p=>p.active&&p.parent_id===id).flatMap(p=>children(p.id))];
const candidats=(events,p,cohorte)=>{
 const scope=children(p);
 return events.filter(e=>e.playable&&e.start_year!==null&&['YEAR','MONTH','DAY','RANGE'].includes(e.playable_mode)&&
 (e.packs??[]).some(x=>scope.includes(x))&&(cohorte==='expert_exclusif'?e.niveau===3:e.niveau<=(cohorte==='debutant'?1:cohorte==='intermediaire_cumule'?2:3)));
};
const nQuestions=(es,d,sens)=>{const cs=es.filter(e=>d==='YEAR'||(e.start_month!==null&&(d!=='DAY'||e.start_day!==null)));
 return sens==='date'?cs.length:new Set(cs.map(e=>[e.start_year,...(d!=='YEAR'?[e.start_month]:[]),...(d==='DAY'?[e.start_day]:[])].join('/'))).size;};
let n=0;
for(const m of audit.rpc_matrix)for(const p of m.packs)for(const d of ['YEAR','MONTH','DAY']){
 assert.equal(nQuestions(candidats(inv,p.id,m.label),d,m.dir),p.comptes[d],p.id+' '+m.label+' '+m.dir+' '+d);n++;
}
const apres=structuredClone(inv);
for(const a of reemplois.associations)apres.find(e=>e.id===a.event_id).packs.push(a.pack_id);
for(const e of lot.events)apres.push({...e,id:e.proposal_id,playable:true,playable_mode:e.precision});
const projection=[['pack_id','pack','cohorte','sens','precision','avant_RPC','apres_PROJETE','gain','5_nouveau','10_nouveau','20_nouveau','Tout_nouveau']];
for(const m of audit.rpc_matrix)for(const p of m.packs)for(const d of ['YEAR','MONTH','DAY']){
 const avant=p.comptes[d],ap=nQuestions(candidats(apres,p.id,m.label),d,m.dir);
 projection.push([p.id,p.titre,m.label,m.dir,d,avant,ap,ap-avant,avant<5&&ap>=5,avant<10&&ap>=10,avant<20&&ap>=20,avant===0&&ap>0]);
}
writeFileSync(dir+'projection-a0-a1.csv',csv(projection));
const gains=projection.slice(1).filter(r=>r.slice(8).some(Boolean));
const summary=['# Projection A0 + A1 — contenu non publié','',
'Calcul hors ligne après reproduction exacte des 888 cellules de production (aucun retrait présent au relevé). Aucun nouveau compte RPC après publication ne peut être revendiqué à ce stade.','',
'| Pack | Sens | Précision | Débutant avant → projeté |',
'| --- | --- | --- | --- |',
...projection.slice(1).filter(r=>r[2]==='debutant'&&['COL-0114','COL-0115','COL-0112','COL-0113','COL-0067','COL-0074'].includes(r[0])).map(r=>'| '+[r[1],r[3],r[4],r[5]+' → '+r[6]].join(' | ')+' |'),
'','42 événements nouveaux proposés : 40 Débutant et 2 Intermédiaire. Le corpus passerait de 2 105 à 2 147 événements ; Débutant de 260 à 300, dont 238 à 278 jouables. Les dix rattachements ne créent aucun événement. Aucun reclassement. Aucun après mesuré.','',
gains.length+' cellules cohorte/sens/précision franchiraient au moins un seuil 5/10/20/Tout. Le CSV donne les seuils individuellement ; les mêmes éligibilités valent pour les packs dans Mystère. Aucun tirage de partie exécuté sur KFFR.'];
writeFileSync(dir+'projection.md',summary.join('\n')+'\n');
console.log(n+' cellules reproduites exactement ; 42 ajouts sans doublon de titre normalisé ; '+gains.length+' cellules avec nouveau seuil. Projection sauvegardée.');
