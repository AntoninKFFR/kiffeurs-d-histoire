// Aucun accès réseau ou secret. Les autorisations ci-dessous sont des objets de tests,
// pas des attestations déposées en production.
import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from 'node:fs';
import { lireCsv } from '../scripts/csv';
import { empreinteLigne, appliquerEtatsPublies } from '../scripts/structure-pedagogique';
import { CHAPITRES, CHAPITRES_ACTIFS, CHAPITRES_HISTORIQUES } from '@/lib/apprendre/catalogue';
import { lireChoix, filtresDepuis } from '@/lib/solo/choix';
import { AUTORISATION_92, PROJET_92, SHA_APPROUVE_92, chargerCorpus92, verifierCible92, verifierAutorisation92,
  sqlPreflight92, sqlSauvegarde92, sqlPublication92, sqlRollback92, type Autorisation92 } from "../scripts/release-pedagogique-92";

const a:Autorisation92={projectId:PROJET_92,endpoint:`https://${PROJET_92}.supabase.co`,autorisation:AUTORISATION_92,
  preuve:{sha:SHA_APPROUVE_92,source:"objet de test isolé",confirmation:"confirmation utilisée seulement pour vérifier le constructeur",cartes_validees:292,svg_nouveaux_valides:203,han_reste_bloque:true},
  sauvegarde:{projectId:PROJET_92,fichier:"hors-git/sauvegarde.json",sha256:"a".repeat(64),verifiee:true}};

it("refuse toute cible voisine, locale, HTTP, credential ou URL non canonique",()=>{
  verifierCible92(PROJET_92,`https://${PROJET_92}.supabase.co`);
  for(const url of ["http://localhost:54321",`http://${PROJET_92}.supabase.co`,`https://${PROJET_92}.supabase.co.example.org`,`https://user:secret@${PROJET_92}.supabase.co`,`https://${PROJET_92}.supabase.co/rest/v1`,`https://${PROJET_92}.supabase.co?x=1`])
    expect(()=>verifierCible92(PROJET_92,url)).toThrow();
  expect(()=>verifierCible92("autre-projet",a.endpoint)).toThrow();
});

it("exige autorisation explicite, preuve humaine au SHA exact, sauvegarde et maintien de Han",()=>{
  verifierAutorisation92(a);
  for(const invalide of [{...a,autorisation:""},{...a,preuve:{...a.preuve,sha:"0".repeat(40)}},{...a,preuve:{...a.preuve,source:"fixture-phase3"}},
    {...a,preuve:{...a.preuve,cartes_validees:291}},{...a,preuve:{...a.preuve,han_reste_bloque:false}},{...a,sauvegarde:{...a.sauvegarde,verifiee:false}}])
    expect(()=>verifierAutorisation92(invalide)).toThrow();
});

it("reste en dry-run par défaut et ne produit aucune commande de publication",()=>{
  const plan=JSON.parse(execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/release-pedagogique-92.ts"],{encoding:"utf8",maxBuffer:2*1024*1024}));
  expect(plan).toMatchObject({mode:"dry-run",execution:false,project_id:PROJET_92,source_sha:SHA_APPROUVE_92,cartes_enfants:188,completions:104,filiations:61,groupe_han_exclu:"THM-006"});
  expect(plan.groupes_eligibles).toHaveLength(5);
  expect(plan.sql_preflight+plan.sql_sauvegarde).not.toMatch(/\b(?:insert|update|delete|create|alter|drop)\b/i);
},30_000);

it("prépare les sauvegardes en lecture seule uniquement dans histoire",()=>{
  const sql=sqlSauvegarde92();
  expect(sql).toMatch(/repeatable read read only/);
  for(const table of ["chapter_cards","pedagogical_editions","event_chapters","learning_progress","games","game_questions"])expect(sql).toContain(`histoire.${table}`);
  expect(sql).not.toMatch(/\b(?:auth|public|private)\./);
  expect(sqlPreflight92()).toContain("20261012180633");
});

it("utilise les RPC existantes, préserve le joueur et l’historique et ignore les enfants publiés",()=>{
  const c=chargerCorpus92(),sql=sqlPublication92(c,a);
  for(const rpc of ["import_pedagogical_cards","stage_pedagogical_completion","set_pedagogical_group_active","publish_pedagogical_completion","export_pedagogical_structure"])expect(sql).toContain(`histoire.${rpc}`);
  expect(sql).toContain("if u.published_fingerprint is not null then");
  expect(sql).toContain("if jsonb_array_length(lot)>0 then");
  expect(sql).toContain("État protégé modifié : transaction annulée");
  expect(sql).not.toMatch(/\b(?:update|delete from|insert into)\s+histoire\.(?:games|game_questions|learning_progress|players)\b/i);
  expect(sql).not.toMatch(/\b(?:from|join|update|into|perform)\s+(?:auth|public|private)\.|^\s*(?:create\s+(?:table|function)|drop\s|alter\s)/im);
  expect(sql).not.toContain("set_pedagogical_group_active('THM-006',true");
},30_000);

it("prévoit un rollback par RPC sans suppression ni restauration destructrice de parties",()=>{
  const sql=sqlRollback92(chargerCorpus92(),a);
  expect(sql.match(/rollback_pedagogical_completion\(/g)).toHaveLength(27);
  expect(sql.match(/set_pedagogical_group_active\(/g)).toHaveLength(5);
  expect(sql).not.toMatch(/delete|truncate|drop|update\s+histoire\.(?:games|learning_progress)/i);
},30_000);

it.skipIf(!existsSync('content/pedagogie/etats-publies-92.json'))('contrôle le catalogue réellement publié et les 593 empreintes, avec anciennes URLs et Han fermé',()=>{
  const c=chargerCorpus92(),etats=JSON.parse(readFileSync('content/pedagogie/etats-publies-92.json','utf8'));
  expect(CHAPITRES).toEqual(appliquerEtatsPublies(c.structure,etats).filter(u=>u.etat!=='inactif'));
  expect(CHAPITRES).toHaveLength(56);expect(CHAPITRES_ACTIFS).toHaveLength(51);expect(CHAPITRES_HISTORIQUES).toHaveLength(5);
  expect(CHAPITRES.filter(u=>u.edition_active==='completion-v1')).toHaveLength(27);
  const cartes=['cartes-v1','cartes-sous-chapitres','cartes-completions'].flatMap(n=>lireCsv(`content/pedagogie/${n}.csv`))
    .filter(row=>CHAPITRES.some(u=>u.id===row.chapter_id));
  const ledger=JSON.parse(readFileSync('content/pedagogie/cartes-publiees.json','utf8'));
  expect(cartes).toHaveLength(593);expect(ledger).toEqual(Object.fromEntries(cartes.map(row=>[row.card_id,empreinteLigne(row)])));
  for(const u of c.structure.sous_chapitres){
    const choice=lireChoix(new URLSearchParams({mode:'scolaire',difficulte:'YEAR',chapitres:u.id,test:'chapitre'}));
    if(u.parent_id==='THM-006')expect(choice).toBeNull();else{
      expect(filtresDepuis(choice!)).toMatchObject({chapterIds:[u.id],chapterTest:true});
      expect(CHAPITRES.find(c=>c.id===u.id)?.content_version).toBe('sous-chapitres-v1');
      expect(filtresDepuis(choice!).questionCount).toBeGreaterThanOrEqual(5);
    }
  }
  expect(filtresDepuis(lireChoix(new URLSearchParams('mode=scolaire&difficulte=YEAR&chapitres=THM-001&test=chapitre&edition=completion-v1'))!)).toMatchObject({chapterVersion:'completion-v1'});
  expect(filtresDepuis(lireChoix(new URLSearchParams('mode=scolaire&difficulte=YEAR&chapitres=THM-001&test=chapitre&edition=legacy-v1'))!)).toMatchObject({chapterVersion:'legacy-v1'});
},30_000);
