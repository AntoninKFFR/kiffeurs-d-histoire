// @vitest-environment jsdom
import { readFileSync, statSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Frise } from "@/components/frise/Frise";
import type { useVue } from "@/components/frise/useVue";
import { EPOQUES, type Vue } from "@/lib/game/frise";
import { estHabillage, habillageDe, HABILLAGES, LISTE_HABILLAGES } from "@/lib/game/habillages";
import { bornesDe, lireChoix } from "@/lib/solo/choix";
import s from "@/components/frise/frise.module.css";

// ---------- Choix de l'habillage ----------

describe("habillageDe", () => {
  it("associe un pack, un thème ou une période à son habillage par identifiant", () => {
    expect(habillageDe({ mode: "pack", pack: "COL-0063" }, { debut: 1900, fin: 1940 })).toBe("tranchees");
    expect(habillageDe({ mode: "pack", pack: "COL-0078" }, { debut: -3210, fin: 490 })).toBe("mosaique");
    expect(habillageDe({ mode: "periode", periode: "antiquite" }, { debut: -3500, fin: 490 })).toBe("mosaique");
    // « Espace » remonte à Galilée : l'habillage vient de l'identifiant, pas des dates.
    expect(habillageDe({ mode: "pack", pack: "COL-0070" }, { debut: 1600, fin: 2030 })).toBe("espace");
    expect(habillageDe({ mode: "theme", theme: "TAG-0130" }, { debut: 1600, fin: 2030 })).toBe("espace");
  });

  it("applique aussi l'habillage à une partie dont les dates tiennent dans la plage (chapitre, sous-pack)", () => {
    expect(habillageDe({ mode: "scolaire" }, { debut: 1901, fin: 1931 })).toBe("tranchees");
    expect(habillageDe({ mode: "pack", pack: "COL-9999" }, { debut: -800, fin: -300 })).toBe("mosaique");
  });

  it("laisse la frise de la V1 hors des périodes retenues", () => {
    expect(habillageDe(null, null)).toBeNull();
    expect(habillageDe({ mode: "general" }, null)).toBeNull();
    expect(habillageDe({ mode: "pack", pack: "COL-0060" }, { debut: -770, fin: 2030 })).toBeNull();
    expect(habillageDe({ mode: "periode", periode: "moyen-age" }, { debut: 460, fin: 1510 })).toBeNull();
    // Guerres mondiales : deux guerres, pas l'habillage d'une seule.
    expect(habillageDe({ mode: "periode", periode: "guerres-mondiales" }, { debut: 1900, fin: 1960 })).toBeNull();
    // Les années folles débordent de la plage de la Grande Guerre.
    expect(habillageDe({ mode: "scolaire" }, { debut: 1919, fin: 1939 })).toBeNull();
  });

  it("reconnaît les identifiants valides seulement", () => {
    expect(estHabillage("espace")).toBe(true);
    expect(estHabillage("inconnu")).toBe(false);
    expect(estHabillage(undefined)).toBe(false);
  });

  it("suit le choix réel d'une partie : le pack de la Première Guerre mondiale, vu par la page de partie", () => {
    const choix = lireChoix(new URLSearchParams("mode=pack&pack=COL-0063&difficulte=YEAR"));
    expect(choix).not.toBeNull();
    expect(habillageDe(choix, bornesDe(choix!))).toBe("tranchees");
  });
});

// ---------- Poids et indépendance des SVG ----------

describe("fichiers d'habillage", () => {
  const fichiers = LISTE_HABILLAGES.flatMap((h) => [h.horizon.url, h.detail, h.fond.image.match(/url\(([^)]+)\)/)![1]]);

  it("sont de petits SVG autonomes, chargés seulement quand la période est jouée", () => {
    let total = 0;
    for (const url of fichiers) {
      const chemin = `public${url}`;
      const taille = statSync(chemin).size;
      total += taille;
      expect(taille, url).toBeLessThan(8 * 1024);
      const svg = readFileSync(chemin, "utf8");
      expect(svg, url).not.toMatch(/<image|<script|href=|data:/);
    }
    expect(total).toBeLessThan(32 * 1024);
  });
});

// ---------- Lisibilité : contraste des dates, marqueurs et saisie ----------

const css = readFileSync("src/app/globals.css", "utf8");
const jetons = (bloc: string) => Object.fromEntries([...bloc.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const clair = jetons(css.slice(0, css.indexOf('[data-theme="dark"]')));
const sombre = { ...clair, ...jetons(css.slice(css.indexOf('[data-theme="dark"]'))) };

const canal = (hex: string, i: number) => Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
const lineaire = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => 0.2126 * lineaire(canal(hex, 0)) + 0.7152 * lineaire(canal(hex, 1)) + 0.0722 * lineaire(canal(hex, 2));
const contraste = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const melange = (dessus: string, dessous: string, alpha: number) =>
  `#${[0, 1, 2].map((i) => Math.round(canal(dessus, i) * alpha + canal(dessous, i) * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;

describe.each(LISTE_HABILLAGES.map((h) => [h.id, h] as const))("lisibilité de l'habillage %s", (_id, h) => {
  const th = h.sombre ? sombre : clair;

  it.each(["encre", "encre-douce", "oxyde"])("le texte « %s » des dates et réponses atteint 4,5:1 sur tous les fonds", (jeton) => {
    for (const fond of h.fondsPires) expect(contraste(th[jeton], fond), `${jeton} sur ${fond}`).toBeGreaterThanOrEqual(4.5);
  });

  it("les noms d'époques restent lisibles sur le bandeau translucide", () => {
    for (const epoque of EPOQUES) {
      const jeton = epoque.couleur.match(/--color-([\w-]+)/)![1];
      for (const fond of h.fondsPires) expect(contraste(th.encre, melange(th[jeton], fond, 0.62)), `${epoque.nom} sur ${fond}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("le repère d'axe et la réponse se détachent du fond (3:1)", () => {
    for (const fond of h.fondsPires) {
      expect(contraste(th.encre, fond), "axe").toBeGreaterThanOrEqual(3);
      expect(contraste(th.laiton, fond), "bonne réponse").toBeGreaterThanOrEqual(1.5);
    }
  });
});

// ---------- Rendu dans la frise ----------

const largeur = 1120;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(el: HTMLElement) {
      Object.defineProperty(el, "clientWidth", { value: largeur, configurable: true });
      Object.defineProperty(el, "clientHeight", { value: 600, configurable: true });
      this.callback([], this as unknown as ResizeObserver);
    }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const vue: Vue = { debut: 1900, fin: 1935 };
const controle = { vue, vueRef: { current: vue }, placer: vi.fn(), animer: vi.fn(), zoomer: vi.fn(), arreter: vi.fn(), bornes: vue } as ReturnType<typeof useVue>;

describe("Frise habillée", () => {
  it("sans habillage, reste la frise de la V1 : pas de décor d'horizon, pas de fond posé", () => {
    const { container } = render(<Frise precision="annee" remplir controle={controle} />);
    const racine = container.querySelector(`.${s.frise}`) as HTMLElement;
    expect(racine.dataset.habillage).toBeUndefined();
    expect(racine.classList.contains(s.habille)).toBe(false);
    expect(racine.style.backgroundColor).toBe("");
    expect(container.querySelector(`.${s.horizon}`)).toBeNull();
    expect(container.querySelector(`.${s.motif}`)).not.toBeNull();
  });

  it.each(LISTE_HABILLAGES.map((h) => h.id))("pose le fond et le décor de %s, sans toucher à la lecture ni au clic", (id) => {
    const { container } = render(<Frise precision="annee" remplir habillage={id} controle={controle} onReponse={vi.fn()} />);
    const racine = container.querySelector(`.${s.frise}`) as HTMLElement;
    const h = HABILLAGES[id];
    expect(racine.dataset.habillage).toBe(id);
    expect(racine.classList.contains(s.habille)).toBe(true);
    expect(racine.style.backgroundImage).toContain(h.fond.image.match(/url\(([^)]+)\)/)![1]);
    const horizon = container.querySelector(`.${s.horizon}`) as HTMLElement;
    expect(horizon).not.toBeNull();
    // Le décor ne capte jamais les clics ni la lecture d'écran.
    expect(horizon.getAttribute("aria-hidden")).toBe("true");
    expect(horizon.style.backgroundImage).toContain(h.horizon.url);
    // Le fond sombre n'allume le thème de nuit que sur la bande, jamais sur les boîtes posées dessus.
    const nuit = container.querySelector('[data-theme="dark"]');
    expect(Boolean(nuit)).toBe(h.sombre);
    if (nuit) expect(racine.contains(nuit) && racine !== nuit).toBe(true);
    // Les motifs gravés de la V1 laissent la place au décor de l'habillage.
    expect(container.querySelector(`.${s.motif}`)).toBeNull();
  });

  it("le décor est le même quelle que soit la date : seul le défilement le déplace", () => {
    const vue2: Vue = { debut: 1920, fin: 1935 };
    const c2 = { ...controle, vue: vue2, vueRef: { current: vue2 } } as ReturnType<typeof useVue>;
    const a = render(<Frise precision="annee" remplir habillage="tranchees" controle={controle} />).container.querySelector(`.${s.horizon}`) as HTMLElement;
    const imageA = a.style.backgroundImage;
    cleanup();
    const b = render(<Frise precision="annee" remplir habillage="tranchees" controle={c2} />).container.querySelector(`.${s.horizon}`) as HTMLElement;
    expect(b.style.backgroundImage).toBe(imageA);
  });
});
