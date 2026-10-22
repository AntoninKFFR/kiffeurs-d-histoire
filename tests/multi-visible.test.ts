import { describe, expect, it } from "vitest";
import { creerLimiteur, doitDiffuser, rapprocher } from "@/lib/multi/curseurs";
import { lireEvenement } from "@/lib/multi/canal";

function horlogeFactice() {
  let t = 0;
  let taches: { quand: number; f: () => void; id: number }[] = [];
  let n = 0;
  return {
    maintenant: () => t,
    plusTard: (f: () => void, ms: number) => { n += 1; taches.push({ quand: t + ms, f, id: n }); return n; },
    annuler: (id: unknown) => { taches = taches.filter((x) => x.id !== id); },
    avancer(ms: number) {
      t += ms;
      for (const x of taches.filter((y) => y.quand <= t)) { taches = taches.filter((y) => y !== x); x.f(); }
    },
  };
}

describe("mode visible (#141)", () => {
  it("envoie au plus 10 curseurs par seconde, et toujours le dernier", () => {
    const horloge = horlogeFactice();
    const envoyes: number[] = [];
    const l = creerLimiteur((v: number) => envoyes.push(v), 100, horloge);
    // 60 déplacements par seconde pendant 1 s.
    for (let i = 0; i < 60; i++) { l.pousser(i); horloge.avancer(1000 / 60); }
    horloge.avancer(200);
    expect(envoyes.length).toBeLessThanOrEqual(11);
    expect(envoyes.length).toBeGreaterThanOrEqual(9);
    expect(envoyes.at(-1)).toBe(59);
    l.pousser(99);
    l.arreter();
    horloge.avancer(500);
    expect(envoyes.at(-1)).not.toBe(99);
  });

  it("ne diffuse rien en mode invisible, ni après avoir validé", () => {
    expect(doitDiffuser(false, true, false)).toBe(false);
    expect(doitDiffuser(true, true, true)).toBe(false);
    expect(doitDiffuser(true, false, false)).toBe(false);
    expect(doitDiffuser(true, true, false)).toBe(true);
  });

  it("lisse le déplacement vers la cible", () => {
    let x = 0;
    for (let i = 0; i < 6; i++) x = rapprocher(x, 100, 16);
    expect(x).toBeGreaterThan(50);
    expect(x).toBeLessThan(100);
    for (let i = 0; i < 200; i++) x = rapprocher(x, 100, 16);
    expect(x).toBe(100);
  });

  it("filtre les curseurs reçus du canal", () => {
    expect(lireEvenement({ type: "curseur", membreId: "m2", question: "q1", annee: 1789, anneeFin: 1799 }))
      .toEqual({ type: "curseur", membreId: "m2", question: "q1", annee: 1789, anneeFin: 1799 });
    expect(lireEvenement({ type: "curseur", membreId: "m2", annee: "1789" })).toBeNull();
    expect(lireEvenement({ type: "curseur", membreId: "m2", annee: 1789, reponse: 1790 })).toEqual({ type: "curseur", membreId: "m2", annee: 1789 });
  });
});
