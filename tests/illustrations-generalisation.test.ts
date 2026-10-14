// @vitest-environment jsdom
import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { lireCsv } from "../scripts/csv";
import reference from "../content/illustrations/reference-validee.json";
import { verifierIntegriteStockPhase4 } from "../scripts/illustrations-pedagogiques/phase4-verifier";

it("conserve les 120 références validées et couvre tous les 211 événements encore manquants", () => {
  const fichiers = readdirSync("content/illustrations").filter(n => n.endsWith(".svg"));
  const stock = verifierIntegriteStockPhase4();
  expect(Object.keys(reference.svg)).toHaveLength(120);
  expect(stock.anciens).toHaveLength(331);
  expect(stock.nouveaux).toHaveLength(203);
  expect(fichiers).toHaveLength(534);
  for (const [nom, empreinte] of Object.entries(reference.svg)) {
    expect(createHash("sha256").update(readFileSync(`content/illustrations/${nom}`)).digest("hex"), nom).toBe(empreinte);
  }
  const inventaire = lireCsv("content/illustrations/generalisation-inventaire.csv");
  const cartes = lireCsv("content/pedagogie/cartes-v1.csv");
  const historiques = new Set(Object.keys(reference.svg));
  const manquants = [...new Set(cartes.filter(c => c.event_id && !historiques.has(`${c.event_id}.svg`)).map(c => c.event_id))].sort();
  expect(inventaire).toHaveLength(211);
  expect(inventaire.map(i => i.event_id).sort()).toEqual(manquants);
  expect(inventaire.map(i => i.fichier_svg).sort()).toEqual(stock.anciens.filter(f => !historiques.has(f)).sort());
});

it("livre des SVG XML lisibles, sobres, distincts et conformes à l'enveloppe du stock", () => {
  const palette = new Set(["#f3f2ec", "#1d2a3a", "#b08a3e", "#8a2f2b", "#7e8c7a"]);
  const empreintes = new Set<string>();
  for (const ligne of lireCsv("content/illustrations/generalisation-inventaire.csv")) {
    const texte = readFileSync(`content/illustrations/${ligne.fichier_svg}`, "utf8");
    expect(Buffer.byteLength(texte), ligne.event_id).toBeLessThanOrEqual(8192);
    const xml = new DOMParser().parseFromString(texte, "image/svg+xml");
    expect(xml.querySelector("parsererror"), ligne.event_id).toBeNull();
    expect(xml.documentElement.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(xml.documentElement.getAttribute("viewBox")).toBe("0 0 160 120");
    expect(xml.documentElement.getAttribute("width")).toBe("160");
    expect(xml.documentElement.getAttribute("height")).toBe("120");
    expect(xml.querySelector("svg > rect")?.getAttribute("fill")).toBe("#f3f2ec");
    const groupe = xml.querySelector("svg > g");
    expect(groupe?.getAttribute("stroke")).toBe("#1d2a3a");
    expect(groupe?.getAttribute("stroke-width")).toBe("2");
    expect(groupe?.getAttribute("stroke-linejoin")).toBe("round");
    expect(groupe?.getAttribute("stroke-linecap")).toBe("round");
    expect(xml.querySelector("text,image,script,foreignObject,filter,linearGradient,radialGradient,animate,style")).toBeNull();
    expect(texte).not.toMatch(/\bon\w+\s*=|\bhref\s*=|<!DOCTYPE|EVT-\d|event_id|url\(/);
    for (const couleur of texte.match(/#[a-f0-9]{6}/g) ?? []) expect(palette.has(couleur)).toBe(true);
    const empreinte = createHash("sha256").update(texte).digest("hex");
    expect(empreintes.has(empreinte), `Dessin dupliqué : ${ligne.event_id}`).toBe(false);
    empreintes.add(empreinte);
    for (const ref of ligne.references_DA.split(" ; ")) expect(Object.keys(reference.svg)).toContain(ref);
  }
});

it("documente exactement les 227 cartes remplacées, les 22 fallbacks sans événement et les mutualisations", () => {
  const cartes = lireCsv("content/pedagogie/cartes-v1.csv");
  const nouvelles = lireCsv("content/illustrations/generalisation-cartes.csv");
  const couverture = lireCsv("content/illustrations/generalisation-couverture-cartes.csv");
  const fallbacks = lireCsv("docs/illustrations/generalisation/fallbacks.csv");
  expect(nouvelles).toHaveLength(227); expect(fallbacks).toHaveLength(22);
  expect(couverture).toHaveLength(325);
  expect(couverture.map(c => c.card_id).sort()).toEqual(cartes.map(c => c.card_id).sort());
  expect(couverture.filter(c => c.fichier_svg)).toHaveLength(303);
  for (const ligne of couverture) {
    expect(cartes.find(c => c.card_id === ligne.card_id)).toMatchObject({ chapter_id: ligne.chapter_id, event_id: ligne.event_id, title: ligne.title });
    expect(ligne.fichier_svg).toBe(ligne.event_id ? `${ligne.event_id}.svg` : "");
    expect(ligne.illustration_existante).toBe(Object.keys(reference.svg).includes(ligne.fichier_svg) ? "oui" : "non");
  }
  const nouveaux = new Set(lireCsv("content/illustrations/generalisation-inventaire.csv").map(i => i.event_id));
  expect(nouvelles.map(c => c.card_id).sort()).toEqual(cartes.filter(c => nouveaux.has(c.event_id)).map(c => c.card_id).sort());
  for (const ligne of nouvelles) {
    expect(cartes.find(c => c.card_id === ligne.card_id)).toMatchObject({ event_id: ligne.event_id, title: ligne.title });
    expect(ligne.illustration_existante).toBe("non"); expect(ligne.nouveau_fichier_svg).toBe(`${ligne.event_id}.svg`);
  }
  expect(fallbacks.map(c => c.card_id).sort()).toEqual(cartes.filter(c => !c.event_id).map(c => c.card_id).sort());
  const partages = lireCsv("docs/illustrations/generalisation/mutualisations.csv");
  const evenements = [...new Set(cartes.map(c => c.event_id).filter(Boolean))];
  expect(partages.map(c => c.event_id).sort()).toEqual(evenements.filter(id => cartes.filter(c => c.event_id === id).length > 1).sort());
  for (const ligne of partages) expect(ligne.card_ids.split(" ; ").sort()).toEqual(cartes.filter(c => c.event_id === ligne.event_id).map(c => c.card_id).sort());
  expect(readdirSync("docs/illustrations/generalisation").filter(n => /^planche-\d{2}\.png$/.test(n))).toHaveLength(18);
});
