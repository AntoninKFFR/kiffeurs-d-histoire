// Fixture HTTP isolée pour relire les vraies routes Next, jamais une base distante.
import type { IncomingMessage, ServerResponse } from "node:http";
import { expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import type { AdminPack, PackQuestion } from "../src/lib/admin-packs/types";
let authorized = true;
const questions: PackQuestion[] = [];
const candidate: PackQuestion = { id: "EVT-120888", title: "L’assassinat de Jules César", niveau: 1, date_text: "15 mars 44 av. J.-C.",
  start_year: -44, start_month: 3, start_day: 15, end_year: null, end_month: null, end_day: null, removed: false, playable: true, last_change: null };
const packs = (): AdminPack[] => [{ id: "B120", title: "Les repères de l’Antiquité", active: true, total: questions.length, retired: 0, playable: questions.length }];
const change = () => ({ changed: true, added: 1, restored: 0, packs: packs(), questions });
export function adminFixture(req: IncomingMessage, res: ServerResponse): boolean {
  const name = req.url?.split("/").at(-1);
  if (!name?.startsWith("admin_")) return false;
  void (async () => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const args = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    res.setHeader("Content-Type", "application/json");
    if (name === "admin_access") { res.end(JSON.stringify(authorized)); return; }
    if (!authorized) { res.statusCode = 403; res.end('{"code":"42501"}'); return; }
    const respond = (value: unknown) => res.end(JSON.stringify(value));
    if (name === "admin_list_packs") respond(packs());
    else if (name === "admin_pack_questions") respond(questions);
    else if (name === "admin_search_events") respond({ has_more: false, items: [{ ...candidate, associated: questions.some(q => q.id === candidate.id), packs: [] }] });
    else if (name === "admin_add_pack_events") { if (!questions.some(q => q.id === candidate.id)) questions.push(candidate); respond(change()); }
    else if (name === "admin_create_event") {
      questions.push({ ...candidate, ...args.p_event, id: "EVT-900000000000", date_text: null });
      respond({ ...change(), event_id: "EVT-900000000000" });
    } else if (name === "admin_event_history") respond([]);
    else if (name === "admin_content_history") respond({ creation: { admin_id: "Compte de relecture locale", created_at: "2026-10-15T12:00:00Z", sources: ["Référence documentaire vérifiée, p. 42"], territory: null }, operations: [] });
    else { res.statusCode = 404; respond(null); }
  })().catch(() => { res.statusCode = 500; res.end("null"); });
  return true;
}
export async function verifierAdminBrowser(page: Page, base: string, output: string) {
  const measurements = [];
  for (const width of [1280, 375, 320]) {
    questions.length = 0;
    authorized = true;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/profil`);
    await expect(page.getByRole("heading", { name: "Mon espace administrateur" })).toBeVisible();
    await page.screenshot({ path: `${output}/profil-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "Gestion des packs et questions" }).click();
    const open = page.getByRole("button", { name: "Ajouter des questions", exact: true });
    await open.focus(); await page.keyboard.press("Enter");
    const modal = page.getByRole("dialog", { name: "Ajouter des questions" });
    await modal.getByLabel("Titre recherché").fill("César");
    await modal.getByRole("button", { name: "Rechercher", exact: true }).click();
    await expect(modal.getByRole("checkbox")).toBeVisible();
    await page.screenshot({ path: `${output}/recherche-${width}.png` });
    await modal.getByRole("checkbox").check();
    await modal.getByRole("button", { name: "Ajouter / réintégrer (1)" }).click();
    await expect(page.getByRole("status")).toContainText("ajoutée");
    await expect(page.getByRole("row", { name: /Jules César/ })).toBeVisible();
    await open.click();
    await modal.getByRole("button", { name: "Créer une nouvelle question" }).click();
    await modal.getByLabel("Titre de la question", { exact: true }).fill("Fondation de la République romaine");
    await modal.getByLabel("Description historique courte").fill("Un repère conventionnel pour comprendre les institutions de Rome.");
    await modal.getByLabel("Début : année").fill("-509");
    await modal.getByLabel("Statut historique").selectOption("CONVENTIONAL");
    await modal.getByLabel("Source 1", { exact: true }).fill("Référence documentaire vérifiée, p. 42");
    await modal.getByRole("heading", { name: "Ajouter des questions" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/creation-${width}.png` });
    await modal.getByRole("button", { name: "Créer et ajouter au pack" }).click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByRole("status")).toContainText("créée");
    await expect(page.getByRole("row", { name: /Fondation de la République/ })).toContainText("509 av. J.-C.");
    await open.click(); await page.keyboard.press("Escape");
    await expect(open).toBeFocused();
    const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    expect(size.document).toBe(width); measurements.push(size);
    authorized = false;
    await page.goto(`${base}/profil`);
    await expect(page.getByRole("heading", { name: "Mon espace administrateur" })).toHaveCount(0);
  }
  writeFileSync(`${output}/mesures.json`, JSON.stringify({ fixture: "HTTP locale, aucune base distante", measurements, checks: ["profil admin/joueur", "recherche", "ajout", "création", "clavier et focus", "absence de débordement"] }, null, 2) + "\n");
  console.log("OK administration : vraies routes Next à 1280/375/320 px, profil conditionnel, ajout, création, clavier et focus.");
}
