import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAPITRES, cheminChapitre } from "../src/lib/apprendre/catalogue";
import { chargerCartes, chargerCartesSousChapitres } from "./import-cartes";
import { chargerCompletions } from "./completions-pedagogiques";
import { verifierIntegriteStockPhase4 } from "./illustrations-pedagogiques/phase4-verifier";
import { verifierCanonHan117 } from './han-117';

const cartes = chargerCartes();
const enfants=chargerCartesSousChapitres('content/pedagogie/cartes-sous-chapitres.csv'),completions=chargerCompletions('content/pedagogie/cartes-completions.csv');
const publie=CHAPITRES.some(c=>c.parent_id);
const completionActive=CHAPITRES.some(c=>c.edition_active==='completion-v1');
const han=CHAPITRES.filter(c=>['THM-047','THM-048','THM-049'].includes(c.id));
assert([0,3].includes(han.length),'Groupe Han publié partiellement');
if(han.length)verifierCanonHan117();
const racine = ".next/server/app";
const accueil = readFileSync(`${racine}/apprendre.html`, "utf8");
const prive = /event_id|EVT-\d+|official_wording|date_status|date_precision|["\\]sources["\\]/;
assert.doesNotMatch(accueil, prive);
assert(!accueil.includes('card_id'), "L’accueil ne charge aucune carte");
let total = 0;
let dediees = 0, motifs = 0;
for (const chapitre of CHAPITRES) {
  const chemin = cheminChapitre(chapitre);
  if(chapitre.etat==='actif')assert(accueil.includes(chemin), `Lien actif absent : ${chemin}`);
  const html = readFileSync(`${racine}${chemin}.html`, "utf8");
  const rsc = readFileSync(`${racine}${chemin}.rsc`, "utf8");
  assert.doesNotMatch(html + rsc, prive);
  assert(html.includes("Me tester sur ce chapitre"));
  const attendues = (chapitre.parent_id?enfants:chapitre.edition_active?[...cartes,...completions]:cartes).filter((c) => c.chapter_id === chapitre.id);
  const ids = new Set((html + rsc).match(/CARD-[a-z0-9-]+/g));
  assert.deepEqual([...ids].sort(), attendues.map((c) => c.card_id).sort(), `Seulement les cartes du chapitre ${chapitre.id}`);
  for (const c of attendues) for (const source of c.sources) assert(!html.includes(source) && !rsc.includes(source), `Source divulguée : ${c.card_id}`);
  // Lire la projection réellement transmise, sans se fier à un manifeste de couverture.
  const donnees = [...rsc.matchAll(/"card_id":"(CARD-[a-z0-9-]+)"/g)];
  assert.equal(donnees.length, attendues.length, `Projection du chapitre ${chapitre.id}`);
  for (let i = 0; i < donnees.length; i++) {
    const tranche = rsc.slice(donnees[i].index, donnees[i + 1]?.index ?? rsc.length);
    const flag = /"illustrationDediee":(true|false)/.exec(tranche)?.[1];
    const carte = attendues.find(c => c.card_id === donnees[i][1])!;
    assert.equal(flag, carte.event_id ? "true" : "false", `Disponibilité publique de ${carte.card_id}`);
    if (flag === "true") dediees++; else motifs++;
  }
  total += attendues.length;
}
assert.equal(CHAPITRES.length, publie?56+han.length:41);
assert.equal(total, publie?(completionActive?593:489)+(han.length?24:0):325);
assert.deepEqual({ dediees, motifs }, { dediees: publie?(completionActive?571:467)+(han.length?24:0):303, motifs: 22 });
const trace = JSON.parse(readFileSync(`${racine}/apprendre/[niveau]/[chapitre]/page.js.nft.json`, "utf8")) as { files: string[] };
const svgTraces = new Set(trace.files.filter(n => /content\/illustrations\/EVT-\d{4}\.svg$/.test(n)).map(n => n.split("/").at(-1)));
const stock = verifierIntegriteStockPhase4();
assert.equal(stock.anciens.length, 331);
assert.equal(stock.nouveaux.length, 203);
assert.equal(svgTraces.size, 534, "Assets disponibles pour recalculer le booléen lors de l'ISR");
assert.deepEqual([...svgTraces].sort(), stock.actuels);
assert(trace.files.some(n => n.endsWith("content/pedagogie/cartes-v1.csv")));
const routes = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8")).routes;
assert(routes["/apprendre"]);
for (const c of CHAPITRES) assert.equal(routes[cheminChapitre(c)].initialRevalidateSeconds, 3600);
console.log(`OK : /apprendre et ${CHAPITRES.length} chapitres statiques, ${total} cartes, cache 3600 s, HTML/RSC sans métadonnées internes. Chaque page n’embarque que ses propres cartes.`);
