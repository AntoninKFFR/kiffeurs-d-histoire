import {expect,test} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import lot from '../content/enrichissement-v12/a0.json';
import {estUrlLocale} from '../scripts/import-cartes';
import {executerSql,lireSql,statutLocal} from './local';
import {attendreQuestion,idPartie,lireBilan,repondreAuClavier,repondreInverse,validerEtContinuer} from './outils';
const migration='supabase/migrations/20261015222704_enrichissement_v12_a0.sql';

for(const inverse of [false,true]){
 test('A0 : cinq questions napoléoniennes Débutant, correction et replay ; inverse='+inverse,async({page})=>{
  await page.goto(inverse?'/inverse':'/solo');
  await page.getByRole('group',{name:'Niveau'}).getByRole('button',{name:/^Débutant/}).click();
  await page.getByRole('group',{name:'Longueur de la partie'}).getByRole('button',{name:/^5 questions/}).click();
  await page.getByRole('button',{name:'Pack',exact:true}).click();
  await page.getByRole('button',{name:/^Époque napoléonienne/}).click();
  await expect(page.getByRole('button',{name:'Jouer',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  expect(await attendreQuestion(page,1)).toBe(5);
  const game=idPartie(page);
  const questions=lireSql<{event_id:string;niveau:number}[]>(`select q.event_id,e.niveau from histoire.game_questions q join histoire.events e on e.id=q.event_id where game_id='${game}'`);
  const ajouts=new Set(lot.associations.filter(a=>a.pack_id==='COL-0067').map(a=>a.event_id));
  expect(questions).toHaveLength(5);expect(questions.every(q=>q.niveau===1)).toBe(true);
  expect(questions.some(q=>ajouts.has(q.event_id))).toBe(true);
  for(let n=1;n<=5;n++){
   await attendreQuestion(page,n);
   if(inverse)await repondreInverse(page,'Réponse de fixture');
   else{await repondreAuClavier(page);await validerEtContinuer(page);}
  }
  const {bilan}=await lireBilan(page);
  await bilan.getByRole('button',{name:'Rejouer',exact:true}).click();
  await attendreQuestion(page,1);
  const choix=new URLSearchParams(new URL(page.url()).searchParams.get('c')!);
  expect(choix.get('pack')).toBe('COL-0067');expect(choix.get('niveau')).toBe('1');
 });
}
test('A0 : le vrai réimport conserve les dix liens, leurs positions et un retrait',()=>{
 const statut=statutLocal();
 if(!estUrlLocale(statut.API_URL))throw new Error('Test A0 exclusivement local');
 const valeurs=lot.associations.map(a=>`('${a.pack_id}','${a.event_id}')`).join(',');
 const liens=()=>lireSql(`select pe.* from histoire.pack_events pe join (values ${valeurs}) v(pack_id,event_id) using(pack_id,event_id) order by pe.pack_id,pe.event_id`);
 const marqueurs=()=>lireSql(`select a.* from histoire.admin_pack_additions a join (values ${valeurs}) v(pack_id,event_id) using(pack_id,event_id) order by a.pack_id,a.event_id`);
 const avant=liens(),proteges=marqueurs();
 expect(avant).toHaveLength(10);expect(proteges).toHaveLength(10);
 const precedents=lireSql<{removed:boolean}[]>(`select removed from histoire.pack_event_status where pack_id='COL-0067' and event_id='EVT-0682'`);
 executerSql(`insert into histoire.pack_event_status values('COL-0067','EVT-0682',true) on conflict(pack_id,event_id) do update set removed=true`);
 try{
  execFileSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/import-dataset.ts','--dossier','content/dataset-v18'],{
   env:{...process.env,SUPABASE_URL:statut.API_URL,SUPABASE_SERVICE_ROLE_KEY:statut.SERVICE_ROLE_KEY},stdio:['ignore','ignore','inherit']});
  executerSql(readFileSync(migration,'utf8'));
  expect(liens()).toEqual(avant);expect(marqueurs()).toEqual(proteges);
  expect(lireSql<{removed:boolean}[]>(`select removed from histoire.pack_event_status where pack_id='COL-0067' and event_id='EVT-0682'`)).toEqual([{removed:true}]);
 }finally{
  executerSql(precedents.length?`update histoire.pack_event_status set removed=${precedents[0].removed} where pack_id='COL-0067' and event_id='EVT-0682'`:
   `delete from histoire.pack_event_status where pack_id='COL-0067' and event_id='EVT-0682'`);
 }
});
