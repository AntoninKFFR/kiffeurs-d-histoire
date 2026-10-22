import { describe, expect, it } from "vitest";
import { decrireCible, optionsContenu, titreContenu } from "@/lib/multi/contenu";
import type { Reglages } from "@/lib/multi/salon";

const base: Reglages = { questions: 10, precision: "YEAR", questions_periode: false, mode_visible: false, mode_chrono: false,
  contenu: { choix: "direct", categories: ["pack"], cible: null } };

describe("contenu des salons (#136)", () => {
  it("propose les packs, périodes et thèmes du solo", () => {
    for (const type of ["pack", "periode", "theme"] as const) {
      const options = optionsContenu(type);
      expect(options.length).toBeGreaterThan(0);
      expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
      expect(options.every((o) => o.type === type && o.titre && o.detail)).toBe(true);
    }
  });

  it("décrit le contenu choisi, ou le mode de choix", () => {
    expect(titreContenu(base)).toBe("Toute l'Histoire");
    expect(titreContenu({ ...base, contenu: { ...base.contenu, cible: { type: "periode", id: "xixe" } } })).toBe("XIXe siècle");
    expect(titreContenu({ ...base, contenu: { ...base.contenu, choix: "mystere" } })).toBe("Thème Mystère");
    expect(decrireCible({ type: "pack", id: "inconnu" })).toBeNull();
  });
});
