// Canal temps réel d'un salon (#135) : un seul canal Supabase Realtime par salon et par onglet.
// Presence dit qui est là ; Broadcast porte les événements. Le canal est public (son nom contient
// l'uuid du salon) : il ne transporte rien de secret, le serveur reste l'arbitre des réponses.
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { estDansLeCatalogue } from "./chat-catalogue";

export type EvenementSalon =
  /** Le salon a changé en base (membres, réglages) : recharger l'état. */
  | { type: "salon_change"; version: number }
  /** Mode visible : où un joueur place son curseur. */
  | { type: "curseur"; membreId: string; annee: number; mois?: number; jour?: number }
  /** Chat restreint : uniquement un identifiant du catalogue (#132). */
  | { type: "chat"; membreId: string; id: string }
  /** Mesure de latence (page de test). Heures en ms, horloge du serveur. */
  | { type: "ping"; de: string; n: number; envoi: number }
  | { type: "pong"; de: string; pour: string; n: number; envoi: number; renvoi: number };

export type Present = { membreId: string; pseudo: string };

export type EtatCanal = "connexion" | "connecte" | "reconnexion" | "ferme";

export type CanalSalon = {
  envoyer: (evenement: EvenementSalon) => Promise<void>;
  presents: () => Present[];
  fermer: () => Promise<void>;
};

const EVENEMENT = "evt";

export function nomCanal(salonId: string): string {
  return `histoire-salon:${salonId}`;
}

const estNombre = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const estTexte = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 64;

/** Filtre ce qui arrive du canal : n'importe qui connaissant son nom peut y écrire. */
export function lireEvenement(x: unknown): EvenementSalon | null {
  if (typeof x !== "object" || x === null) return null;
  const e = x as Record<string, unknown>;
  switch (e.type) {
    case "salon_change":
      return estNombre(e.version) ? { type: "salon_change", version: e.version } : null;
    case "curseur":
      if (!estTexte(e.membreId) || !estNombre(e.annee)) return null;
      return {
        type: "curseur", membreId: e.membreId, annee: e.annee,
        ...(estNombre(e.mois) ? { mois: e.mois } : {}),
        ...(estNombre(e.jour) ? { jour: e.jour } : {}),
      };
    case "chat":
      return estTexte(e.membreId) && estTexte(e.id) && estDansLeCatalogue(e.id)
        ? { type: "chat", membreId: e.membreId, id: e.id } : null;
    case "ping":
      return estTexte(e.de) && estNombre(e.n) && estNombre(e.envoi)
        ? { type: "ping", de: e.de, n: e.n, envoi: e.envoi } : null;
    case "pong":
      return estTexte(e.de) && estTexte(e.pour) && estNombre(e.n) && estNombre(e.envoi) && estNombre(e.renvoi)
        ? { type: "pong", de: e.de, pour: e.pour, n: e.n, envoi: e.envoi, renvoi: e.renvoi } : null;
    default:
      return null;
  }
}

/** Délai avant la n-ième tentative de réabonnement : 0,5 s, 1 s, 2 s… plafonné à 8 s. */
export function delaiReconnexion(tentative: number): number {
  return Math.min(8000, 500 * 2 ** Math.max(0, tentative - 1));
}

export function ouvrirCanalSalon(
  client: SupabaseClient,
  salonId: string,
  moi: Present,
  rappels: {
    surEvenement?: (evenement: EvenementSalon) => void;
    surPresents?: (presents: Present[]) => void;
    surEtat?: (etat: EtatCanal) => void;
  } = {},
): CanalSalon {
  let canal: RealtimeChannel | null = null;
  let ferme = false;
  let tentative = 0;
  let minuteur: ReturnType<typeof setTimeout> | undefined;

  const presentsDe = (c: RealtimeChannel): Present[] =>
    Object.values(c.presenceState<Present>())
      .flatMap((metas) => metas.slice(0, 1))
      .map(({ membreId, pseudo }) => ({ membreId, pseudo }));

  const abonner = () => {
    rappels.surEtat?.(tentative === 0 ? "connexion" : "reconnexion");
    const c = client.channel(nomCanal(salonId), {
      config: { broadcast: { self: false }, presence: { key: moi.membreId } },
    });
    canal = c;
    c.on("broadcast", { event: EVENEMENT }, ({ payload }) => {
      const evenement = lireEvenement(payload);
      if (evenement) rappels.surEvenement?.(evenement);
    });
    c.on("presence", { event: "sync" }, () => rappels.surPresents?.(presentsDe(c)));
    c.subscribe((statut) => {
      if (ferme || c !== canal) return;
      if (statut === "SUBSCRIBED") {
        tentative = 0;
        rappels.surEtat?.("connecte");
        void c.track(moi);
      } else {
        // Coupure réseau, veille du téléphone… : on repart sur un canal neuf, avec un délai croissant.
        tentative += 1;
        rappels.surEtat?.("reconnexion");
        canal = null;
        void client.removeChannel(c);
        clearTimeout(minuteur);
        minuteur = setTimeout(() => { if (!ferme) abonner(); }, delaiReconnexion(tentative));
      }
    });
  };
  abonner();

  return {
    async envoyer(evenement) {
      if (!canal) return;
      await canal.send({ type: "broadcast", event: EVENEMENT, payload: evenement });
    },
    presents: () => (canal ? presentsDe(canal) : []),
    async fermer() {
      ferme = true;
      clearTimeout(minuteur);
      rappels.surEtat?.("ferme");
      if (canal) await client.removeChannel(canal);
      canal = null;
    },
  };
}
