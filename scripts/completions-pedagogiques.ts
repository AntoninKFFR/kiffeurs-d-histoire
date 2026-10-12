import path from "node:path";
import { existsSync,readFileSync } from "node:fs";
import { lireCsv,type LigneCsv } from "./csv";
import { chargerStructure,empreinteLigne } from "./structure-pedagogique";
import { connecterCartes, estUrlLocale, validerCartes } from "./import-cartes";

/** Plan exact de complétion, aucune génération de contenu. */
export function planCompletions(racine = ".") {
  const s = chargerStructure(racine);
  const parents = new Set(s.sous_chapitres.map(c => c.parent_id));
  const cards = lireCsv(path.join(racine, "content/pedagogie/cartes-v1.csv"));
  const links = lireCsv(path.join(racine, "content/dataset-v18/kiffeurs-curriculum-links-v18.csv"));
  const plan = s.chapitres_historiques.filter(c => !parents.has(c.id)).map(c => ({
    chapter_id: c.id, version: "completion-v1", event_ids: [...new Set(links.filter(l => l.theme_id === c.id && l.event_id).map(l => l.event_id))]
      .filter(id => !cards.some(card => card.chapter_id === c.id && card.event_id === id)).sort(),
  })).filter(c => c.event_ids.length);
  if (plan.length !== 27 || plan.reduce((n,c) => n+c.event_ids.length,0) !== 104) throw new Error("Plan de complétion à réauditer : effectifs 27/104 modifiés");
  return plan;
}

export function chargerCompletions(fichier: string, racine = ".") {
  const plan = planCompletions(racine), lignes = lireCsv(fichier);
  const allowed = new Set(plan.map(c => c.chapter_id));
  const old = new Set(lireCsv(path.join(racine, "content/pedagogie/cartes-v1.csv")).map(c => c.card_id));
  if (lignes.some(c => old.has(c.card_id) || !plan.some(p => p.chapter_id === c.chapter_id && p.event_ids.includes(c.event_id))))
    throw new Error("Complétion hors plan ou modifiant une carte historique");
  const dataset = path.join(racine, "content/dataset-v18");
  const ledger=path.join(racine,'content/pedagogie/cartes-publiees.json'),s=chargerStructure(racine);
  if(existsSync(ledger)) s.empreintes_cartes_historiques={...s.empreintes_cartes_historiques,...JSON.parse(readFileSync(ledger,'utf8')) as Record<string,string>};
  return validerCartes(lignes,lireCsv(path.join(dataset,"kiffeurs-events-v18.csv")),lireCsv(path.join(dataset,"kiffeurs-themes-v18.csv")),
    lireCsv(path.join(dataset,"kiffeurs-curriculum-links-v18.csv")),s,allowed);
}

/** Empreintes privées pour les futurs builds/réimports après correction du canon.
 * Chaque ligne doit être exactement la carte figée dans une édition publiée exportée localement.
 */
export function empreintesCartesPubliees(lignes:LigneCsv[],snapshots:Record<string,unknown>[],initiales:ReadonlySet<string>=new Set()) {
  const resultat:Record<string,string>={},expected=new Map(snapshots.map(c=>[c.card_id,c]));
  for(const l of lignes) {
    const e=expected.get(l.card_id);if(!e)continue;
    const normalisee=Object.fromEntries(Object.keys(e).map(k=>[k,
      ['start_year','start_month','start_day','end_year','end_month','end_day'].includes(k)?l[k]?Number(l[k]):null
        :k==='sort_order'?Number(l[k]):k==='event_id'?l[k]||null
          :['key_concepts','sources'].includes(k)?l[k].split(';').map(v=>v.trim()):l[k]]));
    const stable=(x:Record<string,unknown>)=>JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b,'en'))));
    if(stable(normalisee)!==stable(e))throw new Error('CSV différent de la complétion publiée : '+l.card_id);
    resultat[l.card_id]=empreinteLigne(l);
  }
  if([...expected.keys()].some(id=>typeof id==='string'&&!initiales.has(id)&&!resultat[id]))throw new Error('CSV des complétions publiées incomplet');
  return resultat;
}

/** Staging reproductible du lot complet supplémentaire de chaque chapitre ; aucun appel de publication. */
export async function importerCompletionsLocales(fichier: string,url: string,cle: string) {
  if (!estUrlLocale(url)) throw new Error("Complétions réservées à la pile locale");
  const cards = chargerCompletions(fichier), db = connecterCartes(url,cle);
  const preuves:{chapter_id:string;version:string;fingerprint:string}[]=[];
  for (const chapter of new Set(cards.map(c => c.chapter_id))) {
    const {data,error} = await db.rpc("stage_pedagogical_completion",{p_chapter_id:chapter,p_cards:cards.filter(c => c.chapter_id === chapter)});
    if (error) throw new Error(`Complétion ${chapter} : ${error.message}`);
    preuves.push({chapter_id:chapter,version:'completion-v1',fingerprint:data as string});
  }
  return preuves;
}
