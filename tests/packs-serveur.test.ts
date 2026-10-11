import { beforeEach, expect, it, vi } from "vitest";
import { chargerPacksJouables } from "@/app/solo/packs";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
const pack = { id: "C89", titre: "Batailles", description: "", parent_id: "P89",
  comptes: { YEAR: 25, MONTH: 22, DAY: 21 }, b: [1890, 1940] };
beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ data: [pack], error: null });
  mocks.client.mockReset().mockResolvedValue({ schema: () => ({ rpc: mocks.rpc }) });
});
it("lit la hiérarchie vivante, filtre niveau et inverse et retire les champs privés inattendus", async () => {
  mocks.rpc.mockResolvedValue({ data: [{ ...pack, start_year: 1901, aliases: ["secret"] }], error: null });
  expect(await chargerPacksJouables(2, true, "C89")).toEqual([pack]);
  expect(mocks.client).toHaveBeenCalledWith({ noStore: true });
  expect(mocks.rpc).toHaveBeenCalledWith("playable_packs", { p_niveau: 2, p_direction: "inverse", p_pack_id: "C89" });
});
it("refuse les paramètres invalides avant la RPC", async () => {
  await expect(chargerPacksJouables(4)).rejects.toThrow("invalide");
  await expect(chargerPacksJouables(1, false, "../pack")).rejects.toThrow("invalide");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("Expert lit ses comptes exacts pour parents et enfants", async () => {
  await chargerPacksJouables(3,true,"C89",true);
  expect(mocks.rpc).toHaveBeenCalledWith("playable_packs",{p_niveau:3,p_direction:"inverse",p_pack_id:"C89",p_expert_only:true});
  mocks.rpc.mockClear();
  await expect(chargerPacksJouables(2,false,null,true)).rejects.toThrow("invalide");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([null, [{ ...pack, comptes: { YEAR: -1 } }], [{ ...pack, b: [1901] }]])("refuse un catalogue corrompu", async (data) => {
  mocks.rpc.mockResolvedValue({ data, error: null });
  await expect(chargerPacksJouables(1)).rejects.toThrow("momentanément indisponibles");
});
it("masque les erreurs réseau et SQL", async () => {
  mocks.rpc.mockRejectedValue(new Error("Date privée SQL"));
  await expect(chargerPacksJouables(1)).rejects.toThrow("Les packs sont momentanément indisponibles. Réessayez.");
});
