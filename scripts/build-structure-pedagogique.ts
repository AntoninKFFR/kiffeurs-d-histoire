import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { appliquerEtatsPublies, chargerStructure, projectionStructure, type EtatPublie } from "./structure-pedagogique";

const chemin = "src/lib/apprendre/structure.json";
const s = chargerStructure();
const exportReel='content/pedagogie/etats-publies-92.json';
const registre=existsSync(exportReel)?appliquerEtatsPublies(s,JSON.parse(readFileSync(exportReel,'utf8')) as EtatPublie[]):projectionStructure(s);
if(registre.some(c=>c.parent_id==='THM-006'&&c.etat!=='inactif'))throw new Error('Han doit rester bloqué');
const json = JSON.stringify(registre.filter(c=>c.etat!=="inactif"), null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(chemin, "utf8").replace(/\r\n/g,"\n") !== json) throw new Error("Registre pédagogique à régénérer");
} else writeFileSync(chemin, json);
console.log(`Structure : ${registre.length} IDs conservés, ${registre.filter(c=>c.etat!=='inactif').length} routes publiques, états ${existsSync(exportReel)?'exportés de production':'de préparation'}.`);
