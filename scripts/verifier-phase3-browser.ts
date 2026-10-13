// Parcours sur le build réellement branché sur la fixture PostgREST de #92.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect, type Browser } from "@playwright/test";
import { estUrlLocale } from "./import-cartes";
import { lireCsv } from "./csv";
import { attendreQuestion, repondreAuClavier, validerEtContinuer, lireBilan } from "../e2e/outils";

export async function verifierPhase3Navigateur(env: NodeJS.ProcessEnv) {
  assert(env.NEXT_PUBLIC_SUPABASE_URL && estUrlLocale(env.NEXT_PUBLIC_SUPABASE_URL));
  const reserver = createServer();
  await new Promise<void>(resolve => reserver.listen(0, "127.0.0.1", resolve));
  const address = reserver.address(); assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>(resolve => reserver.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const logs: string[] = [], errors: string[] = [];
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { env: { ...env, NEXT_PUBLIC_SITE_URL: origin }, stdio: ["ignore", "pipe", "pipe"] });
  app.stdout.on("data", b => logs.push(String(b))); app.stderr.on("data", b => logs.push(String(b)));
  let browser: Browser | undefined;
  const registry = JSON.parse(readFileSync("src/lib/apprendre/structure.json", "utf8")) as {
    id: string; niveauSlug: string; slug: string; parent_id: string | null; edition_active?: string;
  }[];
  const old = lireCsv("content/pedagogie/cartes-v1.csv"), children = lireCsv("content/pedagogie/cartes-sous-chapitres.csv"),
    completions = lireCsv("content/pedagogie/cartes-completions.csv");
  const route = (u: (typeof registry)[number]) => `/apprendre/${u.niveauSlug}/${u.slug}`;
  const confidential = /event_id|EVT-\d+|official_wording|date_status|date_precision|["\\]sources["\\]/;
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
    browser = await chromium.launch({ headless: true });
    for (const width of [1280, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "fr-FR" });
      const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
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
      await page.goto(origin + "/apprendre/6e/thm-049-sequence");
      await expect(page.getByRole("heading", { name: /introuvable|404/i }).first()).toBeVisible();
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log("OK navigateur PHASE 3 : 56 routes/projections complétées, aucune fuite, lecture desktop/mobile, test réel de 8 questions, bilan/relance completion-v1, archive legacy-v1 à 6 cartes et Han inaccessible.");
  } finally {
    await browser?.close(); app.kill();
    mkdirSync("test-results", { recursive: true }); writeFileSync("test-results/phase3-browser.log", logs.join(""));
  }
}
