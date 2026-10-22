// Affichage optimiste (#135) : le geste d'un joueur s'affiche tout de suite chez lui,
// le serveur confirme ensuite. S'il refuse, on revient à l'état d'avant.
export async function actionOptimiste<T>(etapes: {
  appliquer: () => void;
  envoyer: () => Promise<T>;
  annuler: (erreur: unknown) => void;
}): Promise<{ ok: true; valeur: T } | { ok: false; erreur: unknown }> {
  etapes.appliquer();
  try {
    return { ok: true, valeur: await etapes.envoyer() };
  } catch (erreur) {
    etapes.annuler(erreur);
    return { ok: false, erreur };
  }
}
