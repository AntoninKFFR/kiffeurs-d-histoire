import { describe, expect, it } from "vitest";
import { bornesDe, CHAPITRES, comptesDe, difficultePossible, ecrireChoix, filtresDepuis, lireChoix, PACKS, THEMES } from "@/lib/solo/choix";
import { NIVEAUX } from "@/lib/apprendre/catalogue";

const lire = (q: string) => lireChoix(new URLSearchParams(q));

describe("catalogue du choix", () => {
  it("conserve les 24 packs et ajoute Sport avec ses six sous-packs", () => {
    expect(PACKS).toHaveLength(31);
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(31);
    for (let n=59;n<=82;n++) expect(PACKS.some((p) => p.id === `COL-${String(n).padStart(4,"0")}`)).toBe(true);
    expect(PACKS.filter((p) => p.parent_id === "COL-0105")).toHaveLength(6);
  });
  it("ne garde que des thèmes jouables et tous les niveaux ont des chapitres", () => {
    for (const t of THEMES) expect(t.n[2].YEAR).toBeGreaterThanOrEqual(10);
    for (const n of NIVEAUX) expect(CHAPITRES.some((c) => c.niveauSlug === n.slug)).toBe(true);
  });
});

describe("lireChoix", () => {
  it("refuse les modes, difficultés et identifiants inconnus", () => {
    expect(lire("mode=inconnu&difficulte=YEAR")).toBeNull();
    expect(lire("mode=general&difficulte=HOUR")).toBeNull();
    expect(lire("mode=pack&difficulte=YEAR&pack=../invalide")).toBeNull();
    expect(lire("mode=theme&difficulte=YEAR&theme=X")).toBeNull();
    expect(lire("mode=periode&difficulte=YEAR&periode=jurassique")).toBeNull();
    expect(lire("mode=scolaire&difficulte=YEAR&chapitres=THM-999")).toBeNull();
  });
  it("valide la période libre : pas d'année 0, bornes dans l'ordre, au moins une borne", () => {
    expect(lire("mode=periode&difficulte=YEAR&periode=libre&de=0&a=10")).toBeNull();
    expect(lire("mode=periode&difficulte=YEAR&periode=libre&de=1900&a=1800")).toBeNull();
    expect(lire("mode=periode&difficulte=YEAR&periode=libre&de=&a=")).toBeNull();
    expect(lire("mode=periode&difficulte=YEAR&periode=libre&de=-500&a=")).toEqual({ mode: "periode", difficulte: "YEAR", niveau: 1, periode: "libre", de: -500 });
  });
  it("relit ce qu'il écrit", () => {
    const choix = [
      { mode: "general", difficulte: "DAY", niveau: 1 },
      { mode: "pack", difficulte: "YEAR", niveau: 3, pack: PACKS[3].id },
      { mode: "theme", difficulte: "MONTH", niveau: 2, theme: THEMES[0].id },
      { mode: "periode", difficulte: "YEAR", niveau: 2, periode: "xixe" },
      { mode: "periode", difficulte: "YEAR", niveau: 1, periode: "libre", de: 1789, a: 1815 },
      { mode: "scolaire", difficulte: "YEAR", chapitres: [CHAPITRES[0].id, CHAPITRES[1].id] },
    ] as const;
    for (const c of choix) expect(lireChoix(new URLSearchParams(ecrireChoix(c as never)))).toEqual(c);
  });
});

describe("filtresDepuis", () => {
  it("traduit chaque mode en filtres de start_game", () => {
    expect(filtresDepuis({ mode: "general", difficulte: "YEAR" })).toEqual({ difficulty: "YEAR", questionCount: 10 });
    expect(filtresDepuis({ mode: "general", difficulte: "YEAR", niveau: 2 })).toEqual({ difficulty: "YEAR", questionCount: 10, niveau: 2 });
    expect(filtresDepuis({ mode: "periode", difficulte: "MONTH", periode: "antiquite" })).toEqual({ difficulty: "MONTH", questionCount: 10, yearMax: 476 });
    expect(filtresDepuis({ mode: "periode", difficulte: "YEAR", periode: "libre", de: 1789, a: 1815 })).toMatchObject({ yearMin: 1789, yearMax: 1815 });
    expect(filtresDepuis({ mode: "pack", difficulte: "YEAR", pack: "COL-0059" })).toMatchObject({ packId: "COL-0059" });
    expect(filtresDepuis({ mode: "theme", difficulte: "YEAR", theme: THEMES[0].id })).toMatchObject({ tagId: THEMES[0].id });
    expect(filtresDepuis({ mode: "scolaire", difficulte: "YEAR", chapitres: ["THM-001"] })).toMatchObject({ chapterIds: ["THM-001"] });
  });
  it("désactive une difficulté sans assez de questions, jamais quand le serveur doit trancher", () => {
    expect(difficultePossible({ YEAR: 50, MONTH: 9, DAY: 0 }, "MONTH")).toBe(false);
    expect(difficultePossible(null, "DAY")).toBe(true);
    expect(comptesDe({ mode: "scolaire" })).toBeNull();
  });
  it("compte les événements par niveau, de façon cumulée", () => {
    const [debutant, intermediaire, expert] = ([1, 2, 3] as const).map((niveau) => comptesDe({ mode: "general", niveau })!.YEAR);
    expect(debutant).toBeGreaterThanOrEqual(200);
    expect(debutant).toBeLessThan(intermediaire);
    expect(intermediaire).toBeLessThan(expert);
    expect(comptesDe({ mode: "pack", pack: "COL-0059", niveau: 1 })).toEqual({ YEAR: 50, MONTH: 50, DAY: 50 });
  });
});

describe("niveau dans l'URL", () => {
  it("prend Débutant quand une ancienne URL n'a pas de niveau, refuse un niveau inventé", () => {
    expect(lire("mode=general&difficulte=YEAR")).toEqual({ mode: "general", difficulte: "YEAR", niveau: 1 });
    expect(lire("mode=general&difficulte=YEAR&niveau=4")).toBeNull();
    expect(lire("mode=scolaire&difficulte=YEAR&chapitres=" + CHAPITRES[0].id)?.niveau).toBeUndefined();
  });
});

describe("bornesDe", () => {
  it("laisse toute l'histoire en général et cadre les autres choix à 10 ans près", () => {
    expect(bornesDe({ mode: "general", difficulte: "YEAR" })).toBeNull();
    const revolution = PACKS.find((p) => p.titre === "Révolution française")!;
    expect(bornesDe({ mode: "pack", difficulte: "YEAR", pack: revolution.id })).toEqual({ debut: 1770, fin: 1810 });
    expect(bornesDe({ mode: "periode", difficulte: "YEAR", periode: "libre", de: 1789, a: 1815 })).toEqual({ debut: 1779, fin: 1826 });
  });
  it("couvre tous les chapitres cochés", () => {
    const b = bornesDe({ mode: "scolaire", difficulte: "YEAR", chapitres: ["THM-016", "THM-017"] })!;
    expect(b.debut).toBeLessThanOrEqual(1904);
    expect(b.fin).toBeGreaterThanOrEqual(2000);
  });
  it("somme les chapitres pour savoir si une partie est possible", () => {
    expect(comptesDe({ mode: "scolaire", chapitres: ["THM-016"] })!.YEAR).toBeGreaterThanOrEqual(10);
  });
});

describe("mode inversé", () => {
  it("garde le sens dans le choix et le transmet au moteur", () => {
    const choix = lire("mode=general&difficulte=DAY&sens=inverse")!;
    expect(choix.sens).toBe("inverse");
    expect(lire(ecrireChoix(choix))).toEqual(choix);
    expect(filtresDepuis(choix).direction).toBe("inverse");
  });
  it("impose la date exacte, même si un ancien choix demande l’année ou le mois", () => {
    expect(lire("mode=general&difficulte=YEAR&sens=inverse")!.difficulte).toBe("DAY");
    expect(lire("mode=general&difficulte=MONTH&sens=inverse")!.difficulte).toBe("DAY");
    expect(lire("mode=general&difficulte=YEAR")!.difficulte).toBe("YEAR");
  });
  it("reste en jeu de dates sans sens, et ignore un sens inconnu", () => {
    expect(lire("mode=general&difficulte=YEAR")!.sens).toBeUndefined();
    expect(lire("mode=general&difficulte=YEAR&sens=autre")!.sens).toBeUndefined();
    expect(filtresDepuis(lire("mode=general&difficulte=YEAR")!).direction).toBeUndefined();
  });
  it("accepte aussi les chapitres du scolaire", () => {
    const choix = lire(`mode=scolaire&difficulte=YEAR&chapitres=${CHAPITRES[0].id}&sens=inverse`)!;
    expect(filtresDepuis(choix)).toMatchObject({ direction: "inverse", chapterIds: [CHAPITRES[0].id] });
  });
});
