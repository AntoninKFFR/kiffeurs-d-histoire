import { expect, test } from "@playwright/test";
import { attendreQuestion, idPartie, lireBilan, repondreAuClavier, validerEtContinuer } from "./outils";
import { lireSql } from "./local";

type Contexte = { replay_filters: { packId?: string; tagId?: string; niveau: number; difficulty: string;
  direction: string; questionCount: number; mystery: boolean; mysteryLabel: string } };
function contexte(id: string): Contexte {
  return lireSql<{ context: Contexte }[]>(`select context from histoire.games where id='${id}'`)[0].context;
}

for (const chemin of ["/solo", "/inverse"]) for (const longueur of [5, 10, 20, "tout"] as const) {
  test(`${chemin} : gagnant réel et longueur ${longueur}, bouton Passer`, async ({ page }) => {
    await page.goto(chemin);
    await page.getByRole("button", { name: /^Toutes les questions/ }).click();
    await expect(page.getByText(/questions? réellement jouables?/)).toBeVisible();
    await page.getByRole("group", { name: "Longueur de la partie" }).getByRole("button",
      { name: longueur === "tout" ? /^Tout/ : new RegExp(`^${longueur} questions`) }).click();
    await page.getByRole("button", { name: "Thème", exact: true }).click();
    await page.getByRole("button", { name: /Thème mystère/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Jouer", exact: true }).click();
    const roulette = page.getByRole("dialog", { name: "Thème mystère" });
    await expect(roulette).toBeVisible();
    await expect(roulette.getByRole("status")).toHaveText("La roulette tourne…");
    await roulette.getByRole("button", { name: "Passer" }).click();
    const annonce = (await roulette.getByRole("status").textContent())!.replace("C'est parti : ", "");
    await expect(page).toHaveURL(/\/partie\//);
    const total = await attendreQuestion(page, 1);
    if (longueur !== "tout") expect(total).toBe(longueur);
    else { expect(total).toBeGreaterThan(0); expect(total).toBeLessThanOrEqual(100); }
    const id = idPartie(page), f = contexte(id).replay_filters;
    expect(f.mysteryLabel).toBe(annonce); expect(f.niveau).toBe(3); expect(f.mystery).toBe(true);
    expect(f.direction).toBe(chemin === "/inverse" ? "inverse" : "date");
    expect(f.questionCount).toBe(longueur === "tout" ? 0 : longueur);
    const c = new URLSearchParams(new URL(page.url()).searchParams.get("c")!);
    expect(c.get(f.packId ? "pack" : "theme")).toBe(f.packId ?? f.tagId);
    const conformes = lireSql<{ ok: boolean }[]>(`select bool_and(e.niveau<=3 and
      case when g.context->'replay_filters'->>'packId' is not null then exists (
        select 1 from histoire.pack_events pe where pe.event_id=q.event_id and pe.pack_id=g.context->'replay_filters'->>'packId')
      else exists (select 1 from histoire.event_tags et where et.event_id=q.event_id and et.tag_id=g.context->'replay_filters'->>'tagId') end) as ok
      from histoire.game_questions q join histoire.games g on g.id=q.game_id join histoire.events e on e.id=q.event_id where g.id='${id}'`)[0];
    expect(conformes.ok).toBe(true);
  });
}

test("375 px : gagnant centré après décélération et aucun débordement horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/solo");
  await page.getByRole("button", { name: "Thème", exact: true }).click();
  await page.getByRole("button", { name: /Thème mystère/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  const roulette = page.getByRole("dialog", { name: "Thème mystère" });
  await expect(roulette).toBeVisible();
  const debut = Date.now();
  await expect(roulette.getByRole("status")).toContainText("C'est parti :", { timeout: 6000 });
  expect(Date.now() - debut).toBeGreaterThan(2500);
  const carte = await roulette.locator('[data-gagnante="true"]').boundingBox();
  const fenetre = await roulette.locator('[data-arretee="true"]').boundingBox();
  expect(Math.abs((carte!.x + carte!.width / 2) - (fenetre!.x + fenetre!.width / 2))).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page).toHaveURL(/\/partie\//);
});

test("mouvement réduit, bilan A+, rejouer puis relancer et rouvrir sans URL", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/solo");
  await expect(page.getByText(/questions? réellement jouables?/)).toBeVisible();
  await page.getByRole("group", { name: "Longueur de la partie" }).getByRole("button", { name: /^5 questions/ }).click();
  await page.getByRole("button", { name: "Thème", exact: true }).click();
  await page.getByRole("button", { name: /Thème mystère/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("C'est parti :");
  await expect(page).toHaveURL(/\/partie\//);
  const premier = idPartie(page), gagnant = contexte(premier).replay_filters;
  for (let n = 1; n <= 5; n++) {
    expect(await attendreQuestion(page, n)).toBe(5);
    await repondreAuClavier(page); await validerEtContinuer(page);
  }
  const { bilan } = await lireBilan(page);
  await expect(bilan.getByRole("button", { name: /Rejouer ce thème/ })).toBeVisible();
  await expect(bilan.getByRole("img", { name: /points sur 500$/ })).toBeVisible();
  await bilan.getByRole("button", { name: /Rejouer ce thème/ }).click();
  await expect.poll(() => idPartie(page)).not.toBe(premier);
  expect(await attendreQuestion(page, 1)).toBe(5);
  const rejoue = contexte(idPartie(page)).replay_filters;
  expect(rejoue.packId).toBe(gagnant.packId); expect(rejoue.tagId).toBe(gagnant.tagId);
  expect(rejoue.mysteryLabel).toBe(gagnant.mysteryLabel);
  // Le bilan sans paramètres reste piloté par le contexte privé de la partie.
  await page.goto(`/partie/${premier}`);
  await page.getByRole("button", { name: /Relancer la roulette/ }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("C'est parti :");
  // L'ancienne URL est déjà /partie/... pendant les 900 ms d'annonce.
  // Attendre la navigation effective, sans délai arbitraire.
  await expect.poll(() => idPartie(page)).not.toBe(premier);
  await expect(page).toHaveURL(/\/partie\//);
  expect(idPartie(page)).not.toBe(premier);
  expect(await attendreQuestion(page, 1)).toBe(5);
  const relance = contexte(idPartie(page)).replay_filters;
  expect(relance.niveau).toBe(gagnant.niveau); expect(relance.questionCount).toBe(5);
  expect(relance.difficulty).toBe(gagnant.difficulty); expect(relance.direction).toBe(gagnant.direction);
  expect(relance.mystery).toBe(true);
});
