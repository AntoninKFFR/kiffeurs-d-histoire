// Lecture HTTP seulement, sur le build local ou un aperçu Vercel explicitement fourni.
// Usage : npx tsx scripts/illustrations-pedagogiques/verifier-routes.ts http://localhost:3174
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { lireCsv } from "../csv";
import { verifierIntegriteStockPhase4 } from "./phase4-verifier";
async function verifier() {
const origine = process.argv[2];
assert(origine && /^https?:\/\//.test(origine), "Fournir l'origine locale ou de l'aperçu à vérifier.");
const cartes = lireCsv("content/pedagogie/cartes-v1.csv");
const svgFiles = readdirSync("content/illustrations").filter(n => n.endsWith(".svg"));
const stock = verifierIntegriteStockPhase4();
assert.equal(stock.anciens.length, 331); assert.equal(stock.nouveaux.length, 203); assert.equal(svgFiles.length, 534);
let dediees = 0, fallbacks = 0;
// Petits groupes pour ne pas saturer le serveur ni les fonctions d'aperçu.
for (let debut = 0; debut < cartes.length; debut += 8) {
  await Promise.all(cartes.slice(debut, debut + 8).map(async carte => {
    const response = await fetch(`${origine}/api/pedagogie/illustration/${carte.card_id}`, { redirect: "manual" });
    assert.equal(response.status, 200, carte.card_id);
    assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/);
    assert.equal(response.headers.get("location"), null);
    assert.doesNotMatch(JSON.stringify([...response.headers]), /EVT-\d|event_id|sources|content\/illustrations/);
    const svg = await response.text();
    assert.doesNotMatch(svg, /EVT-\d|event_id|supabase|sources|content\/illustrations|<script|<foreignObject|\bhref\s*=/);
    if (carte.event_id) {
      assert.equal(svg, readFileSync(`content/illustrations/${carte.event_id}.svg`, "utf8").replace(/<!--[\s\S]*?-->/g, ""), carte.card_id);
      assert(!svg.includes("translate(56 36)"), carte.card_id); dediees++;
    } else { assert(svg.includes("translate(56 36)"), carte.card_id); fallbacks++; }
  }));
}
assert.equal(dediees, 303); assert.equal(fallbacks, 22);
for (const id of ["inconnu", "EVT-0210", "CARD-inconnue"]) {
  const response = await fetch(`${origine}/api/pedagogie/illustration/${id}`, { redirect: "manual" });
  assert.equal(response.status, 404); assert.equal(await response.text(), "");
}
// La trace est locale : les fichiers de contenu restent dans la fonction serveur.
const trace = JSON.parse(readFileSync(".next/server/app/api/pedagogie/illustration/[cardId]/route.js.nft.json", "utf8")) as { files: string[] };
const svgTraces = trace.files.filter(n => /content\/illustrations\/EVT-\d{4}\.svg$/.test(n)).map(n => n.split("/").at(-1)!);
// Turbopack peut tracer deux chemins relatifs équivalents sous Windows.
assert.deepEqual([...new Set(svgTraces)].sort(), svgFiles.sort());
assert(!trace.files.some(n => /illustrations-pedagogiques|generalisation-inventaire|reference-validee/.test(n)), "Atelier embarqué dans le bundle serveur.");
console.log(`OK ${origine} : 325 routes exactes (303 dédiées, 22 motifs), 3 refus 404, aucun identifiant/source/chemin transmis, 534 SVG tracés côté serveur (331 intacts + 203 phase 4).`);
}
void verifier().catch(erreur => { console.error(erreur); process.exitCode = 1; });
