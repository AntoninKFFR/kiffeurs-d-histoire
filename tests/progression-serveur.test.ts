import { beforeEach, expect, it, vi } from "vitest";
import { enregistrerTest, lireProgressionJoueur, marquerDecouvert } from "@/lib/progression/serveur";

vi.mock("server-only", () => ({}));
// Lecture de progression avant publication : le contrat initial reste couvert.
vi.mock('../src/lib/apprendre/structure.json',async()=>{
  const {chargerStructure,projectionStructure}=await import('../scripts/structure-pedagogique');
  return {default:projectionStructure(chargerStructure()).filter(c=>c.etat!=='inactif')};
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

const rpc = vi.fn();
const select = vi.fn();
function client(user: object | null) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: user ? null : new Error("pas de session") }) },
    schema: (nom: string) => { expect(nom).toBe("histoire"); return { rpc, from: () => ({ select }) }; },
  } as never;
}
beforeEach(() => { vi.clearAllMocks(); });

it("sans session, ne lit ni n'écrit rien et laisse le navigateur garder la progression", async () => {
  expect(await lireProgressionJoueur(client(null))).toBeNull();
  expect(await marquerDecouvert("THM-027", client(null))).toBe(false);
  expect(await enregistrerTest("00000000-0000-4000-8000-000000000001", client(null))).toEqual({ connecte: false });
  expect(rpc).not.toHaveBeenCalled();
  expect(select).not.toHaveBeenCalled();
});

it("n'appelle les RPC qu'avec un chapitre du catalogue ou un identifiant de partie valide, sans identité en paramètre", async () => {
  await expect(marquerDecouvert("THM-999", client({ id: "a" }))).rejects.toThrow();
  await expect(marquerDecouvert("'; drop table x; --", client({ id: "a" }))).rejects.toThrow();
  await expect(enregistrerTest("pas-un-uuid", client({ id: "a" }))).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: null, error: null });
  expect(await marquerDecouvert("THM-027", client({ id: "a" }))).toBe(true);
  expect(rpc).toHaveBeenCalledWith("mark_chapter_discovered", { p_chapter_id: "THM-027" });
});

it("relit la précision enregistrée par le serveur et signale une amélioration", async () => {
  rpc.mockResolvedValue({ data: { improved: true, best_accuracy: "88.00" }, error: null });
  expect(await enregistrerTest("00000000-0000-4000-8000-000000000001", client({ id: "a" }))).toEqual({ connecte: true, meilleur: true, precision: 88 });
  expect(rpc).toHaveBeenCalledWith("record_chapter_test", { p_game_id: "00000000-0000-4000-8000-000000000001" });
});

it("lit la progression du joueur connecté et refuse de masquer une erreur de lecture", async () => {
  select.mockResolvedValueOnce({ data: [{ chapter_id: "THM-027", discovered_at: "2026-10-08T10:00:00Z", best_accuracy: 70, best_difficulty: "YEAR", tests_count: 1 }], error: null });
  expect(await lireProgressionJoueur(client({ id: "a" }))).toEqual({
    connecte: true, chapitres: { "THM-027": { decouvert: true, precision: 70, difficulte: "YEAR", tests: 1 } },
  });
  select.mockResolvedValueOnce({ data: null, error: { message: "détail privé" } });
  await expect(lireProgressionJoueur(client({ id: "a" }))).rejects.toThrow("Progression indisponible");
});

it("ne laisse remonter aucun détail SQL d'une RPC refusée", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "ligne privée" } });
  await expect(enregistrerTest("00000000-0000-4000-8000-000000000001", client({ id: "a" }))).rejects.toThrow("Progression indisponible");
});
