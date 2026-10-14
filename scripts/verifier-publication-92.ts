// Relecture HTTP et navigateur de la publication réelle ; aucune création de partie ou de compte.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { CHAPITRES, cheminChapitre, cheminEdition } from '../src/lib/apprendre/catalogue';
import { lireCsv } from './csv';
const url=new URL(process.argv[2]);
assert(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/');
assert(url.hostname==='k-iffeur-d-histoire.vercel.app'||/^k-iffeur-d-histoire-[a-z0-9]+-kffrh\.vercel\.app$/.test(url.hostname),'Origine de déploiement Kiffeurs d’Histoire requise');
const origin=url.origin;
const output=process.argv[3];assert(output,'Dossier explicite de preuves requis');mkdirSync(output,{recursive:true});
const rows=['cartes-v1','cartes-sous-chapitres','cartes-completions'].flatMap(n=>lireCsv(`content/pedagogie/${n}.csv`));
const publicIds=new Set(CHAPITRES.map(c=>c.id));
const publicCards=rows.filter(c=>publicIds.has(c.chapter_id)),han=rows.filter(c=>!publicIds.has(c.chapter_id));
const oldIds=new Set(lireCsv('content/pedagogie/cartes-v1.csv').map(c=>c.card_id));
assert.equal(publicCards.length,593);assert.equal(han.length,24);
const privateData=/event_id|EVT-\d+|official_wording|date_status|date_precision|["\\]sources["\\]/;
async function get(path:string,status=200){
  const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(30_000)});
  assert.equal(r.status,status,path);assert.equal(r.headers.get('location'),null,path);
  return {response:r,body:await r.text()};
}
async function main(){
  const home=await get('/apprendre');assert.doesNotMatch(home.body,privateData);
  let pages=0,archives=0;
  for(const u of CHAPITRES){
    const page=await get(cheminChapitre(u));assert.doesNotMatch(page.body,privateData);
    const expected=rows.filter(c=>c.chapter_id===u.id);
    const current=u.parent_id||u.edition_active?expected:expected.filter(c=>oldIds.has(c.card_id));
    assert.deepEqual([...new Set(page.body.match(/CARD-[a-z0-9-]+/g))].sort(),current.map(c=>c.card_id).sort(),u.id);
    pages++;
    for(const version of u.editions?.length?[u.content_version,...u.editions]:[]){
      const edition=await get(cheminEdition(u,version));assert.doesNotMatch(edition.body,privateData);
      const ids=(version==='legacy-v1'?rows.filter(c=>oldIds.has(c.card_id)):rows).filter(c=>c.chapter_id===u.id).map(c=>c.card_id);
      assert.deepEqual([...new Set(edition.body.match(/CARD-[a-z0-9-]+/g))].sort(),ids.sort(),u.id+'/'+version);archives++;
    }
  }
  let svg=0,motifs=0;
  for(let i=0;i<publicCards.length;i+=8)await Promise.all(publicCards.slice(i,i+8).map(async c=>{
    const {response,body}=await get('/api/pedagogie/illustration/'+c.card_id);
    assert.match(response.headers.get('content-type')??'',/image\/svg\+xml/);
    assert.doesNotMatch(body+JSON.stringify([...response.headers]),/EVT-\d|event_id|sources|content\/illustrations|<script|<foreignObject|\bhref\s*=/);
    if(c.event_id){assert.equal(body,readFileSync(`content/illustrations/${c.event_id}.svg`,'utf8').replace(/<!--[\s\S]*?-->/g,''));svg++;}
    else{assert(body.includes('translate(56 36)'));motifs++;}
  }));
  for(const c of han)assert.equal((await get('/api/pedagogie/illustration/'+c.card_id,404)).body,'');
  for(const id of ['THM-047','THM-048','THM-049']){
    const etat=JSON.parse(readFileSync('content/pedagogie/chapitres-v2.json','utf8')).sous_chapitres.find((c:{id:string})=>c.id===id);
    await get(`/apprendre/${etat.niveauSlug}/${etat.slug}`,404);
  }
  assert.equal(pages,56);assert.equal(archives,54);assert.equal(svg,571);assert.equal(motifs,22);
  const browser=await chromium.launch({headless:true});const errors:string[]=[];
  try{
    for(const width of [1280,375]){
      const page=await browser.newPage({viewport:{width,height:812}});
      page.on('pageerror',e=>errors.push(e.message));
      for(const id of ['THM-001','THM-050','THM-056']){
        const u=CHAPITRES.find(c=>c.id===id)!;await page.goto(origin+cheminChapitre(u),{waitUntil:'networkidle'});
        assert.equal(await page.locator('h1').count(),1);
        const image=page.locator('article img').first();await image.waitFor();
        assert(await image.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0),'Image réellement décodée');
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Débordement horizontal');
        await page.screenshot({path:`${output}/${id}-${width}.png`,fullPage:true});
      }
      const u=CHAPITRES.find(c=>c.id==='THM-001')!;await page.goto(origin+cheminEdition(u,'legacy-v1'),{waitUntil:'networkidle'});
      assert.equal(await page.getByRole('navigation',{name:'Cartes du chapitre'}).getByRole('button').count(),6);
      await page.close();
    }
  }finally{await browser.close();}
  assert.deepEqual(errors,[]);
  const report={origine:origin,date:new Date().toISOString(),routes:pages,archives,svg_exacts:svg,motifs,han_404:han.length,
    navigateurs:[1280,375],erreurs_console:errors,sha_etats:createHash('sha256').update(readFileSync('content/pedagogie/etats-publies-92.json')).digest('hex')};
  writeFileSync(`${output}/verification-production.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Vérification interrompue');process.exitCode=1;});
