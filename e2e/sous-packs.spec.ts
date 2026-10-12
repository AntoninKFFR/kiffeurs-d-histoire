import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { executerSql, lireSql, statutLocal } from "./local";
import { estUrlLocale } from "../scripts/import-cartes";
import { attendreQuestion, idPartie, lireBilan, repondreAuClavier, repondreInverse, validerEtContinuer } from "./outils";

test.use({ actionTimeout: 15_000 });
test.beforeEach(() => executerSql(readFileSync("supabase/fixtures/sous_packs_existants.sql", "utf8")));
test.afterEach(() => executerSql(`
  update histoire.packs set parent_id=null where id='COL-0063';
  delete from histoire.packs where id in ('E2E89-ancien','E2E89-moderne','E2E89-vide');
`));

for (const inverse of [false, true]) {
  test(`navigation et partie de sous-pack, inverse=${inverse}`, async ({ page }, info) => {
    await page.goto(inverse ? "/inverse" : "/solo");
    await page.getByRole("group", { name: "Niveau" }).getByRole("button", { name: /^Toutes les questions/ }).click();
    await expect(page.getByText(/questions? réellement jouables?/)).toBeVisible();
    await page.getByRole("group", { name: "Longueur de la partie" }).getByRole("button", { name: /^5 questions/ }).click();
    await page.getByRole("button", { name: "Pack", exact: true }).click();
    const parent = page.getByRole("button", { name: /^Jouer tout Guerres et batailles/ });
    await parent.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Packs disponibles" })).toBeVisible();
    await page.getByRole("button", { name: "Voir les sous-thèmes de Guerres et batailles" }).click();
    await expect(page.getByRole("heading", { name: "Guerres et batailles", exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: /^Sous-pack vide/ })).toBeDisabled();
    if (info.project.name === "ordinateur") {
      const mesure = await page.evaluate(() => ({ hauteur: document.documentElement.scrollHeight, viewport: innerHeight,
        largeur: document.documentElement.scrollWidth, ecran: innerWidth }));
      expect(mesure.largeur).toBeLessThanOrEqual(mesure.ecran);
      expect(mesure.hauteur).toBeLessThanOrEqual(mesure.viewport + 2);
    }
    await page.getByRole("button", { name: /^Tout le pack/ }).click();
    expect(new URLSearchParams(await page.locator('input[name="c"]').inputValue()).get("pack")).toBe("COL-0069");
    const enfant = page.getByRole("button", { name: /^Conflits depuis 1800/ });
    const n = Number((await enfant.textContent())!.match(/(\d+) questions?/)![1]);
    expect(n).toBeGreaterThanOrEqual(5);
    await enfant.focus(); await page.keyboard.press("Enter");
    await expect(page.getByText(`${n} questions réellement jouables.`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Jouer", exact: true }).click();
    expect(await attendreQuestion(page, 1)).toBe(5);
    const gameId = idPartie(page);
    const contexte = lireSql<{ pack: string }[]>(`select context->'replay_filters'->>'packId' pack from histoire.games where id='${gameId}'`);
    expect(contexte[0].pack).toBe("E2E89-moderne");
    for (let position = 1; position <= 5; position++) {
      expect(await attendreQuestion(page, position)).toBe(5);
      if (inverse) await repondreInverse(page, "Bataille de démonstration");
      else { await repondreAuClavier(page); await validerEtContinuer(page); }
    }
    const { bilan } = await lireBilan(page);
    await bilan.getByRole("button", { name: "Rejouer", exact: true }).click();
    expect(await attendreQuestion(page, 1)).toBe(5);
    expect(new URLSearchParams(new URL(page.url()).searchParams.get("c")!).get("pack")).toBe("E2E89-moderne");
    await page.goto(inverse ? "/inverse" : "/solo");
    await expect(page.getByRole("button", { name: /^Conflits depuis 1800/ })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: /^Conflits depuis 1800/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Tous les packs/ }).click();
    await expect(page.getByRole("heading", { name: "Packs disponibles" })).toBeFocused();
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(largeur).toBe(true);
  });
}

test("le vrai import préserve la hiérarchie et les associations locales", async () => {
  const statut = statutLocal();
  if (!estUrlLocale(statut.API_URL)) throw new Error("Import de fixture réservé à la pile locale");
  const avant = lireSql<{ n: number }[]>("select count(*)::int n from histoire.pack_events where pack_id='E2E89-moderne'")[0].n;
  execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/import-dataset.ts", "--dossier", "content/dataset-v18"], {
    env: { ...process.env, SUPABASE_URL: statut.API_URL, SUPABASE_SERVICE_ROLE_KEY: statut.SERVICE_ROLE_KEY },
    stdio: ["ignore", "ignore", "inherit"],
  });
  expect(lireSql<{ parent_id: string }[]>("select parent_id from histoire.packs where id='COL-0063'")[0].parent_id).toBe("COL-0069");
  expect(lireSql<{ n: number }[]>("select count(*)::int n from histoire.pack_events where pack_id='E2E89-moderne'")[0].n).toBe(avant);
});
