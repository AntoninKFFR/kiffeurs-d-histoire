import { describe, expect, it } from "vitest";
import { chatAutorise, elementChat, nettoyerEnvois } from "@/lib/multi/chat";
import { lireEvenement } from "@/lib/multi/canal";

describe("chat restreint (#138)", () => {
  it("accepte 1 message par seconde et 5 par 10 secondes", () => {
    expect(chatAutorise([], 0)).toBe(true);
    expect(chatAutorise([0], 500)).toBe(false);
    expect(chatAutorise([0], 1000)).toBe(true);
    const cinq = [0, 1000, 2000, 3000, 4000];
    expect(chatAutorise(cinq, 5000)).toBe(false);
    expect(chatAutorise(cinq, 10_001)).toBe(true);
    expect(nettoyerEnvois(cinq, 12_500)).toEqual([3000, 4000]);
  });

  it("n'affiche que le catalogue", () => {
    expect(elementChat("berezina")).toMatchObject({ type: "phrase" });
    expect(elementChat("napoleon-rire")).toMatchObject({ type: "emote" });
    expect(elementChat("<b>insulte</b>")).toBeNull();
    expect(lireEvenement({ type: "chat", membreId: "m1", id: "texte libre" })).toBeNull();
    expect(lireEvenement({ type: "chat", membreId: "m1", id: "sacrebleu", texte: "pirate" })).toEqual({ type: "chat", membreId: "m1", id: "sacrebleu" });
  });
});
