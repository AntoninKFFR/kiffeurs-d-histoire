// Contrôles locaux : l'inventaire historique vient du commit de phase 3, jamais du stock courant.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { lireCsv, type LigneCsv } from "../csv";

export const PHASE3_SHA = "41060638e7c3e75f89669d68ecc7c5734f0627d0";
const BASE_MAIN = "a4759cea8bebd66003c2d69592bf8fd5af24b264";
const dossier = "content/illustrations";
export const sha256 = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const git = (args: string[]) => execFileSync("git", args, { maxBuffer: 16 * 1024 * 1024 });
const blobsImmuables = new Map<string, Map<string, Buffer>>();
function blobsSvg(sha: string, fichiers: string[]) {
  const cache = blobsImmuables.get(sha); if (cache) return cache;
  const sortie = execFileSync("git", ["cat-file", "--batch"], {
    input: fichiers.map(n => `${sha}:${dossier}/${n}\n`).join(""), maxBuffer: 16 * 1024 * 1024,
  });
  const resultat = new Map<string, Buffer>(); let position = 0;
  for (const n of fichiers) {
    const fin = sortie.indexOf(10, position); assert(fin >= position);
    const header = sortie.subarray(position, fin).toString("utf8");
    const match = /^\S+ blob (\d+)$/.exec(header); assert(match, `Blob SVG absent : ${sha}/${n}`);
    const taille = Number(match[1]); position = fin + 1;
    resultat.set(n, sortie.subarray(position, position + taille)); position += taille + 1;
  }
  assert.equal(position, sortie.length); blobsImmuables.set(sha, resultat); return resultat;
}

export function svgHistoriques(sha = PHASE3_SHA) {
  return git(["ls-tree", "-r", "--name-only", sha, dossier]).toString("utf8").trim().split("\n")
    .filter(n => n.endsWith(".svg")).map(n => n.split("/").at(-1)!).sort();
}

export function inventairePhase4() {
  const cheminEvenements = "docs/phase-3-92/illustrations-par-evenement.csv";
  const cheminCartes = "docs/phase-3-92/illustrations-par-carte.csv";
  // Aucun recalcul selon les fichiers générés : les 203 besoins restent immuables.
  for (const path of [cheminEvenements, cheminCartes])
    assert.equal(readFileSync(path, "utf8").replaceAll("\r\n", "\n"), git(["show", `${PHASE3_SHA}:${path}`]).toString("utf8"), `Inventaire phase 3 modifié : ${path}`);
  const evenements = lireCsv(cheminEvenements), cartes = lireCsv(cheminCartes);
  const historiques = new Set(svgHistoriques());
  assert.equal(evenements.length, 285); assert.equal(new Set(evenements.map(e => e.event_id)).size, 285);
  assert.equal(cartes.length, 292); assert.equal(new Set(cartes.map(c => c.card_id)).size, 292);
  const corpus = [...lireCsv("content/pedagogie/cartes-completions.csv"), ...lireCsv("content/pedagogie/cartes-sous-chapitres.csv")];
  assert.deepEqual(cartes.map(c => `${c.card_id}/${c.event_id}`).sort(), corpus.map(c => `${c.card_id}/${c.event_id}`).sort());
  for (const e of evenements) {
    assert.match(e.event_id, /^EVT-\d{4}$/);
    const existait = historiques.has(`${e.event_id}.svg`);
    assert.equal(e.illustration_existante, existait ? "oui" : "non", e.event_id);
    assert.equal(e.nouvelle_illustration_requise, existait ? "non" : "oui", e.event_id);
    assert.equal(e.svg_reutilisable, existait ? `${dossier}/${e.event_id}.svg` : "", e.event_id);
    assert.deepEqual(e.card_ids.split(";").sort(), cartes.filter(c => c.event_id === e.event_id).map(c => c.card_id).sort());
    for (const c of cartes.filter(c => c.event_id === e.event_id))
      for (const [key, value] of Object.entries(e)) assert.equal(c[key], value, `${c.card_id}/${key}`);
    for (const ref of e.references_DA.split(";").filter(Boolean)) assert(historiques.has(ref), `Référence DA absente : ${ref}`);
  }
  const nouveaux = evenements.filter(e => e.nouvelle_illustration_requise === "oui");
  const reutilises = evenements.filter(e => e.illustration_existante === "oui");
  assert.equal(nouveaux.length, 203); assert.equal(reutilises.length, 82);
  return { evenements, cartes, nouveaux, reutilises };
}

/** Protège les 331 anciens contre les deux bases ; autorise exclusivement les 203 noms inventoriés. */
export function verifierIntegriteStockPhase4({ exigerComplet = true } = {}) {
  const anciens = svgHistoriques(), baseMain = svgHistoriques(BASE_MAIN), inventaire = inventairePhase4();
  assert.equal(anciens.length, 331); assert.deepEqual(anciens, baseMain);
  const phase3 = blobsSvg(PHASE3_SHA, anciens), main = blobsSvg(BASE_MAIN, baseMain);
  const empreintes = anciens.map(n => {
    const path = `${dossier}/${n}`, before = sha256(phase3.get(n)!);
    assert.equal(before, sha256(main.get(n)!), `Écart entre bases : ${n}`);
    assert.equal(sha256(readFileSync(path)), before, `Ancien SVG modifié : ${n}`);
    return { fichier: path, sha256_main: before, sha256_phase3: before, identique: "oui" };
  });
  const actuels = readdirSync(dossier).filter(n => n.endsWith(".svg")).sort();
  const attendus = [...anciens, ...inventaire.nouveaux.map(e => `${e.event_id}.svg`)].sort();
  assert(actuels.every(n => attendus.includes(n)), "SVG hors inventaire phase 4");
  if (exigerComplet) { assert.equal(actuels.length, 534); assert.deepEqual(actuels, attendus); }
  return { anciens, empreintes, actuels, ...inventaire };
}

const palette = new Set(["#f3f2ec", "#1d2a3a", "#b08a3e", "#8a2f2b", "#7e8c7a"]);
const formes = new Set(["svg", "g", "rect", "path", "circle", "ellipse", "line", "polyline", "polygon"]);
const { JSDOM } = createRequire(import.meta.url)("jsdom");
export function verifierSvgPhase4(texte: string, event = "SVG") {
  assert(Buffer.byteLength(texte) <= 8192, `${event} : poids >8192`);
  assert.doesNotMatch(texte, /<!DOCTYPE|<!ENTITY|<\?|<!--|\b(?:EVT-\d|event_id|sources|supabase)|url\(/i);
  const dom = new JSDOM(texte, { contentType: "image/svg+xml" });
  const xml = dom.window.document as Document, root = xml.documentElement;
  try {
    assert.equal(root.localName, "svg"); assert.equal(root.namespaceURI, "http://www.w3.org/2000/svg");
    assert.equal(root.getAttribute("viewBox"), "0 0 160 120");
    assert.equal(root.getAttribute("width"), "160"); assert.equal(root.getAttribute("height"), "120");
    assert.equal(root.querySelector(":scope > rect")?.getAttribute("fill"), "#f3f2ec");
    const groupe = root.querySelector(":scope > g");
    assert.equal(groupe?.getAttribute("stroke"), "#1d2a3a");
    assert.equal(groupe?.getAttribute("stroke-width"), "2");
    assert.equal(groupe?.getAttribute("stroke-linejoin"), "round"); assert.equal(groupe?.getAttribute("stroke-linecap"), "round");
    for (const element of Array.from(xml.querySelectorAll("*"))) {
      assert(formes.has(element.localName) && element.namespaceURI === root.namespaceURI, `${event} : élément interdit ${element.tagName}`);
      for (const a of Array.from(element.attributes)) {
        assert(!/^on/i.test(a.localName) && !["href", "style", "id", "class"].includes(a.localName), `${event} : attribut interdit ${a.name}`);
        assert(!a.namespaceURI || a.name === "xmlns", `${event} : attribut namespacé ${a.name}`);
        if (["fill", "stroke"].includes(a.localName)) assert(a.value === "none" || palette.has(a.value), `${event} : couleur ${a.value}`);
      }
    }
    for (const couleur of texte.match(/#[a-fA-F0-9]{3,8}\b/g) ?? []) assert(palette.has(couleur), `${event} : couleur ${couleur}`);
    assert.equal(root.textContent?.trim(), "", `${event} : texte embarqué`);
  } finally { dom.window.close(); }
}

export function verifierCopiesIllustrations(cartes: LigneCsv[]) {
  const anciens = new Map(lireCsv("content/pedagogie/cartes-v1.csv").map(c => [c.card_id, c]));
  const enfants = lireCsv("content/pedagogie/cartes-sous-chapitres.csv");
  const copies = enfants.filter(c => c.source_card_id); assert.equal(copies.length, 61);
  for (const c of copies) {
    const origin = anciens.get(c.source_card_id); assert(origin);
    for (const key of Object.keys(origin).filter(k => !["card_id", "chapter_id", "sort_order"].includes(k))) assert.equal(c[key], origin[key], `${c.card_id}/${key}`);
    assert.equal(cartes.find(i => i.card_id === c.card_id)?.event_id, origin.event_id, `${c.card_id} : copie SVG infidèle`);
  }
}

export function verifierPhase4() {
  const p = verifierIntegriteStockPhase4(), hashes = new Set(p.anciens.map(n => sha256(readFileSync(`${dossier}/${n}`))));
  verifierCopiesIllustrations(p.cartes);
  let poids = 0;
  for (const e of p.nouveaux) {
    const svg = readFileSync(`${dossier}/${e.event_id}.svg`, "utf8"); verifierSvgPhase4(svg, e.event_id);
    const hash = sha256(svg); assert(!hashes.has(hash), `${e.event_id} : dessin dupliqué`); hashes.add(hash);
    poids += Buffer.byteLength(svg);
  }
  return { reference: PHASE3_SHA, svg_anciens_inchanges: 331, svg_nouveaux: 203, svg_reutilises: 82, evenements: 285, cartes: 292, svg_total: 534, poids_nouveaux_octets: poids, validation_humaine: "en attente" };
}

export function verifierPlanchesPhase4() {
  const lignes = lireCsv("docs/phase-4-92/planches-index.csv"), p = inventairePhase4();
  assert.equal(lignes.length, 203); assert.equal(new Set(lignes.map(l => l.event_id)).size, 203);
  assert.deepEqual(lignes.map(l => l.event_id).sort(), p.nouveaux.map(e => e.event_id).sort());
  assert.equal(new Set(lignes.map(l => l.planche)).size, 17);
  assert.equal(new Set(lignes.map(l => `${l.planche}/${l.position}`)).size, 203);
  const references = JSON.parse(readFileSync(`${dossier}/reference-validee.json`, "utf8")) as { svg: Record<string, string> };
  for (const [i, l] of lignes.entries()) {
    assert.equal(l.event_id, p.nouveaux[i].event_id, "Ordre du lot documentaire");
    assert.equal(l.planche, String(Math.floor(i / 12) + 1)); assert.equal(l.position, String(i % 12 + 5));
    assert.equal(l.fichier_png, `docs/phase-4-92/planche-${l.planche.padStart(2, "0")}.png`);
    assert(existsSync(l.fichier_png), `Planche absente : ${l.fichier_png}`);
    const png = readFileSync(l.fichier_png);
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 1056);
    assert.equal(l.title, [...lireCsv("content/pedagogie/cartes-completions.csv"), ...lireCsv("content/pedagogie/cartes-sous-chapitres.csv")].find(c => c.event_id === l.event_id)?.title);
    const refs = l.references_DA.split(/\s*;\s*/).filter(Boolean);
    assert.equal(refs.length, 4); assert.equal(new Set(refs).size, 4);
    for (const ref of refs) assert(ref in references.svg, `Référence non validée : ${ref}`);
  }
  const md = readFileSync("docs/phase-4-92/planches.md", "utf8");
  const pagesMd = md.split("\n").filter(l => /^\| \[\d+\]/.test(l));
  assert.equal(pagesMd.length, 17);
  const ids = pagesMd.flatMap(l => l.split("|")[2].match(/EVT-\d{4}/g) ?? []);
  assert.deepEqual(ids.sort(), p.nouveaux.map(e => e.event_id).sort(), "Index Markdown incomplet ou dupliqué");
  for (const [i, page] of pagesMd.entries()) {
    const lot = lignes.filter(l => l.planche === String(i + 1));
    assert.deepEqual(page.split("|")[3].match(/EVT-\d{4}\.svg/g), lot[0].references_DA.split(";"));
    assert(lot.every(l => l.references_DA === lot[0].references_DA));
    const natif = readFileSync(`docs/phase-4-92/natif-${String(i + 1).padStart(2, "0")}.png`);
    assert.equal(natif.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(natif.readUInt32BE(16), 800); assert.equal(natif.readUInt32BE(20), 808);
  }
  return { planches: 17, images_indexees: 203 };
}

export async function verifierRendusPhase4() {
  const lignes = lireCsv("docs/phase-4-92/rendus-svg.csv"), p = inventairePhase4();
  assert.equal(lignes.length, 285); assert.equal(new Set(lignes.map(l => l.event_id)).size, 285);
  assert.deepEqual(lignes.map(l => l.event_id).sort(), p.evenements.map(e => e.event_id).sort());
  const { default: sharp } = await import("sharp");
  for (const l of lignes) {
    assert.equal(l.fichier_svg, `${dossier}/${l.event_id}.svg`);
    const svg = readFileSync(l.fichier_svg), png = await sharp(svg).resize(160, 120).png().toBuffer();
    assert.equal(l.sha256_svg, sha256(svg)); assert.equal(l.sha256_png_natif, sha256(png));
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 160); assert.equal(info.height, 120); assert.equal(l.largeur, "160"); assert.equal(l.hauteur, "120");
    let pixels = 0;
    for (let i = 0; i < data.length; i += info.channels)
      if (Math.abs(data[i] - 243) + Math.abs(data[i + 1] - 242) + Math.abs(data[i + 2] - 236) > 30) pixels++;
    assert(pixels > 100, `${l.event_id} : rendu vide`); assert.equal(Number(l.pixels_dessines), pixels);
    assert.equal(l.statut, p.nouveaux.some(e => e.event_id === l.event_id) ? "en attente de validation humaine" : "réutilisation intacte");
  }
  return { svg_rendus_natifs: 285 };
}

export async function verifierReproductibilitePhase4() {
  const { scenesPhase4 } = await import("./phase4-scenes");
  const { genererSVG } = await import("./phase4-generer");
  const p = inventairePhase4();
  assert.deepEqual(scenesPhase4.map(s => s.event).sort(), p.nouveaux.map(e => e.event_id).sort());
  for (const s of scenesPhase4) assert.equal(genererSVG(s), readFileSync(`${dossier}/${s.event}.svg`, "utf8"), `Régénération différente : ${s.event}`);
  return { svg_reproductibles: 203 };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/phase4-verifier.ts")) {
  void (async () => console.log(JSON.stringify({ ...verifierPhase4(), ...await verifierReproductibilitePhase4(),
    ...(process.argv.includes("--exiger-planches") ? { ...verifierPlanchesPhase4(), ...await verifierRendusPhase4() } : {}) }, null, 2)))()
    .catch(error => { console.error(error); process.exitCode = 1; });
}
