import { expect, test } from "@playwright/test";
import { lireSql } from "./local";
import { attendreQuestion, idPartie, lireBilan, repondreAuClavier, repondreInverse, validerEtContinuer } from "./outils";

for (const inverse of [false,true]) {
  test(`Expert Sport exclusif, mémoire et Rejouer, inverse=${inverse}`, async ({page}) => {
    await page.goto(inverse?"/inverse":"/solo");
    const niveaux=page.getByRole("group",{name:"Niveau"});
    await expect(niveaux.getByRole("button")).toHaveCount(4);
    await expect(niveaux.getByRole("button",{name:/^Toutes les questions/})).toHaveAttribute("aria-pressed","true");
    await page.getByRole("button",{name:"Pack",exact:true}).click();
    await page.getByRole("button",{name:/^Jouer tout Sport/}).click();
    await expect(page.getByText(inverse?"29 questions réellement jouables.":"397 questions réellement jouables.",{exact:true})).toBeVisible();
    await niveaux.getByRole("button",{name:/^Expert/}).click();
    await expect(niveaux.getByRole("button",{name:/^Toutes les questions/})).toHaveAttribute("aria-pressed","false");
    const comptes=lireSql<{ n:number }[]>(`select (histoire.available_questions(p_expert_only=>true,p_niveau=>3,p_pack_id=>'COL-0105',p_direction=>'${inverse?"inverse":"date"}')->>'${inverse?"DAY":"YEAR"}')::int n`)[0].n;
    if(!inverse) expect(comptes).toBe(369);
    await expect(page.getByText(`${comptes} questions réellement jouables.`,{exact:true})).toBeVisible();
    for(const longueur of [10,20]) {
      const bouton=page.getByRole("button",{name:new RegExp(`^${longueur} questions`)});
      if(comptes<longueur) await expect(bouton).toBeDisabled(); else await expect(bouton).toBeEnabled();
    }
    await page.getByRole("button",{name:/^5 questions/}).click();
    await page.getByRole("button",{name:"Voir les sous-thèmes de Sport"}).click();
    expect(new URLSearchParams(await page.locator('input[name="c"]').inputValue()).get("expertOnly")).toBe("1");
    await page.getByRole("button",{name:/Tous les packs/}).click();
    await page.getByRole("button",{name:"Jouer",exact:true}).click();
    expect(await attendreQuestion(page,1)).toBe(5);
    const id=idPartie(page);
    const questions=lireSql<{ niveau:number }[]>(`select e.niveau from histoire.game_questions q join histoire.events e on e.id=q.event_id where q.game_id='${id}'`);
    expect(questions).toHaveLength(5);expect(questions.every(q=>q.niveau===3)).toBe(true);
    const snapshot=lireSql<{ f:{ expertOnly:boolean; niveau:number } }[]>(`select context->'replay_filters' f from histoire.games where id='${id}'`)[0].f;
    expect(snapshot.expertOnly).toBe(true);expect(snapshot.niveau).toBe(3);
    for(let n=1;n<=5;n++) {
      await attendreQuestion(page,n);
      if(inverse) await repondreInverse(page,"Réponse E2E"); else {await repondreAuClavier(page);await validerEtContinuer(page);}
    }
    const {bilan}=await lireBilan(page);
    await expect(bilan.getByText(/Expert/)).toBeVisible();
    await bilan.getByRole("button",{name:"Rejouer",exact:true}).click();
    await attendreQuestion(page,1);
    expect(new URLSearchParams(new URL(page.url()).searchParams.get("c")!).get("expertOnly")).toBe("1");
    await page.goto(inverse?"/inverse":"/solo");
    await expect(niveaux.getByRole("button",{name:/^Expert/})).toHaveAttribute("aria-pressed","true");
  });
}
