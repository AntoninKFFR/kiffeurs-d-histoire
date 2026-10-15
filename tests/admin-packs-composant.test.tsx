// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AdministrationPacks from "@/components/admin/AdministrationPacks";
import type { AdminPack, PackQuestion } from "@/lib/admin-packs/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const mocks = vi.hoisted(() => ({ modifier: vi.fn(), correction: vi.fn(), history: vi.fn() }));
vi.mock("@/app/admin/packs/actions", () => ({ modifierQuestion: mocks.modifier,
  enregistrerCorrection: mocks.correction, consulterHistorique: mocks.history }));
const packs: AdminPack[] = [{ id: "A87", title: "Antiquité", active: true, total: 2, retired: 1, playable: 1 }];
const question: PackQuestion = { id: "e1", title: "César", niveau: 1, date_text: null, start_year: -44,
  start_month: 3, start_day: 15, end_year: null, end_month: null, end_day: null, removed: false, playable: true, last_change: null };
const questions: PackQuestion[] = [question, { ...question, id: "e2", title: "Rome", niveau: 3, removed: true, playable: false }];
const modalInitial = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeInitial = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
it("distingue les questions directes de l'union et affiche la parenté sans déplacer les actions", () => {
  render(<AdministrationPacks initialPacks={[{ ...packs[0], scope_playable: 20 },
    { ...packs[0], id: "C89", title: "Batailles romaines", parent_id: "A87" }]}
    selectedId="A87" initialQuestions={questions} />);
  expect(screen.getByText("20 jouables avec les sous-packs")).toBeTruthy();
  expect(screen.getByText("Sous-pack de Antiquité")).toBeTruthy();
  expect(screen.getByText(/ouvrez le sous-pack correspondant/)).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Modifier" })).toHaveLength(2);
});
beforeEach(() => {
  mocks.modifier.mockReset();
  mocks.correction.mockReset(); mocks.history.mockReset().mockResolvedValue({ ok: true, history: [] });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true,
    value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true,
    value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (modalInitial) Object.defineProperty(HTMLDialogElement.prototype, "showModal", modalInitial);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (closeInitial) Object.defineProperty(HTMLDialogElement.prototype, "close", closeInitial);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
function afficher() { render(<AdministrationPacks initialPacks={packs} selectedId="A87" initialQuestions={questions} />); }

it("affiche dates antiques et retraits ; combine recherche, niveau exact et statut sans RPC", () => {
  afficher(); expect(screen.getAllByText("15 mars 44 av. J.-C.")).toHaveLength(2);
  expect(screen.getByText("Retirée")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Rechercher par titre"), { target: { value: "rOm" } });
  expect(screen.queryByText("César")).toBeNull(); expect(screen.getByText("Rome")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Niveau"), { target: { value: "1" } });
  expect(screen.getByText("Aucune question pour cette sélection.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Niveau"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Statut"), { target: { value: "removed" } });
  expect(screen.getByText("Rome")).toBeTruthy(); expect(mocks.modifier).not.toHaveBeenCalled();
});
it("annule le retrait sans requête et ferme la confirmation avec Échap", () => {
  afficher(); fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(mocks.modifier).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("confirme avec motif, bloque le double clic puis met à jour les questions et décomptes", async () => {
  let resolve!: (value: unknown) => void;
  mocks.modifier.mockImplementation(() => new Promise((r) => { resolve = r; }));
  afficher(); fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
  fireEvent.change(screen.getByLabelText("Motif facultatif"), { target: { value: "Hors thème" } });
  const form = screen.getByRole("dialog").querySelector("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mocks.modifier).toHaveBeenCalledExactlyOnceWith("A87", "e1", true, "Hors thème");
  expect(screen.getByRole("button", { name: "Enregistrement…" }).hasAttribute("disabled")).toBe(true);
  await act(async () => resolve({ ok: true, data: { changed: true,
    packs: [{ ...packs[0], retired: 2, playable: 0 }], questions: questions.map((q) => ({ ...q, removed: true, playable: false })) } }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("0 jouables · 2 retirées · 2 au total")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Remettre" })).toHaveLength(2);
  expect(screen.getByRole("status").textContent).toContain("question retirée");
});
it("une erreur conserve le motif et l'état confirmé, puis permet de réessayer", async () => {
  mocks.modifier.mockResolvedValue({ ok: false, message: "Réessayez" });
  afficher(); fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
  fireEvent.change(screen.getByLabelText("Motif facultatif"), { target: { value: "À vérifier" } });
  await act(async () => fireEvent.submit(screen.getByRole("dialog").querySelector("form")!));
  expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toBe("Réessayez");
  expect((screen.getByLabelText("Motif facultatif") as HTMLTextAreaElement).value).toBe("À vérifier");
  expect(screen.getByText("1 jouables · 1 retirées · 2 au total")).toBeTruthy();
});
it("remet une question et gère une coupure réseau sans changer l'état local", async () => {
  mocks.modifier.mockRejectedValue(new Error("réseau")); afficher();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remettre" })));
  expect(screen.getByRole("alert").textContent).toContain("connexion");
  expect(screen.getByText("Retirée")).toBeTruthy();
  mocks.modifier.mockResolvedValue({ ok: true, data: { changed: true,
    packs: [{ ...packs[0], playable: 2, retired: 0 }], questions: questions.map((q) => ({ ...q, removed: false, playable: true })) } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remettre" })));
  expect(screen.getByText("2 jouables · 0 retirées · 2 au total")).toBeTruthy();
  expect(screen.queryByText("Retirée")).toBeNull();
});

function editer() {
  afficher(); fireEvent.click(screen.getAllByRole("button", { name: "Modifier" })[0]);
  return screen.getByRole("dialog", { name: "Modifier la question" });
}
it("préremplit les champs accessibles et annule sans écriture ni chargement d'historique", () => {
  const dialog = editer();
  expect((within(dialog).getByLabelText("Titre de la question") as HTMLInputElement).value).toBe("César");
  expect((within(dialog).getByRole("combobox", { name: "Niveau de la question" }) as HTMLSelectElement).value).toBe("1");
  fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(mocks.correction).not.toHaveBeenCalled();
  expect(mocks.history).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Modifier" })[0]);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("enregistre titre/niveau/motif une seule fois et actualise liste et décomptes", async () => {
  let resolve!: (value: unknown) => void;
  mocks.correction.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const dialog = editer();
  fireEvent.change(within(dialog).getByLabelText("Titre de la question"), { target: { value: "Mort de César" } });
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Niveau de la question" }), { target: { value: "2" } });
  fireEvent.change(within(dialog).getByLabelText("Motif de modification facultatif"), { target: { value: "Précision" } });
  fireEvent.submit(dialog.querySelector("form")!); fireEvent.submit(dialog.querySelector("form")!);
  expect(mocks.correction).toHaveBeenCalledExactlyOnceWith("A87", "e1", "Mort de César", 2, "Précision", "César", 1);
  const cancel = new Event("cancel", { bubbles: true, cancelable: true }); fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  await act(async () => resolve({ ok: true, data: { changed: true, history: [], packs: [{ ...packs[0], playable: 0 }],
    questions: [{ ...question, title: "Mort de César", niveau: 2, playable: false }, questions[1]] } }));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.getByText("Mort de César")).toBeTruthy();
  expect(screen.getByText("0 jouables · 1 retirées · 2 au total")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("tous les packs");
});
it("garde la saisie après erreur ou conflit ; un retry sans changement affiche sa confirmation", async () => {
  mocks.correction.mockResolvedValue({ ok: false, conflict: true, message: "Rechargez la page" });
  const dialog = editer();
  fireEvent.change(within(dialog).getByLabelText("Titre de la question"), { target: { value: "Titre à garder" } });
  await act(async () => fireEvent.submit(dialog.querySelector("form")!));
  expect(within(dialog).getByRole("alert").textContent).toContain("Rechargez");
  expect((within(dialog).getByLabelText("Titre de la question") as HTMLInputElement).value).toBe("Titre à garder");
  mocks.correction.mockRejectedValue(new Error("réseau"));
  await act(async () => fireEvent.submit(dialog.querySelector("form")!));
  expect(within(dialog).getByRole("alert").textContent).toContain("connexion");
  mocks.correction.mockResolvedValue({ ok: true, data: { changed: false, packs, questions, history: [] } });
  await act(async () => fireEvent.submit(dialog.querySelector("form")!));
  expect(screen.getByRole("status").textContent).toContain("Aucun changement");
});
it("consulte l'historique complet avec les valeurs avant/après et permet de réessayer", async () => {
  mocks.history.mockResolvedValueOnce({ ok: false, message: "Historique indisponible" });
  afficher();
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Historique" })[0]));
  const dialog = screen.getByRole("dialog", { name: "Historique des corrections" });
  expect(mocks.history).toHaveBeenCalledExactlyOnceWith("e1");
  expect(within(dialog).getByRole("alert").textContent).toContain("indisponible");
  const change = { id: 1, event_id: "e1", admin_id: "admin-104", occurred_at: "2026-10-11T10:00:00Z",
    old_title: "César", new_title: "Mort de César", old_niveau: 1, new_niveau: 2, reason: "Précision historique" };
  mocks.history.mockResolvedValue({ ok: true, history: [change, { ...change, id: 2, reason: null }] });
  await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Réessayer l’historique" })));
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
  expect(within(dialog).getByText(/Précision historique/)).toBeTruthy();
  expect(within(dialog).getByText(/Non renseigné/)).toBeTruthy();
  expect(within(dialog).getAllByText(/Débutant → Intermédiaire/)).toHaveLength(2);
  fireEvent.click(within(dialog).getByRole("button", { name: "Fermer" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
