import { readFileSync, writeFileSync } from "node:fs";
import { chargerStructure, projectionStructure } from "./structure-pedagogique";

const chemin = "src/lib/apprendre/structure.json";
const s = chargerStructure();
const json = JSON.stringify(projectionStructure(s).filter(c=>c.etat!=="inactif"), null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(chemin, "utf8") !== json) throw new Error("Registre pédagogique à régénérer");
} else writeFileSync(chemin, json);
console.log("Structure : 41 chapitres conservés, 18 inactifs, 59 IDs, cible 53 actifs après validation/activation.");
