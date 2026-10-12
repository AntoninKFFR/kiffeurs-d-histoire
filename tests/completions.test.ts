import { expect,it } from "vitest";
import { planCompletions,empreintesCartesPubliees } from "../scripts/completions-pedagogiques";
import { chargerStructure,projectionStructure,appliquerEtatsPublies } from "../scripts/structure-pedagogique";
import { lireCsv,type LigneCsv } from "../scripts/csv";
import { validerCartes } from "../scripts/import-cartes";
import { progressionParEditions } from "@/lib/progression/types";
import { relanceEnregistree,lireChoix,filtresDepuis } from "@/lib/solo/choix";

it("compare le plan exact aux 104 manques des 27 chapitres non découpés, sans créer de nouveaux IDs",()=>{
  const plan=planCompletions(),parents=new Set(chargerStructure().sous_chapitres.map(c=>c.parent_id));
  const audit=lireCsv('docs/audit-92/cartes-manquantes-par-chapitre.csv').filter(c=>!parents.has(c.chapter_id));
  expect(plan).toHaveLength(27);expect(plan.flatMap(c=>c.event_ids)).toHaveLength(104);
  expect(plan.flatMap(c=>c.event_ids.map(id=>`${c.chapter_id}/${id}`)).sort()).toEqual(audit.map(c=>`${c.chapter_id}/${c.event_id}`).sort());
});

it("valide le format des 104 ajouts techniques sans modifier les 325 cartes ou réduire les protections",()=>{
  const cards=lireCsv('content/pedagogie/cartes-v1.csv'),events=lireCsv('content/dataset-v18/kiffeurs-events-v18.csv'),
    themes=lireCsv('content/dataset-v18/kiffeurs-themes-v18.csv'),links=lireCsv('content/dataset-v18/kiffeurs-curriculum-links-v18.csv'),s=chargerStructure(),plan=planCompletions();
  // Textes strictement repris d'anciennes cartes : fixture de contrat, aucun contenu éditorial créé.
  const additions=plan.flatMap(p=>p.event_ids.map((id):LigneCsv=>{
    const source=cards.find(c=>c.chapter_id===p.chapter_id)!,e=events.find(e=>e.event_id===id)!;
    return {...source,card_id:`CARD-${p.chapter_id.slice(4)}-fixture-${id.slice(4)}`,event_id:id,
      official_wording:links.find(l=>l.theme_id===p.chapter_id&&l.event_id===id)!.official_wording,
      ...Object.fromEntries(['start_year','start_month','start_day','end_year','end_month','end_day','date_text','date_status'].map(k=>[k,e[k]])),date_precision:e.precision};
  }).sort((a,b)=>Number(a.start_year)-Number(b.start_year)||Number(a.start_month)-Number(b.start_month)||Number(a.start_day)-Number(b.start_day))
    .map((c,i):LigneCsv=>({...c,sort_order:String(i+1)})));
  const allowed=new Set(plan.map(c=>c.chapter_id));
  expect(validerCartes(additions,events,themes,links,s,allowed)).toHaveLength(104);
  expect(()=>validerCartes(additions.map((c,i)=>i?c:{...c,start_year:'2099'}),events,themes,links,s,allowed)).toThrow(/date/);
  expect(()=>validerCartes(additions.map((c,i)=>i?c:{...c,body:'insuffisant'}),events,themes,links,s,allowed)).toThrow(/texte/);
  expect(cards).toHaveLength(325);
  const publiees=validerCartes(additions,events,themes,links,s,allowed),hashes=empreintesCartesPubliees(additions,publiees);
  const archive={...s,empreintes_cartes_historiques:{...s.empreintes_cartes_historiques,...hashes}};
  const canonCorrige=events.map(e=>e.event_id===additions[0].event_id?{...e,start_year:'2099'}:e);
  expect(validerCartes(additions,canonCorrige,themes,links,archive,allowed)).toHaveLength(104);
  expect(()=>empreintesCartesPubliees(additions.map((c,i)=>i?c:{...c,body:c.body+' changé'}),publiees)).toThrow(/différent/);
});

it("garde scores, difficulté et nombres de tests sous leur édition, avant et après rollback",()=>{
  const old=[{chapter_id:'THM-001',discovered_at:'2026-10-12',best_accuracy:83,best_difficulty:'MONTH',tests_count:7}];
  const editions=[{chapter_id:'THM-001',version:'completion-v1',discovered_at:'2026-10-12',best_accuracy:50,best_difficulty:'YEAR',tests_count:1}];
  const metadata={id:'THM-001',content_version:'legacy-v1'};
  const active=progressionParEditions(old,editions,[{...metadata,edition_active:'completion-v1'}]);
  expect(active.chapitres['THM-001']).toMatchObject({precision:50,difficulte:'YEAR',tests:1});
  expect(active.historique?.[0]).toMatchObject({version:'legacy-v1',progression:{precision:83,difficulte:'MONTH',tests:7}});
  const rollback=progressionParEditions(old,editions,[metadata]);
  expect(rollback.chapitres['THM-001']).toMatchObject({precision:83,difficulte:'MONTH',tests:7});
  expect(rollback.historique?.[0]).toMatchObject({version:'completion-v1',progression:{precision:50,difficulte:'YEAR'}});
  expect(progressionParEditions(old,[],[{...metadata,edition_active:'completion-v1'}]).chapitres).toEqual({});
});

it("conserve l'édition historique dans Rejouer et rejette les éditions non publiées",()=>{
  const replay=relanceEnregistree({chapterIds:['THM-017'],chapterTest:true,chapterVersion:'legacy-v1',difficulty:'YEAR',questionCount:10})!;
  expect(replay).toContain('edition=legacy-v1');
  expect(filtresDepuis(lireChoix(new URLSearchParams(replay))!)).toMatchObject({chapterVersion:'legacy-v1'});
  expect(lireChoix(new URLSearchParams('mode=scolaire&difficulte=YEAR&chapitres=THM-001&test=chapitre&edition=completion-v1'))).toBeNull();
});

it("exporte les métadonnées des éditions publiées sans corpus et refuse une complétion sur un parent découpé",()=>{
  const s=chargerStructure(),states=projectionStructure(s).map(c=>({...c,published:!c.parent_id,current_version:null as string|null,editions:[] as string[],edition_counts:{} as Record<string,{YEAR:number;MONTH:number;DAY:number}>}));
  const c=states.find(c=>c.id==='THM-001')!;c.current_version='completion-v1';c.editions=['completion-v1'];
  c.edition_counts={'legacy-v1':{YEAR:5,MONTH:5,DAY:5},'completion-v1':{YEAR:7,MONTH:7,DAY:7}};
  const projected=appliquerEtatsPublies(s,states);expect(projected.find(c=>c.id==='THM-001')).toMatchObject({edition_active:'completion-v1',editions:['completion-v1']});
  expect(projected).toHaveLength(59);expect(JSON.stringify(projected)).not.toContain('EVT-');
  states.find(c=>c.id==='THM-006')!.editions=['completion-v1'];expect(()=>appliquerEtatsPublies(s,states)).toThrow(/Éditions/);
});
