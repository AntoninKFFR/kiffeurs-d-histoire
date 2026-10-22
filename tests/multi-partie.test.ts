import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chronoAccelere, classement, correctionPour, phaseDe, prochainRendezVous, type EtatPartie, type QuestionMulti } from "@/lib/multi/partie";
import { PERIODES } from "@/lib/solo/periodes";
import { creerSimulation } from "@/app/apercu/partie-multi/simulation";

const T0 = Date.parse("2026-10-22T18:00:00Z");
const iso = (s: number) => new Date(T0 + s * 1000).toISOString();

const question = (extra: Partial<QuestionMulti> = {}): QuestionMulti => ({
  id: "q1", position: 1, titre: "Prise de la Bastille", image_path: null, periode: false,
  posee_le: iso(0), limite_le: iso(30), revelee_le: null, ont_valide: [], ...extra,
});
const etat = (extra: Partial<EtatPartie> = {}): EtatPartie => ({
  partie: { id: "p", numero: 1, etat: "en_cours", contenu: {}, precision: "YEAR", mode_chrono: false, total: 5,
    duree_question: 30, duree_revelation: 8 },
  heure_serveur: T0, moi: "m1", je_joue: true, question: question(), prochaine: null,
  scores: [{ membre_id: "m1", points: 0 }, { membre_id: "m2", points: 0 }, { membre_id: "m3", points: 0 }],
  ...extra,
});

describe("partie Convivial (#140)", () => {
  it("passe du décompte à la question, à la révélation, puis à la fin", () => {
    const decompte = etat({ question: null, prochaine: { position: 1, posee_le: iso(3) } });
    expect(phaseDe(decompte, T0).type).toBe("decompte");
    expect(prochainRendezVous(decompte)).toBe(T0 + 3000);

    const ouverte = etat();
    expect(phaseDe(ouverte, T0 + 5000).type).toBe("question");
    expect(prochainRendezVous(ouverte)).toBe(T0 + 30000);

    const revelee = etat({ question: question({ revelee_le: iso(20) }), prochaine: { position: 2, posee_le: iso(28) } });
    expect(phaseDe(revelee, T0 + 21000)).toMatchObject({ type: "revelation", suivanteMs: T0 + 28000 });
    expect(phaseDe(revelee, T0 + 28500)).toMatchObject({ type: "decompte", position: 2 });

    const derniere = etat({ partie: { ...ouverte.partie, etat: "terminee" }, question: question({ revelee_le: iso(20) }) });
    expect(phaseDe(derniere, T0 + 25000).type).toBe("revelation");
    expect(phaseDe(derniere, T0 + 28500).type).toBe("fin");
  });

  it("classe par points, ex æquo au même rang, et ne montre que qui a validé", () => {
    const e = etat({
      question: question({ ont_valide: ["m3"] }),
      scores: [{ membre_id: "m1", points: 150 }, { membre_id: "m2", points: 210 }, { membre_id: "m3", points: 150 }],
    });
    expect(classement(e)).toEqual([
      { membreId: "m2", points: 210, rang: 1, aValide: false },
      { membreId: "m1", points: 150, rang: 2, aValide: false },
      { membreId: "m3", points: 150, rang: 2, aValide: true },
    ]);
  });

  it("donne à chacun sa correction une fois la question close", () => {
    const close = question({
      revelee_le: iso(20), periode: true,
      correction: { debut: { year: 1337 }, fin: { year: 1453 }, description: "un conflit de plus d'un siècle." },
      reponses: [{ membre_id: "m1", debut: { year: 1340 }, fin: { year: 1453 }, ecart: 3, ecart_fin: 0, unite: "YEAR", points: 88 }],
    });
    expect(correctionPour(question(), "m1")).toBeNull();
    expect(correctionPour(close, "m1")).toEqual({
      bonne: { year: 1337, month: null, day: null }, bonneFin: { year: 1453, month: null, day: null },
      points: 88, ecart: "3 ans", ecartFin: null, description: "Un conflit de plus d'un siècle.", expiree: false, autres: [],
    });
    // Sans réponse : 0 point, « temps écoulé ».
    expect(correctionPour(close, "m2")).toMatchObject({ points: 0, expiree: true });
  });

  it("annonce le mode chrono quand l'échéance a été rapprochée", () => {
    const base = etat();
    expect(chronoAccelere(base)).toBe(false);
    const rapide = etat({ partie: { ...base.partie, mode_chrono: true }, question: question({ limite_le: iso(16) }) });
    expect(chronoAccelere(rapide)).toBe(true);
  });

  it("utilise en SQL les mêmes bornes de périodes que le solo", () => {
    const sql = readFileSync("supabase/migrations/20261022140000_partie_convivial.sql", "utf8");
    for (const p of PERIODES) {
      const de = p.de == null ? "null::integer" : String(p.de);
      const a = p.a == null ? "null::integer" : String(p.a);
      expect(sql).toContain(`('${p.id}', ${de}, ${a})`);
    }
  });

  it("aperçu : clôture dès que tous les présents ont validé, 8 s de révélation", () => {
    const sim = creerSimulation();
    const q1 = sim.etat(T0);
    expect(q1.question).toBeNull();
    const ouverte = sim.etat(T0 + 3500);
    expect(ouverte.question?.ont_valide).toEqual([]);
    expect(sim.repondre("q1", { year: 1789, month: null, day: null }, null, T0 + 4000)).toEqual({ ok: true });
    const close = sim.etat(T0 + 3000 + 18000);
    expect(close.question?.revelee_le).not.toBeNull();
    expect(Date.parse(close.prochaine!.posee_le) - Date.parse(close.question!.revelee_le!)).toBe(8000);
    // Juste, en 1 s : 100 × (0,7 + 0,3 × 29/30) ≈ 99, comme en solo.
    expect(correctionPour(close.question!, "m1")?.points).toBe(99);
  });
});
