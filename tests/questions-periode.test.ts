import { describe, expect, it } from "vitest";
import { reponsesBilan } from "@/lib/game/bilan";
import { correctionDepuis } from "@/lib/game/partie";
import type { SoloResult } from "@/lib/game/solo";
import { ecrireChoix, filtresDepuis, lireChoix, relanceEnregistree } from "@/lib/solo/choix";
import { choixMystere } from "@/lib/solo/mystere";

// Questions « période » (#94) : l'option voyage avec le choix, la correction montre le début et la fin.
describe("option des questions période", () => {
  it("activée par défaut, coupée seulement quand le choix le dit", () => {
    const actif = lireChoix(new URLSearchParams("mode=general&difficulte=YEAR"))!;
    expect(actif.periodes).toBeUndefined();
    expect(filtresDepuis(actif).periods).toBeUndefined();
    const coupe = lireChoix(new URLSearchParams("mode=general&difficulte=YEAR&periodes=0"))!;
    expect(coupe.periodes).toBe(false);
    expect(filtresDepuis(coupe).periods).toBe(false);
    expect(lireChoix(new URLSearchParams(ecrireChoix(coupe)))).toEqual(coupe);
  });

  it("sans objet en mode inversé, conservée par la roulette et la relance", () => {
    expect(lireChoix(new URLSearchParams("mode=general&difficulte=YEAR&periodes=0&sens=inverse"))!.periodes).toBeUndefined();
    const coupe = lireChoix(new URLSearchParams("mode=general&difficulte=MONTH&periodes=0&niveau=2"))!;
    expect(choixMystere(coupe).periodes).toBe(false);
    expect(relanceEnregistree({ difficulty: "MONTH", niveau: 2, questionCount: 10, periods: false })).toContain("periodes=0");
    expect(relanceEnregistree({ difficulty: "MONTH", niveau: 2, questionCount: 10, periods: true })).not.toContain("periodes");
  });
});

describe("correction d'une question période", () => {
  it("la vraie fin et l'écart sur la fin, l'écart du début à part", () => {
    const c = correctionDepuis({ question_id: "q", correct_date: { year: 1914 }, gap: 0, unit: "YEAR", accuracy: 75, points: 75,
      expired: false, description: "guerre", periode: true, correct_end_date: { year: 1918 }, end_gap: 25, start_accuracy: 100, end_accuracy: 50 });
    expect(c).toMatchObject({ bonne: { year: 1914 }, bonneFin: { year: 1918, month: null, day: null }, ecart: null, ecartFin: "25 ans", points: 75 });
  });

  it("une question à une date garde sa correction", () => {
    const c = correctionDepuis({ question_id: "q", correct_date: { year: 1789 }, gap: 2, unit: "YEAR", accuracy: 96, points: 90, expired: false, description: null });
    expect(c.bonneFin).toBeUndefined();
    expect(c.ecart).toBe("2 ans");
  });

  it("le carnet du bilan montre la période attendue et celle du joueur", () => {
    const resultat: SoloResult = { game_id: "g", state: "finished", question_count: 1, average_accuracy: 75, total_points: 75, direction: "date",
      questions: [{ question_id: "q", position: 1, title: "première Guerre mondiale", correct_date: { year: 1914, month: 7, day: 28 },
        gap: 0, unit: "YEAR", accuracy: 75, points: 75, expired: false, description: null,
        answer: { year: 1914, month: null, day: null }, answer_end: { year: 1943, month: null, day: null },
        periode: true, correct_end_date: { year: 1918, month: 11, day: 11 }, end_gap: 25, start_accuracy: 100, end_accuracy: 50 }] };
    const [r] = reponsesBilan(resultat);
    expect(r.periode).toEqual({ attendueFin: { year: 1918 }, dateJoueurFin: { year: 1943 }, ecartFin: "25 ans" });
    expect(r.etat).toBe("Réponse incorrecte");
  });
});
