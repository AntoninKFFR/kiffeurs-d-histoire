// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChoixSolo } from "@/components/choix/ChoixSolo";
import { ChoixScolaire } from "@/components/choix/ChoixScolaire";
import { SelectionPacks } from "@/components/choix/SelectionPacks";
import { filtresDepuis, lireChoix, relanceEnregistree } from "@/lib/solo/choix";
import type { PackJouable } from "@/lib/solo/packs";

const mocks = vi.hoisted(() => ({ packs: vi.fn(), compter: vi.fn(), lancer: vi.fn() }));
vi.mock("@/app/solo/packs", () => ({ chargerPacksJouables: mocks.packs }));
vi.mock("@/app/solo/disponibilite", () => ({ compterQuestions: mocks.compter }));
vi.mock("@/app/partie/actions", () => ({ lancer: mocks.lancer }));
vi.mock("@/app/solo/mystere", () => ({ preparerMystere: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const pack = (id: string, titre: string, parent_id: string | null, n = 25): PackJouable =>
  ({ id, titre, description: "", parent_id, comptes: { YEAR: n, MONTH: n, DAY: n }, b: [1800, 2000] });
const packs = [pack("P", "Parent", null), pack("C", "Enfant", "P"), pack("G", "Petit-enfant", "C")];
const champs = (container: HTMLElement) => new URLSearchParams(container.querySelector<HTMLInputElement>('input[name="c"]')!.value);
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  mocks.packs.mockResolvedValue(packs);
  mocks.compter.mockResolvedValue({ YEAR: 25, MONTH: 25, DAY: 25 });
});
afterEach(cleanup);

it.each([false, true])("nouvelle partie : niveau 3, périodes automatiques, inverse=%s", async (inverse) => {
  const { container } = render(<ChoixSolo inverse={inverse} />);
  await screen.findByText(/25 questions réellement jouables/);
  expect(within(screen.getByRole("group", { name: "Niveau" })).getByRole("button", { name: /^Toutes les questions/ }).getAttribute("aria-pressed")).toBe("true");
  expect(champs(container).get("niveau")).toBe("3");
  expect(champs(container).has("periodes")).toBe(false);
  expect(screen.queryByRole("group", { name: "Questions période" })).toBeNull();
  expect(screen.getByRole("button", { name: "Période" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Thème mystère/ })).toBeNull();
  expect(screen.queryByRole("group", { name: "Précision" }) === null).toBe(inverse);
});

it.each([1, 2, 3])("restaure niveau %s, longueur et précision, mais réactive les périodes pour une nouvelle partie", async (niveau) => {
  localStorage.setItem("histoire-choix-solo", `mode=general&difficulte=MONTH&niveau=${niveau}&periodes=0&longueur=5`);
  const { container } = render(<ChoixSolo />);
  await screen.findByText(/25 questions réellement jouables/);
  const choix = lireChoix(champs(container))!;
  expect(choix).toMatchObject({ niveau, difficulte: "MONTH", longueur: 5 });
  expect(choix.periodes).toBeUndefined();
  expect(filtresDepuis(choix).periods).toBeUndefined();
  // La mémoire d'origine reste lisible pour une relance historique explicite.
  expect(lireChoix(new URLSearchParams(localStorage.getItem("histoire-choix-solo")!))!.periodes).toBe(false);
  const replay = relanceEnregistree(filtresDepuis(choix))!;
  expect(lireChoix(new URLSearchParams(replay))).toMatchObject(choix);
});

it("les anciennes URLs et relances explicites conservent periodes=0", () => {
  const ancien = lireChoix(new URLSearchParams("mode=pack&pack=P&difficulte=MONTH&niveau=2&longueur=5&periodes=0"))!;
  expect(filtresDepuis(ancien)).toMatchObject({ packId: "P", niveau: 2, difficulty: "MONTH", questionCount: 5, periods: false });
  const replay = relanceEnregistree(filtresDepuis(ancien))!;
  expect(lireChoix(new URLSearchParams(replay))).toEqual(ancien);
});

it.each([false, true])("explorer et revenir conserve le parent jusqu'au choix d'un enfant, inverse=%s", async (inverse) => {
  const { container } = render(<ChoixSolo inverse={inverse} />);
  fireEvent.click(screen.getByRole("button", { name: "Pack" }));
  fireEvent.click(await screen.findByRole("button", { name: /^Jouer tout Parent/ }));
  const parent = champs(container).toString();
  fireEvent.click(screen.getByRole("button", { name: "Voir les sous-thèmes de Parent" }));
  expect(champs(container).toString()).toBe(parent);
  expect(screen.getByRole("button", { name: /^Tout le pack Parent/ }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(false);
  expect(screen.getByText(/pack « Parent »/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Tous les packs/ }));
  expect(champs(container).toString()).toBe(parent);
  expect(screen.getByRole("button", { name: /^Jouer tout Parent/ }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Voir les sous-thèmes de Parent" }));
  fireEvent.click(screen.getByRole("button", { name: /^Jouer tout Enfant/ }));
  expect(champs(container).get("pack")).toBe("C");
  expect(screen.getByText(/pack « Enfant »/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Tous les packs/ }));
  expect(screen.getByRole("heading", { name: "Packs disponibles" })).toBe(document.activeElement);
  expect(champs(container).get("pack")).toBe("C");
  const choisi = lireChoix(champs(container))!;
  expect(lireChoix(new URLSearchParams(relanceEnregistree(filtresDepuis(choisi))!))).toEqual(choisi);
});

it.each([false, true])("restaure le sous-pack sans imposer sa vue après Retour et mémorise le vrai choix, inverse=%s", async (inverse) => {
  const memoire = inverse ? "histoire-choix-inverse" : "histoire-choix-solo";
  localStorage.setItem(memoire, `mode=pack&pack=C&difficulte=DAY&niveau=2&longueur=5${inverse ? "&sens=inverse" : "&periodes=0"}`);
  const { container, unmount } = render(<ChoixSolo inverse={inverse} />);
  await screen.findByRole("button", { name: /^Jouer tout Enfant/ });
  fireEvent.click(screen.getByRole("button", { name: /Tous les packs/ }));
  expect(champs(container).get("pack")).toBe("C");
  expect(champs(container).has("periodes")).toBe(false);
  expect(screen.getByRole("button", { name: "Jouer" }).hasAttribute("disabled")).toBe(false);
  const form = container.querySelector("form")!;
  form.addEventListener("submit", (e) => e.preventDefault()); fireEvent.submit(form);
  expect(localStorage.getItem(memoire)).toContain("pack=C");
  expect(localStorage.getItem(memoire)).not.toContain("periodes=0");
  unmount(); render(<ChoixSolo inverse={inverse} />);
  await screen.findByRole("button", { name: /^Jouer tout Enfant/ });
  expect(screen.getByRole("button", { name: /^Jouer tout Enfant/ }).getAttribute("aria-pressed")).toBe("true");
});

it("ancienne mémoire sans niveau : défaut historique et dix questions", async () => {
  localStorage.setItem("histoire-choix-solo", "mode=general&difficulte=YEAR");
  const { container } = render(<ChoixSolo />);
  await screen.findByText(/25 questions réellement jouables/);
  expect(champs(container).get("niveau")).toBe("1");
  expect(champs(container).get("longueur")).toBe("10");
});

it.each([false, true])("choisir directement le parent attend Jouer et restaure le parent sans ouvrir, inverse=%s", async (inverse) => {
  const memoire = inverse ? "histoire-choix-inverse" : "histoire-choix-solo";
  const { container, unmount } = render(<ChoixSolo inverse={inverse} />);
  fireEvent.click(screen.getByRole("button", { name: "Pack" }));
  fireEvent.click(await screen.findByRole("button", { name: /^Jouer tout Parent/ }));
  expect(champs(container).get("pack")).toBe("P");
  expect(screen.queryByRole("button", { name: /^Jouer tout Enfant/ })).toBeNull();
  expect(screen.getByRole("heading", { name: "Packs disponibles" })).toBeTruthy();
  expect(mocks.lancer).not.toHaveBeenCalled();
  const form = container.querySelector("form")!;
  form.addEventListener("submit", (e) => e.preventDefault()); fireEvent.submit(form);
  expect(localStorage.getItem(memoire)).toContain("pack=P");
  unmount(); render(<ChoixSolo inverse={inverse} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /^Jouer tout Parent/ }).getAttribute("aria-pressed")).toBe("true"));
  expect(screen.getByRole("heading", { name: "Packs disponibles" })).toBeTruthy();
});

it("chaque parent imbriqué propose choisir ou explorer ; Retour remonte avec le focus", async () => {
  render(<ChoixSolo />);
  fireEvent.click(screen.getByRole("button", { name: "Pack" }));
  fireEvent.click(await screen.findByRole("button", { name: "Voir les sous-thèmes de Parent" }));
  fireEvent.click(screen.getByRole("button", { name: /^Jouer tout Enfant/ }));
  expect(screen.getByRole("heading", { name: "Parent" })).toBeTruthy();
  screen.getByRole("list", { name: "Sous-packs de Parent" }).scrollTop = 100;
  fireEvent.click(screen.getByRole("button", { name: "Voir les sous-thèmes de Enfant" }));
  expect(screen.getByRole("heading", { name: "Enfant" })).toBe(document.activeElement);
  expect(screen.getByRole("list", { name: "Sous-packs de Enfant" }).scrollTop).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: /← Parent/ }));
  expect(screen.getByRole("heading", { name: "Parent" })).toBe(document.activeElement);
});

it("parent insuffisant : sélection bloquée, exploration toujours accessible", () => {
  const choisir = vi.fn(), ouvrir = vi.fn();
  render(<SelectionPacks packs={[pack("P", "Parent", null, 3), pack("C", "Enfant", "P", 3)]}
    ouvert={null} selection="" precision="YEAR" longueur={5} onChoisir={choisir} onOuvrir={ouvrir} />);
  expect(screen.getByRole("button", { name: /^Jouer tout Parent/ }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Voir les sous-thèmes de Parent" }));
  expect(ouvrir).toHaveBeenCalledWith("P"); expect(choisir).not.toHaveBeenCalled();
});

it("le parcours scolaire garde ses niveaux, son réglage et son absence de roulette", () => {
  render(<ChoixScolaire />);
  fireEvent.click(screen.getByRole("button", { name: /^CM2/ }));
  expect(screen.getByRole("group", { name: "Questions période" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Toutes les questions/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Thème mystère/ })).toBeNull();
});
it.each([false,true])("quatre niveaux distincts, comptes Expert et persistance, inverse=%s", async (inverse) => {
  mocks.packs.mockImplementation((_niveau: number,_inverse: boolean,_id: string|null,expertOnly?: boolean) => Promise.resolve([
    pack("COL-0105","Sport",null,expertOnly ? 7 : 397),pack("COL-0106","Football","COL-0105",expertOnly ? 5 : 49)]));
  const memoire=inverse?"histoire-choix-inverse":"histoire-choix-solo";
  const {container,unmount}=render(<ChoixSolo inverse={inverse} />);
  const niveaux=within(screen.getByRole("group",{name:"Niveau"}));
  expect(niveaux.getAllByRole("button")).toHaveLength(4);
  expect(niveaux.getByRole("button",{name:/^Toutes les questions/}).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button",{name:"Pack"}));
  fireEvent.click(await screen.findByRole("button",{name:/^Jouer tout Sport/}));
  fireEvent.click(niveaux.getByRole("button",{name:/^Expert/}));
  await screen.findByText(/7 questions réellement jouables/);
  expect(champs(container).get("expertOnly")).toBe("1");
  expect(champs(container).get("niveau")).toBe("3");
  expect(niveaux.getByRole("button",{name:/^Toutes les questions/}).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button",{name:/^10 questions/}).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:/^5 questions/}));
  fireEvent.click(screen.getByRole("button",{name:"Voir les sous-thèmes de Sport"}));
  fireEvent.click(screen.getByRole("button",{name:/^Football/}));
  expect(champs(container).get("expertOnly")).toBe("1");
  const form=container.querySelector("form")!;
  form.addEventListener("submit",e=>e.preventDefault());fireEvent.submit(form);
  expect(localStorage.getItem(memoire)).toContain("expertOnly=1");
  unmount();render(<ChoixSolo inverse={inverse} />);
  await screen.findByRole("button",{name:/^Football/});
  expect(screen.getByRole("button",{name:/^Expert/}).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button",{name:/^Toutes les questions/}));
  await screen.findByText(/49 questions réellement jouables/);
  expect(screen.getByRole("button",{name:/^Expert/}).getAttribute("aria-pressed")).toBe("false");
});
