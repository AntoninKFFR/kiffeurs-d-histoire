// Scénario appelé seulement par la fixture Docker/PostgREST vérifiée de #92.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {corpusHan117,autorisationHan117,sqlPublicationHan117,sqlRollbackHan117,sqlSauvegardeHan117,verifierSauvegardeHan117} from './release-han-117';
import {exporterArtefacts92,sqlExport92} from './release-pedagogique-92';
import {ANCIENNE_DATE_HAN_117} from './han-117';
import {verifierPhase3Navigateur} from './verifier-phase3-browser';
type Sql=(query:string)=>string;
const lit=(x:string)=>"'"+x.replaceAll("'","''")+"'";
async function commande(args:string[],env=process.env){await new Promise<void>((ok,ko)=>{const p=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',ko);p.on('exit',n=>n===0?ok():ko(new Error(output)));});}
type LecteurCartes={rpc:(nom:'get_chapter_cards_version',args:{p_chapter_id:string;p_version:string})=>PromiseLike<{data:unknown;error:unknown}>};
export async function testerHan117Local(sql:Sql,publicDb:LecteurCartes,env:NodeJS.ProcessEnv,build:boolean){
 const H='00000000-0000-0000-0000-000000001177';
 const joueur=(q:string)=>`set role authenticated; select set_config('request.jwt.claim.sub','${H}',false);${q}`;
 const obj=<T,>(q:string)=>JSON.parse(sql(q).split('\n').at(-1)!) as T;
 const snapshot=(table:string,where='true')=>sql(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from histoire.${table} t where ${where}`);
 // Le moteur choisit aléatoirement les questions période, même avec tout le corpus.
 // Répéter de vraies parties jusqu’au tirage Han ; ne pas fabriquer une question.
 const partieAvecPeriodeHan=(chapter:string)=>{
  for(let essai=0;essai<30;essai++){
   const g=obj<{game_id:string}>(joueur(`select histoire.start_game(p_periodes=>true,p_chapter_ids=>array['${chapter}'],p_question_count=>0);`));
   if(sql(`select count(*) from histoire.game_questions where game_id='${g.game_id}' and event_id='EVT-0040' and periode`)==='1')return g;
  }
  throw new Error('Aucune question période Han après 30 tirages réels');
 };
 const jouerToutes=(id:string)=>{
  // L’administrateur de fixture lit les réponses attendues ; le rôle joueur
  // ne lit jamais la table privée et répond seulement par les RPC publiques.
  const questions=obj<{id:string;expected_year:number;expected_end_year:number|null;periode:boolean}[]>(`select jsonb_agg(jsonb_build_object('id',id,'expected_year',expected_year,'expected_end_year',expected_end_year,'periode',periode) order by position) from histoire.game_questions where game_id='${id}'`);
  sql(joueur(questions.map(q=>`select histoire.next_question('${id}',null);select histoire.${q.periode?'submit_period_answer':'submit_answer'}('${id}','${q.id}',${q.expected_year},null,null,${q.periode?`${q.expected_end_year},null,null,null`:'null,null'});`).join('\n')+`select histoire.finish_game('${id}',null);`));
 };
 sql(`insert into auth.users values('${H}'); update histoire.events set date_status='EXACT' where id='EVT-0040';update histoire.event_answers set start_year=9,end_year=25,date_text=${lit(ANCIENNE_DATE_HAN_117)} where event_id='EVT-0040';
 update histoire.chapter_cards set sort_order=sort_order+1000 where chapter_id='THM-049' and sort_order between 2 and 4;
 update histoire.chapter_cards set sort_order=case event_id when 'EVT-0040' then 4 when 'EVT-0041' then 2 when 'EVT-0371' then 3 else sort_order end where chapter_id='THM-049';
 update histoire.chapter_cards set start_year=9,end_year=25,date_status='EXACT',date_text=${lit(ANCIENNE_DATE_HAN_117)} where chapter_id='THM-049' and event_id='EVT-0040';`);
 sql("delete from histoire.event_tags where event_id='EVT-0040' and tag_id=any(array['TAG-0074','TAG-0087','TAG-0193']);insert into histoire.event_tags(event_id,tag_id,confidence) values('EVT-0040','TAG-0076','HIGH'),('EVT-0040','TAG-0085','HIGH') on conflict(event_id,tag_id) do nothing");
 const legacy=obj<{game_id:string}>(joueur("select histoire.start_chapter_test_version(null,'THM-006','YEAR',5,'legacy-v1');"));
 const oldGeneral=partieAvecPeriodeHan('THM-006');
 assert.equal(sql(`select expected_year||'/'||expected_end_year from histoire.game_questions where game_id='${oldGeneral.game_id}' and event_id='EVT-0040'`),'9/25');
 for(const id of [legacy.game_id,oldGeneral.game_id])sql(`update histoire.game_questions set answered_at=now(),answer_year=expected_year,answer_month=expected_month,answer_day=expected_day,answer_end_year=expected_end_year,accuracy=83,points=83 where game_id='${id}'; update histoire.games set state='finished',finished_at=now(),average_accuracy=83,total_points=83*question_count where id='${id}';`);
 sql(joueur(`select histoire.record_chapter_test('${legacy.game_id}');`));
 const anciensJeux=snapshot('games',`t.id=any(array['${legacy.game_id}','${oldGeneral.game_id}']::uuid[])`);
 const anciennesQuestions=snapshot('game_questions',`t.game_id=any(array['${legacy.game_id}','${oldGeneral.game_id}']::uuid[])`);
 const editionsAvant=snapshot('pedagogical_editions','t.published');
 const oldProgress=snapshot('learning_progress',`t.user_id='${H}' and t.chapter_id='THM-006'`);
 verifierSauvegardeHan117(obj<Parameters<typeof verifierSauvegardeHan117>[0]>(sqlSauvegardeHan117()));
 const preuve={autorisation:autorisationHan117(),sauvegarde_sha256:'0'.repeat(64),verification:'fixture-locale-sans-valeur-attestation'};
 const publication=sqlPublicationHan117(preuve);
 const refuse=publication.replace("perform histoire.set_pedagogical_group_active('THM-006',true,","perform histoire.set_pedagogical_group_active('THM-006',true,'catalogue-invalide'||");
 assert.throws(()=>sql(refuse),'Une validation de catalogue fausse doit faire échouer toute la transaction');
 sql("update histoire.event_answers set start_year=8 where event_id='EVT-0040'");
 assert.throws(()=>sql(publication),'Un canon tiers doit imposer un nouvel audit');
 assert.equal(sql("select start_year from histoire.event_answers where event_id='EVT-0040'"),'8');
 sql("update histoire.event_answers set start_year=9 where event_id='EVT-0040';update histoire.pedagogical_units set blocages=array['validation-externe'] where chapter_id='THM-047'");
 assert.throws(()=>sql(publication),'Un blocage indépendant de Han doit rester opérant');
 assert.equal(sql("select blocages::text from histoire.pedagogical_units where chapter_id='THM-047'"),'{validation-externe}');
 sql("update histoire.pedagogical_units set blocages='{}' where chapter_id='THM-047'");
 assert.equal(sql("select start_year from histoire.event_answers where event_id='EVT-0040'"),'9','Canon partiellement modifié après refus');
 assert.equal(sql("select blocages::text from histoire.pedagogical_units where chapter_id='THM-049'"),'{han-canon-incoherent}');
 sql(publication);
 assert.equal(sql("select string_agg(et.tag_id,',' order by et.tag_id) from histoire.event_tags et join histoire.tags t on t.id=et.tag_id where et.event_id='EVT-0040' and t.tag_type in ('DATE_STATUS','CENTURY')"),'TAG-0074,TAG-0087,TAG-0193');
 assert.equal(snapshot('pedagogical_editions',"t.published and t.chapter_id<>all(array['THM-047','THM-048','THM-049'])"),editionsAvant);
 assert.equal(snapshot('games',`t.id=any(array['${legacy.game_id}','${oldGeneral.game_id}']::uuid[])`),anciensJeux);
 assert.equal(snapshot('game_questions',`t.game_id=any(array['${legacy.game_id}','${oldGeneral.game_id}']::uuid[])`),anciennesQuestions);
 const bilanAncien=obj<{questions:{correct_date:{year:number};correct_end_date?:{year:number}}[]}>(joueur(`select histoire.finish_game('${oldGeneral.game_id}',null)`));
 assert(bilanAncien.questions.some(q=>q.correct_date.year===9&&q.correct_end_date?.year===25),'Le bilan ancien doit conserver 9/25');
 const editions86=snapshot('pedagogical_editions','t.published');sql(publication);assert.equal(snapshot('pedagogical_editions','t.published'),editions86);
 for(const [id,n] of [['THM-047',11],['THM-048',8],['THM-049',5]] as const){const r=await publicDb.rpc('get_chapter_cards_version',{p_chapter_id:id,p_version:'sous-chapitres-v1'});assert.ifError(r.error);assert(Array.isArray(r.data));assert.equal(r.data.length,n);assert(!/"(?:event_id|sources)"\s*:/.test(JSON.stringify(r.data)),'Champ privé dans la projection publique');}
 const test=obj<{game_id:string}>(joueur("select histoire.start_chapter_test_version(null,'THM-049','YEAR',5,'sous-chapitres-v1');"));
 assert.deepEqual(obj<{event_id:string;year:number;periode:boolean}[]>(`select jsonb_agg(jsonb_build_object('event_id',event_id,'year',expected_year,'periode',periode) order by expected_year) from histoire.game_questions where game_id='${test.game_id}'`).map(q=>[q.event_id,q.year,q.periode]),[['EVT-0370',-221,false],['EVT-0040',-206,false],['EVT-0041',-141,false],['EVT-0371',-138,false],['EVT-0392',220,false]]);
 jouerToutes(test.game_id);sql(joueur(`select histoire.record_chapter_test('${test.game_id}');`));
 assert.equal(Number(sql(`select best_accuracy from histoire.learning_progress where user_id='${H}' and chapter_id='THM-049'`)),100);
 const nouveauGeneral=partieAvecPeriodeHan('THM-049');
 assert.equal(sql(`select expected_year||'/'||expected_end_year from histoire.game_questions where game_id='${nouveauGeneral.game_id}' and event_id='EVT-0040' and periode`),'-206/220');
 jouerToutes(nouveauGeneral.game_id);
 assert.equal(Number(sql(`select accuracy from histoire.game_questions where game_id='${nouveauGeneral.game_id}' and event_id='EVT-0040'`)),100);
 const scores=snapshot('learning_progress',`t.user_id='${H}'`);
 sql(sqlRollbackHan117());assert.equal(sql("select count(*) from histoire.pedagogical_units where parent_id='THM-006' and etat='historique'"),'3');
 assert.equal(snapshot('learning_progress',`t.user_id='${H}'`),scores);assert.equal(snapshot('pedagogical_editions','t.published'),editions86);
 assert.deepEqual(obj(joueur(`select histoire.finish_game('${oldGeneral.game_id}',null)`)),bilanAncien,'Ancien bilan changé au repli');
 const relance=obj<{game_id:string}>(joueur("select histoire.start_chapter_test_version(null,'THM-049','YEAR',5,'sous-chapitres-v1');"));
 assert.equal(sql(`select count(*) from histoire.game_questions where game_id='${relance.game_id}'`),'5','Relance de l’édition historique au repli');
 assert.equal(sql(`select expected_year from histoire.game_questions where game_id='${relance.game_id}' and event_id='EVT-0040'`),'-206');
 sql(publication);assert.equal(snapshot('learning_progress',`t.user_id='${H}'`),scores);assert.equal(snapshot('pedagogical_editions','t.published'),editions86);
 assert.deepEqual(obj(joueur(`select histoire.finish_game('${oldGeneral.game_id}',null)`)),bilanAncien,'Ancien bilan changé à la republication');
 assert.equal(snapshot('learning_progress',`t.user_id='${H}' and t.chapter_id='THM-006'`),oldProgress);
 const fichiers=['src/lib/apprendre/structure.json','src/lib/solo/catalogue.json','content/pedagogie/cartes-publiees.json','content/pedagogie/etats-publies-92.json'];
 const backups=new Map(fichiers.map(f=>[f,existsSync(f)?readFileSync(f):null]));
 try{
  const data=obj<Parameters<typeof exporterArtefacts92>[0]>(sqlExport92());
  assert.deepEqual(exporterArtefacts92(data),{unites:59,publiques:59,empreintes:617});
  await commande(['node_modules/tsx/dist/cli.mjs','scripts/build-catalogue-solo.ts']);
  const cat=JSON.parse(readFileSync('src/lib/solo/catalogue.json','utf8'));assert.equal(cat.chapitres['THM-049'].t.YEAR,5);assert.equal(cat.chapitres['THM-049'].t.MONTH,0);assert.equal(cat.chapitres['THM-049'].t.DAY,0);
  if(build){const buildEnv={...env,NEXT_PUBLIC_SUPABASE_URL:env.SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:env.HAN_ANON_KEY};await commande(['node_modules/next/dist/bin/next','build'],buildEnv);await commande(['node_modules/tsx/dist/cli.mjs','scripts/verifier-apprendre.ts']);await verifierPhase3Navigateur(buildEnv,true);}
 }finally{for(const[f,b]of backups)if(b)writeFileSync(f,b);else if(existsSync(f))unlinkSync(f);}
 sql(sqlRollbackHan117());
 // Nettoyage des seules données du joueur synthétique de ce scénario dans la base jetable.
 sql(`delete from histoire.games where user_id='${H}';delete from histoire.learning_progress where user_id='${H}';delete from histoire.learning_progress_editions where user_id='${H}';delete from histoire.players where id='${H}';delete from auth.users where id='${H}';`);
 console.log('OK HAN #117 : ancien bilan 9/25 et 83 éditions conservés ; refus atomique, 24 cartes/3 enfants publiés deux fois, 5 vraies questions, période -206/220 corrigée à 100 %, Wudi intact, scores/archives conservés au rollback et à la republication ; catalogue 617 cartes / 59 routes.');
 assert.equal(corpusHan117().cartes.length,24);
}
