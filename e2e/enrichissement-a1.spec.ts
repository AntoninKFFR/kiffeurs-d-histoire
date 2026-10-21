import {expect,test} from '@playwright/test';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,cpSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import lot from '../content/enrichissement-v12/a1.json';
import massif from '../content/enrichissement-v12/massif.json';
import massif2 from '../content/enrichissement-v12/massif2.json';
import {estUrlLocale} from '../scripts/import-cartes';
import {executerSql,lireSql,statutLocal} from './local';
import {attendreQuestion,idPartie,lireBilan,repondreAuClavier,repondreInverse,validerEtContinuer} from './outils';
const migration='supabase/migrations/20261016095716_enrichissement_v12_a1.sql';
for(const inverse of [false,true])for(const pack of [
 {id:'COL-0114',nom:'Sorties de films cultes'}, {id:'COL-0115',nom:'Pop culture'}]){
 test(`A1 : Débutant ${pack.nom}, ${inverse?'10 inversées':'20 dates'}, correction et replay`,async({page})=>{
  await page.goto(inverse?'/inverse':'/solo');
  await page.getByRole('group',{name:'Niveau'}).getByRole('button',{name:/^Débutant/}).click();
  const longueurs=page.getByRole('group',{name:'Longueur de la partie'});
  // Sélectionner le pack avec une longueur de cinq pour afficher les insuffisances réelles.
  await longueurs.getByRole('button',{name:/^5 questions/}).click();
  await page.getByRole('button',{name:'Pack',exact:true}).click();
  await page.getByRole('button',{name:new RegExp('^'+pack.nom)}).click();
  if(inverse){
   // Le sélecteur Inversé propose exclusivement la date exacte, donc DAY.
   const disponibles=lireSql<{n:number}[]>(`select (histoire.available_questions(p_niveau=>1,p_pack_id=>'${pack.id}',p_direction=>'inverse')->>'DAY')::int n`)[0].n;
   if(disponibles<20)await expect(longueurs.getByRole('button',{name:/^20 questions/})).toBeDisabled();
   else await expect(longueurs.getByRole('button',{name:/^20 questions/})).toBeEnabled();
  }
  const n=inverse?10:20;
  await longueurs.getByRole('button',{name:new RegExp('^'+n+' questions')}).click();
  await expect(page.getByRole('button',{name:'Jouer',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  expect(await attendreQuestion(page,1)).toBe(n);
  const jeu=idPartie(page),nouveaux=new Set([...lot.events,...massif.events,...massif2.events].map(e=>e.id));
  if(inverse)expect(new URLSearchParams(new URL(page.url()).searchParams.get('c')!).get('difficulte')).toBe('DAY');
  const questions=lireSql<{event_id:string;niveau:number;expected_year:number;answer:string}[]>(`select q.event_id,e.niveau,q.expected_year,
    coalesce((select a.alias from histoire.event_aliases a where a.event_id=q.event_id order by length(a.alias),a.alias limit 1),e.title) answer
    from histoire.game_questions q join histoire.events e on e.id=q.event_id where q.game_id='${jeu}' order by q.position`);
  expect(questions).toHaveLength(n);expect(questions.every(q=>q.niveau===1)).toBe(true);
  expect(questions.some(q=>nouveaux.has(q.event_id))).toBe(true);
  for(let i=1;i<=n;i++){
   await attendreQuestion(page,i);
   if(inverse)expect(await repondreInverse(page,questions[i-1].answer)).toContain('Bonne réponse');
   else{await repondreAuClavier(page,questions[i-1].expected_year);await validerEtContinuer(page);}
  }
  const {bilan,precision}=await lireBilan(page);expect(precision).toBe(100);
  await bilan.getByRole('button',{name:'Rejouer',exact:true}).click();
  expect(await attendreQuestion(page,1)).toBe(n);
  const choix=new URLSearchParams(new URL(page.url()).searchParams.get('c')!);
  expect(choix.get('pack')).toBe(pack.id);expect(choix.get('niveau')).toBe('1');
 });
}
test('V1.2 : vrai réimport préservant A1, Massif et Massif2, refus des collisions avant toute écriture',()=>{
 const statut=statutLocal();if(!estUrlLocale(statut.API_URL))throw new Error('A1 exclusivement local');
 const env={...process.env,SUPABASE_URL:statut.API_URL,SUPABASE_SERVICE_ROLE_KEY:statut.SERVICE_ROLE_KEY};
 const ids=[...lot.events,...massif.events,...massif2.events].map(e=>"'"+e.id+"'").join(',');
 const nouvelles=()=>lireSql(`select e.id,to_jsonb(e) evenement,to_jsonb(a) reponse,
   (select jsonb_agg(x order by alias) from histoire.event_aliases x where x.event_id=e.id) alias,
   (select jsonb_agg(x order by pack_id) from histoire.pack_events x where x.event_id=e.id) liens,
   (select jsonb_agg(x order by pack_id) from histoire.admin_pack_additions x where x.event_id=e.id) protections
   from histoire.events e join histoire.event_answers a on a.event_id=e.id where e.id in(${ids}) order by e.id`);
 const etat=lireSql<{evenement:unknown;statut:unknown}[]>(`select to_jsonb(e) evenement,to_jsonb(s) statut
   from histoire.events e left join histoire.pack_event_status s on s.event_id=e.id and s.pack_id='COL-0114'
   where e.id='EVT-2300'`);
 // Modifications locales avant réimport : titre/niveau, sources, position et retrait.
 executerSql(`update histoire.events set title='Titre de fixture corrigé avant réimport A1',niveau=2 where id='EVT-2300';
   insert into histoire.pack_event_status values('COL-0114','EVT-2300',true) on conflict(pack_id,event_id) do update set removed=true;`);
 try{
  const avant=nouvelles();expect(avant).toHaveLength(353);
  execFileSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/import-dataset.ts','--dossier','content/dataset-v18'],{env,stdio:['ignore','ignore','inherit']});
  executerSql(readFileSync(migration,'utf8'));
  executerSql(readFileSync('supabase/migrations/20261016124921_enrichissement_v12_massif.sql','utf8'));
  executerSql(readFileSync('supabase/migrations/20261017172349_enrichissement_v12_massif2.sql','utf8'));
  expect(nouvelles()).toEqual(avant);
  expect(lireSql<{removed:boolean}[]>(`select removed from histoire.pack_event_status where pack_id='COL-0114' and event_id='EVT-2300'`)).toEqual([{removed:true}]);
  const tables=lireSql<{tablename:string}[]>(`select tablename from pg_tables where schemaname='histoire' order by tablename`);
  for(const t of tables)if(!/^[a-z_][a-z_0-9]*$/.test(t.tablename))throw new Error('Nom de table inattendu');
  // UNION ALL ne garantit pas l’ordre des tables, notamment avec Parallel Append.
  // Les lignes de chaque table et la liste des tables ont chacune leur tri explicite.
  const empreintes=()=>lireSql('select * from ('+tables.map(t=>`select '${t.tablename}' tablename,md5(coalesce(string_agg(to_jsonb(x)::text,chr(10) order by to_jsonb(x)::text),'')) empreinte from histoire.${t.tablename} x`).join(' union all ')+') empreintes order by tablename');
  const integrite=empreintes();
  const dossier=mkdtempSync(join(tmpdir(),'kffr-a1-import-'));
  try{
   cpSync('content/dataset-v18',dossier,{recursive:true});
   const fichier=join(dossier,'kiffeurs-events-v18.csv');
   const originalCsv=readFileSync(fichier,'utf8');
   for(const [id,nom] of [['EVT-2300','A1'],['EVT-2500','Massif'],['EVT-2800','Massif2']]){
    writeFileSync(fichier,originalCsv.replace(/\bEVT-\d+\b/,id));
    const refus=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/import-dataset.ts','--dossier',dossier],{env,encoding:'utf8'});
    expect(refus.status).not.toBe(0);expect(refus.stderr).toContain('Identifiants réservés au lot V1.2 '+nom);
    expect(empreintes()).toEqual(integrite);
   }
  }finally{
   const parent=resolve(tmpdir())+sep,cible=resolve(dossier);
   if(!cible.startsWith(parent)||!cible.slice(parent.length).startsWith('kffr-a1-import-'))throw new Error('Nettoyage hors fixture refusé');
   rmSync(cible,{recursive:true,force:true});
  }
 }finally{
  // La correction ne visait que les colonnes title/niveau ; restaurer les valeurs.
  const original=etat[0].evenement as {title:string;niveau:number};
  executerSql(`update histoire.events set title='${original.title.replaceAll("'","''")}',niveau=${original.niveau} where id='EVT-2300';`);
  const precedent=etat[0].statut as {removed:boolean}|null;
  executerSql(precedent?`update histoire.pack_event_status set removed=${precedent.removed} where pack_id='COL-0114' and event_id='EVT-2300'`:
    `delete from histoire.pack_event_status where pack_id='COL-0114' and event_id='EVT-2300'`);
 }
});
