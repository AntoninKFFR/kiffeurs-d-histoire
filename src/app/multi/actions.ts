"use server";

// Salons (#133, #134) : le navigateur passe par ces actions, jamais directement par les RPC.
// Le jeton d'un invité ne quitte pas le serveur : il vit dans un cookie httpOnly par salon (24 h),
// comme le secret des parties solo sans compte (docs/solo-serveur.md).
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { cookieInvite, DUREE_JETON_INVITE, lireCodeSalon, type EtatSalon, type ResultatBattement } from "@/lib/multi/salon";

type Entree = { salon_id: string; membre_id: string; code: string; jeton?: string };
export type ResultatEntree = { ok: true; salonId: string; membreId: string; code: string } | { ok: false; erreur: string };

// Messages SQL écrits pour les joueurs (pseudo pris, salon complet…) : repris tels quels.
// Les autres erreurs restent génériques, sans détail de la base.
const CODES_LISIBLES = new Set(["22023", "55000", "42501"]);

function messageErreur(error: { code?: string; message?: string }): string {
  if (error.code === "53400") return "Trop d'essais ou trop de monde : réessaie dans quelques minutes.";
  if (error.code && CODES_LISIBLES.has(error.code) && error.message) return error.message;
  return "Impossible de rejoindre ce salon pour l'instant.";
}

async function jeton(salonId: string): Promise<string | null> {
  return (await cookies()).get(cookieInvite(salonId))?.value ?? null;
}

async function entrer(rpc: string, args: Record<string, unknown>): Promise<ResultatEntree> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("histoire").rpc(rpc, args);
  if (error) return { ok: false, erreur: messageErreur(error) };
  if (data?.erreur === "code_inconnu") return { ok: false, erreur: "Aucun salon avec ce code. Vérifie la date avec l'hôte." };
  const entree = data as Entree;
  if (entree.jeton) {
    (await cookies()).set(cookieInvite(entree.salon_id), entree.jeton, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DUREE_JETON_INVITE,
    });
  }
  return { ok: true, salonId: entree.salon_id, membreId: entree.membre_id, code: entree.code };
}

/** Rejoindre avec le code JJ/MM/AAAA. Un compte entre avec son pseudo KFFR ; un invité donne le sien. */
export async function rejoindreParCode(code: string, pseudo?: string): Promise<ResultatEntree> {
  const lu = lireCodeSalon(code);
  if (!lu) return { ok: false, erreur: "Le code est une date : JJ/MM/AAAA." };
  return entrer("rejoindre_salon", { p_code: lu, p_pseudo: pseudo ?? null });
}

/** Rejoindre avec le lien d'invitation. */
export async function rejoindreParLien(salonId: string, pseudo?: string): Promise<ResultatEntree> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonId)) {
    return { ok: false, erreur: "Lien d'invitation invalide." };
  }
  return entrer("rejoindre_salon_par_lien", { p_salon_id: salonId, p_pseudo: pseudo ?? null });
}

/** État du salon pour l'affichage ; null si on n'en fait plus partie. */
export async function etatSalon(salonId: string): Promise<EtatSalon | null> {
  cookieInvite(salonId);
  const supabase = await createClient();
  const { data, error } = await supabase.schema("histoire").rpc("etat_salon", { p_salon_id: salonId, p_jeton: await jeton(salonId) });
  return error ? null : (data as EtatSalon);
}

/** Battement de présence (#135), toutes les 10 s. */
export async function battementSalon(salonId: string): Promise<ResultatBattement> {
  cookieInvite(salonId);
  const supabase = await createClient();
  const { data, error } = await supabase.schema("histoire").rpc("battement_salon", { p_salon_id: salonId, p_jeton: await jeton(salonId) });
  if (error) return { ok: false, perdu: error.code === "42501" };
  return { ok: true, version: data.version, heureServeur: data.heure_serveur };
}

export async function quitterSalon(salonId: string): Promise<void> {
  const nom = cookieInvite(salonId);
  const supabase = await createClient();
  await supabase.schema("histoire").rpc("quitter_salon", { p_salon_id: salonId, p_jeton: await jeton(salonId) });
  (await cookies()).delete(nom);
}
