// Test d'intégration reproductible, sans lire .env.local ni contacter KFFR.
// Prérequis : npm run db:start puis npm run db:reset.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chargerCartes, estUrlLocale, importerCartesLocales } from "./import-cartes";
import { lireCsv } from "./csv";
import { cartePublique } from "../src/lib/pedagogie";
import { testerMigrationSommeLocale } from "./test-migration-somme-local";

async function verifier() {
  const status = JSON.parse(execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "status", "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  assert(estUrlLocale(status.API_URL), "URL Supabase non locale : arrêt avant import");
  const env = { ...process.env, SUPABASE_URL: status.API_URL, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY };
  const importer = () => execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/import-dataset.ts", "--dossier", "content/dataset-v18"], { env, stdio: ["ignore", "pipe", "pipe"] });
  const db = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { db: { schema: "histoire" }, auth: { persistSession: false } });
  const publicDb = createClient(status.API_URL, status.ANON_KEY, { db: { schema: "histoire" }, auth: { persistSession: false } });
  // JWT éphémère de la pile locale, en mémoire : aucun compte créé ni secret affiché.
  assert(status.JWT_SECRET, "Secret JWT de test local absent");
  const encoder = (objet: object) => Buffer.from(JSON.stringify(objet)).toString("base64url");
  const jwt = `${encoder({ alg: "HS256", typ: "JWT" })}.${encoder({
    role: "authenticated", aud: "authenticated", sub: "00000000-0000-0000-0000-000000000021",
    exp: Math.floor(Date.now() / 1000) + 600,
  })}`;
  const token = `${jwt}.${createHmac("sha256", status.JWT_SECRET).update(jwt).digest("base64url")}`;
  const authenticatedDb = createClient(status.API_URL, status.ANON_KEY, {
    db: { schema: "histoire" }, auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const cartes = chargerCartes();
  const lire = async () => {
    const { data, error } = await db.from("chapter_cards").select("*").order("card_id");
    if (error) throw error;
    return data;
  };
  importer();
  const premier = await lire();
  assert.deepEqual(premier, [...cartes].sort((a, b) => a.card_id.localeCompare(b.card_id)));
  importer();
  assert.deepEqual(await lire(), premier, "Second import différent");
  const { count, error: erreurCompte } = await db.from("events").select("id", { count: "exact", head: true });
  assert.ifError(erreurCompte);
  assert.equal(count, 2001);
  const chapitres = lireCsv("content/dataset-v18/kiffeurs-themes-v18.csv");
  const { count: nombreChapitres, error: erreurChapitres } = await db.from("chapters").select("id", { count: "exact", head: true });
  assert.ifError(erreurChapitres);
  assert.equal(nombreChapitres, 59);
  assert.equal((await publicDb.from("chapters").select("id",{count:"exact",head:true})).count,41);
  assert.equal(new Set(cartes.map((c) => c.chapter_id)).size, 41);
  for (const carte of cartes.filter((c) => c.event_id)) {
    const e = lireCsv("content/dataset-v18/kiffeurs-events-v18.csv").find((e) => e.event_id === carte.event_id)!;
    const { data, error } = await db.from("event_answers").select("start_year,start_month,start_day,end_year,end_month,end_day,date_text").eq("event_id", carte.event_id).single();
    assert.ifError(error);
    assert.deepEqual(data, Object.fromEntries(Object.keys(data!).map((k) => [k, k === "date_text" ? e[k] : e[k] ? Number(e[k]) : null])));
  }
  for (const navigateur of [publicDb, authenticatedDb]) {
    for (const chapitre of chapitres.map((c) => c.theme_id)) {
      const { data, error } = await navigateur.rpc("get_chapter_cards", { p_chapter_id: chapitre });
      assert.ifError(error);
      assert.deepEqual(data, cartes.filter((c) => c.chapter_id === chapitre).map(cartePublique), "Projection RPC publique incorrecte");
      assert(!JSON.stringify(data).includes("EVT-"));
      assert(!JSON.stringify(data).match(/"sources"\s*:|https?:\/\//));
    }
    assert.equal((await navigateur.rpc("get_chapter_cards", { p_chapter_id: "THM-005" }).eq("event_id", "EVT-0024")).error?.code, "42703");
    assert.equal((await navigateur.rpc("get_chapter_cards", { p_chapter_id: "THM-005" }).select("sources")).error?.code, "42703");
    assert.deepEqual((await navigateur.rpc("get_chapter_cards", { p_chapter_id: "EVT-0024" })).data, []);
    for (const requete of [
      navigateur.from("chapter_cards").select("*"),
      navigateur.from("chapter_cards").select("event_id,date_text").eq("event_id", "EVT-0024"),
      navigateur.from("event_answers").select("*"),
      navigateur.from("event_aliases").select("*"),
      navigateur.from("chapter_cards").insert(cartes[0]),
      navigateur.from("chapter_cards").update({ title: "interdit" }).eq("card_id", cartes[0].card_id),
      navigateur.from("chapter_cards").delete().eq("card_id", cartes[0].card_id),
      navigateur.rpc("replace_chapter_cards", { p_cards: cartes }),
    ]) assert.equal((await requete).error?.code, "42501");
  }

  // Échec en fin de transaction : les anciennes cartes doivent rester intactes.
  const invalides = [...cartes.slice(0, -1), { ...cartes.at(-1)!, event_id: "EVT-INCONNU" }];
  await assert.rejects(importerCartesLocales(invalides, status.API_URL, status.SERVICE_ROLE_KEY));
  assert.deepEqual(await lire(), premier, "Lot partiellement supprimé après échec");
  // Les chapitres publiés conservent leur ordre et toutes leurs cartes.
  const groupe = cartes.filter((c) => c.chapter_id === "THM-005");
  const permute = groupe.map((c) => ({ ...c, sort_order: c.sort_order === 2 ? 3 : c.sort_order === 3 ? 2 : c.sort_order }));
  await assert.rejects(importerCartesLocales(permute, status.API_URL, status.SERVICE_ROLE_KEY));
  assert.deepEqual((await lire())!.filter((c) => c.chapter_id !== "THM-005"), premier!.filter((c) => c.chapter_id !== "THM-005"));
  // Un retrait historique est refusé, même pour service_role.
  await assert.rejects(importerCartesLocales(groupe.slice(0, -1), status.API_URL, status.SERVICE_ROLE_KEY));
  assert.equal((await lire())!.filter((c) => c.chapter_id === "THM-005").length,8);
  await importerCartesLocales(cartes, status.API_URL, status.SERVICE_ROLE_KEY);
  assert.deepEqual(await lire(), premier);
  testerMigrationSommeLocale();
  console.log(`OK : 2001 événements, 41 chapitres publics/59 stockés/18 inactifs, ${cartes.length} cartes conservées, références et dates v18, import idempotent/atomique, retraits historiques refusés, RPC sans event_id ni sources, table/oracle/réponses/alias/écritures anon et authenticated refusés.`);
}

verifier().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
