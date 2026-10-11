// Gestes communs des parcours : répondre sur la frise ou au clavier, passer à la suite, lire la partie en base.
import { expect, type Page } from "@playwright/test";
import { lireSql } from "./local";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Identifiant de la partie en cours, lu dans l'adresse /partie/<id>. */
export function idPartie(page: Page): string {
  const id = new URL(page.url()).pathname.split("/")[2];
  if (!UUID.test(id)) throw new Error(`Adresse de partie inattendue : ${page.url()}`);
  return id;
}

export type QuestionEnBase = {
  position: number;
  event_id: string;
  title: string;
  difficulty: "YEAR" | "MONTH" | "DAY";
  expected_year: number;
  expected_month: number | null;
  expected_day: number | null;
  correction_description: string | null;
  answered_at: string | null;
  input_method: string | null;
  points: number | null;
  answer_text: string | null;
  periode: boolean;
  expected_end_year: number | null;
};

/** Questions de la partie, lues directement dans la base locale (ce que le navigateur ne voit jamais). */
export function questionsEnBase(gameId: string): QuestionEnBase[] {
  if (!UUID.test(gameId)) throw new Error("Identifiant de partie invalide");
  return lireSql<QuestionEnBase[]>(
    `select position, event_id, title, difficulty, expected_year, expected_month, expected_day, correction_description,
       answered_at, input_method, points, answer_text, periode, expected_end_year
     from histoire.game_questions where game_id = '${gameId}' order by position`,
  );
}

/** Attend l'affichage de la question `numero` et renvoie le nombre total de questions annoncé. */
export async function attendreQuestion(page: Page, numero: number): Promise<number> {
  const carte = page.getByText(new RegExp(`Question ${numero} sur (\\d+)`)).first();
  await expect(carte).toBeVisible();
  const total = Number((await carte.textContent())!.match(/sur (\d+)/)![1]);
  return total;
}

/** Pose la réponse d'un clic sur une zone libre de la frise (hors cartes et saisie posées dessus). */
export async function repondreSurFrise(page: Page) {
  const frise = page.locator('[aria-label^="Frise chronologique"]').first();
  const point = await frise.evaluate((el) => {
    const r = el.getBoundingClientRect();
    // On cherche, au milieu de la largeur, une hauteur où le clic tombe sur la frise elle-même.
    for (let y = r.top + r.height / 2; y > r.top + 4; y -= 6) {
      for (const fx of [0.5, 0.35, 0.65]) {
        const x = r.left + r.width * fx;
        const cible = document.elementFromPoint(x, y);
        if (cible && el.contains(cible) && !cible.closest("[data-superposition], button, a, input")) return { x, y };
      }
    }
    return null;
  });
  expect(point, "aucune zone libre sur la frise").not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
  // Question période (#94) : le clic a posé le début et ouvert la fin ; un second clic au même endroit la pose.
  if (await estPeriode(page)) await page.mouse.click(point!.x, point!.y);
  await expect(page.locator("#saisie-annee")).not.toHaveValue("");
}

/** Question période (#94) : la carte porte « Début et fin ». */
async function estPeriode(page: Page) {
  return page.getByRole("group", { name: "Début et fin de la période" }).isVisible();
}

/** Tape une date au clavier, sans viser de case : la première case s'ouvre et les suivantes s'enchaînent. */
export async function repondreAuClavier(page: Page, annee = 1800) {
  const precision = (await page.locator("#saisie-jour").count()) ? "jour" : (await page.locator("#saisie-mois").count()) ? "mois" : "annee";
  const sequence = precision === "jour" ? `0101${annee}` : precision === "mois" ? `01${annee}` : String(annee);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.type(sequence);
  await expect(page.locator("#saisie-annee")).toHaveValue(String(annee));
}

/** Valide, attend la correction, puis passe à la question suivante (ou au bilan). */
export async function validerEtContinuer(page: Page, valider: "bouton" | "entree" = "bouton") {
  // Question période (#94) : début posé, on passe à la fin et on y reporte la même date (fin = début est permis).
  const versLaFin = page.getByRole("button", { name: "Placer la fin →" });
  if (await versLaFin.isVisible()) {
    const annee = Number(await page.locator("#saisie-annee").inputValue());
    if (valider === "entree") await page.keyboard.press("Enter");
    else await versLaFin.click();
    await repondreAuClavier(page, annee);
  }
  if (valider === "entree") await page.keyboard.press("Enter");
  else await page.getByRole("button", { name: "Valider ma réponse" }).click();
  const correction = page.getByRole("status").filter({ hasText: "Réponse :" });
  await expect(correction).toBeVisible();
  await correction.getByRole("button", { name: /Question suivante|Voir le bilan/ }).click();
}

/** Bilan affiché : renvoie les points et la précision lus à l'écran. */
export async function lireBilan(page: Page) {
  const bilan = page.getByRole("region", { name: "Fin de la partie" });
  await expect(bilan).toBeVisible();
  const score = await bilan.getByRole("img", { name: /^\d+ points sur/ }).getAttribute("aria-label");
  const points = Number(score!.match(/^(\d+) points/)![1]);
  const moyenne = await bilan.getByRole("img", { name: /^Précision moyenne/ }).getAttribute("aria-label");
  const precision = Number(moyenne!.match(/(\d+(?:[.,]\d+)?)\s*%/)![1].replace(",", "."));
  return { bilan, points, precision };
}

/** Mode inversé : écrit l'événement, valide avec Entrée, lit la correction puis passe à la suite. */
export async function repondreInverse(page: Page, texte: string) {
  const champ = page.getByPlaceholder("Écris l'événement…");
  await champ.fill(texte);
  await champ.press("Enter");
  const correction = page.getByRole("status").filter({ hasText: "Il fallait trouver" });
  await expect(correction).toBeVisible();
  const verdict = (await correction.textContent())!;
  await correction.getByRole("button", { name: /Question suivante|Voir le bilan/ }).click();
  return verdict;
}
