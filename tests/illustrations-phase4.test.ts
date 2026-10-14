// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium, type Browser } from "@playwright/test";
import { inventairePhase4, verifierCopiesIllustrations, verifierIntegriteStockPhase4, verifierPhase4,
  verifierSvgPhase4, verifierReproductibilitePhase4, sha256 } from "../scripts/illustrations-pedagogiques/phase4-verifier";

vi.mock("server-only", () => ({}));
// Fixture technique en mémoire, isolée dans ce fichier : aucun catalogue, état SQL,
// ni blocage Han n'est écrit. La route et le lookup restent les vrais modules.
vi.mock("@/lib/apprendre/catalogue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apprendre/catalogue")>();
  const { lireCsv } = await import("../scripts/csv");
  const corpus = ["cartes-v1", "cartes-completions", "cartes-sous-chapitres"].flatMap(n => lireCsv(`content/pedagogie/${n}.csv`));
  const ids = [...new Set(corpus.map(c => c.chapter_id))];
  return { ...actual, CHAPITRES: ids.map(id => ({ ...actual.CHAPITRES[0], id, editions: ["completion-v1"] })) };
});

it("fige les besoins 203/82/285/292 au commit phase 3 et conserve toutes les copies", () => {
  const p = inventairePhase4();
  expect(p.nouveaux).toHaveLength(203); expect(p.reutilises).toHaveLength(82);
  expect(p.evenements).toHaveLength(285); expect(p.cartes).toHaveLength(292);
  verifierCopiesIllustrations(p.cartes);
  expect(p.evenements.filter(e => e.card_ids.split(";").length > 1)).toHaveLength(7);
});

it("compare les 331 anciens SVG octet par octet à main et à la phase 3, puis autorise exactement 203 ajouts", () => {
  const p = verifierIntegriteStockPhase4();
  expect(p.anciens).toHaveLength(331); expect(p.empreintes).toHaveLength(331); expect(p.actuels).toHaveLength(534);
  expect(p.empreintes.every(e => e.sha256_main === e.sha256_phase3 && e.identique === "oui")).toBe(true);
});

it("contrôle tous les nouveaux dessins sans doublon, leur XML, palette, poids et enveloppe DA", () => {
  expect(verifierPhase4()).toMatchObject({ svg_anciens_inchanges: 331, svg_nouveaux: 203,
    svg_reutilises: 82, evenements: 285, cartes: 292, validation_humaine: "en attente" });
});

it("refuse XML malformé, contenu actif/externe, texte, mauvaise palette et dimensions", () => {
  const p = inventairePhase4(), svg = readFileSync(`content/illustrations/${p.nouveaux[0].event_id}.svg`, "utf8");
  for (const interdit of ["<text>date</text>", "<script/>", "<image href=\"https://example.invalid/image.png\"/>",
    "<linearGradient/>", "<animateTransform/>", "<foreignObject/>", "<style/>", "<g onclick=\"alert(1)\"/>",
    "<rect fill=\"red\"/>", "<rect stroke=\"#ffffff\"/>", "<g><path/></svg>"])
    expect(() => verifierSvgPhase4(svg.replace("</svg>", `${interdit}</svg>`)), interdit).toThrow();
  expect(() => verifierSvgPhase4(svg.replace('width="160"', 'width="161"'))).toThrow();
  expect(() => verifierSvgPhase4('<!DOCTYPE svg [<!ENTITY x "texte">]>' + svg)).toThrow();
  expect(() => verifierSvgPhase4(svg + " ".repeat(8192))).toThrow();
});

it("reproduit les 203 SVG depuis leurs scènes sans écrire ni faire d'appel distant", async () => {
  expect(await verifierReproductibilitePhase4()).toEqual({ svg_reproductibles: 203 });
});

it("refuse réellement la relance sans modifier aucun des 534 SVG présents", async () => {
  const { produirePhase4 } = await import("../scripts/illustrations-pedagogiques/phase4-generer");
  const stock = verifierIntegriteStockPhase4();
  const empreintes = () => stock.actuels.map(n => sha256(readFileSync(`content/illustrations/${n}`)));
  const avant = empreintes();
  expect(() => produirePhase4()).toThrow(/Écrasement refusé avant toute création/);
  expect(empreintes()).toEqual(avant);
});

async function verifierFixtureIllustrations(renduNavigateur = false) {
  const { GET } = await import("@/app/api/pedagogie/illustration/[cardId]/route");
  const p = inventairePhase4(), erreurs: string[] = [];
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (!path.startsWith("/api/pedagogie/illustration/")) { res.writeHead(404); res.end(); return; }
      const cardId = decodeURIComponent(path.split("/").at(-1)!);
      const response = await GET(new Request(`http://127.0.0.1${path}`), { params: Promise.resolve({ cardId }) });
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) { erreurs.push(String(e)); res.writeHead(500); res.end(); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture sans port");
  const origine = `http://127.0.0.1:${address.port}`;
  const url = (id: string) => `${origine}/api/pedagogie/illustration/${encodeURIComponent(id)}`;
  let browser: Browser | undefined;
  try {
    for (const c of p.cartes) {
      const response = await fetch(url(c.card_id), { redirect: "manual" });
      expect(response.status, c.card_id).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/image\/svg\+xml/);
      expect(response.headers.get("location")).toBeNull();
      expect(JSON.stringify([...response.headers])).not.toMatch(/EVT-\d|event_id|sources|content\/illustrations/);
      const svg = await response.text();
      expect(svg, c.card_id).toBe(readFileSync(`content/illustrations/${c.event_id}.svg`, "utf8").replace(/<!--[\s\S]*?-->/g, ""));
      expect(svg).not.toMatch(/EVT-\d|event_id|supabase|sources|content\/illustrations|<script|<foreignObject|\bhref\s*=/i);
    }
    for (const id of ["inconnu", "EVT-0210", "CARD-inconnue", "../EVT-0210.svg"]) {
      const response = await fetch(url(id)); expect(response.status).toBe(404); expect(await response.text()).toBe("");
    }
    if (renduNavigateur) browser = await chromium.launch({ headless: true });
    for (const width of renduNavigateur ? [1280, 375] : []) {
      const page = await browser!.newPage({ viewport: { width, height: 900 } });
      page.on("pageerror", e => erreurs.push(e.message));
      // Vrais SVG HTTP, un par card_id : le catalogue synthétique ne simule ni
      // une page publiée ni une validation historique, notamment pour Han.
      await page.setContent(`<main style="margin:0;max-width:100%">${p.cartes.map(c => `<img src="${url(c.card_id)}" width="160" height="120" alt="" style="display:block;max-width:100%;height:auto">`).join("")}</main>`);
      const rendus = await page.locator("img").evaluateAll(async images => {
        await Promise.all(images.map(image => (image as HTMLImageElement).decode()));
        return images.map(image => {
          const img = image as HTMLImageElement, rect = img.getBoundingClientRect();
          return { src: img.src, width: img.naturalWidth, height: img.naturalHeight, rendu: rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth };
        });
      });
      expect(rendus).toHaveLength(292);
      for (const image of rendus) expect(image, `${width}/${image.src}`).toMatchObject({ width: 160, height: 120, rendu: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.close();
    }
    expect(erreurs).toEqual([]);
  } finally {
    await browser?.close(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

it("sert le vrai GET exact et privé pour les 292 card_id sur catalogue technique isolé", () => verifierFixtureIllustrations(), 120_000);

// Commande dédiée après installation de Chromium : PHASE4_BROWSER=1 npx vitest run tests/illustrations-phase4.test.ts
it.skipIf(process.env.PHASE4_BROWSER !== "1")("décode les 292 routes de fixture en SVG natif à 1280 et 375 px", () => verifierFixtureIllustrations(true), 120_000);
