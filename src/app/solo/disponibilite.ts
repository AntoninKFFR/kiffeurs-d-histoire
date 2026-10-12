"use server";

import { createClient } from "@/lib/supabase/server";
import { filtresDepuis, lireChoix, type Comptes } from "@/lib/solo/choix";

// Lecture agrégée publique : aucune réponse, date, identité ou liste de candidats.
export async function compterQuestions(texte: string): Promise<Comptes> {
  const choix = lireChoix(new URLSearchParams(texte));
  if (!choix || choix.test) throw new Error("Choix de partie invalide.");
  const f = filtresDepuis(choix);
  const supabase = await createClient({ noStore: true });
  const { data, error } = await supabase.schema("histoire").rpc("available_questions", {
    p_niveau: f.niveau ?? null, p_pack_id: f.packId ?? null, p_tag_id: f.tagId ?? null,
    p_year_min: f.yearMin ?? null, p_year_max: f.yearMax ?? null,
    p_level_id: f.levelId ?? null, p_chapter_ids: f.chapterIds ?? null,
    p_direction: f.direction ?? "date",
    ...(f.expertOnly ? { p_expert_only: true } : {}),
  });
  if (error || !data || !["YEAR", "MONTH", "DAY"].every((d) => Number.isSafeInteger(data[d]) && data[d] >= 0)) {
    throw new Error("Le nombre de questions est momentanément indisponible.");
  }
  return { YEAR: data.YEAR, MONTH: data.MONTH, DAY: data.DAY };
}
