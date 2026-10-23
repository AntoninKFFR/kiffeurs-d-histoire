import { describe, expect, it } from "vitest";
import { classement, closeAvantLaFin, etapeRevelation, type EtatPartie, type QuestionMulti } from "@/lib/multi/partie";

const T0 = Date.parse("2026-10-23T18:00:00Z");
const iso = (s: number) => new Date(T0 + s * 1000).toISOString();

// Question 2 révélée à 20 s : Lulu (m3) trouve pile et passe devant Maxou (m1) ; Sarah (m5) n'a pas répondu.
const q: QuestionMulti = {
  id: "q2", position: 2, titre: "Sacre de Napoléon Ier", image_path: null, periode: false,
  posee_le: iso(0), limite_le: iso(30), revelee_le: iso(20), ont_valide: ["m2", "m3", "m1"],
  correction: { debut: { year: 1804 } },
  reponses: [
    { membre_id: "m1", debut: { year: 1815 }, ecart: 11, unite: "YEAR", points: 76 },
    { membre_id: "m2", debut: { year: 1806 }, ecart: 2, unite: "YEAR", points: 87 },
    { membre_id: "m3", debut: { year: 1804 }, ecart: 0, unite: "YEAR", points: 95 },
  ],
};
const etat: EtatPartie = {
  partie: { id: "p", numero: 1, etat: "en_cours", contenu: {}, precision: "YEAR", mode_chrono: false, total: 5,
    duree_question: 30, duree_revelation: 8 },
  heure_serveur: T0, moi: "m1", je_joue: true, question: q, prochaine: { position: 3, posee_le: iso(28) },
  scores: [{ membre_id: "m1", points: 168 }, { membre_id: "m2", points: 181 }, { membre_id: "m3", points: 179 }, { membre_id: "m5", points: 0 }],
};

describe("révélation (#142)", () => {
  it("se fait en trois temps : placements, bonne date, classement", () => {
    expect(etapeRevelation(q, T0 + 20_500)).toBe("placements");
    expect(etapeRevelation(q, T0 + 21_500)).toBe("date");
    expect(etapeRevelation(q, T0 + 22_500)).toBe("classement");
  });

  it("montre le classement d'avant la question tant qu'il n'a pas bougé", () => {
    expect(classement(etat, "placements").map((l) => [l.membreId, l.points])).toEqual([["m2", 94], ["m1", 92], ["m3", 84], ["m5", 0]]);
  });

  it("puis les points gagnés, les places gagnées ou perdues, et qui n'a pas répondu", () => {
    expect(classement(etat, "classement").map((l) => [l.membreId, l.gain, l.mouvement])).toEqual([
      ["m2", 87, 0], ["m3", 95, 1], ["m1", 76, -1], ["m5", null, 0],
    ]);
  });

  it("rien ne bouge à la première question, quand tout le monde partait de 0", () => {
    const premiere = { ...etat, question: { ...q, position: 1 },
      scores: [{ membre_id: "m1", points: 76 }, { membre_id: "m2", points: 87 }, { membre_id: "m3", points: 95 }, { membre_id: "m5", points: 0 }] };
    expect(classement(premiere, "classement").every((l) => l.mouvement === 0)).toBe(true);
  });

  it("dit si tout le monde a validé ou si le temps s'est écoulé", () => {
    expect(closeAvantLaFin(q)).toBe(true);
    expect(closeAvantLaFin({ ...q, revelee_le: iso(30) })).toBe(false);
  });
});
