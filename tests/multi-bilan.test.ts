import { describe, expect, it } from "vitest";
import { classementFinal, coupDeMaitre, plusGrosRate, type BilanPartie } from "@/lib/multi/bilan";
import { creerSimulation } from "@/app/apercu/partie-multi/simulation";

const bilan = (extra: Partial<BilanPartie> = {}): BilanPartie => ({
  partie: { id: "p", numero: 1, contenu: { titre: "Révolution et Empire" }, precision: "YEAR", total: 2 },
  questions: [
    { position: 1, titre: "sacre de Napoléon", correction: { debut: { year: 1804 } }, reponses: [
      { membre_id: "m2", debut: { year: 1804 }, ecart: 0, unite: "YEAR", points: 99, secondes: 3.2 },
      { membre_id: "m1", debut: { year: 1804 }, ecart: 0, unite: "YEAR", points: 99, secondes: 1.4 },
    ] },
    { position: 2, titre: "Waterloo", correction: { debut: { year: 1815 } }, reponses: [
      { membre_id: "m1", debut: { year: 1812 }, ecart: 3, unite: "YEAR", points: 80, secondes: 9 },
      { membre_id: "m3", debut: { year: 1830 }, ecart: 15, unite: "YEAR", points: 52, secondes: 20 },
    ] },
  ],
  scores: [{ membre_id: "m1", points: 179 }, { membre_id: "m2", points: 99 }, { membre_id: "m3", points: 52 }, { membre_id: "m4", points: 99 }],
  ...extra,
});

describe("fin de partie (#143)", () => {
  it("classe par points, ex æquo au même rang", () => {
    expect(classementFinal(bilan()).map((r) => [r.membreId, r.rang])).toEqual([["m1", 1], ["m2", 2], ["m4", 2], ["m3", 4]]);
  });

  it("coup de maître : le plus de points, puis le plus rapide", () => {
    expect(coupDeMaitre(bilan())).toEqual({ membreId: "m1", titre: "Sacre de Napoléon", texte: "à l'année près en 1 seconde" });
  });

  it("plus gros raté : le moins de points, avec le sens de l'erreur", () => {
    expect(plusGrosRate(bilan())).toEqual({ membreId: "m3", titre: "Waterloo", texte: "en 1830 : 15 ans trop tard" });
  });

  it("pas de faits marquants sans réponse, ni de raté si tout est juste", () => {
    const vide = bilan({ questions: [] });
    expect(coupDeMaitre(vide)).toBeNull();
    expect(plusGrosRate(vide)).toBeNull();
    expect(plusGrosRate(bilan({ questions: [bilan().questions[0]] }))).toBeNull();
  });

  it("aperçu : le bilan n'existe qu'une fois la partie terminée", () => {
    const T0 = Date.parse("2026-10-22T18:00:00Z");
    const sim = creerSimulation();
    expect(sim.bilan(T0)).toBeNull();
    const b = sim.bilan(T0 + 10 * 60_000)!;
    expect(b.questions).toHaveLength(5);
    expect(b.scores.map((x) => x.membre_id)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
  });
});
