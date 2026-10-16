// Prépare la pile Supabase LOCALE des tests de bout en bout (#27) : jamais KFFR.
// Prérequis : `npx supabase start` (migrations + seed appliqués).
// 1. Simule la table public.profiles de KFFR contrée (fixture hors migrations, base jetable seulement).
// 2. Importe le dataset v18 et les cartes pédagogiques.
// 3. Crée le compte de test du parcours « connexion puis statistiques ».
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chargerCartes, estUrlLocale, importerCartesLocales } from "../scripts/import-cartes";
import { COMPTE_TEST, CONTENEUR_DB, statutLocal } from "./local";
import { chargerCorpus92, sqlPublication92, sqlRollback92, AUTORISATION_92, PROJET_92, SHA_APPROUVE_92, type Autorisation92 } from "../scripts/release-pedagogique-92";
import { executerSqlDockerLocal } from '../scripts/verifier-docker-fixture';
import {autorisationHan117,sqlPublicationHan117,sqlRollbackHan117} from '../scripts/release-han-117';

function psql(sql: string) {
  return executerSqlDockerLocal(CONTENEUR_DB,'postgres',sql);
}

async function main() {
  const statut = statutLocal();
  if (!estUrlLocale(statut.API_URL)) throw new Error("URL Supabase non locale : arrêt avant toute écriture");

  // Contrat de KFFR contrée simulé, comme dans scripts/tests-sql.sh, sans les faux comptes du simulateur SQL.
  if (psql("select to_regclass('public.profiles') is null") === "t") {
    const fixture = readFileSync("supabase/fixtures/kffr_profiles.sql", "utf8").split("-- Faux comptes")[0];
    psql(fixture);
    console.log("Table public.profiles simulée (LOCAL).");
  }

  execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/import-dataset.ts", "--dossier", "content/dataset-v18"], {
    env: { ...process.env, SUPABASE_URL: statut.API_URL, SUPABASE_SERVICE_ROLE_KEY: statut.SERVICE_ROLE_KEY },
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.log("Dataset v18 importé (LOCAL).");
  // Les migrations d’une pile vide précèdent l’import : installer ensuite le vrai contenu Sport.
  // La garde locale ci-dessus s’applique aussi à cette migration de données idempotente.
  psql(readFileSync("supabase/migrations/20261011111510_pack_sport.sql", "utf8"));
  psql(readFileSync("supabase/migrations/20261015120156_packs_fun.sql", "utf8"));
  await importerCartesLocales(chargerCartes(), statut.API_URL, statut.SERVICE_ROLE_KEY);
  if(existsSync('content/pedagogie/etats-publies-92.json')){
    // Le site compilé contient le catalogue publié : sa fixture locale doit correspondre.
    // La cible psql est le conteneur local constant, après la garde URL ; aucun transport distant.
    const corpus=chargerCorpus92(),autorisation:Autorisation92={projectId:PROJET_92,endpoint:`https://${PROJET_92}.supabase.co`,autorisation:AUTORISATION_92,
      preuve:{sha:SHA_APPROUVE_92,source:'objet de test isolé',confirmation:'fixture E2E locale exclusivement',cartes_validees:292,svg_nouveaux_valides:203,han_reste_bloque:true},
      sauvegarde:{projectId:PROJET_92,fichier:'test-local-e2e',sha256:'a'.repeat(64),verifiee:true}};
    const etats=JSON.parse(readFileSync('content/pedagogie/etats-publies-92.json','utf8')) as {id:string;etat:string;current_version?:string|null}[];
    const han=etats.filter(e=>['THM-047','THM-048','THM-049'].includes(e.id)&&e.etat!=='inactif');
    const hanDejaPublie=psql("select count(*) from histoire.pedagogical_editions where published and chapter_id=any(array['THM-047','THM-048','THM-049'])");
    if(hanDejaPublie==='0')psql(sqlPublication92(corpus,autorisation));
    else if(hanDejaPublie!=='3'||han.length!==3)throw new Error('Pile E2E incompatible avec les éditions attendues ; utiliser une pile jetable fraîche');
    if(!etats.some(e=>e.current_version==='completion-v1'))psql(sqlRollback92(corpus,autorisation));
    if(han.length){
      if(han.length!==3)throw new Error('Publication Han partielle');
      psql(sqlPublicationHan117({autorisation:autorisationHan117(),sauvegarde_sha256:'0'.repeat(64),verification:'fixture-e2e-locale-sans-attestation'}));
      if(han.every(e=>e.etat==='historique'))psql(sqlRollbackHan117());
    }
    console.log('Corpus publié #92 préparé exclusivement dans la pile E2E locale.');
  }

  // A1 reste indépendant d’A0 ; le corpus et les packs ont été importés ci-dessus.
  psql(readFileSync("supabase/migrations/20261016095716_enrichissement_v12_a1.sql", "utf8"));
  // Compte de test : e-mail confirmé et pseudo KFFR déjà choisi, comme un joueur de Contrée.
  const admin = createClient(statut.API_URL, statut.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: liste, error: erreurListe } = await admin.auth.admin.listUsers();
  if (erreurListe) throw erreurListe;
  let id = liste.users.find((u) => u.email === COMPTE_TEST.email)?.id;
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({ email: COMPTE_TEST.email, password: COMPTE_TEST.motDePasse, email_confirm: true });
    if (error) throw error;
    id = data.user.id;
  }
  psql(`insert into public.profiles (id, username) values ('${id}', '${COMPTE_TEST.pseudo}') on conflict (id) do update set username = excluded.username;`);
  // Chaque lancement repart d'un historique vide pour ce compte.
  psql(`delete from histoire.games where user_id = '${id}'; delete from histoire.learning_progress where user_id = '${id}'; delete from histoire.learning_progress_editions where user_id = '${id}';`);
  console.log(`Compte de test prêt : ${COMPTE_TEST.email} (LOCAL).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
