import { beforeEach, expect, it, vi } from "vitest";
import { erreurEvenement, rechercheValide } from "@/lib/admin-packs/validation";
import { accesAdministrateur } from "@/lib/admin-packs/serveur";
import { ajouterQuestions, creerQuestion, rechercherQuestions, consulterHistoriqueContenu } from "@/app/admin/packs/actions";
import type { NewEvent } from "@/lib/admin-packs/types";
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
const event: NewEvent = { title: "Événement", description: "Description pédagogique", niveau: 1, kind: "event", territory: "", date_status: "EXACT",
  start_year: -44, start_month: null, start_day: null, end_year: null, end_month: null, end_day: null, date_text: "", sources: ["Référence, auteur, p. 42"] };
const id = "12000000-0000-0000-0000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ schema: (schema: string) => { expect(schema).toBe("histoire"); return { rpc: mocks.rpc }; } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});
it("valide dates antiques, bissextiles, mois, jours, périodes et absence de date", () => {
  expect(erreurEvenement(event)).toBeNull();
  expect(erreurEvenement({ ...event, start_year: 2000, start_month: 2, start_day: 29 })).toBeNull();
  expect(erreurEvenement({ ...event, start_year: -5, end_year: 5 })).toBeNull();
  expect(erreurEvenement({ ...event, start_year: null, date_text: "Antiquité, date discutée" })).toBeNull();
  for (const patch of [{ start_year: 0 }, { start_year: 1900, start_month: 2, start_day: 29 }, { start_day: 2 },
    { start_month: 13 }, { end_year: -45 }, { start_year: null }, { end_day: 1 }, { start_year: Number.NaN },
    { sources: [] }, { sources: [""] }, { kind: "film" as const }, { niveau: 4 }]) {
    expect(erreurEvenement({ ...event, ...patch })).not.toBeNull();
  }
  expect(erreurEvenement({ ...event, kind: "film", territory: "France" })).toBeNull();
});
it("borne la pagination et les filtres sans exposer d'identité", () => {
  const f = { query: "César", niveau: null, yearMin: -100, yearMax: 100, page: 0 };
  expect(rechercheValide(f)).toBe(true);
  for (const patch of [{ page: -1 }, { page: 0.5 }, { niveau: 4 }, { yearMin: 0 }, { yearMax: -200 }, { query: "a".repeat(501) }]) expect(rechercheValide({ ...f, ...patch })).toBe(false);
});
it("n'envoie aucune requête pour un formulaire ou une sélection invalide", async () => {
  expect((await creerQuestion(id, "pack", { ...event, sources: [] })).ok).toBe(false);
  expect((await creerQuestion("invalide", "pack", event)).ok).toBe(false);
  expect((await ajouterQuestions("pack", [])).ok).toBe(false);
  expect((await ajouterQuestions("pack", [null as unknown as string])).ok).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("réautorise chaque opération, lit sans cache et transmet la clé de retry", async () => {
  await accesAdministrateur();
  await creerQuestion(id, "pack", event);
  expect(mocks.rpc).toHaveBeenLastCalledWith("admin_create_event", { p_request_id: id, p_pack_id: "pack", p_event: event });
  await ajouterQuestions("pack", ["EVT-1", "EVT-2"]);
  expect(mocks.rpc).toHaveBeenLastCalledWith("admin_add_pack_events", { p_pack_id: "pack", p_event_ids: ["EVT-1", "EVT-2"] });
  await rechercherQuestions("pack", { query: " Rome ", niveau: 1, yearMin: -100, yearMax: 100, page: 2 });
  expect(mocks.rpc).toHaveBeenLastCalledWith("admin_search_events", { p_pack_id: "pack", p_query: "Rome", p_niveau: 1, p_year_min: -100, p_year_max: 100, p_page: 2 });
  await consulterHistoriqueContenu("EVT-1");
  expect(mocks.client).toHaveBeenCalledWith({ noStore: true });
});
it("échoue fermé sur le profil et masque les erreurs SQL privées", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private SQL" } });
  expect(await accesAdministrateur()).toBe(false);
  for (const result of [await creerQuestion(id, "pack", event), await ajouterQuestions("pack", ["EVT-1"]), await consulterHistoriqueContenu("EVT-1")]) {
    expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("private SQL");
  }
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "private SQL" } });
  expect(await creerQuestion(id, "pack", event)).toMatchObject({ ok: false, message: expect.stringContaining("même titre") });
  mocks.client.mockRejectedValue(new Error("secret"));
  expect(await accesAdministrateur()).toBe(false);
});
