// Extension du modèle #66 : les planches historiques restent intactes.
import sharp from "sharp";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { lireCsv } from "../csv.ts";

const dossier = "docs/phase-4-92";
const inventaire = lireCsv("docs/phase-3-92/illustrations-par-evenement.csv");
const nouveaux = inventaire.filter(i => i.nouvelle_illustration_requise === "oui");
const cartes = [...lireCsv("content/pedagogie/cartes-completions.csv"), ...lireCsv("content/pedagogie/cartes-sous-chapitres.csv")];
const baseline = JSON.parse(readFileSync("content/illustrations/reference-validee.json", "utf8"));
assert.equal(nouveaux.length, 203);
assert.equal(new Set(nouveaux.map(i => i.event_id)).size, 203);
mkdirSync(dossier, { recursive: true });
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const hash = b => createHash("sha256").update(b).digest("hex");
const csv = rows => rows.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";
function lignes(texte, max = 40) {
  const resultat = [""];
  for (const mot of texte.split(" ")) {
    const fin = resultat.length - 1;
    if ((resultat[fin] + " " + mot).trim().length > max) resultat.push(mot);
    else resultat[fin] = (resultat[fin] + " " + mot).trim();
  }
  return resultat;
}
const titre = event => cartes.find(c => c.event_id === event).title;
const rendus = new Map();
const preuves = [["event_id", "fichier_svg", "sha256_svg", "largeur", "hauteur", "pixels_dessines", "sha256_png_natif", "statut"]];
for (const i of inventaire) {
  const fichier = `content/illustrations/${i.event_id}.svg`, svg = readFileSync(fichier);
  const png = await sharp(svg).resize(160, 120).png().toBuffer();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 160); assert.equal(info.height, 120);
  let pixels = 0;
  for (let p = 0; p < data.length; p += info.channels)
    if (Math.abs(data[p] - 243) + Math.abs(data[p + 1] - 242) + Math.abs(data[p + 2] - 236) > 30) pixels++;
  assert(pixels > 100, `${i.event_id} : rendu vide`);
  rendus.set(i.event_id, png);
  preuves.push([i.event_id, fichier, hash(svg), 160, 120, pixels, hash(png), i.nouvelle_illustration_requise === "oui" ? "en attente de validation humaine" : "réutilisation intacte"]);
}
const indexCsv = [["event_id", "planche", "fichier_png", "position", "title", "references_DA"]];
const indexMd = ["| Planche | Nouveaux SVG | Références comparées |", "| --- | --- | --- |"];

async function produirePlanche(vignettes, page, natif) {
  const largeur = natif ? 800 : 1200, cellule = natif ? 200 : 300;
  const ligne = natif ? 190 : 252, imageL = natif ? 160 : 240, imageH = natif ? 120 : 180;
  const composites = [{ input: Buffer.from(`<svg width="${largeur}" height="48"><rect width="${largeur}" height="48" fill="#f3f2ec"/><text x="18" y="30" font-family="Arial" font-size="${natif ? 15 : 20}" fill="#1d2a3a">Phase 4 #92 — planche ${page + 1} — 4 références validées / ${vignettes.length - 4} nouveaux SVG${natif ? " · 160 × 120" : ""}</text></svg>`), left: 0, top: 0 }];
  for (let i = 0; i < vignettes.length; i++) {
    const v = vignettes[i], x = (i % 4) * cellule, y = 48 + Math.floor(i / 4) * ligne;
    const png = rendus.get(v.event) ?? await sharp(readFileSync(`content/illustrations/${v.event}.svg`)).resize(160, 120).png().toBuffer();
    composites.push({ input: natif ? png : await sharp(readFileSync(`content/illustrations/${v.event}.svg`)).resize(imageL, imageH).png().toBuffer(), left: x + (cellule - imageL) / 2, top: y + 5 });
    const label = `<svg width="${cellule}" height="65"><rect width="${cellule}" height="65" fill="#f3f2ec"/><text x="15" y="17" font-family="Arial" font-size="${natif ? 12 : 14}" font-weight="bold" fill="${v.reference ? "#7e8c7a" : "#8a2f2b"}">${v.reference ? "VALIDÉ · " : "NOUVEAU · "}${esc(v.event + ".svg")}</text>${lignes(v.titre, natif ? 27 : 40).slice(0, 3).map((l, k) => `<text x="15" y="${34 + k * 14}" font-family="Arial" font-size="${natif ? 10 : 12}" fill="#1d2a3a">${esc(l)}</text>`).join("")}</svg>`;
    composites.push({ input: Buffer.from(label), left: x, top: y + imageH + 5 });
  }
  const nom = `${natif ? "natif-" : "planche-"}${String(page + 1).padStart(2, "0")}.png`;
  await sharp({ create: { width: largeur, height: 48 + Math.ceil(vignettes.length / 4) * ligne, channels: 3, background: "#f3f2ec" } }).composite(composites).png().toFile(`${dossier}/${nom}`);
  return nom;
}
for (let page = 0; page * 12 < nouveaux.length; page++) {
  const lot = nouveaux.slice(page * 12, (page + 1) * 12);
  const candidates = [...new Set(lot.flatMap(i => i.references_DA.split(/\s*;\s*/).filter(Boolean)))];
  for (const secours of ["EVT-0018.svg", "EVT-0623.svg", "EVT-0173.svg", "EVT-0003.svg"])
    if (!candidates.includes(secours)) candidates.push(secours);
  const refs = candidates.filter(n => baseline.svg[n]).slice(0, 4);
  assert.equal(refs.length, 4);
  const vignettes = [...refs.map(f => ({ event: f.replace(/\.svg$/, ""), reference: true, titre: "Référence validée — comparaison DA" })), ...lot.map(i => ({ event: i.event_id, reference: false, titre: titre(i.event_id) }))];
  const nom = await produirePlanche(vignettes, page, false);
  await produirePlanche(vignettes, page, true);
  lot.forEach((i, position) => indexCsv.push([i.event_id, page + 1, `${dossier}/${nom}`, position + 5, titre(i.event_id), refs.join(";")]));
  indexMd.push(`| [${page + 1}](${nom}) · [160 × 120](natif-${String(page + 1).padStart(2, "0")}.png) | ${lot.map(i => i.event_id).join(", ")} | ${refs.join(", ")} |`);
}
const composites = [];
for (let i = 0; i < nouveaux.length; i++) {
  const event = nouveaux[i].event_id, x = i % 7 * 180, y = Math.floor(i / 7) * 170;
  composites.push({ input: rendus.get(event), left: x + 10, top: y });
  const label = `<svg width="180" height="50"><rect width="180" height="50" fill="#f3f2ec"/><text x="10" y="12" font-family="Arial" font-weight="bold" font-size="10" fill="#8a2f2b">${event}</text>${lignes(titre(event), 28).slice(0, 2).map((l, k) => `<text x="10" y="${25 + k * 12}" font-family="Arial" font-size="9" fill="#1d2a3a">${esc(l)}</text>`).join("")}</svg>`;
  composites.push({ input: Buffer.from(label), left: x, top: y + 120 });
}
await sharp({ create: { width: 1260, height: Math.ceil(nouveaux.length / 7) * 170, channels: 3, background: "#f3f2ec" } }).composite(composites).png().toFile(`${dossier}/vue-ensemble-203.png`);
writeFileSync(`${dossier}/planches-index.csv`, csv(indexCsv));
writeFileSync(`${dossier}/rendus-svg.csv`, csv(preuves));
writeFileSync(`${dossier}/planches.md`, "# Planches de comparaison — phase 4\n\nLes 203 nouveaux SVG apparaissent exactement une fois dans l’index principal ci-dessous et dans `planches-index.csv`. Les quatre premières vignettes de chaque planche sont des références validées intactes. Le format comparatif reprend #66 (1 200 px, quatre colonnes, dessins de 240 × 180). Les versions natives montrent les mêmes dessins à 160 × 120 pour la relecture à petite taille ; elles ne constituent pas un second inventaire. Toutes les nouvelles images attendent la validation humaine de Max et Antonin.\n\n[Vue d’ensemble des 203 dessins](vue-ensemble-203.png). Les identifiants et titres figurent uniquement dans les PNG, jamais dans les SVG.\n\n" + indexMd.join("\n") + "\n");
console.log("203 dessins indexés ; 17 planches comparatives, 17 natives et une vue d’ensemble ; 285 SVG réellement rendus.");
