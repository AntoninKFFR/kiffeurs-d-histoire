import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { cursorValide, type Historique, type Statistiques, type StatsMulti } from "./types";

// Aucune identité fournie par le navigateur ; aucune mise en cache partagée.
async function clientPrive(client?: SupabaseClient) {
  const supabase = client ?? (await createClient({ noStore: true }));
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Connexion requise.");
  return supabase.schema("histoire");
}
export async function chargerHistorique(
  cursor: unknown,
  client?: SupabaseClient,
): Promise<Historique> {
  const histoire = await clientPrive(client);
  const { data, error } = await histoire.rpc("player_history", {
    p_cursor: cursorValide(cursor),
  });
  if (error || !data)
    throw new Error("L’historique est momentanément indisponible.");
  return data as Historique;
}
/** Parties à plusieurs (#143) : comptées à part, elles ne changent pas les statistiques du solo. */
export async function chargerStatsMulti(client?: SupabaseClient): Promise<StatsMulti> {
  const histoire = await clientPrive(client);
  const { data, error } = await histoire.rpc("mes_stats_multi");
  if (error || !data) throw new Error("Les parties à plusieurs sont momentanément indisponibles.");
  return data as StatsMulti;
}

export async function chargerStatistiques(
  client?: SupabaseClient,
): Promise<Statistiques> {
  const histoire = await clientPrive(client);
  const { data, error } = await histoire.rpc("player_stats");
  if (error || !data)
    throw new Error("Les statistiques sont momentanément indisponibles.");
  return data as Statistiques;
}
