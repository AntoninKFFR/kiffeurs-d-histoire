import { expect, test, type Page, type Route } from "@playwright/test";
import { lireSql } from "./local";
import { attendreQuestion, idPartie, questionsEnBase, repondreAuClavier, type QuestionEnBase } from "./outils";

// Sécurité (#27) : tant que la question n'est pas corrigée, aucune réponse reçue par le navigateur
// (pages, Server Actions, navigations) ne contient la date attendue, ni, en mode inversé, le titre ou un alias.

// Une Server Action encore en vol à la fin d'un test (ex. « Voir le bilan ») ne doit pas faire
// échouer le test : on retire l'interception en ignorant les requêtes inachevées.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

/** Intercepte les réponses du site ; `fenetre()` rend les corps reçus depuis le dernier `ouvrir()`. */
async function ecouterReseau(page: Page) {
  let enCours: Promise<string>[] = [];
  // Interception plutôt qu'écoute : les réponses de Server Actions sont diffusées en flux et
  // le navigateur ne garde pas toujours leur corps ; ici chaque corps est lu en entier, puis rendu tel quel.
  await page.route("**/*", async (route: Route) => {
    const type = route.request().resourceType();
    if (!["document", "fetch", "xhr"].includes(type) || !route.request().url().startsWith("http://localhost")) return route.continue();
    let fin!: (corps: string) => void;
    enCours.push(new Promise<string>((r) => (fin = r)));
    try {
      const reponse = await route.fetch({ maxRedirects: 0 });
      fin(await reponse.text().catch(() => ""));
      await route.fulfill({ response: reponse });
    } catch (e) {
      fin("");
      throw e;
    }
  });
  return {
    ouvrir: () => {
      enCours = [];
    },
    fenetre: async () => normaliser((await Promise.all(enCours)).join("\n")),
  };
}

// Corps lus comme le navigateur les comprend : entités HTML et échappements JSON défaits, sans accents ni casse.
function normaliser(texte: string) {
  return texte
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\"/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const simple = (s: string) => normaliser(s).trim();

/** La date attendue sous forme de donnée : `"year":1789`, `"start_year": 1789`… */
const anneeEnDonnee = (q: QuestionEnBase) => new RegExp(`"[a-z_]*(?:year|annee)[a-z_]*"\\s*:\\s*${q.expected_year}(?![\\d.])`);
/** Question période (#94) : l'année de fin attendue sous forme de donnée. */
const finEnDonnee = (q: QuestionEnBase) => q.periode && q.expected_end_year != null
  ? new RegExp(`"[a-z_]*(?:year|annee)[a-z_]*"\\s*:\\s*${q.expected_end_year}(?![\\d.])`) : null;

function secretsDate(q: QuestionEnBase) {
  const [ligne] = lireSql<{ date_text: string | null }[]>(`select date_text from histoire.event_answers where event_id = '${q.event_id.replace(/'/g, "")}'`);
  const textes = [ligne?.date_text, q.correction_description?.slice(0, 60)].filter((t): t is string => !!t && t.length >= 8);
  // Une explication qui commence par le titre de l'événement ne trahit rien : le titre est la question affichée.
  return { annee: anneeEnDonnee(q), textes: textes.map(simple).filter((t) => !simple(q.title).includes(t)) };
}

function secretsInverse(q: QuestionEnBase) {
  const alias = lireSql<{ alias: string }[]>(`select alias from histoire.event_aliases where event_id = '${q.event_id.replace(/'/g, "")}'`);
  // Les alias très courts (« WWI ») pourraient apparaître par hasard dans un mot : on garde les plus parlants.
  // Un alias qui n'est qu'une date (« mai 1968 ») est la question elle-même, affichée en grand : il ne trahit rien.
  const queDate = (t: string) => !t.replace(/\b(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b|[\d\s.,'-]/g, "");
  return [q.title, ...alias.map((a) => a.alias)].map(simple).filter((t) => t.length >= 6 && !queDate(t));
}

test("aucune date attendue dans le réseau avant la correction (solo)", async ({ page }) => {
  const reseau = await ecouterReseau(page);
  await page.goto("/solo");
  reseau.ouvrir();
  await page.getByRole("button", { name: "Jouer" }).click();
  await expect(page).toHaveURL(/\/partie\//);
  const gameId = idPartie(page);
  const total = await attendreQuestion(page, 1);

  for (let n = 1; n <= total; n++) {
    await attendreQuestion(page, n);
    await repondreAuClavier(page, 1);
    // Question période (#94) : on pose aussi la fin, sans rien envoyer au serveur.
    const versLaFin = page.getByRole("button", { name: "Placer la fin →" });
    if (await versLaFin.isVisible()) {
      await versLaFin.click();
      await repondreAuClavier(page, 1);
    }
    const q = questionsEnBase(gameId)[n - 1];
    const { annee, textes } = secretsDate(q);
    const avant = await reseau.fenetre();
    expect(avant.length, "aucune réponse réseau observée").toBeGreaterThan(0);
    expect(avant, `date de la question ${n} visible avant la correction`).not.toMatch(annee);
    const fin = finEnDonnee(q);
    if (fin) expect(avant, `fin de la période ${n} visible avant la correction`).not.toMatch(fin);
    for (const t of textes) expect(avant.includes(t), `« ${t} » visible avant la correction de la question ${n}`).toBe(false);

    // Témoin : la correction, elle, contient bien la date (l'écoute fonctionne).
    reseau.ouvrir();
    await page.getByRole("button", { name: "Valider ma réponse" }).click();
    const correction = page.getByRole("status").filter({ hasText: "Réponse :" });
    await expect(correction).toBeVisible();
    expect(await reseau.fenetre()).toMatch(annee);

    reseau.ouvrir();
    await correction.getByRole("button", { name: /Question suivante|Voir le bilan/ }).click();
  }
});

test("ni titre ni alias dans le réseau avant la correction (mode inversé)", async ({ page }) => {
  const reseau = await ecouterReseau(page);
  await page.goto("/inverse");
  reseau.ouvrir();
  await page.getByRole("button", { name: "Jouer" }).click();
  await expect(page).toHaveURL(/\/partie\//);
  const gameId = idPartie(page);
  const total = await attendreQuestion(page, 1);

  for (let n = 1; n <= total; n++) {
    await attendreQuestion(page, n);
    const q = questionsEnBase(gameId)[n - 1];
    const secrets = secretsInverse(q);
    expect(secrets.length).toBeGreaterThan(0);
    const avant = await reseau.fenetre();
    expect(avant.length, "aucune réponse réseau observée").toBeGreaterThan(0);
    for (const s of secrets) expect(avant.includes(s), `« ${s} » visible avant la correction de la question ${n}`).toBe(false);

    reseau.ouvrir();
    const champ = page.getByPlaceholder("Écris l'événement…");
    await champ.fill("je ne sais pas");
    await champ.press("Enter");
    const correction = page.getByRole("status").filter({ hasText: "Il fallait trouver" });
    await expect(correction).toBeVisible();
    // Témoin : le titre arrive avec la correction.
    expect((await reseau.fenetre()).includes(simple(q.title))).toBe(true);

    reseau.ouvrir();
    await correction.getByRole("button", { name: /Question suivante|Voir le bilan/ }).click();
  }
});
