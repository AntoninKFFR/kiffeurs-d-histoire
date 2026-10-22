// Battement de présence (#135) : toutes les 10 s, le membre dit au serveur qu'il est là.
// Sans battement pendant 30 s, il perd sa place (un autre membre le fait retirer).
// L'envoi passe par l'action serveur battementSalon : le jeton d'un invité reste dans son cookie httpOnly (#134).
import type { ResultatBattement } from "./salon";

export const INTERVALLE_BATTEMENT = 10_000;

export function demarrerBattement(
  battre: () => Promise<ResultatBattement>,
  rappels: {
    /** Version du salon : si elle a changé, l'écran recharge l'état. */
    surVersion?: (version: number, heureServeur: number) => void;
    /** Le serveur ne nous connaît plus (absent trop longtemps, expulsé, salon fermé, jeton expiré). */
    surPerdu?: () => void;
  } = {},
): () => void {
  let arrete = false;
  const envoyer = async () => {
    if (arrete) return;
    let resultat: ResultatBattement;
    try {
      resultat = await battre();
    } catch {
      return; // Erreur réseau : le prochain battement réessaie.
    }
    if (arrete) return;
    if (resultat.ok) rappels.surVersion?.(resultat.version, resultat.heureServeur);
    else if (resultat.perdu) rappels.surPerdu?.();
  };
  // Retour sur l'onglet (téléphone sorti de veille) : battre tout de suite pour garder sa place.
  const auRetour = () => { if (document.visibilityState === "visible") void envoyer(); };
  void envoyer();
  const minuteur = setInterval(() => void envoyer(), INTERVALLE_BATTEMENT);
  document.addEventListener("visibilitychange", auRetour);
  return () => {
    arrete = true;
    clearInterval(minuteur);
    document.removeEventListener("visibilitychange", auRetour);
  };
}
