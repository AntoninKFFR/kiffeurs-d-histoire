// Correction éditoriale versionnée ; le corpus brut #92 et ses preuves restent archivés.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {lireCsv,lireTexteCsv,type LigneCsv} from './csv';
export const FICHIER_HAN_117='content/pedagogie/cartes-han-117.csv';
export const DATE_HAN_117='206 av. J.-C.–220 apr. J.-C., avec une interruption entre 9 et 25 apr. J.-C. (interrègne de Wang Mang et transition jusqu’au rétablissement des Han)';
export const ANCIENNE_DATE_HAN_117='206 av. J.-C.-220 apr. J.-C., interrompue par le régime de Wang Mang/Xin (9-25 apr. J.-C.)';
export function corrigerLignesCanonHan117(fichier:string,lignes:LigneCsv[]){
  const resultat=lignes.map(row=>{
    if(row.event_id!=='EVT-0040')return row;
    const r={...row};
    if(fichier.endsWith('kiffeurs-events-v18.csv'))Object.assign(r,{start_year:'-206',end_year:'220',date_status:'CONVENTIONAL',date_text:DATE_HAN_117});
    if(fichier.endsWith('kiffeurs-gameplay-v18.csv'))r.date_status='CONVENTIONAL';
    if(fichier.endsWith('kiffeurs-curriculum-links-v18.csv'))r.date_text_candidate=DATE_HAN_117;
    if(fichier.endsWith('kiffeurs-ready-collection-events-v18.csv'))r.date_text=DATE_HAN_117;
    if(fichier.endsWith('kiffeurs-event-tags-v18.csv')){
      if(r.tag_id==='TAG-0076')r.tag_id='TAG-0074';
      if(r.tag_id==='TAG-0085')r.tag_id='TAG-0193';
    }
    return r;
  });
  if(fichier.endsWith('kiffeurs-event-tags-v18.csv'))resultat.push({event_tag_id:'ETAG-21909',event_id:'EVT-0040',tag_id:'TAG-0087',assignment_method:'DATE_DERIVED',confidence:'HIGH',notes:'Derived from structured year.'});
  return resultat;
}
export const CANONS_CORRIGES_117=['events','gameplay','curriculum-links','ready-collection-events','event-tags'].map(n=>`content/dataset-v18/kiffeurs-${n}-v18.csv`);
/** Toute différence autre que les champs autorisés d’EVT-0040 est refusée. */
export function verifierDeltaCanon117(fichier:string,archive:string){
  assert(CANONS_CORRIGES_117.includes(fichier));
  assert.deepEqual(lireCsv(fichier),corrigerLignesCanonHan117(fichier,lireTexteCsv(archive,fichier)),`Delta canon hors arbitrage : ${fichier}`);
}
export function lignesEnfantsCourantes117(fichier:string,racine='.'):LigneCsv[]{
  const raw=lireCsv(fichier),patch=join(racine,FICHIER_HAN_117);
  if(resolve(fichier)!==resolve(racine,'content/pedagogie/cartes-sous-chapitres.csv')||!existsSync(patch))return raw;
  const corrections=lireCsv(patch),old=raw.filter(c=>c.chapter_id==='THM-049');
  assert.equal(corrections.length,5);assert.equal(old.length,5);
  const attendu:LigneCsv[]=old.map((c):LigneCsv=>({...c,...(c.event_id==='EVT-0040'?{start_year:'-206',end_year:'220',date_status:'CONVENTIONAL',date_text:DATE_HAN_117}:{} )}))
    .sort((a,b)=>Number(a.start_year)-Number(b.start_year)).map((c,i):LigneCsv=>({...c,sort_order:String(i+1)}));
  assert.deepEqual(corrections,attendu,'Correction Han différente de la décision ou modifiant Wudi/contenu validé');
  const map=new Map(corrections.map(c=>[c.card_id,c]));
  return raw.map(c=>map.get(c.card_id)??c).sort((a,b)=>a.chapter_id.localeCompare(b.chapter_id)||Number(a.sort_order)-Number(b.sort_order));
}
export function verifierCanonHan117(racine='.'){
  const e=lireCsv(join(racine,'content/dataset-v18/kiffeurs-events-v18.csv')).find(e=>e.event_id==='EVT-0040');
  assert(e);assert.equal(e.start_year,'-206');assert.equal(e.end_year,'220');assert.equal(e.date_status,'CONVENTIONAL');
  assert.equal(e.precision,'YEAR_RANGE');assert.equal(e.playable_mode,'RANGE');assert.equal(e.date_text,DATE_HAN_117);
  const decision=JSON.parse(readFileSync(join(racine,'content/pedagogie/decision-han-117.json'),'utf8'));
  assert.equal(decision.event_id,'EVT-0040');assert.equal(decision.start_year,-206);assert.equal(decision.end_year,220);assert.equal(decision.date_status,'CONVENTIONAL');
  assert.equal(decision.trace_github,'https://github.com/Zazou13015/KIffeur-d-Histoire/issues/117#issuecomment-6180701113');
  assert.equal(decision.precision,'YEAR_RANGE');assert.equal(decision.playable_mode,'RANGE');assert.equal(decision.date_text,DATE_HAN_117);
  const typesTags=new Map(lireCsv(join(racine,'content/dataset-v18/kiffeurs-tags-v18.csv')).map(t=>[t.tag_id,t.tag_type]));
  const tags=lireCsv(join(racine,'content/dataset-v18/kiffeurs-event-tags-v18.csv')).filter(t=>t.event_id==='EVT-0040'&&['DATE_STATUS','CENTURY'].includes(typesTags.get(t.tag_id)??''));
  assert.deepEqual(tags.map(t=>t.tag_id).sort(),['TAG-0074','TAG-0087','TAG-0193'],'Tags de statut/siècles Han incohérents');
  lignesEnfantsCourantes117(join(racine,'content/pedagogie/cartes-sous-chapitres.csv'),racine);
}
