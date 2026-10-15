import { expect, test } from "@playwright/test";
import { COMPTE_TEST, executerSql, lireSql } from "./local";

test.use({ actionTimeout: 15_000 });
test.beforeEach(() => {
  executerSql(`
    insert into histoire.packs(id,slug,title) values('E2E120','e2e120','Pack création E2E120') on conflict do nothing;
    insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
      values('EVT-120998','Question à rattacher E2E120','POINT','YEAR','EXACT',true,'YEAR',1,1,1) on conflict do nothing;
    insert into histoire.event_answers(event_id,start_year) values('EVT-120998',-44) on conflict do nothing;
    delete from histoire.admins where user_id=(select id from auth.users where email='${COMPTE_TEST.email}');
  `);
});
test.afterEach(() => {
  executerSql(`
    delete from histoire.admin_content_audit where pack_id='E2E120';
    delete from histoire.admin_pack_additions where pack_id='E2E120';
    delete from histoire.admin_event_creations where payload->>'pack_id'='E2E120';
    delete from histoire.pack_event_audit where pack_id='E2E120';
    delete from histoire.pack_event_status where pack_id='E2E120';
    delete from histoire.events where title like 'Création sourcée E2E120%';
    delete from histoire.packs where id='E2E120';
    delete from histoire.events where id='EVT-120998';
    delete from histoire.admins where user_id=(select id from auth.users where email='${COMPTE_TEST.email}');
  `);
});
async function login(page: import("@playwright/test").Page) {
  await page.goto("/connexion");
  await page.getByPlaceholder("Email").fill(COMPTE_TEST.email);
  await page.getByPlaceholder("Mot de passe").fill(COMPTE_TEST.motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(COMPTE_TEST.pseudo).first()).toBeVisible();
}
function authorize() {
  executerSql(`insert into histoire.admins(user_id) select id from auth.users where email='${COMPTE_TEST.email}';`);
}
test("profil joueur sans administration, puis accès autorisé et retrait du droit", async ({ page }) => {
  await login(page); await page.goto("/profil");
  await expect(page.getByRole("heading", { name: "Mon espace administrateur" })).toHaveCount(0);
  authorize(); await page.reload();
  await expect(page.getByRole("link", { name: "Indicateurs et statistiques" })).toBeVisible();
  await page.getByRole("link", { name: "Gestion des packs et questions" }).click();
  await expect(page.getByRole("heading", { name: "Relire les packs" })).toBeVisible();
  executerSql(`delete from histoire.admins where user_id=(select id from auth.users where email='${COMPTE_TEST.email}');`);
  await page.goto("/profil");
  await expect(page.getByRole("heading", { name: "Mon espace administrateur" })).toHaveCount(0);
});
test("recherche, ajout, retrait et réintégration depuis le pack au clavier", async ({ page }) => {
  await login(page); authorize(); await page.goto("/admin/packs?pack=E2E120");
  const open = page.getByRole("button", { name: "Ajouter des questions", exact: true });
  await open.focus(); await page.keyboard.press("Enter");
  const modal = page.getByRole("dialog", { name: "Ajouter des questions" });
  await modal.getByLabel("Titre recherché").fill("Question à rattacher E2E120");
  await modal.getByRole("button", { name: "Rechercher", exact: true }).click();
  await modal.getByRole("checkbox").check();
  await modal.getByRole("button", { name: "Ajouter / réintégrer (1)" }).click();
  const row = page.getByRole("row", { name: /Question à rattacher E2E120/ });
  await expect(row).toContainText("44 av. J.-C.");
  await row.getByRole("button", { name: "Retirer", exact: true }).click();
  await page.getByRole("button", { name: "Confirmer le retrait" }).click();
  await open.click();
  await modal.getByLabel("Titre recherché").fill("Question à rattacher E2E120");
  await modal.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(modal).toContainText("historique conservé");
  await modal.getByRole("checkbox").check();
  await modal.getByRole("button", { name: "Ajouter / réintégrer (1)" }).click();
  await expect(row).toContainText("Jouable");
  await open.click(); await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
test("création sourcée, précision annuelle et historique après rechargement", async ({ page }) => {
  await login(page); authorize(); await page.goto("/admin/packs?pack=E2E120");
  await page.getByRole("button", { name: "Ajouter des questions", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Ajouter des questions" });
  await modal.getByRole("button", { name: "Créer une nouvelle question" }).click();
  await modal.getByLabel("Titre de la question", { exact: true }).fill("Création sourcée E2E120");
  await modal.getByLabel("Description historique courte").fill("Texte pédagogique et sourcé de la fixture locale.");
  await modal.getByLabel("Début : année").fill("-44");
  await modal.getByLabel("Source 1", { exact: true }).fill("Référence documentaire vérifiée, p. 42");
  await modal.getByRole("button", { name: "Créer et ajouter au pack" }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("créée");
  const row = page.getByRole("row", { name: /Création sourcée E2E120/ });
  await expect(row).toContainText("44 av. J.-C."); await page.reload();
  await row.getByRole("button", { name: "Historique", exact: true }).click();
  await page.getByText("Création, sources et rattachements", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Référence documentaire vérifiée");
  const [event] = lireSql<{ precision: string; n: number }[]>("select e.precision,cardinality(c.sources) n from histoire.admin_event_creations c join histoire.events e on e.id=c.event_id where c.payload->>'pack_id'='E2E120'");
  expect(event).toEqual({ precision: "YEAR", n: 1 });
});
