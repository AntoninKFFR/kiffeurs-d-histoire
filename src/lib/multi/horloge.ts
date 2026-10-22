// Horloge du serveur (#135) : tous les chronos d'un salon se calent sur l'heure de la base,
// pas sur celle de chaque appareil (souvent décalée de plusieurs secondes).

/** Une mesure : heure locale à l'envoi, heure du serveur, heure locale à la réception (ms). */
export type Echantillon = { envoi: number; serveur: number; reception: number };

export type Decalage = {
  /** À ajouter à l'heure locale pour obtenir l'heure du serveur (ms). */
  decalage: number;
  /** Aller-retour de la meilleure mesure (ms) : l'erreur possible en vaut au plus la moitié. */
  allerRetour: number;
};

// Méthode NTP simplifiée : on garde la mesure au plus court aller-retour, la moins bruitée.
export function estimerDecalage(echantillons: readonly Echantillon[]): Decalage {
  if (echantillons.length === 0) throw new Error("Aucune mesure d'horloge");
  const meilleur = echantillons.reduce((a, b) =>
    b.reception - b.envoi < a.reception - a.envoi ? b : a,
  );
  const allerRetour = meilleur.reception - meilleur.envoi;
  return { decalage: Math.round(meilleur.serveur - (meilleur.envoi + allerRetour / 2)), allerRetour };
}

/** Interroge le serveur `n` fois à la suite et en déduit le décalage. */
export async function synchroniserHorloge(
  lireHeureServeur: () => Promise<number>,
  n = 5,
  maintenant: () => number = () => Date.now(),
): Promise<Decalage> {
  const echantillons: Echantillon[] = [];
  for (let i = 0; i < n; i++) {
    const envoi = maintenant();
    const serveur = await lireHeureServeur();
    echantillons.push({ envoi, serveur, reception: maintenant() });
  }
  return estimerDecalage(echantillons);
}

/** Heure du serveur estimée maintenant (ms). */
export function heureServeur(decalage: number, maintenant: () => number = () => Date.now()): number {
  return maintenant() + decalage;
}

/** Millisecondes avant une échéance fixée par le serveur (jamais négatif). */
export function resteAvant(echeanceServeur: number, decalage: number, maintenant: () => number = () => Date.now()): number {
  return Math.max(0, echeanceServeur - heureServeur(decalage, maintenant));
}
