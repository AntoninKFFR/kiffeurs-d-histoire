// Parcours sur le build réellement branché sur la fixture PostgREST de #92.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect, type Browser } from "@playwright/test";
import { estUrlLocale } from "./import-cartes";
import { lireCsv } from "./csv";
import { attendreQuestion, repondreAuClavier, validerEtContinuer, lireBilan } from "../e2e/outils";
import { verifierIntegriteStockPhase4 } from "./illustrations-pedagogiques/phase4-verifier";
import { lignesEnfantsCourantes117,verifierCanonHan117 } from './han-117';

export async function verifierPhase3Navigateur(env: NodeJS.ProcessEnv,han117=false) {
  assert(env.NEXT_PUBLIC_SUPABASE_URL && estUrlLocale(env.NEXT_PUBLIC_SUPABASE_URL));
  const reserver = createServer();
  await new Promise<void>(resolve => reserver.listen(0, "127.0.0.1", resolve));
  const address = reserver.address(); assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>(resolve => reserver.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const logs: string[] = [], errors: string[] = [];
  let browser: Browser | undefined;
  const registry = JSON.parse(readFileSync("src/lib/apprendre/structure.json", "utf8")) as {
    id: string; niveauSlug: string; slug: string; parent_id: string | null; edition_active?: string;
  }[];
  const old = lireCsv("content/pedagogie/cartes-v1.csv"), children = lignesEnfantsCourantes117("content/pedagogie/cartes-sous-chapitres.csv"),
    completions = lireCsv("content/pedagogie/cartes-completions.csv");
  const route = (u: (typeof registry)[number]) => `/apprendre/${u.niveauSlug}/${u.slug}`;
  const confidential = /event_id|EVT-\d+|official_wording|date_status|date_precision|["\\]sources["\\]/;
  const phase4 = verifierIntegriteStockPhase4();
  const ajouts = [...completions, ...children], idsPublics = new Set(registry.map(u => u.id));
  const fermees = ajouts.filter(c => !idsPublics.has(c.chapter_id));
  const publiques = ajouts.filter(c => idsPublics.has(c.chapter_id));
  const imagesNavigateur=han117?publiques.filter(c=>['THM-047','THM-048','THM-049'].includes(c.chapter_id)):publiques;
  assert.equal(ajouts.length, 292); assert.equal(publiques.length + fermees.length, 292);
  assert.equal(registry.length,han117?59:56);
  assert.deepEqual([...new Set(fermees.map(c => c.chapter_id))].sort(), han117?[]:["THM-047", "THM-048", "THM-049"]);
  if(han117)verifierCanonHan117();
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { env: { ...env, NEXT_PUBLIC_SITE_URL: origin }, stdio: ["ignore", "pipe", "pipe"] });
  app.stdout.on("data", b => logs.push(String(b))); app.stderr.on("data", b => logs.push(String(b)));
  try {
    await expect.poll(async () => { try { return (await fetch(origin + "/apprendre")).status; } catch { return 0; } }, { timeout: 30_000 }).toBe(200);
    // Vérification exhaustive des routes/projections statiques réellement générées.
    for (const u of registry) {
      const file = ".next/server/app" + route(u), html = readFileSync(file + ".html", "utf8"), rsc = readFileSync(file + ".rsc", "utf8");
      const expected = u.parent_id ? children.filter(c => c.chapter_id === u.id) :
        [...old.filter(c => c.chapter_id === u.id), ...(u.edition_active ? completions.filter(c => c.chapter_id === u.id) : [])];
      assert.doesNotMatch(html + rsc, confidential);
      assert.deepEqual([...new Set((html + rsc).match(/CARD-[a-z0-9-]+/g))].sort(), expected.map(c => c.card_id).sort(), u.id);
      assert.equal((await fetch(origin + route(u))).status, 200, u.id);
    }
    // Catalogue public réel : les 3 enfants du groupe Han restent fermés.
    // Le harness technique séparé teste le vrai GET sur 292 identifiants avec
    // un catalogue uniquement en mémoire ; aucune activation n'est déduite ici.
    for (const c of ajouts) {
      const response = await fetch(`${origin}/api/pedagogie/illustration/${c.card_id}`, { redirect: "manual" });
      assert.equal(response.status, idsPublics.has(c.chapter_id) ? 200 : 404, c.card_id);
      assert.equal(response.headers.get("location"), null);
      assert.doesNotMatch(JSON.stringify([...response.headers]), /EVT-\d|event_id|sources|content\/illustrations/);
      const svg = await response.text();
      if (!idsPublics.has(c.chapter_id)) { assert.equal(svg, "", c.card_id); continue; }
      assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/);
      assert.doesNotMatch(svg, /EVT-\d|event_id|sources|supabase|content\/illustrations|<script|<foreignObject|\bhref\s*=/i);
      assert.equal(svg, readFileSync(`content/illustrations/${c.event_id}.svg`, "utf8").replace(/<!--[\s\S]*?-->/g, ""), c.card_id);
    }
    const trace = JSON.parse(readFileSync(".next/server/app/api/pedagogie/illustration/[cardId]/route.js.nft.json", "utf8")) as { files: string[] };
    const traces = [...new Set(trace.files.filter(n => /content\/illustrations\/EVT-\d{4}\.svg$/.test(n)).map(n => n.split("/").at(-1)!))].sort();
    assert.deepEqual(traces, phase4.actuels);
    assert(!trace.files.some(n => /illustrations-pedagogiques|generalisation-inventaire|reference-validee/.test(n)), "Atelier embarqué côté serveur");
    browser = await chromium.launch({ headless: true });
    for (const width of [1280, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "fr-FR" });
      const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
      let imagesVerifiees = 0;
      for (const u of registry) {
        const cartes = imagesNavigateur.filter(c => c.chapter_id === u.id); if (!cartes.length) continue;
        await page.goto(origin + route(u));
        const liste = page.getByRole("navigation", { name: "Cartes du chapitre" });
        for (const c of cartes) {
          await liste.getByRole("button").filter({ has: page.getByText(c.title, { exact: true }) }).click();
          await expect(page.locator("#titre-carte")).toHaveText(c.title);
          const image = page.locator(`article img[src="/api/pedagogie/illustration/${c.card_id}"]`);
          await expect(image).toBeVisible();
          const dimensions = await image.evaluate(async node => {
            const element = node as HTMLImageElement;
            await element.decode(); const r = element.getBoundingClientRect();
            return { width: element.naturalWidth, height: element.naturalHeight, complete: element.complete,
              visible: r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth };
          });
          assert.deepEqual(dimensions, { width: 160, height: 120, complete: true, visible: true }, `${c.card_id}/${width}`);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${c.card_id}/${width}: débordement`);
          assert.doesNotMatch(await page.content(), confidential);
          imagesVerifiees++;
        }
      }
      assert.equal(imagesVerifiees, imagesNavigateur.length, `${width} : toutes les images du scénario`);
      for (const id of ["THM-001", "THM-004", "THM-046", "THM-056", "THM-059"]) {
        const u = registry.find(c => c.id === id)!;
        await page.goto(origin + route(u));
        const buttons = page.getByRole("navigation", { name: "Cartes du chapitre" }).getByRole("button");
        assert((await buttons.count()) >= 5); await buttons.last().click();
        await expect(page.locator("#titre-carte")).toBeVisible();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id}/${width}: débordement`);
        await expect(page.getByRole("button", { name: "Me tester sur ce chapitre" })).toBeEnabled();
      }
      // Une véritable partie de complétion, correction, bilan et relance dans la même édition.
      const target = registry.find(c => c.id === "THM-001")!;
      await page.goto(origin + route(target));
      await page.getByRole("button", { name: "Me tester sur ce chapitre" }).click();
      await expect(page).toHaveURL(/\/partie\//);
      const total = await attendreQuestion(page, 1); assert.equal(total, 8);
      for (let n = 1; n <= total; n++) {
        await attendreQuestion(page, n); await repondreAuClavier(page, 1850); await validerEtContinuer(page);
      }
      const { bilan } = await lireBilan(page);
      await expect(bilan.getByText(/Test du chapitre/)).toBeVisible();
      const revoir = page.getByRole("link", { name: "Revoir le chapitre" });
      assert.match((await revoir.getAttribute("href"))!, /edition\/completion-v1/);
      await page.getByRole("button", { name: "Rejouer" }).click(); await expect(page).toHaveURL(/\/partie\//);
      assert.equal(await attendreQuestion(page, 1), 8);
      // L'archive garde ses six cartes, indépendamment des huit de la complétion.
      await page.goto(origin + route(target) + "/edition/legacy-v1");
      assert.equal(await page.getByRole("navigation", { name: "Cartes du chapitre" }).getByRole("button").count(), 6);
      if(han117){
        const han=registry.find(c=>c.id==='THM-049')!;
        await page.goto(origin+route(han));
        assert.equal(await page.getByRole('navigation',{name:'Cartes du chapitre'}).getByRole('button').count(),5);
        await page.getByRole('button',{name:'Me tester sur ce chapitre'}).click();
        await expect(page).toHaveURL(/\/partie\//);
        const nombre=await attendreQuestion(page,1);assert.equal(nombre,5);
        for(let n=1;n<=nombre;n++){await attendreQuestion(page,n);await repondreAuClavier(page,-206);await validerEtContinuer(page);}
        const {bilan:hanBilan}=await lireBilan(page);await expect(hanBilan.getByText(/Test du chapitre/)).toBeVisible();
        assert.equal(await page.getByRole('link',{name:'Revoir le chapitre'}).getAttribute('href'),route(han));
        assert.match((await page.locator('form input[name="c"]').inputValue()),/edition=sous-chapitres-v1/);
        await page.getByRole('button',{name:'Rejouer'}).click();await expect(page).toHaveURL(/\/partie\//);assert.equal(await attendreQuestion(page,1),5);
      }else{
        await page.goto(origin + "/apprendre/6e/thm-049-sequence");
        await expect(page.getByRole("heading", { name: /introuvable|404/i }).first()).toBeVisible();
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(`OK navigateur : ${registry.length} routes/projections ; ${publiques.length} SVG publics exacts ; ${imagesNavigateur.length} images décodées desktop/mobile ; ${fermees.length} images privées refusées ; 534 SVG tracés ; aucune fuite ; test de 8 questions, bilan/relance completion-v1 et archive legacy-v1 à 6 cartes${han117?' ; Han : 24 cartes, test réel de 5 questions, bilan et relance sous-chapitres-v1':' ; Han inaccessible'}.`);
  } finally {
    await browser?.close(); app.kill();
    mkdirSync("test-results", { recursive: true }); writeFileSync(`test-results/${han117?'han-117':'phase3'}-browser.log`, logs.join(""));
  }
}
