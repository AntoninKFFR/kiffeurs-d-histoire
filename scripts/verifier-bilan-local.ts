// Relecture de la vraie route Next, avec une API HTTP éphémère exclusivement locale.
// Pas de base, de migration, de clé KFFR ou de données de démonstration dans l'app.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import { fixtureBilan, partieBilan } from "../tests/fixtures/bilan";
import { chargerCartes } from "./import-cartes";
import { cartePublique } from "../src/lib/pedagogie";
import { CHAPITRES } from "../src/lib/solo/choix";

const require = createRequire(import.meta.url);
const user = { id: "00000000-0000-4000-8000-00000000000a", aud: "authenticated", role: "authenticated", email: "bilan@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" };
const cartes = chargerCartes().map(cartePublique);
let cas = "classique", erreurClaim = false, claims = 0, tests = 0;
let relance: Record<string, unknown> | null = null;
const inconnues: string[] = [];
const api = createServer(async (req, res) => {
  const url = new URL(req.url!, "http://127.0.0.1");
  res.setHeader("Content-Type", "application/json");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const texte = Buffer.concat(chunks).toString();
  const args = texte ? JSON.parse(texte) : {};
  if (["/rest/v1/rpc/get_chapter_cards","/rest/v1/rpc/get_chapter_cards_version"].includes(url.pathname)) return res.end(JSON.stringify(cartes.filter((c) => c.chapter_id === url.searchParams.get("p_chapter_id"))));
  if (url.pathname === "/auth/v1/user") return res.end(JSON.stringify(user));
  if (url.pathname === "/rest/v1/profiles") return res.end(JSON.stringify({ username: "Antonin" }));
  const rpc = url.pathname.replace("/rest/v1/rpc/", "");
  if (["ensure_player", "purge_expired_anonymous_games", "next_question", "kpi_noter_visiteur"].includes(rpc)) return res.end("null");
  if (rpc === "finish_game") return res.end(JSON.stringify(fixtureBilan(cas)));
  if (rpc === "claim_anonymous_game") {
    claims++;
    if (erreurClaim) { res.statusCode = 503; return res.end('{"message":"fixture indisponible"}'); }
    return res.end("null");
  }
  if (rpc === "record_chapter_test") { tests++; return res.end('{"improved":true,"best_accuracy":82}'); }
  if (rpc === "start_game") {
    relance = args;
    return res.end(JSON.stringify({ game_id: partieBilan.game_id, direction: "date", difficulty: args.p_difficulty, question_count: 10, state: "playing", anonymous: false }));
  }
  inconnues.push(`${req.method} ${url.pathname}`); res.statusCode = 404; res.end("null");
});

async function authentifier(context: BrowserContext) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp, aud: "authenticated", role: "authenticated" })).toString("base64url"), "fixture"].join(".");
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: "fixture", token_type: "bearer", expires_at: exp, expires_in: 3600, user })).toString("base64url")}`, domain: "127.0.0.1", path: "/", sameSite: "Lax" }]);
}

async function main() {
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  const address = api.address();
  assert(address && typeof address !== "string");
  const port = 3026;
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publique-bilan", NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}` };
  const log: string[] = [];
  const npm = process.env.npm_execpath;
  assert(npm, "Lancer via npm run test:bilan-browser pour exécuter npm run build.");
  const build = spawn(process.execPath, [npm, "run", "build"], { env, stdio: ["ignore", "pipe", "pipe"] });
  build.stdout.on("data", (chunk) => { log.push(String(chunk)); process.stdout.write(chunk); });
  build.stderr.on("data", (chunk) => { log.push(String(chunk)); process.stderr.write(chunk); });
  await new Promise<void>((resolve, reject) => {
    build.on("error", reject);
    build.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`npm run build : code ${code}`)));
  });
  const app = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, stdio: ["ignore", "pipe", "pipe"] });
  app.stdout.on("data", (chunk) => log.push(String(chunk)));
  app.stderr.on("data", (chunk) => log.push(String(chunk)));
  let browser: Browser | undefined;
  const output = "docs/captures/issue-96";
  mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true });
    for (let attempt = 0; attempt < 60; attempt++) {
      try { await fetch(`http://127.0.0.1:${port}`); break; }
      catch { if (attempt === 59) throw new Error("Serveur Next absent"); await new Promise((r) => setTimeout(r, 500)); }
    }
    const context = await browser.newContext();
    await authentifier(context);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const choix = "mode=general&difficulte=YEAR&niveau=2";
    const route = (c = choix) => `http://127.0.0.1:${port}/partie/${partieBilan.game_id}?c=${encodeURIComponent(c)}`;
    const measurements: unknown[] = [];
    const formats = [[320, 568], [390, 844], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]];
    for (const [width, height] of formats) {
      await page.setViewportSize({ width, height });
      for (cas of ["classique", "inverse", "zero", "maximum", "absente", "eloignee", "trois", "jour", "mois", "vingt", "cent"]) {
        await page.goto(route());
        await page.getByRole("region", { name: "Fin de la partie" }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        // Le carnet est dans le HTML serveur ; la frise mesure sa largeur à l'hydratation.
        await page.waitForFunction(() => {
          const svg = document.querySelector<SVGSVGElement>(".timeline-svg svg");
          return svg && Math.abs(svg.viewBox.baseVal.width - svg.getBoundingClientRect().width) < 1;
        });
        const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, replayBottom: document.querySelector(".replay")!.getBoundingClientRect().bottom, detailBottom: document.querySelector(".answer-navigation")!.getBoundingClientRect().bottom }));
        if (size.document !== width) {
          const debordements = await page.locator("body *").evaluateAll((els) => els.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -.5 || r.right > innerWidth + .5); }).slice(-12).map((el) => ({ element: el.tagName, classe: el.getAttribute("class"), texte: el.textContent?.slice(0, 80), droite: el.getBoundingClientRect().right })));
          assert.fail(`Débordement ${cas} à ${width} : ${JSON.stringify(debordements)}`);
        }
        if (width <= 390) assert(size.replayBottom <= height, `Rejouer hors écran ${cas} ${width}`);
        if (width >= 1024 && cas === "classique") assert(size.detailBottom <= height, `Carnet hors écran ${width}`);
        measurements.push({ cas, width, height, ...size });
        const tabs = page.getByRole("navigation", { name: "Choisir une réponse" }).getByRole("button");
        assert.equal(await tabs.count(), Math.min(10, fixtureBilan(cas).question_count));
        await tabs.first().click();
        assert.equal(await tabs.first().getAttribute("aria-pressed"), "true");
        await tabs.first().press("ArrowRight");
        assert.equal(await tabs.nth(1).getAttribute("aria-pressed"), "true");
        if (cas !== "inverse") {
          if (cas === "eloignee" || cas === "jour" || cas === "mois") await tabs.nth(2).click();
          await page.getByRole("button", { name: "Voir l’écart" }).click();
          await page.getByRole("img", { name: `Écart de la question ${["eloignee", "jour", "mois"].includes(cas) ? 3 : 2}` }).waitFor();
          const bounds = await page.locator('.correct-mark, .player-mark').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
          assert(bounds.every((r) => r.left >= 0 && r.right <= width), `Marqueur invisible ${cas}`);
          await page.getByRole("button", { name: "Tout le parcours" }).click();
        }
        const boutons = await page.locator('.timeline-hotspots button').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
        assert(boutons.every((r, i) => i === 0 || r.left >= boutons[i - 1].right), `Étiquettes superposées ${cas} ${width}`);
        const repere = page.getByRole("button", { name: /^Repère :/ }).first();
        await repere.click(); assert.equal(await repere.getAttribute("aria-pressed"), "true");
        if (cas === "cent") {
          await tabs.first().press("End");
          assert.equal(await page.getByRole("button", { name: /^Question 100 :/ }).getAttribute("aria-pressed"), "true");
          await page.getByRole("button", { name: "← Dix précédentes" }).click();
          await page.getByRole("button", { name: /^Question 81 :/ }).waitFor();
        }
        if (cas === "classique" && [390, 1366].includes(width)) {
          await tabs.nth(2).click();
          await page.screenshot({ path: `${output}/bilan-${width}.png`, fullPage: true });
          await page.getByRole("button", { name: "Voir l’écart" }).click();
          await page.screenshot({ path: `${output}/ecart-${width}.png`, fullPage: true });
        }
      }
    }
    cas = "classique";
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator('.hero').evaluate((el) => getComputedStyle(el).animationName), "none");
    // Régression du cadrage initial : même avant l'hydratation, aucune cible ne déborde.
    const sansJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 568 } });
    await authentifier(sansJs);
    const htmlInitial = await sansJs.newPage();
    cas = "trois";
    await htmlInitial.goto(route());
    assert.equal(await htmlInitial.evaluate(() => document.documentElement.scrollWidth), 320);
    await sansJs.close();
    cas = "classique";
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route(`mode=scolaire&difficulte=YEAR&chapitres=${CHAPITRES[0].id}&test=chapitre`));
    await page.getByText(/Nouveau meilleur test de ce chapitre/).waitFor();
    assert.equal(tests, 1);
    await page.getByRole("button", { name: /^Question 1 :/ }).click();
    assert.equal(tests, 1);
    await page.getByRole("link", { name: "Revoir le chapitre" }).waitFor();
    await page.screenshot({ path: `${output}/pedagogie-390.png`, fullPage: true });
    await context.addCookies([{ name: `histoire-solo-${partieBilan.game_id}`, value: "fixture-anonyme", domain: "127.0.0.1", path: "/" }]);
    erreurClaim = true;
    await page.goto(route());
    const erreurSauvegarde = page.getByRole("region", { name: "Fin de la partie" }).getByRole("alert");
    await erreurSauvegarde.waitFor();
    await page.screenshot({ path: `${output}/erreur-390.png`, fullPage: true });
    assert.equal(claims, 1, `Claim non appelé : ${await erreurSauvegarde.textContent()} ; RPC inconnues ${inconnues.join(", ")}`);
    await page.getByRole("button", { name: /^Question 1 :/ }).click(); assert.equal(claims, 1);
    await page.screenshot({ path: `${output}/erreur-390.png`, fullPage: true });
    erreurClaim = false;
    await page.reload(); await page.getByText(/Partie sauvegardée dans ton compte/).waitFor(); assert.equal(claims, 2);
    await page.goto(route());
    await page.getByRole("button", { name: "Rejouer" }).click();
    await page.waitForURL(/n=10/);
    assert.equal(relance?.p_niveau, 2); assert.equal(relance?.p_difficulty, "YEAR");
    await context.clearCookies();
    await context.addCookies([{ name: `histoire-solo-${partieBilan.game_id}`, value: "fixture-anonyme", domain: "127.0.0.1", path: "/" }]);
    await page.goto(route());
    await page.getByRole("link", { name: "Se connecter pour la sauvegarder" }).waitFor();
    await page.screenshot({ path: `${output}/invite-390.png`, fullPage: true });
    assert.deepEqual(errors, []); assert.deepEqual(inconnues, []);
    writeFileSync(`${output}/mesures.json`, JSON.stringify({ measurements, errors, checks: ["navigation clavier et numéros", "frise synchronisée", "écart et retour global", "sauvegarde et erreur", "rattachement unique", "test pédagogique unique", "relance avec sélection", "invité"] }, null, 2) + "\n");
    console.log(`OK : ${measurements.length} cas/formats, interactions et effets réels, npm run build réussi.`);
  } finally {
    await browser?.close(); app.kill(); api.close();
    mkdirSync("test-results", { recursive: true });
    writeFileSync("test-results/bilan-local.log", log.join(""));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; api.close(); });
