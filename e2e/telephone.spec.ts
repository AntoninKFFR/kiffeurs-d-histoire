import { expect, test, type Page } from "@playwright/test";
import { attendreQuestion } from "./outils";

// Téléphone et tablette (#28) : l'écran de partie tient sans défilement, debout comme couché.
// Couché, une longue explication peut encore pousser la correction de quelques pixels : on ne vérifie que la question.
const ECRANS = [
  { nom: "téléphone debout", width: 375, height: 667, correction: true },
  { nom: "téléphone couché", width: 667, height: 375, correction: false },
  { nom: "tablette debout", width: 768, height: 1024, correction: true },
];

async function tientSansDefiler(page: Page) {
  const jeu = page.getByRole("region", { name: /^Écran de partie/ });
  const { haut, visible, large } = await jeu.evaluate((el) => ({ haut: el.scrollHeight, visible: el.clientHeight, large: document.documentElement.scrollWidth > innerWidth }));
  expect(haut, "l'écran de partie défile").toBeLessThanOrEqual(visible + 1);
  expect(large, "la page déborde en largeur").toBe(false);
}

for (const ecran of ECRANS) {
  test(`écran de partie sans défilement : ${ecran.nom}`, async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "parcours tactile");
    await page.setViewportSize({ width: ecran.width, height: ecran.height });
    await page.goto("/solo");
    await page.getByRole("button", { name: "Jouer" }).click();
    await attendreQuestion(page, 1);
    await tientSansDefiler(page);
    if (!ecran.correction) return;
    await page.locator("#saisie-annee").fill("1800");
    // Question période (#94) : la fin se pose à la même année que le début.
    const versLaFin = page.getByRole("button", { name: "Placer la fin →" });
    if (await versLaFin.isVisible()) {
      await versLaFin.click();
      await page.locator("#saisie-annee").fill("1800");
    }
    await page.getByRole("button", { name: "Valider ma réponse" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Réponse :" })).toBeVisible();
    await tientSansDefiler(page);
  });
}

test("raccourci sur l'écran d'accueil : manifeste et icônes", async ({ request }) => {
  const manifeste = await (await request.get("/manifest.webmanifest")).json();
  expect(manifeste.name).toBe("Kiffeurs d'Histoire");
  expect(manifeste.display).toBe("standalone");
  for (const icone of manifeste.icons) expect((await request.get(icone.src)).ok()).toBe(true);
});
