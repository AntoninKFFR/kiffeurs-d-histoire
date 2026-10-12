import { expect, test, type Page } from "@playwright/test";
import { LISTE_HABILLAGES } from "../src/lib/game/habillages";

// Habillages de frise (#97), sur l'aperçu de l'écran de partie (pas de base nécessaire) :
// l'écran tient sans défilement à 1366×768 et sur téléphone, et la réponse se pose toujours d'un clic sur la frise.
// Couché, une longue explication peut pousser la correction de quelques pixels : on ne vérifie que la question.
const ECRANS = [
  { nom: "PC 1366×768", width: 1366, height: 768, correction: true },
  { nom: "téléphone debout", width: 375, height: 667, correction: true },
  { nom: "téléphone couché", width: 667, height: 375, correction: false },
];

async function tientSansDefiler(page: Page) {
  const jeu = page.getByRole("region", { name: /^Écran de partie/ });
  const { haut, visible, large } = await jeu.evaluate((el) => ({ haut: el.scrollHeight, visible: el.clientHeight, large: document.documentElement.scrollWidth > innerWidth }));
  expect(haut, "l'écran de partie défile").toBeLessThanOrEqual(visible + 1);
  expect(large, "la page déborde en largeur").toBe(false);
}

for (const h of LISTE_HABILLAGES) {
  for (const ecran of ECRANS) {
    test(`habillage ${h.id} : ${ecran.nom}`, async ({ page }) => {
      test.skip(test.info().project.name !== "ordinateur", "les tailles d'écran sont fixées par le test");
      await page.setViewportSize({ width: ecran.width, height: ecran.height });
      await page.goto(`/apercu?habillage=${h.id}&precision=annee`);
      const frise = page.locator(`[data-habillage="${h.id}"]`);
      await expect(frise).toBeVisible();
      await tientSansDefiler(page);
      // Le décor ne capte pas le clic : poser une réponse sur la frise active toujours le bouton.
      const boite = (await frise.boundingBox())!;
      await page.mouse.click(boite.x + boite.width * 0.6, boite.y + boite.height * 0.3);
      await expect(page.getByRole("button", { name: "Valider ma réponse" })).toBeEnabled();
      if (!ecran.correction) return;
      await page.getByRole("button", { name: "Valider ma réponse" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Réponse :" })).toBeVisible();
      await tientSansDefiler(page);
    });
  }
}
