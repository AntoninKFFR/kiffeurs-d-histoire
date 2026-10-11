// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChoixSolo } from "@/components/choix/ChoixSolo";
import type { PackJouable } from "@/lib/solo/packs";
import sport from "../content/sport/packs-proposes.json";
const mocks = vi.hoisted(() => ({ packs: vi.fn(), compter: vi.fn(), lancer: vi.fn() }));
vi.mock("@/app/solo/packs", () => ({ chargerPacksJouables: mocks.packs }));
vi.mock("@/app/solo/disponibilite", () => ({ compterQuestions: mocks.compter }));
vi.mock("@/app/partie/actions", () => ({ lancer: mocks.lancer }));
vi.mock("@/app/solo/mystere", () => ({ preparerMystere: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const pack = (id: string, titre: string, parent_id: string | null, n: number): PackJouable =>
  ({ id, titre, description: "", parent_id, comptes: { YEAR: n, MONTH: n, DAY: n }, b: [1800, 2000] });
const packs = [pack("P89", "Guerres et batailles", null, 25), pack("C89", "Conflits du XXe siècle", "P89", 20),
  pack("V89", "Vide", "P89", 0), pack("F89", "Pack plat", null, 10)];
beforeEach(() => {
  localStorage.clear(); mocks.packs.mockReset().mockResolvedValue(packs);
  mocks.compter.mockReset().mockResolvedValue({ YEAR: 25, MONTH: 25, DAY: 25 });
});
afterEach(cleanup);
it.each([false,true])("présente le vrai découpage Sport, les précisions et longueurs disponibles, inverse=%s", async (inverse) => {
  mocks.packs.mockResolvedValue(sport.packs.map((p) => ({ id: p.id, titre: p.title, description: p.description,
    parent_id: p.parent_id, comptes: Object.fromEntries(["YEAR","MONTH","DAY"].map((k,i) => [k, (inverse ? p.comptes.inverse : p.comptes.precisions)[i]])), b: [-790,2040] })));
  const { container } = render(<ChoixSolo inverse={inverse} />);
  fireEvent.click(screen.getByRole("group", { name: "Niveau" }).querySelectorAll("button")[2]);
  fireEvent.click(screen.getByRole("button", { name: "Pack" }));
  fireEvent.click(await screen.findByRole("button", { name: /^Jouer tout Sport/ }));
  const parent = container.querySelector<HTMLInputElement>('input[name="c"]')!.value;
  fireEvent.click(screen.getByRole("button", { name: "Voir les sous-thèmes de Sport" }));
  expect(screen.getByRole("heading", { name: /^Sport$/ })).toBe(document.activeElement);
  expect(container.querySelector<HTMLInputElement>('input[name="c"]')!.value).toBe(parent);
  expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /Tous les packs/ }));
  expect(container.querySelector<HTMLInputElement>('input[name="c"]')!.value).toBe(parent);
  expect(screen.getByRole("button", { name: /^Jouer tout Sport/ }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Voir les sous-thèmes de Sport" }));
  fireEvent.click(screen.getByRole("button", { name: /^Tout le pack/ }));
  expect(container.querySelector<HTMLInputElement>('input[name="c"]')!.value).toContain("pack=COL-0105");
  if (inverse) expect(screen.getByRole("button", { name: /^Sports mécaniques/ }).hasAttribute("disabled")).toBe(true);
  else {
    fireEvent.click(screen.getByRole("button", { name: /^Sports mécaniques/ }));
    expect(container.querySelector<HTMLInputElement>('input[name="c"]')!.value).toContain("pack=COL-0110");
    expect(screen.getByRole("group", { name: "Précision" }).querySelectorAll("button")[1].hasAttribute("disabled")).toBe(true);
  }
  fireEvent.click(screen.getByRole("button", { name: /^Football/ }));
  if (!inverse) fireEvent.click(screen.getByRole("group", { name: "Précision" }).querySelectorAll("button")[2]);
  expect(screen.getByRole("button", { name: /^20 questions/ }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: /^10 questions/ }).hasAttribute("disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /Tous les packs/ }));
  expect(screen.getByRole("heading", { name: "Packs disponibles" })).toBe(document.activeElement);
});
it("ouvre la vue dédiée, désactive le vide, choisit l'enfant et revient avec focus", async () => {
  const { container } = render(<ChoixSolo />);
  fireEvent.click(screen.getByRole("button", { name: "Pack" }));
  fireEvent.click(await screen.findByRole("button", { name: /^Jouer tout Guerres et batailles/ }));
  fireEvent.click(screen.getByRole("button", { name: "Voir les sous-thèmes de Guerres et batailles" }));
  expect(screen.getByRole("heading", { name: "Guerres et batailles" })).toBe(document.activeElement);
  expect((screen.getByRole("button", { name: /^Vide/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /^Tout le pack/ }));
  expect(container.querySelector<HTMLInputElement>('input[name="c"]')!.value).toContain("pack=P89");
  fireEvent.click(screen.getByRole("button", { name: /^Conflits du XXe/ }));
  expect(container.querySelector<HTMLInputElement>('input[name="c"]')!.value).toContain("pack=C89");
  fireEvent.click(screen.getByRole("button", { name: /Tous les packs/ }));
  expect(screen.getByRole("heading", { name: "Packs disponibles" })).toBe(document.activeElement);
  expect(screen.queryByRole("button", { name: /^Conflits du XXe/ })).toBeNull();
});
it.each([false,true])("restaure un sous-pack dynamique et sa longueur en mémoire, inverse=%s", async (inverse) => {
  localStorage.setItem(inverse ? "histoire-choix-inverse" : "histoire-choix-solo",
    `mode=pack&pack=C89&difficulte=DAY&niveau=2&longueur=tout${inverse ? "&sens=inverse" : ""}`);
  const { container } = render(<ChoixSolo inverse={inverse} />);
  await screen.findByRole("button", { name: /^Conflits du XXe/ });
  const choix = container.querySelector<HTMLInputElement>('input[name="c"]')!.value;
  expect(choix).toContain("pack=C89"); expect(choix).toContain("longueur=tout");
  expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(false);
  expect(mocks.packs).toHaveBeenCalledWith(2, inverse);
});
it.each([false,true])("retour depuis le sous-pack mémorisé puis restauration au rechargement, inverse=%s", async (inverse) => {
  const memoire = inverse ? "histoire-choix-inverse" : "histoire-choix-solo";
  const initial = `mode=pack&pack=C89&difficulte=DAY&niveau=2&longueur=5${inverse ? "&sens=inverse" : ""}`;
  localStorage.setItem(memoire, initial);
  const { unmount } = render(<ChoixSolo inverse={inverse} />);
  await screen.findByRole("button", { name: /^Conflits du XXe/ });
  fireEvent.click(screen.getByRole("button", { name: /Tous les packs/ }));
  expect(screen.getByRole("heading", { name: "Packs disponibles" })).toBe(document.activeElement);
  expect(screen.queryByRole("button", { name: /^Conflits du XXe/ })).toBeNull();
  expect(localStorage.getItem(memoire)).toBe(initial);
  unmount(); render(<ChoixSolo inverse={inverse} />);
  await screen.findByRole("button", { name: /^Conflits du XXe/ });
  expect(screen.getByRole("button", { name: /^Conflits du XXe/ }).getAttribute("aria-pressed")).toBe("true");
});
it.each([[0, "tout"], [3, "5"]])("garde un sous-pack présent avec %s questions, désactive Jouer et permet le retour", async (n, longueur) => {
  mocks.packs.mockResolvedValue(packs.map((p) => p.id === "V89" ? pack("V89", "Vide", "P89", Number(n)) : p));
  localStorage.setItem("histoire-choix-solo", `mode=pack&pack=V89&difficulte=YEAR&niveau=2&longueur=${longueur}`);
  render(<ChoixSolo />);
  await screen.findByRole("button", { name: /^Vide/ });
  expect(screen.queryByText(/Ce pack n’est plus disponible/)).toBeNull();
  expect(screen.getByRole("button", { name: /^Vide/ }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(true);
  if (Number(n) > 0) {
    fireEvent.click(within(screen.getByRole("group", { name: "Longueur de la partie" })).getByRole("button", { name: /^Tout/ }));
    expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: /^Vide/ }).getAttribute("aria-pressed")).toBe("true");
  }
  fireEvent.click(screen.getByRole("button", { name: /Tous les packs/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Pack plat/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(false));
});
it("ne confond pas une panne avec un pack supprimé et conserve le choix pendant Réessayer", async () => {
  localStorage.setItem("histoire-choix-solo", "mode=pack&pack=C89&difficulte=DAY&niveau=2&longueur=5");
  mocks.packs.mockRejectedValueOnce(new Error("Réseau"));
  const { container } = render(<ChoixSolo />);
  await screen.findByRole("alert");
  expect(container.querySelector<HTMLInputElement>('input[name="c"]')!.value).toContain("pack=C89");
  expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  await screen.findByRole("button", { name: /^Conflits du XXe/ });
  expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(false);
});
it("actualise les décomptes avec le niveau et ne promet rien pendant une erreur", async () => {
  mocks.packs.mockRejectedValueOnce(new Error("Réseau"));
  render(<ChoixSolo />);
  fireEvent.click(screen.getByRole("button", { name: "Pack" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  fireEvent.click(await screen.findByRole("button", { name: /^Pack plat/ }));
  fireEvent.click(within(screen.getByRole("group", { name: "Niveau" })).getByRole("button", { name: /^Intermédiaire/ }));
  await screen.findByText(/10 questions réellement jouables/);
  expect(mocks.packs).toHaveBeenCalledWith(2, false);
});
