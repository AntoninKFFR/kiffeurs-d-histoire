// PostgreSQL WASM jetable, sans réseau ni secrets. Runtime facultatif hors dépôt.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const root = process.env.KFFR_PGLITE_DIST ?? join(tmpdir(), 'kiffeurs-expert-pglite/node_modules/@electric-sql/pglite/dist');
const { PGlite } = await import(pathToFileURL(join(root, 'index.js')));
const { pg_trgm } = await import(pathToFileURL(join(root, 'contrib/pg_trgm.js')));
const { unaccent } = await import(pathToFileURL(join(root, 'contrib/unaccent.js')));
const db = new PGlite({ extensions: { pg_trgm, unaccent } });
let step = 'initialisation';
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema extensions; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  await db.exec(readFileSync('supabase/fixtures/kffr_profiles.sql','utf8'));
  const source = (file) => readFileSync(file,'utf8').replace(/^\\ir (.+)\r?$/gm, (_, name) => source(resolve(dirname(file),name.trim())));
  const run = async (file) => { step=file; await db.exec(source(file)); };
  for (const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
    if(f==='20261010232237_corrections_editoriales.sql') await run('supabase/fixtures/corrections_avant_migration.sql');
    await run(join('supabase/migrations',f));
    if(f==='20261010232237_corrections_editoriales.sql') await run('supabase/fixtures/corrections_apres_migration.sql');
  }
  for (const file of ['supabase/seed.sql','supabase/fixtures/sport_397.sql','supabase/migrations/20261011111510_pack_sport.sql']) await run(file);
  for (const f of readdirSync('supabase/tests').filter(f=>f.endsWith('.sql')).sort()) {
    await run(join('supabase/tests',f)); console.log(f+' : vert');
  }
  await run('supabase/tests/fun/scenario.sql'); console.log('fun/scenario.sql : vert');
} catch(e) { console.error(step, e.message); process.exitCode=1; }
finally { await db.close(); }
