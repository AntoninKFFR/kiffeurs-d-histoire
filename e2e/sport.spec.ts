import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sport from "../content/sport/packs-proposes.json";
import massif from '../content/enrichissement-v12/massif.json';
import { executerSql, lireSql, statutLocal } from "./local";
import { estUrlLocale } from "../scripts/import-cartes";
import { attendreQuestion, idPartie, lireBilan, repondreAuClavier, repondreInverse, validerEtContinuer } from "./outils";

for (const inverse of [false,true]) {
  test(`vrai Sport : six sous-packs, partie et replay, inverse=${inverse}`, async ({ page }, info) => {
    await page.goto(inverse ? "/inverse" : "/solo");
    await page.getByRole("group", { name: "Niveau" }).getByRole("button", { name: /^Toutes les questions/ }).click();
    await page.getByRole("group", { name: "Longueur de la partie" }).getByRole("button", { name: /^5 questions/ }).click();
    await page.getByRole("button", { name: "Pack", exact: true }).click();
    const parent = page.getByRole("button", { name: /^Jouer tout Sport/ });
    await parent.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Packs disponibles" })).toBeVisible();
    await page.getByRole("button", { name: "Voir les sous-thèmes de Sport" }).click();
    await expect(page.getByRole("heading", { name: "Sport", exact: true })).toBeFocused();
    expect(new URLSearchParams(await page.locator('input[name="c"]').inputValue()).get("pack")).toBe("COL-0105");
    await expect(page.getByRole("button", { name: "Jouer", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: /Tous les packs/ }).click();
    await expect(parent).toHaveAttribute("aria-pressed", "true");
    expect(new URLSearchParams(await page.locator('input[name="c"]').inputValue()).get("pack")).toBe("COL-0105");
    await page.getByRole("button", { name: "Voir les sous-thèmes de Sport" }).click();
    for (const p of sport.packs.slice(1)) {
      const bouton = page.getByRole("button", { name: p.title, exact: false });
      const ajouts=massif.events.filter(e=>e.packs.includes(p.id)&&e.precision==='DAY').length;
      if (inverse && p.comptes.inverse[2]+ajouts<5) await expect(bouton).toBeDisabled();
      else await expect(bouton).toBeEnabled();
    }
    await page.getByRole("button", { name: /^Tout le pack/ }).click();
    const total = inverse ? 69 : 437;
    await expect(page.getByText(`${total} questions réellement jouables.`, { exact: true })).toBeVisible();
    const mesure = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
    expect(mesure.sw).toBeLessThanOrEqual(mesure.width);
    if (info.project.name === "ordinateur") expect(mesure.sh).toBeLessThanOrEqual(mesure.height + 2);
    await page.getByRole("button", { name: /^Football/ }).click();
    await page.getByRole("button", { name: "Jouer", exact: true }).click();
    expect(await attendreQuestion(page, 1)).toBe(5);
    const id = idPartie(page);
    const questions = lireSql<{ event_id: string }[]>(`select event_id from histoire.game_questions where game_id='${id}'`);
    const football = new Set([...sport.associations.filter((a) => a.sous_pack === "COL-0106").map((a) => a.event_id),
      ...massif.events.filter(e=>e.packs.includes('COL-0106')).map(e=>e.id)]);
    expect(questions.every((q) => football.has(q.event_id))).toBe(true);
    expect(new Set(questions.map((q) => q.event_id)).size).toBe(5);
    for (let n=1;n<=5;n++) {
      await attendreQuestion(page,n);
      if (inverse) await repondreInverse(page,"Événement de démonstration");
      else { await repondreAuClavier(page); await validerEtContinuer(page); }
    }
    const { bilan } = await lireBilan(page);
    await bilan.getByRole("button", { name: "Rejouer", exact: true }).click();
    await attendreQuestion(page,1);
    expect(new URLSearchParams(new URL(page.url()).searchParams.get("c")!).get("pack")).toBe("COL-0106");
    await page.goto(inverse ? "/inverse" : "/solo");
    await expect(page.getByRole("button", { name: /^Football/ })).toHaveAttribute("aria-pressed","true");
    await page.getByRole("button", { name: /Tous les packs/ }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: /^Football/ })).toHaveAttribute("aria-pressed","true");
  });
}
test("réimport et migration répétée préservent les 24 packs, Sport et les retraits", async () => {
  const statut = statutLocal();
  if (!estUrlLocale(statut.API_URL)) throw new Error("Test Sport exclusivement local");
  const anciens = () => lireSql("select p.*, coalesce((select jsonb_agg(to_jsonb(pe) order by pe.event_id) from histoire.pack_events pe where pe.pack_id=p.id),'[]') contenu from histoire.packs p where p.id between 'COL-0059' and 'COL-0082' order by p.id");
  const avant = anciens();
  const fun = () => lireSql("select p.*, (select jsonb_agg(to_jsonb(pe) order by pe.event_id) from histoire.pack_events pe where pe.pack_id=p.id) contenu from histoire.packs p where p.id between 'COL-0112' and 'COL-0117' order by p.id");
  const avantFun = fun();
  const nouveauxFun = () => lireSql("select e.*,to_jsonb(a) reponse from histoire.events e join histoire.event_answers a on a.event_id=e.id where e.id between 'EVT-2100' and 'EVT-2203' order by e.id");
  const evenementsFun = nouveauxFun();
  expect(avantFun).toHaveLength(6);expect(evenementsFun).toHaveLength(104);
  expect(avant).toHaveLength(24);
  executerSql("insert into histoire.pack_event_status(pack_id,event_id,removed) values ('COL-0107','EVT-0759',true) on conflict(pack_id,event_id) do update set removed=true;");
  executerSql("insert into histoire.pack_event_status(pack_id,event_id,removed) values ('COL-0113','EVT-2100',true) on conflict(pack_id,event_id) do update set removed=true;");
  try {
    execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/import-dataset.ts","--dossier","content/dataset-v18"],{
      env: { ...process.env, SUPABASE_URL: statut.API_URL, SUPABASE_SERVICE_ROLE_KEY: statut.SERVICE_ROLE_KEY }, stdio: ["ignore","ignore","inherit"],
    });
    executerSql(readFileSync("supabase/migrations/20261011111510_pack_sport.sql","utf8"));
    executerSql(readFileSync("supabase/migrations/20261015120156_packs_fun.sql","utf8"));
    expect(fun()).toEqual(avantFun);expect(nouveauxFun()).toEqual(evenementsFun);
    expect(lireSql<{removed:boolean}[]>("select removed from histoire.pack_event_status where pack_id='COL-0113' and event_id='EVT-2100'")[0].removed).toBe(true);
    expect(anciens()).toEqual(avant);
    const etat = lireSql<{ n: number; scope: number; removed: boolean; parent: string }[]>("select (select count(*)::int from histoire.pack_events where pack_id between 'COL-0105' and 'COL-0111') n, (histoire.available_questions(p_pack_id=>'COL-0107')->>'YEAR')::int scope, (select removed from histoire.pack_event_status where pack_id='COL-0107' and event_id='EVT-0759') removed, (select parent_id from histoire.packs where id='COL-0107') parent")[0];
    expect(etat).toEqual({ n:877, scope:93, removed:true, parent:"COL-0105" });
  } finally { executerSql("delete from histoire.pack_event_status where (pack_id='COL-0107' and event_id='EVT-0759') or (pack_id='COL-0113' and event_id='EVT-2100');"); }
});
