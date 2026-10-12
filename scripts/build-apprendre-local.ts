// Build autonome CI : serveur HTTP éphémère simulant uniquement la projection
// publique de la RPC. Aucun fallback dans l'application ou accès à KFFR.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { chargerCartes } from "./import-cartes";
import { cartePublique } from "../src/lib/pedagogie";

const cartes = chargerCartes().map(cartePublique);
const server = createServer((req, res) => {
  const url = new URL(req.url!, "http://localhost");
  if (req.method !== "GET" || !["/rest/v1/rpc/get_chapter_cards","/rest/v1/rpc/get_chapter_cards_version"].includes(url.pathname) || req.headers["accept-profile"] !== "histoire") {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(cartes.filter((c) => c.chapter_id === url.searchParams.get("p_chapter_id"))));
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
