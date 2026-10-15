"use server";

import { changerQuestion, chargerHistoriqueEvenement, corrigerEvenement, EditorialConflictError } from "@/lib/admin-packs/serveur";
import type { EditorialActionResult, HistoryActionResult, PackActionResult } from "@/lib/admin-packs/types";
import { ajouterEvenements, creerEvenement, rechercherEvenements, chargerHistoriqueContenu, AdminValidationError } from "@/lib/admin-packs/serveur";
import type { AdminResult, ContentChange, ContentHistory, NewEvent, SearchFilters, SearchPage } from "@/lib/admin-packs/types";
import { erreurEvenement, rechercheValide } from "@/lib/admin-packs/validation";

const identifiantValide = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;
async function actionContenu<T>(operation: () => Promise<T | null>): Promise<AdminResult<T>> {
  try {
    const data = await operation();
    return data === null ? { ok: false, message: "Accès réservé aux administrateurs. Reconnectez-vous si nécessaire." } : { ok: true, data };
  } catch (e) {
    return { ok: false, message: e instanceof AdminValidationError ? e.message : "L’opération n’a pas pu être confirmée. Réessayez avec la même saisie pour vérifier son enregistrement." };
  }
}
export async function rechercherQuestions(packId: string, filters: SearchFilters): Promise<AdminResult<SearchPage>> {
  if (!identifiantValide(packId) || !rechercheValide(filters)) return { ok: false, message: "Vérifiez les filtres de recherche." };
  return actionContenu(() => rechercherEvenements(packId, filters));
}
export async function ajouterQuestions(packId: string, ids: string[]): Promise<AdminResult<ContentChange>> {
  if (!identifiantValide(packId) || !Array.isArray(ids) || ids.length < 1 || ids.length > 100 || !ids.every(identifiantValide)) return { ok: false, message: "Sélectionnez une à cent questions." };
  return actionContenu(() => ajouterEvenements(packId, ids));
}
export async function creerQuestion(requestId: string, packId: string, event: NewEvent): Promise<AdminResult<ContentChange>> {
  const message = erreurEvenement(event);
  if (message || !identifiantValide(packId) || typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return { ok: false, message: message ?? "Demande invalide." };
  return actionContenu(() => creerEvenement(requestId, packId, event));
}
export async function consulterHistoriqueContenu(eventId: string): Promise<AdminResult<ContentHistory>> {
  if (!identifiantValide(eventId)) return { ok: false, message: "Question invalide." };
  return actionContenu(() => chargerHistoriqueContenu(eventId));
}

// Chaque appel est de nouveau autorisé en SQL : la page n'est pas une permission.
export async function modifierQuestion(packId: string, eventId: string, removed: boolean, reason = ""): Promise<PackActionResult> {
  if (typeof packId !== "string" || !packId || packId.length > 100
    || typeof eventId !== "string" || !eventId || eventId.length > 100
    || typeof removed !== "boolean" || typeof reason !== "string" || reason.length > 1000) {
    return { ok: false, message: "Choix invalide ou motif trop long (1 000 caractères maximum)." };
  }
  try {
    const data = await changerQuestion(packId, eventId, removed, reason);
    if (!data) return { ok: false, message: "Accès réservé aux administrateurs. Reconnectez-vous si nécessaire." };
    return { ok: true, data };
  } catch {
    return { ok: false, message: "La modification n’a pas pu être confirmée. Réessayez : l’action ne sera pas enregistrée deux fois." };
  }
}

export async function enregistrerCorrection(packId: string, eventId: string, title: string, niveau: number,
  reason: string, expectedTitle: string, expectedNiveau: number): Promise<EditorialActionResult> {
  if (typeof packId !== "string" || !packId || packId.length > 100
    || typeof eventId !== "string" || !eventId || eventId.length > 100
    || typeof title !== "string" || !title.trim() || title.trim().length > 500 || /[\u0000-\u001f\u007f]/.test(title)
    || !Number.isInteger(niveau) || niveau < 1 || niveau > 3
    || typeof reason !== "string" || reason.length > 1000
    || typeof expectedTitle !== "string" || !Number.isInteger(expectedNiveau) || expectedNiveau < 1 || expectedNiveau > 3) {
    return { ok: false, message: "Vérifiez le titre (1 à 500 caractères), le niveau et le motif (1 000 caractères maximum)." };
  }
  try {
    const data = await corrigerEvenement(packId, eventId, title, niveau, reason, expectedTitle, expectedNiveau);
    if (!data) return { ok: false, message: "Accès réservé aux administrateurs. Reconnectez-vous si nécessaire." };
    return { ok: true, data };
  } catch (error) {
    if (error instanceof EditorialConflictError) return { ok: false, conflict: true, message: error.message };
    return { ok: false, message: "La correction n’a pas pu être confirmée. Réessayez pour vérifier son enregistrement." };
  }
}

export async function consulterHistorique(eventId: string): Promise<HistoryActionResult> {
  if (typeof eventId !== "string" || !eventId || eventId.length > 100) return { ok: false, message: "Question invalide." };
  try {
    const history = await chargerHistoriqueEvenement(eventId);
    if (!history) return { ok: false, message: "Accès réservé aux administrateurs." };
    return { ok: true, history };
  } catch {
    return { ok: false, message: "L’historique est momentanément indisponible. Réessayez." };
  }
}
