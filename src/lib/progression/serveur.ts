import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CHAPITRES } from "@/lib/apprendre/catalogue";
import { progressionDepuisLignes, progressionParEditions, type LigneProgression, type Progression } from "./types";

const CHAPITRES_CONNUS: ReadonlySet<string> = new Set(CHAPITRES.map((c) => c.id));
export const chapitreConnu = (id: unknown): id is string => typeof id === "string" && CHAPITRES_CONNUS.has(id);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const partieValide = (id: unknown): id is string => typeof id === "string" && UUID.test(id);

// Identité lue dans la session du navigateur, jamais fournie en paramètre ; aucun cache partagé.
async function joueur(client?: SupabaseClient) {
  if (!isSupabaseConfigured) return null;
  const supabase = client ?? (await createClient({ noStore: true }));
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : supabase;
}

/** null = visiteur sans compte. Lève si la lecture échoue pour un joueur connecté. */
export async function lireProgressionJoueur(client?: SupabaseClient): Promise<Progression | null> {
  const supabase = await joueur(client);
  if (!supabase) return null;
  const { data, error } = await supabase.schema("histoire").from("learning_progress")
    .select("chapter_id, discovered_at, best_accuracy, best_difficulty, tests_count");
  if (error) throw new Error("Progression indisponible");
  if (CHAPITRES.some(c=>c.editions?.length)) {
    const {data: editions,error: erreurEditions}=await supabase.schema("histoire").from("learning_progress_editions")
      .select("chapter_id, version, discovered_at, best_accuracy, best_difficulty, tests_count");
    if (erreurEditions) throw new Error("Progression indisponible");
    return {connecte:true,...progressionParEditions((data??[]) as LigneProgression[],(editions??[]) as (LigneProgression&{version:string})[],CHAPITRES)};
  }
  return { connecte: true, chapitres: progressionDepuisLignes((data ?? []) as LigneProgression[], CHAPITRES_CONNUS) };
}

/** false = visiteur sans compte (le navigateur garde alors la progression de la session). */
export async function marquerDecouvert(chapitre: string, client?: SupabaseClient): Promise<boolean> {
  if (!chapitreConnu(chapitre)) throw new Error("Chapitre inconnu");
  const supabase = await joueur(client);
  if (!supabase) return false;
  const { error } = await supabase.schema("histoire").rpc("mark_chapter_discovered", { p_chapter_id: chapitre });
  if (error) throw new Error("Progression indisponible");
  return true;
}

export type EnregistrementTest = { connecte: boolean; meilleur?: boolean; precision?: number };
export async function enregistrerTest(partie: string, client?: SupabaseClient): Promise<EnregistrementTest> {
  if (!partieValide(partie)) throw new Error("Partie invalide");
  const supabase = await joueur(client);
  if (!supabase) return { connecte: false };
  const { data, error } = await supabase.schema("histoire").rpc("record_chapter_test", { p_game_id: partie });
  if (error) throw new Error("Progression indisponible");
  const r = data as { improved?: boolean; best_accuracy?: number | string };
  return { connecte: true, meilleur: Boolean(r.improved), precision: Number(r.best_accuracy) };
}
