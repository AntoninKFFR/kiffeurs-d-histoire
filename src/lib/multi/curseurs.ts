// Mode visible (#141) : les curseurs des autres joueurs en direct. Sans DOM, pour être testé.
// Envoi limité à 10 par seconde (le dernier curseur part toujours), affichage lissé entre deux envois.

export const INTERVALLE_CURSEUR = 100;

/**
 * Limiteur d'envois : au plus un envoi par `intervalle` ms. Un envoi trop rapproché est retardé,
 * et seule la dernière valeur part (pas de file d'attente).
 */
export function creerLimiteur<T>(
  envoyer: (valeur: T) => void,
  intervalle = INTERVALLE_CURSEUR,
  horloge: { maintenant: () => number; plusTard: (f: () => void, ms: number) => unknown; annuler: (id: unknown) => void } = {
    maintenant: () => Date.now(), plusTard: (f, ms) => setTimeout(f, ms), annuler: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  },
) {
  let dernier = -Infinity;
  let attente: { valeur: T } | null = null;
  let minuterie: unknown = null;
  const partir = () => {
    minuterie = null;
    if (!attente) return;
    dernier = horloge.maintenant();
    const { valeur } = attente;
    attente = null;
    envoyer(valeur);
  };
  return {
    pousser(valeur: T) {
      attente = { valeur };
      if (minuterie != null) return;
      const reste = dernier + intervalle - horloge.maintenant();
      if (reste <= 0) partir();
      else minuterie = horloge.plusTard(partir, reste);
    },
    arreter() {
      if (minuterie != null) horloge.annuler(minuterie);
      minuterie = null;
      attente = null;
    },
  };
}

/** Rapproche une position de sa cible (lissage exponentiel) ; colle à la cible une fois assez près. */
export function rapprocher(actuel: number, cible: number, dtMs: number, constanteMs = 90): number {
  const suivant = actuel + (cible - actuel) * (1 - Math.exp(-Math.max(0, dtMs) / constanteMs));
  return Math.abs(cible - suivant) < 1e-4 ? cible : suivant;
}

/** On diffuse son curseur seulement en mode visible, pendant la question, tant qu'on n'a pas validé. */
export function doitDiffuser(modeVisible: boolean, questionOuverte: boolean, dejaValide: boolean): boolean {
  return modeVisible && questionOuverte && !dejaValide;
}
