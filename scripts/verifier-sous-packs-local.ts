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
const sportDemande = process.argv.includes("--sport");
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
  const output=process.env.KFFR_SOUS_PACKS_CAPTURES ?? (sportDemande ? "docs/captures/issue-90" : "docs/captures/issue-89"); mkdirSync(output,{recursive:true});
  const mesures=[];
  for(const [width,height] of [[1280,800],[1366,768],[375,812]]) {
    for(const inverse of [false,true]) {
      const page=await browser.newPage({viewport:{width,height}});
      const errors: string[]=[]; page.on("pageerror",e=>errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/${inverse?"inverse":"solo"}`);
      await page.getByRole("group",{name:"Niveau"}).getByRole("button",{name:/^Expert/}).click();
      await page.getByRole("group",{name:"Longueur de la partie"}).getByRole("button",{name:/^5 questions/}).click();
      await page.getByRole("button",{name:"Pack",exact:true}).click();
      const parent=page.getByRole("button",{name:sportDemande ? /^Sport\s/ : /^Guerres et batailles/});
      await parent.focus(); await page.keyboard.press("Enter");
      await expect(page.getByRole("heading",{name:sportDemande ? "Sport" : "Guerres et batailles",exact:true})).toBeFocused();
      if(sportDemande && inverse) await expect(page.getByRole("button",{name:/^Sports mécaniques/})).toBeDisabled();
      if(!sportDemande) await expect(page.getByRole("button",{name:/^Sous-pack vide/})).toBeDisabled();
      // Mesurer aussi avant toute sélection, quand le statut et les longueurs sont en attente.
      if(width>=1000) assert(await page.evaluate(()=>document.documentElement.scrollHeight)<=height+2,"Défilement PC avant sélection");
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
      assert.equal(errors.length,0,errors.join("\n"));
      await page.close();
    }
  }
  writeFileSync(`${output}/mesures.json`,`${JSON.stringify(mesures,null,2)}\n`);
  console.log(JSON.stringify(mesures));
} finally { await browser?.close(); app?.kill(); api.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
