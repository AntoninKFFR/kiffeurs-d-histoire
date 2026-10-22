"use client";

// État du chat d'un salon (#138) : messages récents, limites anti-spam à l'envoi et à la réception,
// joueurs masqués (pour soi seulement, le temps de la visite).
import { useCallback, useEffect, useRef, useState } from "react";
import { estDansLeCatalogue } from "@/lib/multi/chat-catalogue";
import { chatAutorise, DUREE_BULLE, nettoyerEnvois, type MessageChat } from "@/lib/multi/chat";
import type { ChatSalon } from "./EcranSalon";

const GARDES = 20;

export function useChatSalon(moi: string, diffuser: (id: string) => void) {
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [masques, setMasques] = useState<ReadonlySet<string>>(new Set());
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const envois = useRef<number[]>([]);
  const recus = useRef(new Map<string, number[]>());

  // Les bulles s'effacent seules : un rendu une fois la dernière arrivée expirée.
  useEffect(() => {
    const dernier = messages.at(-1);
    if (!dernier) return;
    const reste = dernier.recu + DUREE_BULLE - Date.now();
    if (reste <= 0) return;
    const t = setTimeout(() => setMaintenant(Date.now()), reste + 50);
    return () => clearTimeout(t);
  }, [messages]);

  const ajouter = useCallback((membreId: string, id: string) => {
    const recu = Date.now();
    setMaintenant(recu);
    setMessages((l) => [...l, { cle: `${membreId}-${recu}`, membreId, id, recu }].slice(-GARDES));
  }, []);

  const recevoir = useCallback((membreId: string, id: string) => {
    if (membreId === moi || !estDansLeCatalogue(id)) return;
    const t = Date.now();
    const deja = nettoyerEnvois(recus.current.get(membreId) ?? [], t);
    if (!chatAutorise(deja, t)) return; // Client trop bavard (ou modifié) : ignoré.
    recus.current.set(membreId, [...deja, t]);
    ajouter(membreId, id);
  }, [moi, ajouter]);

  const salon: ChatSalon = {
    messages,
    masques,
    dire: (id) => {
      const t = Date.now();
      envois.current = nettoyerEnvois(envois.current, t);
      if (!chatAutorise(envois.current, t)) return "Doucement : un message par seconde.";
      envois.current.push(t);
      diffuser(id);
      ajouter(moi, id);
      return null;
    },
    masquer: (membreId, oui) => setMasques((m) => {
      const suivant = new Set(m);
      if (oui) suivant.add(membreId); else suivant.delete(membreId);
      return suivant;
    }),
  };

  return { salon, recevoir, maintenant };
}
