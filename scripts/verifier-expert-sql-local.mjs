// PostgreSQL embarqué jetable, sans réseau. Runtime optionnel installé hors du dépôt.
// Voir docs/niveaux-expert.md pour la reproduction et les limites par rapport à Supabase.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const root = process.env.KFFR_PGLITE_DIST ?? join(tmpdir(), 'kiffeurs-expert-pglite/node_modules/@electric-sql/pglite/dist');
const { PGlite } = await import(pathToFileURL(join(root, 'index.js')));
const { pg_trgm } = await import(pathToFileURL(join(root, 'contrib/pg_trgm.js')));
const { unaccent } = await import(pathToFileURL(join(root, 'contrib/unaccent.js')));
const db = new PGlite({ extensions: { pg_trgm, unaccent } });
let courant = 'initialisation';
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema extensions; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await db.exec(readFileSync('supabase/fixtures/kffr_profiles.sql','utf8'));
  for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
    courant=f;
    await db.exec(readFileSync(join('supabase/migrations',f),'utf8'));
  }
  for(const f of ['supabase/seed.sql','supabase/fixtures/sport_397.sql','supabase/migrations/20261011111510_pack_sport.sql']) {
    courant=f; await db.exec(readFileSync(f,'utf8'));
  }
  console.log('Migrations et Sport installés dans PostgreSQL WASM en mémoire, sans réseau.');
  console.log((await db.query(`select histoire.available_questions(p_niveau=>3,p_pack_id=>'COL-0105') as toutes,
    histoire.available_questions(p_expert_only=>true,p_niveau=>3,p_pack_id=>'COL-0105') as expert`)).rows);
  courant='tests Expert';
  for(const f of ['niveaux_expert.sql','pack_sport.sql','sous_packs.sql','questions_periode.sql','longueur_parties.sql','theme_mystere.sql']) {courant=f;await db.exec(readFileSync('supabase/tests/'+f,'utf8'));console.log(f+' : vert');}
  console.log('Tests SQL Expert réussis.');
} catch(e) {console.error(courant, e.message); process.exitCode=1;}
finally {await db.close();}
