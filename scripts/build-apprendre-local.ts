// Build autonome CI : serveur HTTP éphémère simulant uniquement la projection
// publique de la RPC. Aucun fallback dans l'application ou accès à KFFR.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { chargerCartes } from "./import-cartes";
import { chargerCartesSousChapitres } from "./import-cartes";
import { chargerCompletions } from "./completions-pedagogiques";
import { readFileSync } from "node:fs";
import { cartePublique } from "../src/lib/pedagogie";

const cartes = chargerCartes().map(cartePublique);
const enfants=chargerCartesSousChapitres('content/pedagogie/cartes-sous-chapitres.csv').map(cartePublique);
const completions=chargerCompletions('content/pedagogie/cartes-completions.csv').map(cartePublique);
const registre=JSON.parse(readFileSync('src/lib/apprendre/structure.json','utf8')) as {id:string;parent_id:string|null;etat:string;edition_active?:string}[];
const server = createServer((req, res) => {
  const url = new URL(req.url!, "http://localhost");
  if (req.method !== "GET" || !["/rest/v1/rpc/get_chapter_cards","/rest/v1/rpc/get_chapter_cards_version"].includes(url.pathname) || req.headers["accept-profile"] !== "histoire") {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader("Content-Type", "application/json");
  const id=url.searchParams.get('p_chapter_id'),u=registre.find(c=>c.id===id),version=url.searchParams.get('p_version')??u?.edition_active;
  const source=u?.parent_id?enfants:version==='completion-v1'?[...cartes,...completions]:cartes;
  let result=u&&u.etat!=='inactif'?source.filter(c=>c.chapter_id===id):[];
  if(version==='completion-v1')result=result.sort((a,b)=>(a.start_year??Infinity)-(b.start_year??Infinity)||(a.start_month??0)-(b.start_month??0)||(a.start_day??0)-(b.start_day??0)||a.card_id.localeCompare(b.card_id)).map((c,i)=>({...c,sort_order:i+1}));
  res.end(JSON.stringify(result));
});
server.listen(0, "127.0.0.1", () => {
  const adresse = server.address();
  if (!adresse || typeof adresse === "string") throw new Error("Serveur fixture absent");
  const child = spawn(process.execPath, [createRequire(import.meta.url).resolve("next/dist/bin/next"), "build"], {
    stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${adresse.port}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publique" },
  });
  child.on("error", (error) => { console.error(error); server.close(); process.exitCode = 1; });
  child.on("exit", (code) => { server.close(); process.exitCode = code ?? 1; });
});
