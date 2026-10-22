// Battement de présence (#135) : toutes les 10 s, le membre dit au serveur qu'il est là.
// Sans battement pendant 30 s, il perd sa place (un autre membre le fait retirer).
import type { SupabaseClient } from "@supabase/supabase-js";

export const INTERVALLE_BATTEMENT = 10_000;

export function demarrerBattement(
  client: SupabaseClient,
  salonId: string,
  jeton: string | null,
  rappels: {
    /** Version du salon : si elle a changé, l'écran recharge l'état. */
    surVersion?: (version: number, heureServeur: number) => void;
    /** Le serveur ne nous connaît plus (absent trop longtemps, expulsé, salon fermé). */
    surPerdu?: () => void;
  } = {},
): () => void {
  let arrete = false;
  const battre = async () => {
    if (arrete) return;
    const { data, error } = await client
      .schema("histoire")
      .rpc("battement_salon", { p_salon_id: salonId, p_jeton: jeton });
    if (arrete) return;
    if (error) {
      if (error.code === "42501") rappels.surPerdu?.();
      return; // Erreur réseau : le prochain battement réessaie.
    }
    rappels.surVersion?.(data.version, data.heure_serveur);
  };
  // Retour sur l'onglet (téléphone sorti de veille) : battre tout de suite pour garder sa place.
  const auRetour = () => { if (document.visibilityState === "visible") void battre(); };
  void battre();
  const minuteur = setInterval(() => void battre(), INTERVALLE_BATTEMENT);
  document.addEventListener("visibilitychange", auRetour);
  return () => {
    arrete = true;
    clearInterval(minuteur);
    document.removeEventListener("visibilitychange", auRetour);
  };
}
