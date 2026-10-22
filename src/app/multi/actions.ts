"use server";

// Salons (#133, #134) : le navigateur passe par ces actions, jamais directement par les RPC.
// Le jeton d'un invité ne quitte pas le serveur : il vit dans un cookie httpOnly par salon (24 h),
// comme le secret des parties solo sans compte (docs/solo-serveur.md).
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { SoloDate } from "@/lib/game/solo";
import type { BilanPartie } from "@/lib/multi/bilan";
import type { EtatPartie } from "@/lib/multi/partie";
import { cookieInvite, DUREE_JETON_INVITE, lireCodeSalon, type EtatSalon, type Reglages, type ResultatBattement } from "@/lib/multi/salon";

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

export type ResultatAction = { ok: true } | { ok: false; erreur: string };

/** Créer un salon (compte requis). Renvoie l'identifiant pour ouvrir l'écran du salon. */
export async function creerSalon(mode: "convivial" | "un_contre_un"): Promise<{ ok: true; salonId: string } | { ok: false; erreur: string }> {
  if (mode !== "convivial" && mode !== "un_contre_un") return { ok: false, erreur: "Mode inconnu." };
  const supabase = await createClient();
  const { data, error } = await supabase.schema("histoire").rpc("creer_salon", { p_mode: mode, p_visibilite: "prive" });
  if (error) {
    if (error.code === "42501") return { ok: false, erreur: "Connecte-toi pour créer un salon." };
    if (error.code === "53400") return { ok: false, erreur: "Beaucoup de monde en ce moment : réessaie dans un instant." };
    return { ok: false, erreur: "Impossible de créer le salon pour l'instant." };
  }
  return { ok: true, salonId: data.salon_id };
}

/** Réglages de l'hôte : seules les clés données changent. */
export async function modifierSalon(salonId: string, changements: {
  reglages?: Partial<Reglages>;
  visibilite?: "prive" | "ouvert";
  maxJoueurs?: number;
}): Promise<ResultatAction> {
  cookieInvite(salonId);
  const supabase = await createClient();
  const { error } = await supabase.schema("histoire").rpc("modifier_salon", {
    p_salon_id: salonId, p_jeton: await jeton(salonId), p_reglages: changements.reglages ?? null,
    p_visibilite: changements.visibilite ?? null, p_max_joueurs: changements.maxJoueurs ?? null,
  });
  return error ? { ok: false, erreur: messageErreur(error) } : { ok: true };
}

export async function expulserMembre(salonId: string, membreId: string): Promise<ResultatAction> {
  cookieInvite(salonId);
  const supabase = await createClient();
  const { error } = await supabase.schema("histoire").rpc("expulser_membre", {
    p_salon_id: salonId, p_membre_id: membreId, p_jeton: await jeton(salonId),
  });
  return error ? { ok: false, erreur: messageErreur(error) } : { ok: true };
}

export type PartieOuverte = {
  id: string; hote: string | null; mode: "convivial" | "un_contre_un"; reglages: Reglages;
  joueurs: number; max_joueurs: number; etat: "attente" | "partie"; moi: boolean;
};

/** Salons ouverts (comptes seulement) ; null si la liste est indisponible ou réservée aux comptes. */
export async function partiesOuvertes(): Promise<PartieOuverte[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("histoire").rpc("parties_ouvertes");
  return error || !Array.isArray(data) ? null : (data as PartieOuverte[]);
}

/** L'hôte accepte un joueur arrivé pendant une partie (le refuser : expulserMembre). */
export async function accepterMembre(salonId: string, membreId: string): Promise<ResultatAction> {
  cookieInvite(salonId);
  const supabase = await createClient();
  const { error } = await supabase.schema("histoire").rpc("accepter_membre", {
    p_salon_id: salonId, p_membre_id: membreId, p_jeton: await jeton(salonId),
  });
  return error ? { ok: false, erreur: messageErreur(error) } : { ok: true };
}

/** L'hôte lance la partie avec les réglages du salon (#140). */
export async function lancerPartie(salonId: string): Promise<ResultatAction> {
  cookieInvite(salonId);
  const supabase = await createClient();
  const { error } = await supabase.schema("histoire").rpc("lancer_partie", { p_salon_id: salonId, p_jeton: await jeton(salonId) });
  return error ? { ok: false, erreur: messageErreur(error) } : { ok: true };
}

/** État de la partie du salon (null : pas de partie, ou plus membre). Fait aussi avancer la partie. */
export async function etatPartie(salonId: string): Promise<EtatPartie | null> {
  cookieInvite(salonId);
  const supabase = await createClient();
  const { data, error } = await supabase.schema("histoire").rpc("etat_partie", { p_salon_id: salonId, p_jeton: await jeton(salonId) });
  return error ? null : (data as EtatPartie | null);
}

/** Réponse à la question en cours ; question période : début et fin. */
export async function repondrePartie(salonId: string, questionId: string, debut: SoloDate, fin?: SoloDate | null): Promise<ResultatAction> {
  cookieInvite(salonId);
  const supabase = await createClient();
  const { error } = await supabase.schema("histoire").rpc("repondre_partie", {
    p_salon_id: salonId, p_question_id: questionId,
    p_annee: debut.year, p_mois: debut.month ?? null, p_jour: debut.day ?? null,
    p_annee_fin: fin?.year ?? null, p_mois_fin: fin?.month ?? null, p_jour_fin: fin?.day ?? null,
    p_jeton: await jeton(salonId),
  });
  return error ? { ok: false, erreur: messageErreur(error) } : { ok: true };
}

/** Bilan de la dernière partie terminée du salon (podium, #143) ; null avant la fin. */
export async function bilanPartie(salonId: string): Promise<BilanPartie | null> {
  cookieInvite(salonId);
  const supabase = await createClient();
  const { data, error } = await supabase.schema("histoire").rpc("bilan_partie", { p_salon_id: salonId, p_jeton: await jeton(salonId) });
  return error ? null : (data as BilanPartie | null);
}
