import { expect, it } from "vitest";
import { inventaireIndependant } from "../scripts/phase3-pedagogie";
import { lireCsv } from "../scripts/csv";
import { chargerCompletions } from "../scripts/completions-pedagogiques";
import { chargerCartesSousChapitres, validerFiliationCartes } from "../scripts/import-cartes";

it("recompose les 231 manques depuis les rattachements canoniques et conserve les 61 origines", () => {
  const p = inventaireIndependant();
  expect(p.manques).toHaveLength(231);
  expect(p.completions).toHaveLength(104);
  expect(p.enfants).toHaveLength(188);
  expect(p.enfants.filter(c => c.origine)).toHaveLength(61);
  expect(p.enfants.filter(c => !c.origine)).toHaveLength(127);
});

it("couvre exactement tous les ensembles attendus avec les CSV éditoriaux livrés", () => {
  const p = inventaireIndependant();
  const completions = chargerCompletions("content/pedagogie/cartes-completions.csv");
  const enfants = chargerCartesSousChapitres("content/pedagogie/cartes-sous-chapitres.csv");
  const key = (c: { chapter_id?: string; event_id?: string | null }) => `${c.chapter_id}/${c.event_id}`;
  expect(completions.map(key).sort()).toEqual(p.completions.map(key).sort());
  expect(enfants.map(key).sort()).toEqual(p.enfants.map(key).sort());
  const ids = [...p.anciennes, ...completions, ...enfants].map(c => c.card_id);
  expect(new Set(ids).size).toBe(617);
  for (const child of p.structure.sous_chapitres)
    expect(enfants.filter(c => c.chapter_id === child.id).map(c => c.event_id).sort()).toEqual([...child.event_ids].sort());
});

it("préserve tous les champs validés des 61 copies et refuse filiation absente ou incorrecte", () => {
  const p = inventaireIndependant(), enfants = lireCsv("content/pedagogie/cartes-sous-chapitres.csv");
  const copies = enfants.filter(c => c.source_card_id);
  expect(copies).toHaveLength(61);
  for (const c of copies) {
    const origin = p.anciennes.find(o => o.card_id === c.source_card_id)!;
    for (const k of Object.keys(origin).filter(k => !["card_id", "chapter_id", "sort_order"].includes(k)))
      expect(c[k], `${c.card_id}/${k}`).toBe(origin[k]);
  }
  expect(() => validerFiliationCartes([{ ...copies[0], source_card_id: "" }], p.anciennes, p.structure)).toThrow(/explicite/);
  expect(() => validerFiliationCartes([{ ...copies[0], source_card_id: "inconnue" }], p.anciennes, p.structure)).toThrow(/incohérente/);
  expect(p.structure.sous_chapitres.find(c => c.id === "THM-049")?.blocages).toContain("han-canon-incoherent");
  expect(p.structure.sous_chapitres.every(c => c.etat === "inactif" && c.validation_contenu === null)).toBe(true);
});
