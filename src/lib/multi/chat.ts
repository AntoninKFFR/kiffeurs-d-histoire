// Chat restreint du salon (#138) : seulement des identifiants du catalogue (#132), avec une limite anti-spam
// appliquée deux fois : à l'envoi, et à la réception pour chaque joueur (un client modifié ne peut pas inonder).
import { EMOTES, PHRASES, type Emote, type Phrase } from "./chat-catalogue";

/** Au plus 1 message par seconde et 5 par 10 secondes. */
export const LIMITES_CHAT = [{ fenetre: 1_000, max: 1 }, { fenetre: 10_000, max: 5 }] as const;

/** Durée d'affichage d'une bulle près du joueur. */
export const DUREE_BULLE = 4_000;

/** Vrai si un message envoyé à l'instant `maintenant` respecte les limites, vu les envois précédents (horodatages). */
export function chatAutorise(envois: readonly number[], maintenant: number): boolean {
  return LIMITES_CHAT.every(({ fenetre, max }) => envois.filter((t) => maintenant - t < fenetre).length < max);
}

/** Garde seulement les horodatages encore utiles au calcul des limites. */
export function nettoyerEnvois(envois: readonly number[], maintenant: number): number[] {
  return envois.filter((t) => maintenant - t < LIMITES_CHAT[LIMITES_CHAT.length - 1].fenetre);
}

export type ElementChat = { type: "emote"; emote: Emote } | { type: "phrase"; phrase: Phrase };

export function elementChat(id: string): ElementChat | null {
  const emote = EMOTES.find((e) => e.id === id);
  if (emote) return { type: "emote", emote };
  const phrase = PHRASES.find((p) => p.id === id);
  return phrase ? { type: "phrase", phrase } : null;
}

export type MessageChat = { cle: string; membreId: string; id: string; recu: number };
