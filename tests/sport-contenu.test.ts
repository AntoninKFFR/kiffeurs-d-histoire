import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import sport from "../content/sport/packs-proposes.json";
import catalogue from "../src/lib/solo/catalogue.json";
import { lireCsv } from "../scripts/csv";
import { contenuPacksHierarchiques } from "../scripts/catalogue-packs";
import { verifierCollectionsSport } from "../scripts/import-sport";

const audit = JSON.parse(readFileSync("content/sport/audit-base-2026-10-11.json", "utf8")) as {
  events: { id: string; niveau: number; start_year: number; start_month: number | null; start_day: number | null; tags: { id: string }[] }[];
};
it("classe exactement les 397 identifiants Sport existants sans collision avec les collections v18", () => {
  expect(sport.statut).toBe("PROVISOIRE_A_VALIDER_PAR_MAX");
  const ids = sport.associations.map((a) => a.event_id);
  expect(new Set(ids).size).toBe(397);
  expect([...ids].sort()).toEqual(audit.events.map((e) => e.id).sort());
  expect(audit.events.every((e) => e.tags.some((t) => t.id === "TAG-0145"))).toBe(true);
  const reserves = new Set(lireCsv("content/dataset-v18/kiffeurs-collections-v18.csv").map((p) => p.collection_id));
  expect(sport.packs.every((p) => !reserves.has(p.id))).toBe(true);
  expect(sport.packs.slice(1).map((p) => p.comptes.total)).toEqual([49,86,57,91,60,54]);
});
it("produit une union de 397 malgré les 794 associations et des sous-packs disjoints", () => {
  const contenu = new Map(sport.packs.map((p) => [p.id, sport.associations.filter((a) => p.id === "COL-0105" || a.sous_pack === p.id).map((a) => a.event_id)]));
  const unions = contenuPacksHierarchiques(sport.packs.map((p) => ({ collection_id: p.id, parent_id: p.parent_id ?? "" })), contenu);
  expect([...unions.get("COL-0105")!]).toHaveLength(397);
  for (const p of sport.packs.slice(1)) expect([...unions.get(p.id)!]).toHaveLength(p.comptes.total);
  expect([...unions.get("COL-0106")!]).toContain("EVT-0941");
  expect([...unions.get("COL-0106")!]).not.toContain("EVT-0759");
});
it("vérifie les niveaux et précisions depuis le relevé, y compris les dates distinctes en inverse", () => {
  for (const p of sport.packs) {
    const ids = new Set(sport.associations.filter((a) => p.id === "COL-0105" || a.sous_pack === p.id).map((a) => a.event_id));
    const events = audit.events.filter((e) => ids.has(e.id));
    expect(p.comptes.niveaux).toEqual([1,2,3].map((n) => events.filter((e) => e.niveau === n).length));
    const dates = [events, events.filter((e) => e.start_month), events.filter((e) => e.start_month && e.start_day)];
    expect(p.comptes.precisions).toEqual(dates.map((es) => es.length));
    expect(p.comptes.inverse).toEqual(dates.map((es, i) => new Set(es.map((e) => [e.start_year, ...(i >= 1 ? [e.start_month] : []), ...(i === 2 ? [e.start_day] : [])].join("/"))).size));
    const statique = catalogue.packs.find((c) => c.id === p.id)!;
    expect(statique.n[2]).toEqual(Object.fromEntries(["YEAR", "MONTH", "DAY"].map((k, i) => [k, p.comptes.precisions[i]])));
  }
  expect(sport.packs[0].comptes).toMatchObject({ niveaux: [5,23,369], precisions: [397,29,29], inverse: [131,28,29] });
});
it("garde les sept niveaux en proposition et la migration limitée aux nouvelles associations", () => {
  const propositions = lireCsv("content/sport/niveaux-proposes.csv");
  expect(propositions).toHaveLength(7);
  expect(propositions.every((p) => p.statut === "PROPOSE_NON_APPLIQUE" && p.avant === "3" && p.apres === "2")).toBe(true);
  expect(sport.packs[0].proposes.niveaux).toEqual([5,30,362]);
  const migration = readFileSync("supabase/migrations/20261011111510_pack_sport.sql", "utf8");
  expect(migration).not.toMatch(/\b(update|delete|alter|create)\s+(table|function|histoire\.)/i);
  expect(migration).not.toMatch(/\b(public|auth|private)\./);
  expect(migration).not.toMatch(/insert\s+into\s+histoire\.(events|event_answers|event_aliases|event_editorial_overrides)\b/i);
  expect(migration).toContain("on conflict (pack_id,event_id) do nothing");
  for (const id of sport.associations.map((a) => a.event_id)) expect(migration).toContain(`'${id}'`);
  const anciens = lireCsv("content/dataset-v18/kiffeurs-ready-collections-v18.csv");
  expect(anciens).toHaveLength(24);
  expect(catalogue.packs).toHaveLength(31);
  for (const p of anciens) {
    expect(catalogue.packs.find((c) => c.id === p.collection_id)).toMatchObject({ titre: p.title, description: p.description });
    expect(migration).not.toContain(`'${p.collection_id}'`);
  }
});
it("fournit 397 lignes d’inventaire avec leurs sources et signale les dates traditionnelles", () => {
  const inventaire = lireCsv("content/sport/inventaire-397.csv");
  expect(inventaire).toHaveLength(397);
  expect(inventaire.every((e) => e.sources_existantes.includes("https://") && e.precisions_jouables.includes("YEAR"))).toBe(true);
  expect(inventaire.find((e) => e.event_id === "EVT-0023")!.alertes).toContain("TRADITIONAL");
});
it("laisse importer les 24 collections et refuse une collision d’un futur dataset avant écriture", () => {
  const anciens = lireCsv("content/dataset-v18/kiffeurs-ready-collections-v18.csv").map((p) => ({ collection_id:p.collection_id, slug:p.slug }));
  expect(() => verifierCollectionsSport(anciens)).not.toThrow();
  expect(() => verifierCollectionsSport([...anciens,{ collection_id:"COL-0105",slug:"nouveau-pack" }])).toThrow("réservées");
  expect(() => verifierCollectionsSport([...anciens,{ collection_id:"COL-9999",slug:"sport-tennis" }])).toThrow("réservées");
});
