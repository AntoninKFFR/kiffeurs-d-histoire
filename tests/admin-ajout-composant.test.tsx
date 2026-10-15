// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AjouterQuestions from "@/components/admin/AjouterQuestions";
const mocks = vi.hoisted(() => ({ search: vi.fn(), add: vi.fn(), create: vi.fn(), saved: vi.fn(), close: vi.fn() }));
vi.mock("@/app/admin/packs/actions", () => ({ rechercherQuestions: mocks.search, ajouterQuestions: mocks.add, creerQuestion: mocks.create }));
const q = { id: "EVT-1", title: "Question antique", niveau: 1, date_text: "44 av. J.-C.", packs: [], associated: false, removed: false };
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
  mocks.search.mockResolvedValue({ ok: true, data: { items: [q, { ...q, id: "EVT-2", title: "Déjà rattachée", associated: true }, { ...q, id: "EVT-3", title: "À remettre", associated: true, removed: true }], has_more: true } });
});
afterEach(cleanup);
function show() { render(<AjouterQuestions packId="A120" packs={[{ id: "A120", title: "Antiquité", active: true, total: 0, retired: 0, playable: 0 }]} onClose={mocks.close} onSaved={mocks.saved} />); }
it("recherche sur le serveur, pagine, signale les doublons et sélectionne la réintégration", async () => {
  show();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /^Rechercher$/ })));
  expect(mocks.search).toHaveBeenCalledWith("A120", { query: "", niveau: null, yearMin: null, yearMax: null, page: 0 });
  expect(screen.getByText(/Déjà dans ce pack/)).toBeTruthy();
  expect(screen.getByText(/historique conservé/)).toBeTruthy();
  const checks = screen.getAllByRole("checkbox") as HTMLInputElement[];
  expect(checks[1].disabled).toBe(true);
  fireEvent.click(checks[0]); fireEvent.click(checks[2]);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Suivante" })));
  expect(mocks.search).toHaveBeenLastCalledWith("A120", expect.objectContaining({ page: 1 }));
  mocks.add.mockResolvedValue({ ok: true, data: { changed: true, added: 1, restored: 1, packs: [], questions: [] } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ajouter / réintégrer (2)" })));
  expect(mocks.add).toHaveBeenCalledWith("A120", ["EVT-1", "EVT-3"]);
  expect(mocks.saved).toHaveBeenCalled();
});
it("conserve formulaire et identifiant après coupure puis confirme la reprise sans double clic", async () => {
  show(); fireEvent.click(screen.getByRole("button", { name: "Créer une nouvelle question" }));
  fireEvent.change(screen.getByLabelText("Titre de la question"), { target: { value: "Création sourcée" } });
  fireEvent.change(screen.getByLabelText("Description historique courte"), { target: { value: "Description pédagogique" } });
  fireEvent.change(screen.getByLabelText("Début : année"), { target: { value: "-44" } });
  fireEvent.change(screen.getByLabelText("Source 1"), { target: { value: "Référence documentaire p. 40" } });
  mocks.create.mockRejectedValueOnce(new Error("coupure")).mockResolvedValueOnce({ ok: true, data: { event_id: "EVT-9", changed: true, packs: [], questions: [], added: 1, restored: 0 } });
  const form = screen.getByRole("button", { name: "Créer et ajouter au pack" }).closest("form")!;
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alert").textContent).toContain("connexion");
  await act(async () => fireEvent.submit(form));
  expect(mocks.create.mock.calls[0][0]).toBe(mocks.create.mock.calls[1][0]);
  expect(mocks.create.mock.calls[1][2]).toMatchObject({ start_year: -44, start_month: null, start_day: null });
  expect(mocks.saved).toHaveBeenCalled();
});
it("Échap ferme sans écriture, un film impose le territoire", () => {
  show(); fireEvent.click(screen.getByRole("button", { name: "Créer une nouvelle question" }));
  fireEvent.change(screen.getByLabelText("Type de contenu"), { target: { value: "film" } });
  expect((screen.getByLabelText("Territoire de sortie") as HTMLInputElement).required).toBe(true);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
  expect(mocks.close).toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
});
