import { describe, expect, it } from "vitest";
import { bandeRoulette, decompteVotes, memeContenu, phaseDe, prochainRendezVous, type EtatPartie, type PropositionContenu } from "@/lib/multi/partie";
import { detailContenu, motifContenu } from "@/lib/multi/contenu";
import { phraseAttente } from "@/components/multi/ChoixPartie";

const T0 = Date.parse("2026-10-23T18:00:00Z");
const iso = (s: number) => new Date(T0 + s * 1000).toISOString();
const PROPOSITIONS: PropositionContenu[] = [
  { type: "pack", id: "COL-0066", titre: "Révolution française" },
  { type: "periode", id: "xixe", titre: "XIXe siècle" },
  { type: "theme", id: "TAG-0127", titre: "Sciences" },
];
const base: EtatPartie = {
  partie: { id: "p", numero: 1, etat: "vote", contenu: {}, precision: "YEAR", mode_chrono: false, total: 10,
    duree_question: 30, duree_revelation: 8, categories: ["pack", "periode", "theme"] },
  vote: { propositions: PROPOSITIONS, fin: iso(15), duree: 15, votes: [{ membre_id: "m2", choix: 0 }, { membre_id: "m1", choix: 2 }, { membre_id: "m3", choix: 2 }] },
  tirage: null, heure_serveur: T0, moi: "m1", je_joue: true, question: null, prochaine: null, scores: [],
};

describe("vote (#144)", () => {
  it("montre le vote et redemande l'état à la fin du chrono", () => {
    expect(phaseDe(base, T0 + 5000).type).toBe("vote");
    expect(prochainRendezVous(base)).toBe(T0 + 15_000);
  });
  it("compte les voix de chaque proposition et retrouve la mienne", () => {
    expect(decompteVotes(base.vote!, "m1")).toEqual({ voix: [["m2"], [], ["m1", "m3"]], monChoix: 2 });
    expect(decompteVotes(base.vote!, "m9").monChoix).toBeNull();
  });
  it("dit qui n'a pas encore voté", () => {
    expect(phraseAttente([])).toBe("Tout le monde a voté.");
    expect(phraseAttente(["Sarah"])).toBe("Sarah n'a pas encore voté.");
    expect(phraseAttente(["Sarah", "Nora"])).toBe("Sarah et Nora n'ont pas encore voté.");
    expect(phraseAttente(["a", "b", "c"])).toBe("3 joueurs n'ont pas encore voté.");
  });
  it("décrit chaque proposition avec un motif de la charte", () => {
    expect(motifContenu(PROPOSITIONS[1])).toBe("locomotive");
    expect(motifContenu(PROPOSITIONS[0])).toBe("cocarde");
    expect(motifContenu({ type: "theme", id: "inconnu", titre: "Zzz" })).toMatch(/^[a-z]+$/);
    expect(detailContenu(PROPOSITIONS[1])).toBe("1789 – 1914");
    expect(detailContenu(PROPOSITIONS[0])).toMatch(/^\d+ questions · /);
  });
});

describe("roulette (#144)", () => {
  const tirage = { candidats: [PROPOSITIONS[0], PROPOSITIONS[2]], gagnant: PROPOSITIONS[0], fin: iso(6) };
  const mystere: EtatPartie = { ...base, vote: null, tirage, partie: { ...base.partie, etat: "en_cours", contenu: { ...PROPOSITIONS[0], mystere: true } },
    prochaine: { position: 1, posee_le: iso(9) } };
  it("tourne puis montre le gagnant jusqu'à la première question", () => {
    expect(phaseDe(mystere, T0 + 1000)).toEqual({ type: "roulette", tirage, debutMs: T0 + 9000 });
    expect(phaseDe(mystere, T0 + 8000).type).toBe("roulette");
    expect(phaseDe(mystere, T0 + 9000).type).toBe("decompte");
  });
  it("s'arrête sur le gagnant, jamais précédé ni suivi de lui-même", () => {
    const bande = bandeRoulette(tirage, 24);
    expect(bande).toHaveLength(28);
    expect(bande[24]).toEqual(tirage.gagnant);
    expect(memeContenu(bande[23], tirage.gagnant)).toBe(false);
    expect(memeContenu(bande[25], tirage.gagnant)).toBe(false);
    expect(new Set(bande.map((c) => c.id))).toEqual(new Set(["COL-0066", "TAG-0127"]));
  });
  it("fonctionne avec un seul candidat", () => {
    expect(bandeRoulette({ candidats: [], gagnant: PROPOSITIONS[1], fin: iso(6) }, 3).every((c) => c.id === "xixe")).toBe(true);
  });
});
