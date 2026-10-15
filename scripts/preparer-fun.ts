// Génération hors ligne du corpus #91 et de son inventaire de relecture ; aucune connexion à KFFR.
import { readFileSync, writeFileSync } from 'node:fs';
import packs from '../content/fun/packs.json';
import selection from '../content/fun/selection-existante.json';
import { ajouts } from '../content/fun/ajouts';
import { lireCsv } from './csv';

export type EvenementFun = {
  id: string; title: string; titre_question: string | null; event_type: string; precision: string;
  date_status: string; playable: boolean; playable_mode: string; importance: number; difficulty: number;
  niveau: number; source_status: string; start_year: number; start_month: number | null; start_day: number | null;
  end_year: number | null; end_month: number | null; end_day: number | null; date_text: string; description: string | null;
  nouveau: boolean; sources: string[]; preuve: string; alias: string[];
};
const audit=JSON.parse(readFileSync('content/fun/audit-base-2026-10-15.json','utf8')) as { events: Omit<EvenementFun,'nouveau'|'sources'|'preuve'|'alias'>[] };
const parId=new Map(audit.events.map(e=>[e.id,e]));
const csv=(nom:string)=>lireCsv(`content/dataset-v18/kiffeurs-${nom}-v18.csv`);
const sources=new Map(csv('sources').map(s=>[s.source_id,s.url]));
const liens=csv('event-sources').filter(s=>s.source_role==='HISTORICAL');
const idsExistants=new Set(Object.values(selection).flat());
const events: EvenementFun[]=[...idsExistants].sort().map(id=>{
  const e=parId.get(id);
  if(!e?.playable||!e.start_year)throw new Error(`Événement existant absent ou non jouable : ${id}`);
  const urls=[...new Set(liens.filter(l=>l.event_id===id).map(l=>sources.get(l.source_id)).filter((s):s is string=>Boolean(s)))];
  if(!urls.length)throw new Error(`Date sans source historique : ${id}`);
  return {...e,nouveau:false,sources:urls,preuve:'Réemploi du relevé KFFR et des sources historiques du dataset v18 ; pas de modification globale ni de nouvelle certification primaire.',alias:[]};
});
const associations=Object.entries(selection).flatMap(([pack_id,ids])=>ids.map((event_id,i)=>({pack_id,event_id,position:i+1})));
for(const [i,a] of ajouts.entries()){
  const id=`EVT-${2100+i}`;
  if(parId.has(id))throw new Error(`Collision événement : ${id}`);
  const precision=a.jour?'DAY':a.mois?'MONTH':'YEAR';
  if(!/^https:\/\//.test(a.source)||![1,2,3].includes(a.niveau)||!a.description||!a.preuve)throw new Error(`Ajout incomplet : ${id}`);
  events.push({id,title:a.titre,titre_question:null,event_type:'POINT',precision,date_status:'EXACT',playable:true,playable_mode:precision,
    importance:3,difficulty:a.niveau+1,niveau:a.niveau,source_status:'SUPPORTED_B',start_year:a.annee,start_month:a.mois,start_day:a.jour,
    end_year:null,end_month:null,end_day:null,date_text:[a.jour,a.mois,a.annee].filter(v=>v!==null).join('/'),description:a.description,
    nouveau:true,sources:[a.source],preuve:a.preuve,alias:a.alias});
  associations.push({pack_id:a.pack_id,event_id:id,position:associations.filter(r=>r.pack_id===a.pack_id).length+1});
}
const manifeste={statut:'PROPOSE_A_VALIDER_AVANT_MIGRATION',date_audit:'2026-10-15',packs:packs.map((p,i)=>{
  const ids=new Set(associations.filter(a=>a.pack_id===p.id).map(a=>a.event_id)),es=events.filter(e=>ids.has(e.id));
  if(es.length<30)throw new Error(`${p.title} : moins de 30 questions`);
  const compte=(liste:EvenementFun[],inverse=false)=>Object.fromEntries(['YEAR','MONTH','DAY'].map((d,i)=>{
    const candidats=liste.filter(e=>i===0||(e.start_month!==null&&(i===1||e.start_day!==null)));
    return [d,inverse?new Set(candidats.map(e=>[e.start_year,...(i>=1?[e.start_month]:[]),...(i===2?[e.start_day]:[])].join('/'))).size:candidats.length];
  }));
  return {...p,parent_id:null,position:112+i,fun:true,n:[1,2,3].map(n=>compte(es.filter(e=>e.niveau<=n))),
    inverse:[1,2,3].map(n=>compte(es.filter(e=>e.niveau<=n),true)),niveaux:[1,2,3].map(n=>es.filter(e=>e.niveau===n).length),
    nouveaux:es.filter(e=>e.nouveau).length};
}),events,associations};
writeFileSync('content/fun/manifeste.json',JSON.stringify(manifeste,null,2)+'\n');
// Ne conserver dans Git que les lignes réutilisées, après audit complet de 2 001 événements.
writeFileSync('content/fun/audit-base-2026-10-15.json',JSON.stringify({date:'2026-10-15',project:'bskyfdjwcdvzhlugtknb',total_audite:2001,
  events:audit.events.filter(e=>idsExistants.has(e.id))},null,2)+'\n');
const cellule=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
const inventaire=[['pack','event_id','origine','titre','annee','mois','jour','precision','niveau','description','sources','preuve'],
  ...associations.map(a=>{const e=events.find(e=>e.id===a.event_id)!;return [packs.find(p=>p.id===a.pack_id)!.title,e.id,e.nouveau?'AJOUT_PROPOSE':'EXISTANT',
    e.titre_question??e.title,e.start_year,e.start_month,e.start_day,e.precision,e.niveau,e.description,e.sources.join(' ; '),e.preuve];})];
writeFileSync('content/fun/inventaire.csv',inventaire.map(l=>l.map(cellule).join(',')).join('\n')+'\n');
const resume=['| Pack | Total | Nouveaux | D / I / E | Année / Mois / Jour | Inverse (jour, dates distinctes) |',
  '| --- | ---: | ---: | --- | --- | ---: |',...manifeste.packs.map(p=>`| ${p.title} | ${p.n[2].YEAR} | ${p.nouveaux} | ${p.niveaux.join(' / ')} | ${Object.values(p.n[2]).join(' / ')} | ${p.inverse[2].DAY} |`)];
writeFileSync('content/fun/effectifs.md',resume.join('\n')+'\n');
console.log(`${events.length} événements uniques, ${events.filter(e=>e.nouveau).length} ajouts proposés, ${associations.length} associations.\n${resume.join('\n')}`);
