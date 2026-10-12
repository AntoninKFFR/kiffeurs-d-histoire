import { beforeEach, expect, it, vi } from "vitest";
import { compterQuestions } from "@/app/solo/disponibilite";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ data: { YEAR: 42, MONTH: 10, DAY: 5 }, error: null });
  mocks.client.mockReset().mockResolvedValue({ schema: () => ({ rpc: mocks.rpc }) });
});
it("transmet les filtres exacts et ne renvoie que les décomptes agrégés", async () => {
  mocks.rpc.mockResolvedValue({ data: { YEAR: 42, MONTH: 10, DAY: 5, titre: "privé" }, error: null });
  expect(await compterQuestions("mode=periode&periode=libre&de=-52&a=2000&niveau=2&difficulte=YEAR&sens=inverse&longueur=tout")).toEqual({ YEAR: 42, MONTH: 10, DAY: 5 });
  expect(mocks.client).toHaveBeenCalledWith({ noStore: true });
  expect(mocks.rpc).toHaveBeenCalledWith("available_questions", { p_niveau: 2, p_pack_id: null, p_tag_id: null,
    p_year_min: -52, p_year_max: 2000, p_level_id: null, p_chapter_ids: null, p_direction: "inverse" });
});
it("refuse les entrées invalides avant une RPC", async () => {
  await expect(compterQuestions("mode=general&difficulte=YEAR&longueur=101")).rejects.toThrow("Choix de partie invalide");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("Expert envoie le filtre exact, y compris en inversé, sans soustraire de comptes", async () => {
  await compterQuestions("mode=pack&pack=COL-0105&difficulte=DAY&niveau=3&expertOnly=1&sens=inverse");
  expect(mocks.rpc).toHaveBeenCalledWith("available_questions",expect.objectContaining({p_niveau:3,p_expert_only:true,p_direction:"inverse",p_pack_id:"COL-0105"}));
});
it("masque les erreurs SQL et refuse un décompte corrompu", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "secret SQL" } });
  await expect(compterQuestions("mode=general&difficulte=YEAR")).rejects.toThrow("momentanément indisponible");
  mocks.rpc.mockResolvedValueOnce({ data: { YEAR: -1, MONTH: 8, DAY: 4 }, error: null });
  await expect(compterQuestions("mode=general&difficulte=YEAR")).rejects.toThrow("momentanément indisponible");
});
