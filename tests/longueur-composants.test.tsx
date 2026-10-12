// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChoixSolo } from "@/components/choix/ChoixSolo";
import { ChoixScolaire } from "@/components/choix/ChoixScolaire";
import { Statistiques } from "@/components/profil/Statistiques";
import { statistiques } from "./fixtures/profil";
const mocks = vi.hoisted(() => ({ compter: vi.fn(), lancer: vi.fn() }));
vi.mock("@/app/solo/disponibilite", () => ({ compterQuestions: mocks.compter }));
vi.mock("@/app/partie/actions", () => ({ lancer: mocks.lancer }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/solo/mystere", () => ({ preparerMystere: vi.fn() }));
beforeEach(() => { localStorage.clear(); mocks.compter.mockReset().mockResolvedValue({ YEAR: 42, MONTH: 8, DAY: 3 }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const longueurs = () => within(screen.getByRole("group", { name: "Longueur de la partie" }));

it("utilise le décompte serveur, plafonne Tout et mémorise la longueur choisie", async () => {
  mocks.compter.mockResolvedValue({ YEAR: 130, MONTH: 8, DAY: 3 });
  const { container } = render(<ChoixSolo />);
  await screen.findByText(/130 questions réellement jouables/);
  fireEvent.click(longueurs().getByRole("button", { name: /^Tout/ }));
  expect(container.querySelector<HTMLInputElement>('input[name="c"]')!.value).toContain("longueur=tout");
  expect(screen.getByText(/100 questions · maximum 100/)).toBeTruthy();
  const form = container.querySelector("form")!;
  form.addEventListener("submit", (e) => e.preventDefault());
  fireEvent.submit(form);
  expect(localStorage.getItem("histoire-choix-solo")).toContain("longueur=tout");
});
it("reprend une mémoire historique avec dix questions et désactive les longueurs indisponibles", async () => {
  localStorage.setItem("histoire-choix-solo", "mode=general&difficulte=YEAR&niveau=1");
  render(<ChoixSolo />);
  await screen.findByText(/42 questions réellement jouables/);
  expect(longueurs().getByRole("button", { name: /^10 questions/ }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(within(screen.getByRole("group", { name: "Précision" })).getByRole("button", { name: /^Jour/ }));
  for (const n of [5, 10, 20]) expect((longueurs().getByRole("button", { name: new RegExp(`^${n} questions`) }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(longueurs().getByRole("button", { name: /^Tout/ }));
  expect((screen.getByRole("button", { name: /^Jouer$/ }) as HTMLButtonElement).disabled).toBe(false);
});
it("oublie immédiatement le décompte du niveau précédent et ignore une réponse réseau périmée", async () => {
  let terminer!: (c: { YEAR: number; MONTH: number; DAY: number }) => void;
  mocks.compter.mockReturnValueOnce(new Promise((resolve) => { terminer = resolve; }));
  render(<ChoixSolo />);
  await waitFor(() => expect(mocks.compter).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: /^Intermédiaire/ }));
  await screen.findByText(/42 questions réellement jouables/);
  terminer({ YEAR: 1, MONTH: 0, DAY: 0 });
  await waitFor(() => expect(longueurs().getByRole("button", { name: /^20 questions/ }).getAttribute("disabled")).toBeNull());
});
it("en inversé, les dates dédupliquées du serveur gouvernent les longueurs", async () => {
  render(<ChoixSolo inverse />);
  await screen.findByText(/3 questions réellement jouables/);
  expect((longueurs().getByRole("button", { name: /^5 questions/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("group", { name: "Précision" })).toBeNull();
  expect(mocks.compter.mock.calls[0][0]).toContain("sens=inverse");
});
it("le scolaire utilise les unions réelles, pas la somme des chapitres du catalogue", async () => {
  mocks.compter.mockResolvedValue({ YEAR: 4, MONTH: 3, DAY: 2 });
  render(<ChoixScolaire />);
  fireEvent.click(screen.getByRole("button", { name: /^CM2/ }));
  await screen.findByText(/4 questions réellement jouables/);
  expect((longueurs().getByRole("button", { name: /^5 questions/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(longueurs().getByRole("button", { name: /^Tout/ }));
  expect((screen.getByRole("button", { name: "Jouer" }) as HTMLButtonElement).disabled).toBe(false);
});
it("une lecture impossible n'affiche aucun nombre fictif et peut être relancée", async () => {
  mocks.compter.mockRejectedValueOnce(new Error("hors ligne"));
  render(<ChoixSolo />);
  await screen.findByRole("alert");
  expect((screen.getByRole("button", { name: "Jouer" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  await screen.findByText(/42 questions réellement jouables/);
});
it("ne présente jamais un agrégat brut historique comme un score normalisé", () => {
  render(<Statistiques data={{ ...statistiques, average_points_per_question: undefined, best_points_per_question: undefined }} />);
  expect(screen.queryByText("720")).toBeNull();
  expect(screen.getByText(/total divisé par son nombre/)).toBeTruthy();
});
