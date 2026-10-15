import { expect,test } from '@playwright/test';
import fun from '../content/fun/manifeste.json';
import { lireSql } from './local';
import { attendreQuestion,idPartie,repondreAuClavier,repondreInverse,validerEtContinuer,lireBilan } from './outils';
for(const inverse of [false,true]){
  test(`packs fun : films, partie et replay réels, inverse=${inverse}`,async({page},info)=>{
    await page.goto(inverse?'/inverse':'/solo');
    await page.getByRole('group',{name:'Niveau'}).getByRole('button',{name:/^Intermédiaire/}).click();
    await page.getByRole('group',{name:'Longueur de la partie'}).getByRole('button',{name:/^5 questions/}).click();
    await page.getByRole('button',{name:'Pack',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Pour le fun'})).toBeVisible();
    for(const p of fun.packs){
      await expect(page.getByRole('button',{name:new RegExp('^'+p.title)})).toBeEnabled();
    }
    const film=page.getByRole('button',{name:/^Sorties de films cultes/});
    await film.focus();await page.keyboard.press('Enter');
    expect(new URLSearchParams(await page.locator('input[name="c"]').inputValue()).get('pack')).toBe('COL-0114');
    const mesure=await page.evaluate(()=>({largeur:innerWidth,hauteur:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));
    expect(mesure.sw).toBeLessThanOrEqual(mesure.largeur);
    if(info.project.name==='ordinateur')expect(mesure.sh).toBeLessThanOrEqual(mesure.hauteur+2);
    await page.getByRole('button',{name:'Jouer',exact:true}).click();
    expect(await attendreQuestion(page,1)).toBe(5);
    const id=idPartie(page),ids=new Set(fun.associations.filter(a=>a.pack_id==='COL-0114').map(a=>a.event_id));
    expect(lireSql<{event_id:string}[]>(`select event_id from histoire.game_questions where game_id='${id}'`).every(q=>ids.has(q.event_id))).toBe(true);
    for(let n=1;n<=5;n++){
      await attendreQuestion(page,n);
      if(inverse)await repondreInverse(page,'Réponse de démonstration');
      else{await repondreAuClavier(page);await validerEtContinuer(page);}
    }
    const {bilan}=await lireBilan(page);
    await bilan.getByRole('button',{name:'Rejouer',exact:true}).click();
    await attendreQuestion(page,1);
    expect(new URLSearchParams(new URL(page.url()).searchParams.get('c')!).get('pack')).toBe('COL-0114');
    await page.goto(inverse?'/inverse':'/solo');await page.reload();
    await expect(page.getByRole('button',{name:/^Sorties de films cultes/})).toHaveAttribute('aria-pressed','true');
  });
}
