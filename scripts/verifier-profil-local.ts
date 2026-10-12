// Relecture navigateur autonome : API HTTP exclusivement locale, données de test
// hors application. Aucune connexion à KFFR ni écriture d'un compte distant.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, type Browser } from "@playwright/test";
import {
  statistiques,
  statistiquesVides,
  historique,
} from "../tests/fixtures/profil";
import { chargerCartes } from "./import-cartes";
import { cartePublique } from "../src/lib/pedagogie";
const require = createRequire(import.meta.url);
const user = {
  id: "00000000-0000-4000-8000-00000000000a",
  aud: "authenticated",
  role: "authenticated",
  email: "a@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-10-01T00:00:00Z",
};
const cartes = chargerCartes().map(cartePublique);
let state: "full" | "empty" | "error" = "full";
const api = createServer((req, res) => {
  const url = new URL(req.url!, "http://127.0.0.1");
  res.setHeader("Content-Type", "application/json");
  if (["/rest/v1/rpc/get_chapter_cards","/rest/v1/rpc/get_chapter_cards_version"].includes(url.pathname))
    return res.end(
      JSON.stringify(
        cartes.filter(
          (c) => c.chapter_id === url.searchParams.get("p_chapter_id"),
        ),
      ),
    );
  if (url.pathname === "/auth/v1/user") return res.end(JSON.stringify(user));
  if (url.pathname === "/rest/v1/rpc/ensure_player") return res.end("null");
  if (url.pathname === "/rest/v1/profiles")
    return res.end(
      JSON.stringify({ username: "Antonin · carnet de relecture" }),
    );
  if (
    url.pathname === "/rest/v1/rpc/player_stats" ||
    url.pathname === "/rest/v1/rpc/player_history"
  ) {
    if (state === "error") {
      res.statusCode = 503;
      return res.end('{"message":"SQL privé de B"}');
    }
    const value = url.pathname.endsWith("player_stats")
      ? state === "full"
        ? statistiques
        : statistiquesVides
      : state === "full"
        ? historique
        : { games: [], next_cursor: null };
    return res.end(JSON.stringify(value));
  }
  // Progression pédagogique (#23) : lecture REST de la table privée, avec les lignes du seul joueur simulé.
  if (url.pathname === "/rest/v1/learning_progress") {
    if (state === "error") {
      res.statusCode = 503;
      return res.end('{"message":"SQL privé de B"}');
    }
    return res.end(
      JSON.stringify(
        state === "full"
          ? [{ chapter_id: "THM-027", discovered_at: "2026-10-08T10:00:00Z", best_accuracy: 80, best_difficulty: "YEAR", tests_count: 1 }]
          : [],
      ),
    );
  }
  res.statusCode = 404;
  res.end("null");
});
async function main() {
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  const address = api.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture absente");
  const port = 3025;
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publique-profil",
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
  };
  const log: string[] = [];
  const build = spawn(
    process.execPath,
    process.env.npm_execpath ? [process.env.npm_execpath, "run", "build"] : [require.resolve("next/dist/bin/next"), "build"],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  build.stdout?.on("data", (chunk) => log.push(String(chunk)));
  build.stderr?.on("data", (chunk) => log.push(String(chunk)));
  await new Promise<void>((resolve, reject) => {
    build.on("error", reject);
    build.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Build fixture en échec : ${log.join("").slice(-4000)}`)),
    );
  });
  const app = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  app.stdout?.on("data", (chunk) => log.push(String(chunk)));
  app.stderr?.on("data", (chunk) => log.push(String(chunk)));
  let browser: Browser | undefined;
  const output = "docs/relecture-profil";
  mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({
      headless: true,
      channel: process.env.PROFIL_BROWSER_CHANNEL || (process.platform === "win32" ? "chrome" : undefined),
    });
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await fetch(`http://127.0.0.1:${port}/profil`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (attempt === 59) throw new Error("Serveur absent");
    }
    const context = await browser.newContext();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = [
      Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          exp,
          aud: "authenticated",
          role: "authenticated",
        }),
      ).toString("base64url"),
      "fixture",
    ].join(".");
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value: `base64-${Buffer.from(JSON.stringify({ access_token: token, refresh_token: "fixture", token_type: "bearer", expires_at: exp, expires_in: 3600, user })).toString("base64url")}`,
        domain: "127.0.0.1",
        path: "/",
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(error.message));
    const measurements: unknown[] = [];
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 950 });
      for (const [tab, path, title] of [
        ["historique", "/profil", "Tes dernières parties"],
        [
          "statistiques",
          "/profil?onglet=statistiques",
          "Ton carnet de résultats",
        ],
      ]) {
        await page.goto(`http://127.0.0.1:${port}${path}`);
        await page.getByRole("heading", { name: title }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        const size = await page.evaluate(() => ({
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          debordements: Array.from(document.querySelectorAll("main th, main td, main dt, main dd"))
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => ({ texte: el.textContent, largeur: el.clientWidth, contenu: el.scrollWidth,
              whiteSpace: getComputedStyle(el).whiteSpace })),
        }));
        assert.equal(size.document, width, `Débordement ${tab} à ${width}px : ${JSON.stringify(size.debordements)}`);
        assert.deepEqual(size.debordements, [], `Contenu statistique débordant à ${width}px`);
        measurements.push({ tab, width, ...size });
        await page.screenshot({
          path: `${output}/${tab}-${width}.png`,
          fullPage: true,
        });
      }
    }
    await page.getByRole("link", { name: "Historique", exact: true }).click();
    await page
      .getByRole("heading", { name: "Tes dernières parties" })
      .waitFor();
    await page.getByRole("link", { name: "Statistiques", exact: true }).click();
    await page
      .getByRole("heading", { name: "Ton carnet de résultats" })
      .waitFor();
    await page.getByText(/1 chapitre découvert sur 41/).waitFor();
    state = "empty";
    await page.reload();
    await page.getByText("Une première partie, puis des repères.").waitFor();
    await page.getByText("Un premier chapitre, puis des repères.").waitFor();
    await page.screenshot({
      path: `${output}/statistiques-vide-375.png`,
      fullPage: true,
    });
    state = "error";
    await page.reload();
    await page
      .getByRole("heading", {
        name: "Ton carnet est momentanément indisponible.",
      })
      .waitFor();
    assert(!(await page.content()).includes("SQL privé de B"));
    await page.screenshot({ path: `${output}/erreur-375.png`, fullPage: true });
    state = "full";
    await page.getByRole("button", { name: "Réessayer", exact: true }).click();
    await page
      .getByRole("heading", { name: "Ton carnet de résultats" })
      .waitFor()
      .catch(async (error) => {
        await page.screenshot({
          path: `${output}/reessayer-echec.png`,
          fullPage: true,
        });
        throw error;
      });
    await page.getByText("Ton compte KFFR", { exact: true }).click();
    await page.getByRole("textbox", { name: "Pseudo KFFR" }).waitFor();
    await context.clearCookies();
    await page.goto(`http://127.0.0.1:${port}/profil?onglet=statistiques`);
    await page.waitForURL(/\/connexion\?next=/);
    assert(page.url().includes("onglet%3Dstatistiques"));
    assert.deepEqual(errors, []);
    writeFileSync(
      `${output}/mesures.json`,
      JSON.stringify(
        {
          measurements,
          errors,
          checks: [
            "navigation onglets",
            "vide",
            "erreur sans fuite",
            "réessayer",
            "compte",
            "redirection anonyme",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "OK : profil desktop/375 px, onglets, vide, erreur, réessayer, compte, redirection anonyme.",
    );
  } finally {
    await browser?.close();
    app.kill();
    api.close();
    writeFileSync(".profil-navigateur-local.log", log.join(""));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  api.close();
});
