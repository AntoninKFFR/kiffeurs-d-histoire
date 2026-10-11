"use server";

import { createClient } from "@/lib/supabase/server";
import type { PackJouable } from "@/lib/solo/packs";

export async function chargerPacksJouables(niveau: number, inverse = false, packId: string | null = null, expertOnly = false): Promise<PackJouable[]> {
  if (![1, 2, 3].includes(niveau) || (expertOnly && niveau !== 3) || (packId !== null && !/^[\w-]{1,80}$/.test(packId))) {
    throw new Error("Choix de pack invalide.");
  }
  try {
    const client = await createClient({ noStore: true });
    const { data, error } = await client.schema("histoire").rpc("playable_packs", {
      p_niveau: niveau, p_direction: inverse ? "inverse" : "date", p_pack_id: packId,
      ...(expertOnly ? { p_expert_only: true } : {}),
    });
    if (error || !Array.isArray(data)) throw new Error();
    // Projection explicite : aucun champ privé inattendu ne quitte le serveur.
    return data.map((p) => {
      if (typeof p.id !== "string" || typeof p.titre !== "string" || typeof p.description !== "string"
        || !(p.parent_id === null || typeof p.parent_id === "string")
        || !["YEAR", "MONTH", "DAY"].every((d) => Number.isSafeInteger(p.comptes?.[d]) && p.comptes[d] >= 0)
        || !(p.b === null || (Array.isArray(p.b) && p.b.length === 2 && p.b.every(Number.isFinite) && p.b[0] < p.b[1]))) throw new Error();
      return { id: p.id, titre: p.titre, description: p.description, parent_id: p.parent_id,
        comptes: { YEAR: p.comptes.YEAR, MONTH: p.comptes.MONTH, DAY: p.comptes.DAY }, b: p.b };
    });
  } catch {
    throw new Error("Les packs sont momentanément indisponibles. Réessayez.");
  }
}
