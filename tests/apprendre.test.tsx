// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CHAPITRES, NIVEAUX, cheminChapitre, trouverChapitre } from "@/lib/apprendre/catalogue";
import { cadrageChapitre, debutCarte, marqueursCartes } from "@/lib/apprendre/frise";
import { ChoisirChapitre } from "@/components/pedagogie/ChoisirChapitre";
import { DecouvrirChapitre } from "@/components/pedagogie/DecouvrirChapitre";
import { chargerDemoPedagogie } from "@/app/demo/pedagogie/donnees";
import { lireCsv } from "../scripts/csv";
import { existsSync, readFileSync } from "node:fs";
import { appliquerEtatsPublies, chargerStructure, projectionStructure, type EtatPublie } from "../scripts/structure-pedagogique";
import { versT } from "@/lib/game/frise";
import { Frise } from "@/components/frise/Frise";
import type { CartePedagogique } from "@/lib/pedagogie";

// Ces tests de navigation ne décident pas de la disponibilité serveur des dessins.
const pourApprendre = (c: CartePedagogique) => ({ ...c, illustrationDediee: false });

// La progression et le lancement du test relèvent de progression.test.tsx : ici, aucun appel serveur.
vi.mock("@/app/apprendre/actions", () => ({ lireProgression: vi.fn(() => new Promise(() => {})), marquerChapitreDecouvert: vi.fn(), enregistrerTestChapitre: vi.fn() }));
vi.mock("@/app/partie/actions", () => ({ lancer: vi.fn() }));

// Le comportement de la frise elle-même est vérifié dans frise.test.ts et au
// navigateur ; ce double teste le contrat et le parcours du nouvel écran.
vi.mock("@/components/frise/Frise", () => ({ Frise: vi.fn(({ marqueurs, onMarqueur }) => <div aria-label="Frise en lecture">
  {marqueurs.map((m: { id: string; titre: string }) => <button key={m.id} onClick={() => onMarqueur(m.id)}>{m.titre}</button>)}
</div>) }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => { f(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("conserve les 41 chapitres historiques et propose exactement les unités publiques exportées, sans charger leurs cartes", () => {
  const themes = lireCsv("content/dataset-v18/kiffeurs-themes-v18.csv");
  expect(CHAPITRES.filter(c=>!c.parent_id).map((c) => [c.id, c.titre, c.niveau])).toEqual(themes.map((t) => [t.theme_id, t.theme_title, t.level]));
  const s=chargerStructure(),file='content/pedagogie/etats-publies-92.json';
  const expected=existsSync(file)?appliquerEtatsPublies(s,JSON.parse(readFileSync(file,'utf8')) as EtatPublie[]):projectionStructure(s);
  expect(CHAPITRES).toEqual(expected.filter(c=>c.etat!=='inactif'));
  const count=existsSync(file)?56:41;
  expect(NIVEAUX.map((n) => n.slug)).toEqual(["cm2", "6e", "5e", "4e", "3e", "seconde", "premiere", "terminale", "premiere-hggsp", "terminale-hggsp"]);
  expect(new Set(CHAPITRES.map(cheminChapitre)).size).toBe(count);
  expect(JSON.stringify(CHAPITRES)).not.toMatch(/EVT-|"(?:event_id|sources|start_year|body)"\s*:/);
  render(<ChoisirChapitre chapitres={CHAPITRES} />);
  const select = screen.getByRole("combobox", { name: "1. Choisir mon niveau" });
  expect(within(select).getAllByRole("option")).toHaveLength(10);
  let total = 0;
  for (const n of NIVEAUX) {
    fireEvent.change(select, { target: { value: n.slug } });
    const liens = screen.getAllByRole("link");
    expect(liens.map((l) => l.getAttribute("href"))).toEqual(CHAPITRES.filter((c) => c.niveauSlug === n.slug).map(cheminChapitre));
    total += liens.length;
  }
  expect(total).toBe(count);
});

it("résout les slugs figés et refuse niveau inconnu, chapitre inconnu et mauvais niveau", () => {
  for (const c of CHAPITRES) {
    expect(c.slug).toMatch(/^thm-\d{3}-[a-z0-9-]+$/);
    expect(trouverChapitre(c.niveauSlug, c.slug)).toBe(c);
    expect(trouverChapitre("inconnu", c.slug)).toBeUndefined();
  }
  expect(trouverChapitre("3e", "inconnu")).toBeUndefined();
  expect(trouverChapitre("6e", CHAPITRES.find((c) => c.id === "THM-027")!.slug)).toBeUndefined();
});

it("ouvre et parcourt les cartes via la frise, la liste, les boutons et le clavier", () => {
  const cartes = chargerDemoPedagogie().find((c) => c.id === "THM-027")!.cartes.map(pourApprendre);
  render(<DecouvrirChapitre cartes={cartes} chapitre={{ id: "THM-027", titre: "Chapitre", niveau: "3e" }} />);
  const panneau = () => screen.getByRole("article");
  expect(within(panneau()).getByRole("heading", { level: 2 }).textContent).toBe(cartes[0].title);
  expect((screen.getByRole("button", { name: "← Précédente" }) as HTMLButtonElement).disabled).toBe(true);
  expect(vi.mocked(Frise).mock.calls.at(-1)![0]).toMatchObject({ mode: "lecture", precision: "jour", presentationMarqueurs: "illustree" });
  expect(vi.mocked(Frise).mock.calls.at(-1)![0].onReponse).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Suivante →" }));
  expect(panneau().textContent).toContain(cartes[1].body);
  fireEvent.keyDown(panneau(), { key: "ArrowLeft" });
  expect(panneau().textContent).toContain(cartes[0].body);
  const somme = cartes.find((c) => c.card_id === "CARD-027-somme-guerre-usure")!;
  fireEvent.click(within(screen.getByLabelText("Frise en lecture")).getByRole("button", { name: somme.title }));
  expect(panneau().textContent).toContain("1er juillet - 18 novembre 1916");
  expect(panneau().textContent).toContain(somme.takeaway);
  expect(panneau().querySelector("img")?.getAttribute("src")).toBe(`/api/pedagogie/illustration/${somme.card_id}`);
  const liste = screen.getByRole("navigation", { name: "Cartes du chapitre" });
  expect(within(liste).getAllByRole("button").map((b) => b.textContent)).toEqual(cartes.map((c, i) => `${i + 1}${c.title}`));
  expect(liste.querySelector('[aria-pressed="true"]')?.textContent).toContain(somme.title);
  fireEvent.keyDown(panneau(), { key: "Escape" });
  expect(screen.queryByRole("article")).toBeNull();
  fireEvent.click(within(liste).getAllByRole("button").at(-1)!);
  expect((screen.getByRole("button", { name: "Suivante →" }) as HTMLButtonElement).disabled).toBe(true);
  // Le test est lancé par le formulaire de lancement existant, filtré sur ce seul chapitre.
  const tester = screen.getByRole("button", { name: "Me tester sur ce chapitre" }) as HTMLButtonElement;
  expect(tester.disabled).toBe(false);
  expect(tester.form?.querySelector<HTMLInputElement>('input[name="c"]')?.value).toBe("mode=scolaire&difficulte=YEAR&chapitres=THM-027&test=chapitre");
  expect(document.body.innerHTML).not.toMatch(/EVT-\d|event_id|date_precision|date_status|official_wording|EXACT/);
});

it("respecte les dates av. J.-C., l'année, le jour, DAY_RANGE et YEAR_RANGE sans inventer PERIOD_TEXT", () => {
  const chapitres = chargerDemoPedagogie();
  const toutes = chapitres.flatMap((c) => c.cartes).map(pourApprendre);
  const somme = toutes.find((c) => c.card_id === "CARD-027-somme-guerre-usure")!;
  expect(debutCarte(somme)).toEqual({ year: 1916, month: 7, day: 1 });
  expect(marqueursCartes([somme], somme.card_id)[0]).toMatchObject({ id: somme.card_id, etat: "actif", date: { year: 1916, month: 7, day: 1 } });
  const neolithique = toutes.find((c) => c.card_id === "CARD-004-catalhoyuk")!;
  expect(debutCarte(neolithique)).toEqual({ year: -7100 });
  for (const c of toutes) {
    if (c.start_year == null) {
      expect(debutCarte(c)).toBeNull(); expect(marqueursCartes([c], null)).toEqual([]);
    } else {
      expect(debutCarte(c)?.year).toBe(c.start_year);
      expect(debutCarte(c)?.year).not.toBe(0);
      expect(debutCarte(c)?.month).toBe(c.start_month ?? undefined);
      expect(debutCarte(c)?.day).toBe(c.start_day ?? undefined);
    }
  }
  for (const chapitre of chapitres) {
    const { plage } = cadrageChapitre(chapitre.cartes);
    for (const c of chapitre.cartes) {
      const debut = debutCarte(c);
      if (debut) { expect(versT(debut)).toBeGreaterThanOrEqual(plage.debut); expect(versT(debut)).toBeLessThanOrEqual(plage.fin); }
      if (c.end_year != null) expect(versT({ year: c.end_year, month: c.end_month ?? undefined, day: c.end_day ?? undefined })).toBeLessThanOrEqual(plage.fin);
    }
  }
  expect(cadrageChapitre([somme]).plage.fin).toBeGreaterThan(versT({ year: 1916, month: 11, day: 18 }));
  render(<DecouvrirChapitre cartes={[toutes.find((c) => c.card_id === "CARD-005-homere")!]} />);
  expect(screen.getByRole("article").textContent).toContain("VIIIe siècle av. J.-C.");
  expect(vi.mocked(Frise).mock.calls.at(-1)![0].marqueurs).toEqual([]);
});
