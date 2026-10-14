// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChoisirChapitre } from "@/components/pedagogie/ChoisirChapitre";
import { EnregistrerTest } from "@/components/pedagogie/EnregistrerTest";
import { SuiviDecouverte } from "@/components/pedagogie/SuiviDecouverte";
import { TesterChapitre } from "@/components/pedagogie/TesterChapitre";
import { ProgressionPedagogique } from "@/components/profil/ProgressionPedagogique";
import { CHAPITRES } from "@/lib/apprendre/catalogue";
import { lireProgressionSession, noterDecouvertSession, noterTestSession } from "@/lib/progression/session";
import { progressionDepuisLignes } from "@/lib/progression/types";
import { comptesDe, ecrireChoix, filtresDepuis, lireChoix } from "@/lib/solo/choix";

const mocks = vi.hoisted(() => ({ lire: vi.fn(), decouvert: vi.fn(), test: vi.fn() }));
// Scénario historique #27 conservé intégralement avec son catalogue initial.
vi.mock('../src/lib/apprendre/structure.json',async()=>{
  const {chargerStructure,projectionStructure}=await import('../scripts/structure-pedagogique');
  return {default:projectionStructure(chargerStructure()).filter(c=>c.etat!=='inactif')};
});
vi.mock('../src/lib/solo/catalogue.json',async()=>{
  const {execFileSync}=await import('node:child_process');
  return {default:JSON.parse(execFileSync('git',['show','31ab0d56dd87a3400101e112005d63292c544853:src/lib/solo/catalogue.json'],{encoding:'utf8'}))};
});
vi.mock("@/app/apprendre/actions", () => ({ lireProgression: mocks.lire, marquerChapitreDecouvert: mocks.decouvert, enregistrerTestChapitre: mocks.test }));
vi.mock("@/app/partie/actions", () => ({ lancer: vi.fn() }));
beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const premier = CHAPITRES[0];

it("pose les pastilles « Découvert » et « Meilleur test » depuis le compte, sans rien inventer pour les autres chapitres", async () => {
  mocks.lire.mockResolvedValue({ connecte: true, chapitres: { [premier.id]: { decouvert: true, precision: 85.5, difficulte: "MONTH", tests: 2 } } });
  render(<ChoisirChapitre chapitres={CHAPITRES} />);
  await screen.findByText("Découvert");
  expect(screen.getByText(/Meilleur test : 85,5 %/).textContent).toContain("Mois");
  expect(screen.getAllByText("Découvert")).toHaveLength(1);
  expect(screen.queryByRole("note")).toBeNull();
});

it("sans compte, relit la progression de la session et dit qu'elle disparaît avec l'onglet", async () => {
  noterDecouvertSession(premier.id);
  mocks.lire.mockResolvedValue(null);
  render(<ChoisirChapitre chapitres={CHAPITRES} />);
  await screen.findByText("Découvert");
  expect(screen.getByRole("note").textContent).toMatch(/seulement tant que cet onglet reste ouvert/);
});

it("garde la progression de la session si le serveur est indisponible", async () => {
  noterDecouvertSession(premier.id);
  mocks.lire.mockRejectedValue(new Error("hors ligne"));
  render(<ChoisirChapitre chapitres={CHAPITRES} />);
  await screen.findByText("Découvert");
});

it("marque le chapitre découvert dans le compte, ou dans la session sans compte", async () => {
  mocks.decouvert.mockResolvedValueOnce(true);
  const { unmount } = render(<SuiviDecouverte chapitre="THM-027" />);
  await waitFor(() => expect(mocks.decouvert).toHaveBeenCalledWith("THM-027"));
  expect(lireProgressionSession()).toEqual({});
  unmount();
  mocks.decouvert.mockResolvedValueOnce(false);
  render(<SuiviDecouverte chapitre="THM-027" />);
  await waitFor(() => expect(lireProgressionSession()["THM-027"]?.decouvert).toBe(true));
});

it("garde le meilleur test de la session et ne compte pas deux fois le même bilan", () => {
  expect(noterTestSession("THM-027", "partie-1", 60, "YEAR")).toBe(true);
  expect(noterTestSession("THM-027", "partie-1", 60, "YEAR")).toBe(false);
  expect(noterTestSession("THM-027", "partie-2", 40, "DAY")).toBe(false);
  expect(noterTestSession("THM-027", "partie-3", 90, "MONTH")).toBe(true);
  expect(lireProgressionSession()["THM-027"]).toMatchObject({ precision: 90, difficulte: "MONTH", tests: 3 });
});

it("enregistre un test connecté une seule fois, côté serveur, et attend la fin du rattachement d'une partie anonyme", async () => {
  mocks.test.mockResolvedValue({ connecte: true, meilleur: true, precision: 90 });
  const props = { chapitre: "THM-027", partie: "p1", precision: 90, difficulte: "YEAR" as const };
  const { rerender } = render(<EnregistrerTest {...props} connecte anonyme />);
  expect(mocks.test).not.toHaveBeenCalled();
  rerender(<EnregistrerTest {...props} connecte anonyme={false} />);
  await screen.findByText(/Nouveau meilleur test de ce chapitre : 90 %/);
  rerender(<EnregistrerTest {...props} connecte anonyme={false} />);
  expect(mocks.test).toHaveBeenCalledTimes(1);
  expect(mocks.test).toHaveBeenCalledWith("p1");
});

it("sans compte, garde le résultat dans la session et n'appelle pas le serveur", () => {
  render(<EnregistrerTest chapitre="THM-027" partie="p1" precision={70} difficulte="DAY" connecte={false} anonyme />);
  expect(mocks.test).not.toHaveBeenCalled();
  expect(lireProgressionSession()["THM-027"]).toMatchObject({ precision: 70, difficulte: "DAY" });
  expect(screen.getByRole("status").textContent).toMatch(/onglet reste ouvert/);
});

it("annonce l'échec d'enregistrement sans détail technique", async () => {
  mocks.test.mockResolvedValue({ connecte: true, erreur: true });
  render(<EnregistrerTest chapitre="THM-027" partie="p1" precision={70} difficulte="YEAR" connecte anonyme={false} />);
  await screen.findByText(/n'a pas pu être ajouté/);
});

it("lance un test d'un seul chapitre, avec autant de questions que le chapitre en compte (10 au plus)", () => {
  const { unmount } = render(<TesterChapitre chapitre="THM-016" />);
  const form = screen.getByRole("button", { name: "Me tester sur ce chapitre" }).closest("form")!;
  expect(form.querySelector<HTMLInputElement>('input[name="c"]')!.value).toBe("mode=scolaire&difficulte=YEAR&chapitres=THM-016&test=chapitre");
  // THM-016 : 11 cartes jouables, le test est plafonné à 10 questions.
  expect(screen.getByText("10 questions sur les cartes de ce chapitre")).toBeTruthy();
  unmount();
  // THM-006 : 8 cartes jouables à l'année, trop peu au mois et au jour : seule la précision Année est proposée.
  render(<TesterChapitre chapitre="THM-006" />);
  expect(screen.getByText("8 questions sur les cartes de ce chapitre")).toBeTruthy();
  const options = within(screen.getByRole("combobox", { name: "Précision du test" })).getAllByRole("option") as HTMLOptionElement[];
  expect(options.map((o) => [o.value, o.disabled])).toEqual([["YEAR", false], ["MONTH", true], ["DAY", true]]);
});

it("le choix de test est validé : un seul chapitre, jeu de dates, assez de dates jouables", () => {
  const lire = (q: string) => lireChoix(new URLSearchParams(q));
  const test = lire("mode=scolaire&difficulte=YEAR&chapitres=THM-006&test=chapitre")!;
  expect(test.test).toBe(true);
  expect(ecrireChoix(test)).toBe("mode=scolaire&difficulte=YEAR&chapitres=THM-006&test=chapitre");
  // Le test ne compte que les cartes du chapitre (THM-006 : 8), pas tous ses événements.
  expect(comptesDe(test)!.YEAR).toBe(8);
  expect(filtresDepuis(test)).toMatchObject({ chapterIds: ["THM-006"], chapterTest: true, questionCount: 8 });
  expect(filtresDepuis(lire("mode=scolaire&difficulte=YEAR&chapitres=THM-016&test=chapitre")!).questionCount).toBe(10);
  expect(lire("mode=scolaire&difficulte=MONTH&chapitres=THM-006&test=chapitre")).toBeNull();
  expect(lire("mode=scolaire&difficulte=YEAR&chapitres=THM-016,THM-006&test=chapitre")!.test).toBeUndefined();
  expect(lire("mode=scolaire&difficulte=YEAR&chapitres=THM-016&sens=inverse&test=chapitre")!.test).toBeUndefined();
  expect(lire("mode=general&difficulte=YEAR&test=chapitre")!.test).toBeUndefined();
  expect(lire("mode=scolaire&difficulte=YEAR&chapitres=THM-004&test=chapitre")).toBeNull(); // 4 cartes jouables seulement
  const scolaire = filtresDepuis(lire("mode=scolaire&difficulte=YEAR&chapitres=THM-016")!);
  expect(scolaire.questionCount).toBe(10);
  expect(scolaire.chapterTest).toBeUndefined();
});

it("lit les lignes du compte sans accepter un chapitre hors catalogue ni une valeur invalide", () => {
  const ids = new Set(CHAPITRES.map((c) => c.id));
  expect(progressionDepuisLignes([
    { chapter_id: "THM-027", discovered_at: "2026-10-08T10:00:00Z", best_accuracy: "72.50", best_difficulty: "DAY", tests_count: 2 },
    { chapter_id: "THM-001", discovered_at: null, best_accuracy: null, best_difficulty: "AUTRE", tests_count: 0 },
    { chapter_id: "THM-999", discovered_at: "2026-10-08T10:00:00Z", best_accuracy: 50, best_difficulty: "YEAR", tests_count: 1 },
  ], ids)).toEqual({
    "THM-027": { decouvert: true, precision: 72.5, difficulte: "DAY", tests: 2 },
    "THM-001": { decouvert: false, precision: null, difficulte: null, tests: 0 },
  });
});

it("résume le parcours du profil par niveau, avec états vide et erreur honnêtes", () => {
  const { unmount } = render(<ProgressionPedagogique progression={{ connecte: true, chapitres: { "THM-027": { decouvert: true, precision: 80, difficulte: "YEAR", tests: 1 } } }} />);
  expect(screen.getByText(/1 chapitre découvert sur 41 · 1 testé/)).toBeTruthy();
  const chapitre = CHAPITRES.find((c) => c.id === "THM-027")!;
  const ligne = screen.getByRole("link", { name: chapitre.titre }).closest("li")!;
  expect(within(ligne).getByText("Découvert")).toBeTruthy();
  expect(within(ligne).getByText(/Meilleur test : 80 % · Année/)).toBeTruthy();
  unmount();
  render(<ProgressionPedagogique progression={null} />);
  expect(screen.getByRole("alert").textContent).toMatch(/momentanément indisponible/);
});
