import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { EMOTES, PHRASES, estDansLeCatalogue, urlEmote } from "@/lib/multi/chat-catalogue";

it("chaque identifiant du catalogue est unique, émotes et phrases confondues", () => {
  const ids = [...EMOTES.map((e) => e.id), ...PHRASES.map((p) => p.id)];
  expect(new Set(ids).size).toBe(ids.length);
});

it("chaque émote a son dessin SVG léger (4 Ko max) dans public/emotes", () => {
  for (const e of EMOTES) {
    const fichier = join(process.cwd(), "public", urlEmote(e.id));
    expect(existsSync(fichier), e.id).toBe(true);
    expect(statSync(fichier).size, e.id).toBeLessThanOrEqual(4096);
    expect(readFileSync(fichier, "utf8")).toMatch(/^<svg [^>]*viewBox="0 0 64 64"/);
  }
});

it("seuls les identifiants du catalogue passent, jamais un texte libre", () => {
  expect(estDansLeCatalogue("napoleon-rire")).toBe(true);
  expect(estDansLeCatalogue("berezina")).toBe(true);
  expect(estDansLeCatalogue("Ça sent la Bérézina…")).toBe(false);
  expect(estDansLeCatalogue("")).toBe(false);
});
