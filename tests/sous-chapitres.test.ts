import { describe,it,expect } from "vitest";
import { readFileSync } from "node:fs";
import { chargerStructure, projectionStructure, validerStructure, appliquerEtatsPublies, conserverLiensPedagogiques, type EtatPublie } from "../scripts/structure-pedagogique";
import { lireCsv } from "../scripts/csv";
import { validerCartes, validerFiliationCartes } from "../scripts/import-cartes";
import { CHAPITRES,CHAPITRES_ACTIFS,trouverChapitre,cheminChapitre } from "@/lib/apprendre/catalogue";
import { lireChoix,relanceEnregistree } from "@/lib/solo/choix";
import { progressionDepuisLignes } from "@/lib/progression/types";

const s=chargerStructure(), cards=lireCsv("content/pedagogie/cartes-v1.csv"), themes=lireCsv("content/dataset-v18/kiffeurs-themes-v18.csv"),
  links=lireCsv("content/dataset-v18/kiffeurs-curriculum-links-v18.csv"),events=lireCsv("content/dataset-v18/kiffeurs-events-v18.csv");
const validate=(v:typeof s)=>validerStructure(v,themes,links,cards);
const states=():EtatPublie[]=>projectionStructure(s).map(c=>({...c,published:!c.parent_id}));
describe("structure pédagogique additive #92",()=>{
  it("conserve chaque ancienne URL et propose 18 IDs stables, 59 stockés et 53 actifs à terme",()=>{
    const old=JSON.parse(readFileSync("src/lib/apprendre/catalogue.json","utf8")) as typeof CHAPITRES;
    expect(CHAPITRES_ACTIFS).toHaveLength(41);expect(s.sous_chapitres).toHaveLength(18);
    expect(projectionStructure(s)).toHaveLength(59);
    for(const c of old){expect(trouverChapitre(c.niveauSlug,c.slug)).toMatchObject(c);expect(cheminChapitre(c)).toBe(`/apprendre/${c.niveauSlug}/${c.slug}`);}
    const all=states().map(c=>({...c,etat:c.parent_id?"actif" as const:s.sous_chapitres.some(x=>x.parent_id===c.id)?"historique" as const:"actif" as const,published:true}));
    const projected=appliquerEtatsPublies(s,all);
    expect(projected.filter(c=>c.etat==='actif')).toHaveLength(53);expect(projected.filter(c=>c.etat==='historique')).toHaveLength(6);
  });
  it("conserve les partitions retenues et la rubrique spécifique de chaque objet de S5",()=>{
    const counts=Object.fromEntries([...new Set(s.sous_chapitres.map(c=>c.parent_id))].map(p=>[p,s.sous_chapitres.filter(c=>c.parent_id===p).map(c=>c.event_ids.length)]));
    expect(counts).toEqual({'THM-006':[11,8,5],'THM-012':[7,14],'THM-016':[17,7,9,14,8],'THM-017':[9,15,5,10],'THM-024':[17,9],'THM-025':[15,8]});
    expect(s.sous_chapitres.find(c=>c.id==='THM-056')!.rubriques).toEqual({genocide:['EVT-0101','EVT-0102'],diplomatie_alliee:['EVT-0511','EVT-0517'],fin_de_guerre:['EVT-0518','EVT-0519','EVT-0520','EVT-0521']});
    expect(s.sous_chapitres.find(c=>c.event_ids.includes('EVT-0115'))!.id).toBe('THM-060');
  });
  it("ne publie aucun enfant ni réponse dans le catalogue ou le choix scolaire",()=>{
    const publicRegistry=JSON.parse(readFileSync('src/lib/apprendre/structure.json','utf8')) as typeof CHAPITRES;
    expect(publicRegistry).toHaveLength(41);expect(publicRegistry.some(c=>c.etat==='inactif')).toBe(false);
    for(const c of s.sous_chapitres){expect(CHAPITRES.some(x=>x.id===c.id)).toBe(false);expect(trouverChapitre(c.niveauSlug,c.slug)).toBeUndefined();expect(lireChoix(new URLSearchParams({mode:'scolaire',difficulte:'YEAR',chapitres:c.id}))).toBeNull();}
    expect(JSON.stringify(projectionStructure(s))).not.toMatch(/EVT-|"(?:event_ids|start_year|end_year|sources|empreintes)"\s*:/);
    expect(s.sous_chapitres.every(c=>c.etat==='inactif'&&c.validation_contenu===null&&c.validation_illustrations===null)).toBe(true);
  });
  it("refuse un manifeste incomplet, un changement de carte et un blocage Han retiré",()=>{
    const lost=structuredClone(s);lost.sous_chapitres.pop();expect(()=>validate(lost)).toThrow(/effectifs/);
    const han=structuredClone(s);han.sous_chapitres.find(c=>c.id==='THM-049')!.blocages=[];expect(()=>validate(han)).toThrow(/Han/);
    const changed=cards.map((c,i)=>i?c:{...c,body:c.body+' modifié'});expect(()=>validerStructure(s,themes,links,changed)).toThrow(/historiques/);
  });
  it("refuse l'activation manuelle du manifeste et les états non attestés/partiels",()=>{
    const activated=structuredClone(s);activated.sous_chapitres[0].etat='actif';expect(()=>validate(activated)).toThrow(/activation/);
    const partial=states();partial.find(c=>c.id==='THM-047')!.etat='actif';partial.find(c=>c.id==='THM-047')!.published=true;expect(()=>appliquerEtatsPublies(s,partial)).toThrow(/partielle|doublon/);
    const unproven=states();unproven[0].published=false;expect(()=>appliquerEtatsPublies(s,unproven)).toThrow(/incompatible/);
    expect(()=>appliquerEtatsPublies(s,states().slice(1))).toThrow(/incomplet/);
  });
  it("représente le rollback sans disparition des URLs et résultats des enfants publiés",()=>{
    const rollback=states().map(c=>({...c,etat:c.parent_id==='THM-017'?'historique' as const:c.etat,published:c.parent_id==='THM-017'||c.published}));
    const out=appliquerEtatsPublies(s,rollback);expect(out.filter(c=>c.etat==='actif')).toHaveLength(41);expect(out.filter(c=>c.etat==='historique')).toHaveLength(4);
  });
  it("préserve les liens publiés à la réimportation, sans doublon ni réattribution",()=>{
    const old=[{chapter_id:'THM-017',event_id:'EVT-0115'},{chapter_id:'THM-060',event_id:'EVT-0115'}];
    const fresh=[{chapter_id:'THM-017',event_id:'EVT-0114'}];
    const merged=conserverLiensPedagogiques(fresh,old,new Set(['THM-017','THM-060']));
    expect(merged).toHaveLength(3);expect(conserverLiensPedagogiques(fresh,merged,new Set(['THM-017','THM-060']))).toEqual(merged);
  });
  it("ne déduit aucun acquis des enfants et conserve la relance du parent",()=>{
    const p=progressionDepuisLignes([{chapter_id:'THM-017',discovered_at:'2026-10-12',best_accuracy:83,best_difficulty:'MONTH',tests_count:7}],new Set(projectionStructure(s).map(c=>c.id)));
    expect(p['THM-017']).toEqual({decouvert:true,precision:83,difficulte:'MONTH',tests:7});for(const c of s.sous_chapitres)expect(p[c.id]).toBeUndefined();
    expect(relanceEnregistree({chapterIds:['THM-017'],chapterTest:true,difficulty:'YEAR',questionCount:10})).toContain('test=chapitre');
  });
  it("adapte le plafond sans affaiblir les dates, textes, identifiants ou ordres",()=>{
    // Fixture technique : reprise d'un contexte existant, jamais une nouvelle carte éditoriale.
    const source=cards.find(c=>c.card_id==='CARD-016-nazisme')!, group=cards.filter(c=>c.chapter_id==='THM-016');
    const thirteen=[...group,{...source,card_id:'CARD-016-contexte-fixture',sort_order:'13'}]
      .sort((a,b)=>Number(a.start_year)-Number(b.start_year)||Number(a.start_month)-Number(b.start_month)||Number(a.start_day)-Number(b.start_day))
      .map((c,i)=>({...c,sort_order:String(i+1)}));
    expect(validerCartes(thirteen,events,themes,links)).toHaveLength(13);
    expect(()=>validerCartes(thirteen.map(c=>c.sort_order==='13'?{...c,body:'texte insuffisant'}:c),events,themes,links)).toThrow();
    const child={...cards.find(c=>c.card_id==='CARD-006-auguste')!,card_id:'CARD-047-fixture',chapter_id:'THM-047',sort_order:'1',source_card_id:'CARD-006-auguste'};
    expect(()=>validerFiliationCartes([child],cards,s)).not.toThrow();expect(()=>validerFiliationCartes([{...child,source_card_id:'CARD-017-fin-urss'}],cards,s)).toThrow(/filiation/i);
  });
  it("conserve les dates de la version historique même si le canon est corrigé plus tard",()=>{
    const updated=events.map(e=>e.event_id==='EVT-0115'?{...e,start_year:'2099'}:e);
    expect(validerCartes(cards,updated,themes,links,s).find(c=>c.card_id==='CARD-017-fin-urss')!.start_year).toBe(1991);
    expect(()=>validerCartes(cards,updated,themes,links)).toThrow(/date/);
  });
});
