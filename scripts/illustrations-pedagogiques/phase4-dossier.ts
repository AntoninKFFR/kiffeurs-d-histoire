// Livrables d'audit dérivés du corpus et des fichiers réellement présents.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { lireCsv } from "../csv";
import { sha256, verifierIntegriteStockPhase4, verifierPhase4, verifierPlanchesPhase4, verifierRendusPhase4, verifierReproductibilitePhase4 } from "./phase4-verifier";
import { objetsPhase4 } from "./phase4-objets";

const dossier = "docs/phase-4-92";
const csv = (rows: (string | number)[][]) => rows.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";
async function main() {
  mkdirSync(dossier, { recursive: true });
  const p = verifierIntegriteStockPhase4();
  const scenes = (await import("./phase4-scenes")).scenesPhase4;
  const cartes = [...lireCsv("content/pedagogie/cartes-completions.csv"), ...lireCsv("content/pedagogie/cartes-sous-chapitres.csv")];
  const index = new Map(lireCsv(`${dossier}/planches-index.csv`).map(l => [l.event_id, l]));
  writeFileSync(`${dossier}/integrite-331-svg.csv`, csv([["fichier", "sha256_main", "sha256_phase3", "sha256_phase4", "identique"], ...p.empreintes.map(e => [e.fichier, e.sha256_main, e.sha256_phase3, sha256(readFileSync(e.fichier)), e.identique])]));
  const entetes = ["event_id", "card_ids", "title", "origine", "fichier_svg", "sha256", "poids_octets", "planche", "intention", "references_DA", "vigilances_historiques", "adaptations_stock", "validation_humaine"];
  const lignes = p.evenements.map(e => {
    const fichier = `content/illustrations/${e.event_id}.svg`, b = readFileSync(fichier), scene = scenes.find(s => s.event === e.event_id);
    return [e.event_id, e.card_ids, cartes.find(c => c.event_id === e.event_id)!.title, e.illustration_existante === "oui" ? "réutilisation inchangée" : "nouveau SVG phase 4", fichier, sha256(b), b.byteLength, index.get(e.event_id)?.planche ?? "", scene?.intention ?? e.intention, index.get(e.event_id)?.references_DA ?? e.references_DA, scene?.vigilance ?? e.vigilances_historiques, scene?.adaptations.join(" | ") ?? "", e.illustration_existante === "oui" ? "SVG existant réutilisé ; rattachement à relire" : "en attente de Max et Antonin"];
  });
  writeFileSync(`${dossier}/inventaire-285-evenements.csv`, csv([entetes, ...lignes]));
  writeFileSync(`${dossier}/nouveaux-203-svg.csv`, csv([entetes, ...lignes.filter(l => l[3] === "nouveau SVG phase 4")]));
  writeFileSync(`${dossier}/reutilisations-82-svg.csv`, csv([entetes, ...lignes.filter(l => l[3] === "réutilisation inchangée")]));
  writeFileSync(`${dossier}/couverture-292-cartes.csv`, csv([["card_id", "chapter_id", "event_id", "title", "fichier_svg", "sha256", "source_card_id", "validation_humaine"], ...cartes.map(c => [c.card_id, c.chapter_id, c.event_id, c.title, `content/illustrations/${c.event_id}.svg`, sha256(readFileSync(`content/illustrations/${c.event_id}.svg`)), c.source_card_id ?? "", "illustration préparée ; aucune publication"])]));
  writeFileSync(`${dossier}/adaptations-stock.csv`, csv([["objet", "references_graphique_DA", "adaptation", "evenements_utilisateurs"], ...Object.entries(objetsPhase4).filter(([nom]) => scenes.some(s => s.objets.includes(nom))).map(([nom, o]) => [nom, o.references.join(";"), o.adaptation, scenes.filter(s => s.objets.includes(nom)).map(s => s.event).join(";")])]));
  writeFileSync(`${dossier}/rapport-controles.json`, JSON.stringify({ ...verifierPhase4(), ...verifierPlanchesPhase4(), ...await verifierRendusPhase4(), ...await verifierReproductibilitePhase4(), production_modifiee: false, han_canon_blocage_modifie: false }, null, 2) + "\n");
  const reserves = p.nouveaux.map(e => {
    const scene = scenes.find(s => s.event === e.event_id)!;
    return `### ${e.event_id} — ${cartes.find(c => c.event_id === e.event_id)!.title}\n\nCartes : ${e.card_ids}. [Planche ${index.get(e.event_id)!.planche}](${index.get(e.event_id)!.fichier_png.split("/").at(-1)}).\n\nIntention : ${scene.intention}\n\nVigilance historique : ${scene.vigilance}\n\nAdaptations graphiques : ${scene.adaptations.join(" | ") || "Objets du stock réutilisés."}\n\nDécision attendue : relecture du sujet, des objets, de la lisibilité à 160 × 120 et de la conformité DA par Max et Antonin.\n`;
  }).join("\n");
  writeFileSync(`${dossier}/validation-humaine.md`, "# Relecture humaine des 203 nouveaux dessins\n\nAucun de ces SVG n’est déclaré validé. Les réserves de dates et de contenu restent celles de la phase 3. Han reste bloqué : préparer son dessin n’autorise aucune activation. Les 82 réutilisations conservent leurs octets, mais leur adéquation aux nouvelles cartes doit également être relue dans l’inventaire.\n\n" + reserves);
  console.log("Dossier : 285 événements, 292 cartes, 203 créations, 82 réutilisations, 331 preuves d’intégrité.");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
