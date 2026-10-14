// Intégration réelle SDK → PostgREST → Postgres, sans serveur Supabase distant.
// Un Postgres labellisé et une base aléatoire jetable ; seules les données de fixture sont importées.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync,readdirSync,mkdtempSync,writeFileSync,unlinkSync,rmdirSync,existsSync,rmSync } from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,sep} from "node:path";
import { createServer } from "node:http";
import { randomBytes,createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chargerCartes,importerCartesSousChapitresLocales } from "./import-cartes";
import { chargerStructure } from "./structure-pedagogique";
import { cartePublique } from "../src/lib/pedagogie";
import {verifierDockerFixture,executerSqlDockerLocal} from "./verifier-docker-fixture";
import {testerMigrationSommeLocale} from "./test-migration-somme-local";
import {planCompletions,importerCompletionsLocales} from "./completions-pedagogiques";
import {lireCsv,type LigneCsv} from "./csv";
import { verifierPhase3Navigateur } from "./verifier-phase3-browser";
import { chargerCorpus92, sqlPublication92, sqlRollback92, sqlExport92, exporterArtefacts92, AUTORISATION_92, PROJET_92, SHA_APPROUVE_92, type Autorisation92 } from "./release-pedagogique-92";
const container=process.argv[process.argv.indexOf('--container')+1];
const corpusPhase3=process.argv.includes('--corpus-phase3');
const release92=process.argv.includes('--release92');
assert(!release92||corpusPhase3,'Le rehearsal release exige le corpus réel');
verifierDockerFixture(container);
const suffix=randomBytes(5).toString('hex'),database='kffr_api_'+suffix,network='kffr-issue92-api-'+suffix,api='kffr-issue92-rest-'+suffix;
const secret=randomBytes(32).toString('hex');
function sql(t:string){return executerSqlDockerLocal(container,database,t,8_000_000);}
const token=(role:string)=>{
  const part=(x:object)=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const value=part({alg:'HS256',typ:'JWT'})+'.'+part({role,exp:Math.floor(Date.now()/1000)+1800});
  return value+'.'+createHmac('sha256',secret).update(value).digest('base64url');
};
async function command(args:string[],env=process.env){
  await new Promise<void>((resolve,reject)=>{const p=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});let output='';
    p.stdout.on('data',b=>output+=String(b));p.stderr.on('data',b=>output+=String(b));p.on('error',reject);
    p.on('exit',code=>code===0?resolve():reject(new Error('Commande locale échouée : '+output)));});
}
async function main(){
  execFileSync('docker',['exec',container,'createdb','-U','postgres',database]);
  let server:ReturnType<typeof createServer>|undefined;
  let apiStarted=false,networkCreated=false,connected=false;
  try{
    // Les rôles et auth/public ne sont que des stubs de cette fixture jetable.
    sql(`create schema extensions; create schema auth; create table auth.users(id uuid primary key);
      alter role service_role bypassrls;
      create function auth.uid() returns uuid language sql as 'select coalesce(nullif(current_setting(''request.jwt.claim.sub'',true),''''),nullif(current_setting(''request.jwt.claims'',true),'''')::jsonb->>''sub'')::uuid';`);
    sql(readFileSync('supabase/fixtures/kffr_profiles.sql','utf8'));
    for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())sql(readFileSync('supabase/migrations/'+file,'utf8'));
    execFileSync('docker',['network','create','--label','kffr.audit=issue92-phase2',network],{stdio:'pipe'});networkCreated=true;
    execFileSync('docker',['network','connect',network,container]);connected=true;
    execFileSync('docker',['run','--detach','--name',api,'--label','kffr.audit=issue92-phase2','--network',network,'-p','127.0.0.1::3000',
      '-e',`PGRST_DB_URI=postgres://postgres:fixture-issue92@${container}:5432/${database}`,'-e','PGRST_DB_SCHEMAS=histoire','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,'postgrest/postgrest:v14.10'],{stdio:'pipe'});apiStarted=true;
    const port=JSON.parse(execFileSync('docker',['inspect',api],{encoding:'utf8'}))[0].NetworkSettings.Ports['3000/tcp'][0].HostPort;
    const upstream=`http://127.0.0.1:${port}`;
    server=createServer(async(req,res)=>{
      try{
        const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
        const target=upstream+(req.url??'/').replace(/^\/rest\/v1/,'');
        const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v&& !['host','content-length','connection'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);
        const response=await fetch(target,{method:req.method,headers,...(['GET','HEAD'].includes(req.method??'GET')?{}:{body:Buffer.concat(chunks)})});
        const outgoing=Object.fromEntries(response.headers);
        // fetch peut décoder le corps ; recalculer le framing et fermer la connexion
        // avant les longs contrôles psql synchrones de cette fixture.
        for(const key of ['content-length','content-encoding','transfer-encoding','connection'])delete outgoing[key];
        res.writeHead(response.status,{...outgoing,connection:'close'});res.end(Buffer.from(await response.arrayBuffer()));
      }catch{res.writeHead(503);res.end();}
    });
    await new Promise<void>(resolve=>server!.listen(0,'127.0.0.1',resolve));
    const address=server.address();assert(address&&typeof address!=='string');
    const url=`http://127.0.0.1:${address.port}`;
    const db=createClient(url,token('service_role'),{db:{schema:'histoire'},auth:{persistSession:false}});
    const publicDb=createClient(url,token('anon'),{db:{schema:'histoire'},auth:{persistSession:false}});
    const env={...process.env,SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:token('service_role')};
    const importer=()=>command(['node_modules/tsx/dist/cli.mjs','scripts/import-dataset.ts','--dossier','content/dataset-v18'],env);
    await importer();
    const before=sql("select jsonb_agg(to_jsonb(c) order by c.card_id) from histoire.chapter_cards c");
    await importer();assert.equal(sql("select jsonb_agg(to_jsonb(c) order by c.card_id) from histoire.chapter_cards c"),before);
    assert.equal(sql('select count(*) from histoire.events'),'2001');assert.equal(sql('select count(*) from histoire.chapters'),'59');assert.equal(sql('select count(*) from histoire.chapter_cards'),'325');
    assert.equal(sql('select count(*) from histoire.event_chapters'),'722');assert.equal(sql("select count(*) from histoire.pedagogical_units where etat='inactif'"),'18');
    const cards=chargerCartes();
    for(const chapter of [...new Set(cards.map(c=>c.chapter_id))]){
      const {data,error}=await publicDb.rpc('get_chapter_cards',{p_chapter_id:chapter});assert.ifError(error);
      assert.deepEqual(data,cards.filter(c=>c.chapter_id===chapter).map(cartePublique));
      assert(!JSON.stringify(data).includes('"event_id"'));assert(!JSON.stringify(data).includes('"sources"'));
    }
    const {count,error}=await publicDb.from('chapters').select('id',{count:'exact',head:true});assert.ifError(error);assert.equal(count,41);
    for(const table of ['pedagogical_units','chapter_cards','event_answers','event_aliases'])assert.equal((await publicDb.from(table).select('*')).error?.code,'42501');
    assert.equal((await publicDb.rpc('get_chapter_cards',{p_chapter_id:'THM-049'})).data?.length,0);
    const exportResult=await db.rpc('export_pedagogical_structure');assert.ifError(exportResult.error);assert.equal(exportResult.data.length,59);
    assert.equal(sql('select count(*) from histoire.learning_progress'),'0');
    testerMigrationSommeLocale({container,database});
    assert.equal(sql('select count(*) from histoire.pedagogical_units'),'59');
    // Le véritable importeur de complétion passe par SDK/PostgREST. Textes de fixture déjà existants.
    const original=lireCsv('content/pedagogie/cartes-v1.csv'),events=lireCsv('content/dataset-v18/kiffeurs-events-v18.csv'),links=lireCsv('content/dataset-v18/kiffeurs-curriculum-links-v18.csv');
    const additions=corpusPhase3?lireCsv('content/pedagogie/cartes-completions.csv'):planCompletions().flatMap(p=>p.event_ids.map((id):LigneCsv=>{
      const template=original.find(c=>c.chapter_id===p.chapter_id)!,e=events.find(e=>e.event_id===id)!;
      return {...template,card_id:`CARD-${p.chapter_id.slice(4)}-fixture-${id.slice(4)}`,event_id:id,
        official_wording:links.find(l=>l.theme_id===p.chapter_id&&l.event_id===id)!.official_wording,
        ...Object.fromEntries(['start_year','start_month','start_day','end_year','end_month','end_day','date_text','date_status'].map(k=>[k,e[k]])),date_precision:e.precision};
    }).sort((a,b)=>Number(a.start_year)-Number(b.start_year)||Number(a.start_month)-Number(b.start_month)||Number(a.start_day)-Number(b.start_day))
      .map((c,i):LigneCsv=>({...c,sort_order:String(i+1)})));
    const directory=mkdtempSync(join(tmpdir(),'kffr-completion-fixture-')),file=join(directory,'fixture.csv');
    const fields=Object.keys(additions[0]),csvValue=(v:string)=>'"'+v.replaceAll('"','""')+'"';
    try {
      writeFileSync(file,[fields.map(csvValue).join(','),...additions.map(c=>fields.map(k=>csvValue(c[k as keyof typeof c])).join(','))].join('\n')+'\n');
      await importerCompletionsLocales(file,url,token('service_role'));
      const snapshot=sql("select jsonb_agg(to_jsonb(e) order by chapter_id,version) from histoire.pedagogical_editions e");
      await importerCompletionsLocales(file,url,token('service_role'));
      assert.equal(sql("select jsonb_agg(to_jsonb(e) order by chapter_id,version) from histoire.pedagogical_editions e"),snapshot);
      assert.equal(sql("select count(*) from histoire.pedagogical_editions where version='completion-v1' and not published"),'27');
      assert.equal(sql("select count(*) from histoire.chapter_cards"),'325');
      assert.equal(sql("select count(*) from histoire.chapters"),'59');
      assert.equal((await publicDb.rpc('get_chapter_cards_version',{p_chapter_id:'THM-001',p_version:'completion-v1'})).data?.length,0);
      assert((await publicDb.rpc('start_chapter_test_version',{p_token:'a'.repeat(64),p_chapter_id:'THM-001',p_difficulty:'YEAR',p_question_count:5,p_version:'completion-v1'})).error);
    }finally {unlinkSync(file);rmdirSync(directory);}
    console.log(`OK HTTP complétions : 104 ajouts ${corpusPhase3?'éditoriaux':'techniques'} / 27 brouillons importés deux fois par le véritable importeur, 325 cartes historiques et 59 unités inchangées, aucun brouillon public.`);
    if(corpusPhase3){
      const historique=sql("select jsonb_agg(to_jsonb(c) order by c.card_id) from histoire.chapter_cards c");
      const ids=cards.map(c=>"'"+c.card_id+"'").join(',');
      const oldSnapshot=()=>sql(`select jsonb_agg(to_jsonb(c) order by c.card_id) from histoire.chapter_cards c where card_id in (${ids})`);
      const childFile='content/pedagogie/cartes-sous-chapitres.csv';
      await importerCartesSousChapitresLocales(childFile,url,token('service_role'));
      const childSnapshot=sql("select jsonb_agg(to_jsonb(c) order by c.card_id) from histoire.chapter_cards c");
      await importerCartesSousChapitresLocales(childFile,url,token('service_role'));
      assert.equal(sql("select jsonb_agg(to_jsonb(c) order by c.card_id) from histoire.chapter_cards c"),childSnapshot);
      assert.equal(oldSnapshot(),historique);
      assert.equal(sql('select count(*) from histoire.chapter_cards'),'513');
      assert.equal(sql('select count(*) from histoire.pedagogical_card_lineage'),'61');
      assert.equal(sql("select count(*) from histoire.pedagogical_units where etat='inactif'"),'18');
      const modification=await db.rpc('replace_chapter_cards',{p_cards:cards.map((c,i)=>i?c:{...c,body:c.body+' Modification interdite.'})});
      assert(modification.error,'Une carte historique modifiée doit être refusée');assert.equal(oldSnapshot(),historique);
      const A='00000000-0000-0000-0000-000000000192';
      sql(`insert into auth.users values('${A}'); select set_config('request.jwt.claim.sub','${A}',false); select histoire.mark_chapter_discovered('THM-001');
        do $$declare g jsonb; begin g:=histoire.start_chapter_test(null,'THM-001','YEAR',5);
        update histoire.games set state='finished',average_accuracy=83,finished_at=now() where id=(g->>'game_id')::uuid;
        perform histoire.record_chapter_test((g->>'game_id')::uuid); end $$;`);
      const progressBefore=sql('select jsonb_agg(to_jsonb(p)) from histoire.learning_progress p');
      const structure=chargerStructure();
      const corpus=release92?chargerCorpus92():undefined;
      // Objet de test transmis exclusivement à psql dans le conteneur local vérifié.
      // Il ne constitue ni une attestation humaine ni une sauvegarde production.
      const autorisation:Autorisation92={projectId:PROJET_92,endpoint:`https://${PROJET_92}.supabase.co`,autorisation:AUTORISATION_92,
        preuve:{sha:SHA_APPROUVE_92,source:'objet de test isolé',confirmation:'constructeur SQL testé dans PostgreSQL jetable',cartes_validees:292,svg_nouveaux_valides:203,han_reste_bloque:true},
        sauvegarde:{projectId:PROJET_92,fichier:'test-local',sha256:'a'.repeat(64),verifiee:true}};
      if(corpus){
        const initial=sql("select jsonb_agg(to_jsonb(u) order by chapter_id) from histoire.pedagogical_units u");
        const refusal=sqlPublication92(corpus,autorisation).replace("  for e in select chapter_id,md5(cards::text||candidates::text)","  perform histoire.set_pedagogical_group_active('THM-006',true,'test');\n  for e in select chapter_id,md5(cards::text||candidates::text)");
        assert.throws(()=>sql(refusal),'Han doit annuler toute la transaction');
        assert.equal(sql("select jsonb_agg(to_jsonb(u) order by chapter_id) from histoire.pedagogical_units u"),initial,'Écriture partielle après refus Han');
        sql(sqlPublication92(corpus,autorisation));
        const snapshot=sql("select jsonb_agg(to_jsonb(e) order by chapter_id,version) from histoire.pedagogical_editions e");
        sql(sqlPublication92(corpus,autorisation));
        assert.equal(sql("select jsonb_agg(to_jsonb(e) order by chapter_id,version) from histoire.pedagogical_editions e"),snapshot,'Publication non idempotente');
        sql(sqlRollback92(corpus,autorisation));
        assert.equal(sql("select count(*) from histoire.pedagogical_units where etat='actif'"),'41');
        assert.equal(sql('select jsonb_agg(to_jsonb(p)) from histoire.learning_progress p'),progressBefore);
        const exportDir=mkdtempSync(join(tmpdir(),'kffr-release-export-'));
        try{
          const repli=exporterArtefacts92(JSON.parse(sql(sqlExport92())),exportDir);
          assert.deepEqual(repli,{unites:59,publiques:56,empreintes:593},'Les archives doivent rester exportables après rollback');
        }finally{
          assert(resolve(exportDir).startsWith(resolve(tmpdir())+sep));
          rmSync(exportDir,{recursive:true,force:true});
        }
        sql(sqlPublication92(corpus,autorisation));
        console.log('OK RELEASE #92 : transaction réelle exécutée deux fois, rollback et republication ; historique, joueurs et Han protégés.');
      }else{
      // Attestations uniquement techniques dans une base jetable, sans valeur de revue humaine.
      sql(`update histoire.pedagogical_units set content_approval=histoire.pedagogical_fingerprint(chapter_id),
        illustration_approval='fixture-phase3',catalogue_approval='fixture-phase3' where parent_id is not null;`);
      assert.throws(()=>sql("select histoire.set_pedagogical_group_active('THM-006',true,'fixture-phase3')"));
      assert.equal(sql("select blocages::text from histoire.pedagogical_units where chapter_id='THM-049'"),'{han-canon-incoherent}');
      for(const parent of new Set(structure.sous_chapitres.filter(c=>!c.blocages.length&&c.parent_id!=='THM-006').map(c=>c.parent_id)))
        sql(`select histoire.set_pedagogical_group_active('${parent}',true,'fixture-phase3')`);
      sql(`do $$declare e record; begin for e in select chapter_id,md5(cards::text||candidates::text) fp from histoire.pedagogical_editions where version='completion-v1' loop
        perform histoire.publish_pedagogical_completion(e.chapter_id,e.fp,'fixture-phase3','fixture-phase3'); end loop; end $$;`);
      }
      assert.equal(sql("select count(*) from histoire.pedagogical_editions where version='completion-v1' and published"),'27');
      assert.equal(sql("select count(*) from histoire.pedagogical_units where parent_id is not null and etat='actif'"),'15');
      assert.equal(sql('select jsonb_agg(to_jsonb(p)) from histoire.learning_progress p'),progressBefore);
      sql(`select set_config('request.jwt.claim.sub','${A}',false); do $$declare g jsonb; begin
        g:=histoire.start_chapter_test(null,'THM-001','YEAR',5);
        update histoire.games set state='finished',average_accuracy=50,finished_at=now() where id=(g->>'game_id')::uuid;
        perform histoire.record_chapter_test((g->>'game_id')::uuid); end $$;`);
      assert.equal(sql('select jsonb_agg(to_jsonb(p)) from histoire.learning_progress p'),progressBefore);
      assert.equal(sql(`select best_accuracy from histoire.learning_progress_editions where user_id='${A}' and chapter_id='THM-001'`),'50');
      assert.equal(sql("select count(*) from histoire.learning_progress where chapter_id between 'THM-047' and 'THM-064'"),'0');
      const active=structure.sous_chapitres.filter(c=>c.parent_id!=='THM-006');
      for(const c of active){
        const {data,error}=await publicDb.rpc('get_chapter_cards_version',{p_chapter_id:c.id,p_version:'sous-chapitres-v1'});assert.ifError(error);assert.equal(data.length,c.event_ids.length);
        assert(!JSON.stringify(data).includes('"event_id"'));assert(!JSON.stringify(data).includes('"sources"'));
      }
      for(const c of planCompletions()){
        const expected=cards.filter(x=>x.chapter_id===c.chapter_id).length+c.event_ids.length;
        const {data,error}=await publicDb.rpc('get_chapter_cards_version',{p_chapter_id:c.chapter_id,p_version:'completion-v1'});assert.ifError(error);assert.equal(data.length,expected);
      }
      const published=sql("select jsonb_agg(to_jsonb(e) order by chapter_id,version) from histoire.pedagogical_editions e");
      await importerCompletionsLocales('content/pedagogie/cartes-completions.csv',url,token('service_role'));
      // Le contrat #111 réserve l'import des enfants aux unités inactives :
      // après activation, même un lot identique est refusé sans mutation.
      await assert.rejects(importerCartesSousChapitresLocales(childFile,url,token('service_role')), /enfants inactifs/);
      assert.equal(sql("select jsonb_agg(to_jsonb(c) order by c.card_id) from histoire.chapter_cards c"),childSnapshot);
      assert.equal(sql("select jsonb_agg(to_jsonb(e) order by chapter_id,version) from histoire.pedagogical_editions e"),published);
      assert.equal(oldSnapshot(),historique);
      // Les générateurs existants opèrent sur un export local, restauré même en cas d'erreur.
      const generated=['src/lib/apprendre/structure.json','src/lib/solo/catalogue.json','content/pedagogie/cartes-publiees.json'];
      const backups=new Map(generated.map(f=>[f,existsSync(f)?readFileSync(f):null]));
      try{
        await command(['node_modules/tsx/dist/cli.mjs','scripts/export-structure-pedagogique-local.ts'],env);
        await command(['node_modules/tsx/dist/cli.mjs','scripts/build-catalogue-solo.ts'],env);
        const registry=JSON.parse(readFileSync(generated[0],'utf8')) as {id:string}[];
        assert.equal(registry.length,56);assert(!registry.some(c=>['THM-047','THM-048','THM-049'].includes(c.id)));
        const catalogue=JSON.parse(readFileSync(generated[1],'utf8'));
        for(const c of active){assert(catalogue.chapitres[c.id].t.YEAR>=5);assert.equal(catalogue.chapitres[c.id].t.YEAR,c.event_ids.length);}
        for(const c of planCompletions())assert(catalogue.chapitres[c.chapter_id].editions['completion-v1'].t.YEAR>=5);
        const exportData=await db.rpc('export_pedagogical_structure');assert.ifError(exportData.error);assert.equal(exportData.data.length,59);
        if(process.argv.includes('--build-phase3')) {
          const buildEnv={...env,NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:token('anon')};
          await command(['node_modules/next/dist/bin/next','build'],buildEnv);
          await verifierPhase3Navigateur(buildEnv);
        }
      }finally{for(const[f,backup]of backups)if(backup)writeFileSync(f,backup);else if(existsSync(f))unlinkSync(f);}
      // Retour arrière complet : progression et anciens instantanés restent présents.
      for(const c of planCompletions())sql(`select histoire.rollback_pedagogical_completion('${c.chapter_id}')`);
      for(const parent of new Set(active.map(c=>c.parent_id)))sql(`select histoire.set_pedagogical_group_active('${parent}',false,null)`);
      assert.equal(sql('select jsonb_agg(to_jsonb(p)) from histoire.learning_progress p'),progressBefore);
      assert.equal(sql(`select best_accuracy from histoire.learning_progress_editions where user_id='${A}' and chapter_id='THM-001'`),'50');
      assert.equal(oldSnapshot(),historique);
      // Les copies sont strictement celles du contenu original, jusque dans leurs champs privés.
      const delivered=lireCsv(childFile);assert.equal(delivered.filter(c=>c.source_card_id).length,61);
      const badLineage=await db.rpc('import_pedagogical_cards',{p_cards:[],p_lineage:[{card_id:delivered[0].card_id,source_card_id:'inconnue'}]});assert(badLineage.error);
      assert.equal(sql(`select count(*) from histoire.chapter_cards c where c.chapter_id between 'THM-047' and 'THM-064'`),'188');
      console.log('OK PHASE 3 : 104 cartes réelles + 188 enfants, 61 filiations, réimport inactif identique, complétions publiées idempotentes, réimport enfant actif refusé sans mutation, historiques/progression conservés, 27 éditions et 15 enfants simulés, 3 enfants Han fermés, catalogues réels régénérés puis restaurés, rollback sans perte.');
    }
    console.log('OK HTTP baseline : deux imports du dataset par le SDK et PostgREST, 2001 événements/325 cartes inchangées/59 unités/18 inactives/722 liens à la préparation initiale, 41 anciennes projections exactes, données privées refusées.');
  }finally{
    if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
    if(apiStarted)execFileSync('docker',['rm','--force',api],{stdio:'pipe'});
    if(connected)execFileSync('docker',['network','disconnect',network,container],{stdio:'pipe'});
    if(networkCreated)execFileSync('docker',['network','rm',network],{stdio:'pipe'});
    execFileSync('docker',['exec',container,'dropdb','-U','postgres','--force',database]);
  }
}
main().catch((error:unknown)=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
