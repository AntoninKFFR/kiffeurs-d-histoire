// Intégration réelle SDK → PostgREST → Postgres, sans serveur Supabase distant.
// Un Postgres labellisé et une base aléatoire jetable ; seules les données de fixture sont importées.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync,readdirSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes,createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chargerCartes } from "./import-cartes";
import { cartePublique } from "../src/lib/pedagogie";
import {verifierDockerFixture} from "./verifier-docker-fixture";
import {testerMigrationSommeLocale} from "./test-migration-somme-local";
const container=process.argv[process.argv.indexOf('--container')+1];
verifierDockerFixture(container);
const suffix=randomBytes(5).toString('hex'),database='kffr_api_'+suffix,network='kffr-issue92-api-'+suffix,api='kffr-issue92-rest-'+suffix;
const secret=randomBytes(32).toString('hex');
function sql(t:string){return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-X','-Atq'],{input:t,encoding:'utf8',maxBuffer:8_000_000,stdio:['pipe','pipe','pipe']}).trim();}
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
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
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
    console.log('OK HTTP réel : deux imports du dataset par le SDK et PostgREST, 2001 événements/325 cartes inchangées/59 unités/18 inactives/722 liens, 41 anciennes projections exactes, données privées refusées et aucune progression fabriquée.');
  }finally{
    if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
    if(apiStarted)execFileSync('docker',['rm','--force',api],{stdio:'pipe'});
    if(connected)execFileSync('docker',['network','disconnect',network,container],{stdio:'pipe'});
    if(networkCreated)execFileSync('docker',['network','rm',network],{stdio:'pipe'});
    execFileSync('docker',['exec',container,'dropdb','-U','postgres','--force',database]);
  }
}
main().catch((error:unknown)=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
