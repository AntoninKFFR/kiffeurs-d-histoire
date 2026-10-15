// Émission SQL uniquement. Aucun client réseau ni secret ; dry-run par défaut.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chargerCartesSousChapitres,chargerCartes} from './import-cartes';
import {PROJET_92,SHA_APPROUVE_92,sqlSauvegarde92,verifierCible92,chargerCorpus92,type Sauvegarde92} from './release-pedagogique-92';
import {verifierCanonHan117,verifierDeltaCanon117,FICHIER_HAN_117,CANONS_CORRIGES_117} from './han-117';
export const MIGRATION_HAN_117='supabase/migrations/20261014232713_correction_han_117.sql';
const tables=['games','game_questions','game_question_editorial_snapshots','learning_progress','learning_progress_editions','players','kpi_games','solo_anonymous_limits','event_chapters','pedagogical_card_lineage'];
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const lit=(v:unknown)=>"'"+String(v).replaceAll("'","''")+"'";
const json=(v:unknown)=>lit(JSON.stringify(v))+'::jsonb';
const agg=(table:string,where='true')=>`(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from histoire.${table} t where ${where})`;
export function corpusHan117(){
  verifierCanonHan117();
  for(const fichier of CANONS_CORRIGES_117)verifierDeltaCanon117(fichier,execFileSync('git',['show',`${SHA_APPROUVE_92}:${fichier}`],{encoding:'utf8',maxBuffer:8_000_000}));
  const approuve=chargerCorpus92();
  const fichiers=[FICHIER_HAN_117,'content/pedagogie/decision-han-117.json',MIGRATION_HAN_117,...CANONS_CORRIGES_117];
  const empreintes={...approuve.hashes,...Object.fromEntries(fichiers.map(p=>[p,sha(readFileSync(p,'utf8').replaceAll('\r\n','\n'))]))};
  const cartes=chargerCartesSousChapitres('content/pedagogie/cartes-sous-chapitres.csv').filter(c=>['THM-047','THM-048','THM-049'].includes(c.chapter_id));
  assert.equal(cartes.length,24);
  assert.deepEqual(cartes.filter(c=>c.chapter_id==='THM-049').map(c=>[c.event_id,c.start_year]),[['EVT-0370',-221],['EVT-0040',-206],['EVT-0041',-141],['EVT-0371',-138],['EVT-0392',220]]);
  return {cartes,empreintes,fonctions:approuve.fonctions,sha:sha(JSON.stringify(empreintes)),migration:readFileSync(MIGRATION_HAN_117,'utf8').replaceAll('\r\n','\n')};
}
export function autorisationHan117(){return `PUBLIER_HAN117_${PROJET_92}_${corpusHan117().sha}`;}
export function sqlSauvegardeHan117(){
  const original=sqlSauvegarde92();
  // Ajouter les seules réponses/canon qui peuvent être corrigés, sans élargir aux comptes Contrée.
  return original.replace(/\)\);\s*commit;\s*$/,`),'canon',jsonb_build_object('events',${agg('events',"t.id=any(array['EVT-0040','EVT-0041'])")},'answers',${agg('event_answers',"t.event_id=any(array['EVT-0040','EVT-0041'])")},'event_tags',${agg('event_tags',"t.event_id=any(array['EVT-0040','EVT-0041'])")}));\ncommit;\n`);
}
export function verifierSauvegardeHan117(data:Sauvegarde92&{canon:{events:Record<string,unknown>[];answers:Record<string,unknown>[];event_tags:Record<string,unknown>[]}},now=Date.now()){
  assert.equal(data.project_id,PROJET_92);const age=now-Date.parse(data.captured_at);assert(age>=0&&age<15*60_000,'Sauvegarde fraîche requise');
  assert.equal(data.tables.pedagogical_units.length,59);assert.equal(data.tables.chapter_cards.length,513);assert.equal(data.tables.event_chapters.length,722);
  assert.equal(data.canon.events.length,2);assert.equal(data.canon.answers.length,2);
  const anciennes=chargerCartes(),ids=new Set(anciennes.map(c=>c.card_id));
  const stable=(x:unknown)=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b,'en'))):v);
  assert.deepEqual(data.tables.chapter_cards.filter(c=>ids.has(String(c.card_id))).map(stable).sort(),anciennes.map(stable).sort(),'Anciennes cartes différentes du corpus approuvé');
  assert.deepEqual(data.canon.events.map(e=>e.id).sort(),['EVT-0040','EVT-0041']);
  assert.deepEqual(data.canon.answers.map(e=>e.event_id).sort(),['EVT-0040','EVT-0041']);
  assert(data.canon.event_tags.length>0&&data.canon.event_tags.every(e=>['EVT-0040','EVT-0041'].includes(String(e.event_id))));
  for(const table of [...tables,'chapter_cards','chapters','pedagogical_units','pedagogical_editions','pedagogical_registry'])assert(Array.isArray(data.tables[table]),`Sauvegarde incomplète : ${table}`);
  assert([83,86].includes(data.tables.pedagogical_editions.filter(e=>e.published).length));
}
export type PreuveTechniqueHan117={autorisation:string;sauvegarde_sha256:string;verification:string};
const editionsHan=()=>agg('pedagogical_editions',"t.published and t.chapter_id=any(array['THM-047','THM-048','THM-049'])");
const protection=()=>`jsonb_build_object(${tables.map(t=>`${lit(t)},md5(${agg(t)}::text)`).join(',')},'editions',md5(${agg('pedagogical_editions',"t.published and t.chapter_id<>all(array['THM-047','THM-048','THM-049'])")}::text),'autres_cartes',md5(${agg('chapter_cards',"t.chapter_id<>all(array['THM-047','THM-048','THM-049'])")}::text))`;
export function sqlPublicationHan117(p:PreuveTechniqueHan117){
  const c=corpusHan117();assert.equal(p.autorisation,autorisationHan117());assert(/^[a-f0-9]{64}$/.test(p.sauvegarde_sha256));assert(p.verification.trim());
  const migration=c.migration.replace(/^([\s\S]*?)\bbegin;\s*/,'').replace(/commit;\s*$/,'');
  assert(!migration.includes('$publication117$'));
  const catalogue=`catalogue-han117:${c.sha}:${p.verification}`;
  return `begin isolation level repeatable read; set local lock_timeout='5s';set local statement_timeout='120s';
do $publication117$ declare avant jsonb; editions_han_avant jsonb; expected jsonb:=${json(c.cartes)}; actuel jsonb; u record; begin
perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));
if (select count(*) from histoire.pedagogical_units)<>59 or (select count(*) from histoire.event_chapters)<>722 then raise exception 'Structure hors audit';end if;
if (select count(*) from histoire.pedagogical_editions where published) not in (83,86) then raise exception 'Éditions hors audit';end if;
if (select jsonb_object_agg(proname,md5(replace(prosrc,E'\\r',''))) from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='histoire' and proname=any(array[${Object.keys(c.fonctions).map(lit).join(',')}])) is distinct from ${json(c.fonctions)} then raise exception 'RPC existantes modifiées : nouvel audit requis';end if;
avant:=${protection()};
editions_han_avant:=${editionsHan()};
execute ${lit(migration)};
actuel:=${agg('chapter_cards',"t.chapter_id=any(array['THM-047','THM-048','THM-049'])")};
if actuel is distinct from(select jsonb_agg(x order by x::text) from jsonb_array_elements(expected)x) then raise exception 'Cartes Han différentes du corpus humain';end if;
for u in select chapter_id from histoire.pedagogical_units where parent_id='THM-006' order by chapter_id loop
update histoire.pedagogical_units set content_approval=histoire.pedagogical_fingerprint(u.chapter_id),
 illustration_approval='reutilisation-SVG-valides:31ab0d56dd87a3400101e112005d63292c544853',catalogue_approval=${lit(catalogue)} where chapter_id=u.chapter_id;
end loop;
perform histoire.set_pedagogical_group_active('THM-006',true,${lit(catalogue)});
if ${protection()} is distinct from avant then raise exception 'Historique publié ou joueurs modifiés';end if;
if jsonb_array_length(editions_han_avant)>0 and ${editionsHan()} is distinct from editions_han_avant then raise exception 'Éditions Han historiques modifiées';end if;
if (select count(*) from histoire.pedagogical_editions where published)<>86
 or (select count(*) from histoire.pedagogical_units where parent_id='THM-006' and etat='actif')<>3
 or (select jsonb_array_length(candidates) from histoire.pedagogical_editions where chapter_id='THM-049' and version='sous-chapitres-v1')<>5 then raise exception 'Publication incomplète';end if;
perform histoire.export_pedagogical_structure();
end $publication117$;
select jsonb_build_object('project_id',${lit(PROJET_92)},'corpus_sha',${lit(c.sha)},'sauvegarde_sha256',${lit(p.sauvegarde_sha256)},'cartes_han',24,'editions',86,'etats',histoire.export_pedagogical_structure());commit;\n`;
}
export function sqlRollbackHan117(){
  return `begin isolation level repeatable read; set local lock_timeout='5s';set local statement_timeout='60s';
do $repli117$ declare avant jsonb; han jsonb; editions_han_avant jsonb; begin
perform pg_advisory_xact_lock(hashtextextended('histoire.pedagogie',0));avant:=${protection()};han:=${agg('chapter_cards')};editions_han_avant:=${editionsHan()};
perform histoire.set_pedagogical_group_active('THM-006',false,null);
if ${protection()} is distinct from avant or ${agg('chapter_cards')} is distinct from han or ${editionsHan()} is distinct from editions_han_avant then raise exception 'Rollback destructif refusé';end if;
perform histoire.export_pedagogical_structure();end $repli117$;
select histoire.export_pedagogical_structure();commit;\n`;
}
function main(){
 const args=process.argv.slice(2),value=(k:string)=>{const i=args.indexOf(k);assert(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),`Valeur requise : ${k}`);return args[i+1];};
 const valeurs=['--sauvegarde','--autorisation','--verification'],drapeaux=['--emettre-publication','--emettre-rollback'];
 for(let i=0;i<args.length;i++){assert([...valeurs,...drapeaux].includes(args[i]),`Option inconnue : ${args[i]}`);assert.equal(args.filter(a=>a===args[i]).length,1,'Option répétée');if(valeurs.includes(args[i])){value(args[i]);i++;}}
 verifierCible92(PROJET_92,`https://${PROJET_92}.supabase.co`);
 if(!args.includes('--emettre-publication')&&!args.includes('--emettre-rollback')){console.log(JSON.stringify({mode:'dry-run',execution:false,project_id:PROJET_92,corpus:corpusHan117().sha,cartes:24,questions_han:5,sql_sauvegarde:sqlSauvegardeHan117()},null,2));return;}
 assert(!(args.includes('--emettre-publication')&&args.includes('--emettre-rollback')));
 const manifest=JSON.parse(readFileSync(value('--sauvegarde'),'utf8'));
 assert.equal(manifest.projectId,PROJET_92);assert.equal(sha(readFileSync(manifest.fichier)),manifest.sha256);
 verifierSauvegardeHan117(JSON.parse(readFileSync(manifest.fichier,'utf8')));
 assert.equal(value('--autorisation'),autorisationHan117());
 process.stdout.write(args.includes('--emettre-rollback')?sqlRollbackHan117():sqlPublicationHan117({autorisation:value('--autorisation'),sauvegarde_sha256:manifest.sha256,verification:value('--verification')}));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/release-han-117.ts')){try{main();}catch(e){console.error(e instanceof Error?e.message:'Release refusée');process.exitCode=1;}}
