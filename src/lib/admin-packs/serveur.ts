import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminPack, EditorialChange, EditorialResult, PackChange, PackQuestion } from "./types";
import type { ContentChange, ContentHistory, NewEvent, SearchFilters, SearchPage } from "./types";

const INDISPONIBLE = "La gestion des packs est momentanément indisponible. Réessayez.";
export class EditorialConflictError extends Error {}
export class AdminValidationError extends Error {}

// Même autorisation SQL que les indicateurs. Aucun cache partagé de données privées.
async function appeler<T>(rpc: string, params?: Record<string, unknown>): Promise<T | null> {
  try {
    const client = await createClient({ noStore: true });
    const { data, error } = await client.schema("histoire").rpc(rpc, params);
    if (error?.code === "42501") return null;
    if (error?.code === "40001") throw new EditorialConflictError("Cette question a été modifiée dans un autre onglet. Rechargez la page avant de reprendre la correction.");
    if (error?.code === "23505" && rpc === "admin_create_event") throw new AdminValidationError("Un événement de même titre ou très proche existe déjà. Recherchez-le pour l’ajouter au pack ; précisez le titre s’il s’agit d’un autre événement.");
    if (error || data == null) throw new Error(INDISPONIBLE);
    return data as T;
  } catch (error) {
    if (error instanceof EditorialConflictError || error instanceof AdminValidationError) throw error;
    // Les erreurs réseau, SQL et PostgREST ne quittent pas le serveur.
    throw new Error(INDISPONIBLE);
  }
}

export async function chargerPacks(): Promise<AdminPack[] | null> {
  return appeler<AdminPack[]>("admin_list_packs");
}

export async function chargerQuestions(packId: string): Promise<PackQuestion[] | null> {
  return appeler<PackQuestion[]>("admin_pack_questions", { p_pack_id: packId });
}

export async function changerQuestion(packId: string, eventId: string, removed: boolean, reason: string): Promise<PackChange | null> {
  return appeler<PackChange>(removed ? "admin_remove_pack_event" : "admin_restore_pack_event", {
    p_pack_id: packId, p_event_id: eventId, p_reason: reason.trim() || null,
  });
}

export async function corrigerEvenement(packId: string, eventId: string, title: string, niveau: number,
  reason: string, expectedTitle: string, expectedNiveau: number): Promise<EditorialResult | null> {
  return appeler<EditorialResult>("admin_edit_event", {
    p_pack_id: packId, p_event_id: eventId, p_title: title.trim(), p_niveau: niveau,
    p_reason: reason.trim() || null, p_expected_title: expectedTitle, p_expected_niveau: expectedNiveau,
  });
}

export async function chargerHistoriqueEvenement(eventId: string): Promise<EditorialChange[] | null> {
  return appeler<EditorialChange[]>("admin_event_history", { p_event_id: eventId });
}

export async function accesAdministrateur(): Promise<boolean> {
  try { return (await appeler<boolean>("admin_access")) === true; } catch { return false; }
}
export async function rechercherEvenements(packId: string, f: SearchFilters): Promise<SearchPage | null> {
  return appeler("admin_search_events", { p_pack_id: packId, p_query: f.query.trim(), p_niveau: f.niveau,
    p_year_min: f.yearMin, p_year_max: f.yearMax, p_page: f.page });
}
export async function ajouterEvenements(packId: string, ids: string[]): Promise<ContentChange | null> {
  return appeler("admin_add_pack_events", { p_pack_id: packId, p_event_ids: ids });
}
export async function creerEvenement(requestId: string, packId: string, event: NewEvent): Promise<ContentChange | null> {
  return appeler("admin_create_event", { p_request_id: requestId, p_pack_id: packId, p_event: event });
}
export async function chargerHistoriqueContenu(eventId: string): Promise<ContentHistory | null> {
  return appeler("admin_content_history", { p_event_id: eventId });
}
