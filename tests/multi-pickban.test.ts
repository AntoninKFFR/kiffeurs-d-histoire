import { describe, expect, it } from "vitest";
import { lirePickBan, phaseDe, prochainRendezVous, type EtatPartie, type PickBan } from "@/lib/multi/partie";

const T0 = Date.parse("2026-10-23T18:00:00Z");
const iso = (s: number) => new Date(T0 + s * 1000).toISOString();
const propositions = ["Sport", "Moyen Âge", "Sciences", "XIXe siècle", "Films", "Espace", "Antiquité"]
  .map((titre, i) => ({ type: "pack" as const, id: `P${i}`, titre }));
const pb = (bans: [string, number, boolean?][], tourFin: string | null): PickBan => ({
  propositions, ordre: ["m2", "m1"], duree: 10, tour_fin: tourFin,
  bans: bans.map(([membre_id, choix, hasard = false], tour) => ({ tour, membre_id, choix, hasard })),
});
const etat = (p: PickBan, enCours = false): EtatPartie => ({
  partie: { id: "p", numero: 1, etat: enCours ? "en_cours" : "pick_ban", contenu: {}, precision: "YEAR", mode_chrono: false,
    total: 5, duree_question: 30, duree_revelation: 8 },
  pick_ban: p, heure_serveur: T0, moi: "m1", je_joue: true, question: null,
  prochaine: enCours ? { position: 1, posee_le: iso(40) } : null, scores: [],
});

describe("pick & ban (#145)", () => {
  it("alterne les tours dans l'ordre tiré par le serveur", () => {
    expect(lirePickBan(pb([], iso(10))).joueur).toBe("m2");
    const lu = lirePickBan(pb([["m2", 4], ["m1", 0], ["m2", 6]], iso(25)));
    expect(lu.joueur).toBe("m1");
    expect(lu.restantes).toEqual([1, 2, 3, 5]);
    expect(lu.bansDe("m2")).toBe(2);
    expect(lu.retenue).toBeNull();
  });
  it("garde la dernière proposition une fois six bans faits", () => {
    const lu = lirePickBan(pb([["m2", 4], ["m1", 0], ["m2", 6], ["m1", 5], ["m2", 2], ["m1", 3, true]], null));
    expect(lu.retenue).toBe(1);
    expect(lu.joueur).toBeNull();
  });
  it("montre le pick & ban, redemande l'état à la fin du tour, puis le contenu retenu jusqu'à la question", () => {
    const enCours = etat(pb([["m2", 4]], iso(13)));
    expect(phaseDe(enCours, T0 + 5000)).toMatchObject({ type: "pickban", debutMs: null });
    expect(prochainRendezVous(enCours)).toBe(T0 + 13_000);
    const fini = etat(pb([["m2", 4], ["m1", 0], ["m2", 6], ["m1", 5], ["m2", 2], ["m1", 3]], null), true);
    expect(phaseDe(fini, T0 + 38_000)).toMatchObject({ type: "pickban", debutMs: T0 + 40_000 });
    expect(phaseDe(fini, T0 + 40_000).type).toBe("decompte");
  });
});
