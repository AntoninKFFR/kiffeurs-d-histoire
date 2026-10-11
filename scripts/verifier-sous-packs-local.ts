// Build et relecture de la vraie route Next avec une API de fixtures locale.
// Aucune base, migration ou clé KFFR ; durée bornée, hors suites complètes.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { chargerCartes } from "./import-cartes";
import { cartePublique } from "../src/lib/pedagogie";
import type { PackJouable } from "../src/lib/solo/packs";
import sport from "../content/sport/packs-proposes.json";
import catalogue from "../src/lib/solo/catalogue.json";
const ux = process.argv.includes("--ux");
const sportDemande = ux || process.argv.includes("--sport");
const require = createRequire(import.meta.url);
const cartes = chargerCartes().map(cartePublique);
const pack = (id: string,titre: string,parent_id: string | null,n: number): PackJouable =>
  ({ id,titre,parent_id,description: "",comptes: { YEAR:n,MONTH:n,DAY:n },b:[1800,2000] });
// Même nombre de lignes et mêmes titres sur deux lignes que le cas réel échoué en CI.
const packs89 = [pack("COL-0069","Guerres et batailles",null,203),
  pack("W89","Première Guerre mondiale","COL-0069",30),
  pack("A89","Conflits avant 1800 (démo)","COL-0069",52),
  pack("C89","Conflits depuis 1800 (démo)","COL-0069",137),
  pack("V89","Sous-pack vide (démo)","COL-0069",0),...Array.from({length:23},(_,i)=>pack(`F89-${i}`,`Pack indépendant ${i+1}`,null,10))];
const packs: PackJouable[] = sportDemande ? catalogue.packs.map((p) => ({
  id:p.id,titre:p.titre,description:p.description,parent_id:p.parent_id ?? null,
  comptes:p.n[2],b:p.b as [number,number],
})) : packs89;
const lancements: { rpc: string; niveau: number; precision: string; longueur: number; inverse: boolean; periodes?: boolean; pack?: string }[] = [];
const parties = new Map<string, { total: number; inverse: boolean; periodes?: boolean; precision: string }>();
const api = createServer(async (req,res) => {
  const url = new URL(req.url!,"http://127.0.0.1");
  res.setHeader("Content-Type","application/json");
  const chunks=[]; for await (const c of req) chunks.push(c);
  const args = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  if (url.pathname.endsWith("get_chapter_cards")) return res.end(JSON.stringify(cartes.filter(c=>c.chapter_id===url.searchParams.get("p_chapter_id"))));
  if (url.pathname.endsWith("playable_packs")) return res.end(JSON.stringify(packs.filter(p=>!args.p_pack_id || p.id===args.p_pack_id).map(p=>{
    const s=sport.packs.find(s=>s.id===p.id);
    return sportDemande && s && args.p_direction==="inverse" ? {...p,comptes:{YEAR:s.comptes.inverse[0],MONTH:s.comptes.inverse[1],DAY:s.comptes.inverse[2]}} : p;
  })));
  if (url.pathname.endsWith("available_questions")) return res.end(JSON.stringify(packs.find(p=>p.id===args.p_pack_id)?.comptes ?? {YEAR:25,MONTH:25,DAY:25}));
  if (ux && /\/(start_game|start_mystery_game)$/.test(url.pathname)) {
    const rpc = url.pathname.split("/").at(-1)!;
    const id = `00000000-0000-4000-8000-${String(lancements.length + 1).padStart(12,"0")}`;
    const partie = { total: args.p_question_count || 100, inverse: args.p_direction === "inverse", periodes: args.p_periodes, precision: args.p_difficulty };
    parties.set(id, partie);
    lancements.push({ rpc, niveau: args.p_niveau, precision: partie.precision, longueur: args.p_question_count,
      inverse: partie.inverse, periodes: partie.periodes, pack: args.p_pack_id });
    const winner = {mode:"pack",id:"COL-0105",titre:"Sport"};
    return res.end(JSON.stringify({game_id:id,question_count:partie.total,difficulty:partie.precision,
      direction:args.p_direction,state:"playing",anonymous:true,
      ...(rpc === "start_mystery_game" ? {mystery:{winner,candidates:[winner,{mode:"theme",id:catalogue.themes[0].id,titre:catalogue.themes[0].nom}]}} : {})}));
  }
  if (ux && url.pathname.endsWith("next_question")) {
    const partie = parties.get(args.p_game_id)!;
    const timing = {question_id:"00000000-0000-4000-9000-000000000001",position:1,question_count:partie.total,difficulty:partie.precision,
      asked_at:new Date().toISOString(),server_time:new Date().toISOString(),deadline:new Date(Date.now()+120000).toISOString()};
    return res.end(JSON.stringify({...timing,...(partie.inverse ? {date:{year:1914,month:8,day:3},date_label:"3 août 1914",date_precision:"DAY"}
      : {title:"Événement de relecture",image_path:null,...(partie.periodes ? {periode:true} : {})})}));
  }
  res.end("null");
});
async function main() {
await new Promise<void>(r=>api.listen(3188,"127.0.0.1",r));
const address=api.address(); assert(address && typeof address!=="string");
const port=3189;
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${address.port}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture-locale-89",NEXT_PUBLIC_SITE_URL:`http://127.0.0.1:${port}`};
let app: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  if(!process.argv.includes("--sans-build")) {
    const build=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"build"],{env,stdio:"inherit"});
    await new Promise<void>((resolve,reject)=>{build.on("error",reject);build.on("exit",code=>code===0?resolve():reject(new Error(`Build : ${code}`)));});
  }
  app=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"start","--hostname","127.0.0.1","--port",String(port)],{env,stdio:["ignore","pipe","pipe"]});
  for(let i=0;i<40;i++) {
    try { await fetch(`http://127.0.0.1:${port}/solo`); break; }
    catch { if(i===39) throw new Error("Serveur Next absent"); await new Promise(r=>setTimeout(r,250)); }
  }
  browser=await chromium.launch({headless:true});
  const output=process.env.KFFR_SOUS_PACKS_CAPTURES ?? (ux ? "docs/captures/choix-ux" : sportDemande ? "docs/captures/issue-90" : "docs/captures/issue-89"); mkdirSync(output,{recursive:true});
  const mesures=[];
  for(const [width,height] of [[1280,800],[1366,768],[375,812]]) {
    for(const inverse of [false,true]) {
      const page=await browser.newPage({viewport:{width,height}});
      const errors: string[]=[]; page.on("pageerror",e=>errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/${inverse?"inverse":"solo"}`);
      if (ux) {
        await expect(page.getByRole("group",{name:"Niveau"}).getByRole("button",{name:/^Toutes les questions/})).toHaveAttribute("aria-pressed","true");
        await expect(page.getByRole("group",{name:"Questions période"})).toHaveCount(0);
        await expect(page.getByRole("button",{name:/Thème mystère/})).toHaveCount(0);
        await expect(page.getByRole("button",{name:"Jouer",exact:true})).toBeEnabled();
        await page.screenshot({path:`${output}/general-${inverse?"inverse":"classique"}-${width}.png`,fullPage:true});
      }
      await page.getByRole("group",{name:"Niveau"}).getByRole("button",{name:/^Toutes les questions/}).click();
      await page.getByRole("group",{name:"Longueur de la partie"}).getByRole("button",{name:/^5 questions/}).click();
      await page.getByRole("button",{name:"Pack",exact:true}).click();
      const parent=page.getByRole("button",{name:sportDemande ? /^Jouer tout Sport/ : /^Jouer tout Guerres et batailles/});
      await parent.focus(); await page.keyboard.press("Enter");
      await expect(page.getByRole("heading",{name:"Packs disponibles"})).toBeVisible();
      if (ux) {
        await expect(parent).toHaveAttribute("aria-pressed","true");
        await expect(page.locator('input[name="c"]')).toHaveValue(/pack=COL-0105/);
        await expect(page.getByRole("button",{name:/^Football/})).toHaveCount(0);
        await page.screenshot({path:`${output}/parent-${inverse?"inverse":"classique"}-${width}.png`,fullPage:true});
      }
      await page.getByRole("button",{name:sportDemande ? "Voir les sous-thèmes de Sport" : "Voir les sous-thèmes de Guerres et batailles"}).click();
      await expect(page.getByRole("heading",{name:sportDemande ? "Sport" : "Guerres et batailles",exact:true})).toBeFocused();
      if(sportDemande && inverse) await expect(page.getByRole("button",{name:/^Sports mécaniques/})).toBeDisabled();
      if(!sportDemande) await expect(page.getByRole("button",{name:/^Sous-pack vide/})).toBeDisabled();
      // Mesurer aussi avant toute sélection, quand le statut et les longueurs sont en attente.
      if(ux) await page.screenshot({path:`${output}/sous-themes-${inverse?"inverse":"classique"}-${width}.png`,fullPage:true});
      if(width>=1000) {
        const hauteur = await page.evaluate(()=>document.documentElement.scrollHeight);
        assert(hauteur<=height+2,`Défilement PC avant sélection : ${width}×${height}, inverse=${inverse}, document ${hauteur}`);
      }
      await page.getByRole("button",{name:sportDemande ? /^Football/ : /^Conflits depuis 1800/}).click();
      await expect(page.getByRole("button",{name:"Jouer",exact:true})).toBeEnabled();
      await page.evaluate(()=>document.fonts.ready);
      const mesure=await page.evaluate(()=>({largeur:innerWidth,hauteur:innerHeight,documentLargeur:document.documentElement.scrollWidth,
        documentHauteur:document.documentElement.scrollHeight,jouerBas:[...document.querySelectorAll("button")].find(b=>b.textContent==="Jouer")!.getBoundingClientRect().bottom}));
      mesures.push({...mesure,inverse});
      await page.screenshot({path:`${output}/${inverse?"inverse":"classique"}-${width}.png`,fullPage:true});
      assert(mesure.documentLargeur<=width,"Débordement horizontal");
      if(width>=1000) assert(mesure.documentHauteur<=height+2,`Défilement PC : ${JSON.stringify(mesure)}`);
      if(sportDemande) {
        if(inverse) {
          await page.getByRole("group",{name:"Longueur de la partie"}).getByRole("button",{name:/^Tout/}).click();
          await expect(page.getByRole("button",{name:/^Sports mécaniques/})).toBeDisabled();
          const tennis=page.getByRole("button",{name:/^Tennis/});
          await expect(tennis).toBeEnabled(); await tennis.focus(); await page.keyboard.press("Enter");
        } else {
          const autres=page.getByRole("button",{name:/^Autres sports et exploits/});
          await autres.focus(); await page.keyboard.press("Enter");
        }
        await expect(page.getByRole("button",{name:"Jouer",exact:true})).toBeEnabled();
        if(width>=1000) assert(await page.evaluate(()=>document.documentElement.scrollHeight)<=height+2,"Défilement global après navigation au dernier sous-pack");
      }
      await page.getByRole("button",{name:/Tous les packs/}).click();
      await expect(page.getByRole("heading",{name:"Packs disponibles"})).toBeFocused();
      if(width>=1000) {
        await page.screenshot({path:`${output}/liste-${inverse?"inverse":"classique"}-${width}.png`,fullPage:true});
        const hauteurListe=await page.evaluate(()=>document.documentElement.scrollHeight);
        assert(hauteurListe<=height+2,`Défilement PC dans les 24 packs : ${hauteurListe}`);
      }
      if (ux) {
        await page.getByRole("button",{name:"Période",exact:true}).click();
        await expect(page.getByRole("button",{name:/^Antiquité/})).toBeVisible();
        await page.screenshot({path:`${output}/periode-${inverse?"inverse":"classique"}-${width}.png`,fullPage:true});
        await page.getByRole("button",{name:"Thème",exact:true}).click();
        const mystere = page.getByRole("button",{name:/Thème mystère/});
        await mystere.focus(); await page.keyboard.press("Enter");
        await expect(mystere).toHaveAttribute("aria-pressed","true");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.getByRole("group",{name:"Niveau"}).getByRole("button",{name:/^Intermédiaire/}).click();
        if(!inverse) await page.getByRole("group",{name:"Précision"}).getByRole("button",{name:/^Mois/}).click();
        await page.getByRole("group",{name:"Longueur de la partie"}).getByRole("button",{name:/^20 questions/}).click();
        await page.screenshot({path:`${output}/mystere-${inverse?"inverse":"classique"}-${width}.png`,fullPage:true});
        const mesureMystere = await page.evaluate(()=>({largeur:innerWidth,hauteur:innerHeight,
          documentLargeur:document.documentElement.scrollWidth,documentHauteur:document.documentElement.scrollHeight,
          jouerBas:[...document.querySelectorAll("button")].find(b=>b.textContent?.trim()==="Jouer")!.getBoundingClientRect().bottom}));
        assert(mesureMystere.documentLargeur<=width,"Débordement du thème mystère");
        assert(mesureMystere.jouerBas<=height+2,"Jouer hors écran");
        if(width>=1000) assert(mesureMystere.documentHauteur<=height+2,"Défilement PC des thèmes");
        mesures.push({...mesureMystere,inverse,mystere:true});
        const avant = lancements.length;
        const jouer = page.getByRole("button",{name:"Jouer",exact:true});
        await jouer.focus(); await page.keyboard.press("Enter");
        await expect(page.getByRole("dialog",{name:"Thème mystère"})).toBeVisible();
        assert.equal(lancements.length,avant+1,"Une seule création pendant la roulette");
        assert.deepEqual(lancements.at(-1),{rpc:"start_mystery_game",niveau:2,precision:inverse?"DAY":"MONTH",longueur:20,
          inverse,periodes:inverse?undefined:true,pack:null});
        await page.screenshot({path:`${output}/roulette-${inverse?"inverse":"classique"}-${width}.png`,fullPage:true});
        await page.getByRole("button",{name:"Passer",exact:true}).click();
        await expect(page).toHaveURL(/\/partie\//);
        if(!inverse) await expect(page.getByText("Début et fin",{exact:true})).toBeVisible();
        assert.equal(lancements.length,avant+1,"Aucune seconde partie après la roulette");
        const memoire = await page.evaluate((cle)=>localStorage.getItem(cle),inverse?"histoire-choix-inverse":"histoire-choix-solo");
        assert(memoire?.includes("pack=COL-0105") && memoire.includes("niveau=2") && memoire.includes("longueur=20"),"Gagnant mémorisé");
        await page.goto(`http://127.0.0.1:${port}/${inverse?"inverse":"solo"}`);
        await expect(page.getByRole("button",{name:/^Jouer tout Sport/})).toHaveAttribute("aria-pressed","true");
        await expect(page.getByRole("heading",{name:"Packs disponibles"})).toBeVisible();
        await page.getByRole("button",{name:"Jouer",exact:true}).click();
        await expect(page).toHaveURL(/\/partie\//);
        assert.equal(lancements.at(-1)?.rpc,"start_game");
        assert.equal(lancements.at(-1)?.pack,"COL-0105");
      }
      assert.equal(errors.length,0,errors.join("\n"));
      await page.close();
    }
  }
  writeFileSync(`${output}/mesures.json`,`${JSON.stringify(mesures,null,2)}\n`);
  console.log(JSON.stringify(mesures));
} finally { await browser?.close(); app?.kill(); api.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
