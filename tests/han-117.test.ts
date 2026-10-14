import {expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,sep} from 'node:path';
import {lireCsv,lireTexteCsv} from '../scripts/csv';
import {CANONS_CORRIGES_117,DATE_HAN_117,FICHIER_HAN_117,lignesEnfantsCourantes117,verifierCanonHan117,verifierDeltaCanon117} from '../scripts/han-117';
import {corpusHan117,sqlSauvegardeHan117,autorisationHan117,sqlPublicationHan117} from '../scripts/release-han-117';

it('limite le delta canon aux seuls champs arbitrés de EVT-0040, depuis le main publié',()=>{
 for(const file of CANONS_CORRIGES_117){
  const archive=execFileSync('git',['show',`220e2edf2d547353acd17493158aae0837572514:${file}`],{encoding:'utf8',maxBuffer:8_000_000});
  verifierDeltaCanon117(file,archive);
  const before=lireTexteCsv(archive),after=lireCsv(file);
  expect(after.filter(e=>e.event_id!=='EVT-0040')).toEqual(before.filter(e=>e.event_id!=='EVT-0040'));
 }
});

it('conserve les 188 identités et 61 filiations, les textes et Wudi ; corrige les cinq positions de THM-049',()=>{
 const raw=lireCsv('content/pedagogie/cartes-sous-chapitres.csv');
 const current=lignesEnfantsCourantes117('content/pedagogie/cartes-sous-chapitres.csv');
 expect(current).toHaveLength(188);expect(current.filter(c=>c.source_card_id)).toHaveLength(61);
 expect(current.map(c=>c.card_id).sort()).toEqual(raw.map(c=>c.card_id).sort());
 expect(current.filter(c=>c.chapter_id!=='THM-049')).toEqual(raw.filter(c=>c.chapter_id!=='THM-049'));
 const han=current.filter(c=>c.chapter_id==='THM-049');
 expect(han.map(c=>[c.event_id,Number(c.start_year),Number(c.sort_order)])).toEqual([
  ['EVT-0370',-221,1],['EVT-0040',-206,2],['EVT-0041',-141,3],['EVT-0371',-138,4],['EVT-0392',220,5]]);
 for(const card of current){const old=raw.find(c=>c.card_id===card.card_id)!;for(const field of ['title','body','takeaway','key_concepts','sources','source_card_id'])expect(card[field]).toEqual(old[field]);}
 const wudi=han.find(c=>c.event_id==='EVT-0041')!,oldWudi=raw.find(c=>c.card_id===wudi.card_id)!;
 expect({...wudi,sort_order:oldWudi.sort_order}).toEqual(oldWudi);
 expect(han[1]).toMatchObject({start_year:'-206',end_year:'220',date_status:'CONVENTIONAL',date_precision:'YEAR_RANGE',date_text:DATE_HAN_117});
});

it('refuse une décision divergente, une sixième carte ou une réécriture de Wudi',()=>{
 const base=join(tmpdir(),'kffr-han117-'),root=mkdtempSync(base);
 const fichiers=['content/dataset-v18/kiffeurs-events-v18.csv','content/pedagogie/decision-han-117.json','content/pedagogie/cartes-sous-chapitres.csv',FICHIER_HAN_117,'content/dataset-v18/kiffeurs-tags-v18.csv','content/dataset-v18/kiffeurs-event-tags-v18.csv'];
 try{
  for(const file of fichiers){mkdirSync(dirname(join(root,file)),{recursive:true});copyFileSync(file,join(root,file));}
  verifierCanonHan117(root);
  const decisionFile=join(root,fichiers[1]),decision=JSON.parse(readFileSync(decisionFile,'utf8'));
  writeFileSync(decisionFile,JSON.stringify({...decision,playable_mode:'YEAR'}));expect(()=>verifierCanonHan117(root)).toThrow();writeFileSync(decisionFile,JSON.stringify(decision));
  const patch=join(root,FICHIER_HAN_117),original=readFileSync(patch,'utf8');
  writeFileSync(patch,original.replace('141-87 av. J.-C.','Dynastie entière'));
  expect(()=>verifierCanonHan117(root)).toThrow(/Wudi/);
  writeFileSync(patch,original.trimEnd()+'\n'+original.trimEnd().split('\n').at(-1)+'\n');
  expect(()=>verifierCanonHan117(root)).toThrow();
 }finally{expect(resolve(root).startsWith(resolve(base))).toBe(true);expect(resolve(root).startsWith(resolve(tmpdir())+sep)).toBe(true);rmSync(root,{recursive:true,force:true});}
});

it('émet une sauvegarde en lecture seule, canon et joueurs inclus, et refuse une autorisation fausse',()=>{
 const backup=sqlSauvegardeHan117();
 expect(backup).toContain('repeatable read read only');expect(backup).toContain("'canon'");
 expect(backup).toContain('histoire.event_answers');expect(backup).toContain('histoire.game_question_editorial_snapshots');
 expect(backup).not.toMatch(/\b(?:insert|update|delete|alter|drop|truncate)\b|\b(?:auth|public|private)\./i);
 expect(()=>sqlPublicationHan117({autorisation:'NON',sauvegarde_sha256:'0'.repeat(64),verification:'objet de test'})).toThrow();
},30_000);

it('vérifie les 534 SVG approuvés et les sources archivées avant de construire la publication atomique',()=>{
 const corpus=corpusHan117();expect(corpus.cartes).toHaveLength(24);
 expect(Object.keys(corpus.empreintes).filter(p=>p.endsWith('.svg'))).toHaveLength(534);
 const sql=sqlPublicationHan117({autorisation:autorisationHan117(),sauvegarde_sha256:'0'.repeat(64),verification:'objet de test sans attestation'});
 expect(sql).toContain('RPC existantes modifiées');expect(sql).toContain('Éditions Han historiques modifiées');
 expect(sql).toContain("set_pedagogical_group_active('THM-006',true");
 expect(sql).not.toMatch(/\b(?:update|delete from|insert into)\s+histoire\.(?:games|game_questions|learning_progress|players|pedagogical_editions)\b/i);
 expect(sql).not.toMatch(/\b(?:auth|public|private)\./i);
},60_000);
