"use client";

// Salon branché sur la base et le temps réel (#135, #136) : état par l'action etatSalon, présence par le
// canal du salon, battement toutes les 10 s, et un avis « salon_change » diffusé après chaque modification.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ouvrirCanalSalon, type CanalSalon } from "@/lib/multi/canal";
import { demarrerBattement } from "@/lib/multi/battement";
import type { EtatSalon } from "@/lib/multi/salon";
import { useChatSalon } from "./useChatSalon";
import { accepterMembre, battementSalon, etatPartie, etatSalon, expulserMembre, lancerPartie, modifierSalon, quitterSalon, repondrePartie } from "@/app/multi/actions";
import { EcranSalon } from "./EcranSalon";
import { PartieMulti, type ActionsPartieMulti } from "./PartieMulti";

export function SalonEnDirect({ depart }: { depart: EtatSalon }) {
  const router = useRouter();
  const [etat, setEtat] = useState(depart);
  const [presents, setPresents] = useState<ReadonlySet<string>>(new Set([depart.moi]));
  const canal = useRef<CanalSalon | null>(null);
  const version = useRef(depart.salon.version);
  const salonId = depart.salon.id;
  // En partie (#140) : de son lancement jusqu'au retour au salon demandé par le joueur.
  const joue = (e: EtatSalon) => e.salon.etat === "partie" && !e.membres.find((m) => m.id === e.moi)?.en_attente;
  const [enJeu, setEnJeu] = useState(() => joue(depart));
  const [signalPartie, setSignalPartie] = useState(0);
  const chat = useChatSalon(depart.moi, (id) => void canal.current?.envoyer({ type: "chat", membreId: depart.moi, id }));
  const recevoirChat = useRef(chat.recevoir);
  useEffect(() => { recevoirChat.current = chat.recevoir; }, [chat.recevoir]);

  const perdu = useCallback(() => router.replace("/multi?erreur=salon_perdu"), [router]);
  const recharger = useCallback(async () => {
    const suivant = await etatSalon(salonId);
    if (!suivant) return perdu();
    version.current = suivant.salon.version;
    setEtat(suivant);
    if (joue(suivant)) setEnJeu(true);
  }, [salonId, perdu]);

  useEffect(() => {
    const moi = depart.membres.find((m) => m.id === depart.moi)!;
    const c = ouvrirCanalSalon(createClient(), salonId, { membreId: moi.id, pseudo: moi.pseudo }, {
      surEvenement: (e) => {
        if (e.type === "salon_change" && e.version > version.current) void recharger();
        if (e.type === "chat") recevoirChat.current(e.membreId, e.id);
        if (e.type === "partie_change") setSignalPartie((n) => n + 1);
      },
      surPresents: (liste) => setPresents(new Set(liste.map((p) => p.membreId))),
    });
    canal.current = c;
    const arreter = demarrerBattement(() => battementSalon(salonId), {
      surVersion: (v) => { if (v > version.current) void recharger(); },
      surPerdu: perdu,
    });
    return () => { arreter(); void c.fermer(); };
  }, [salonId, depart.moi, depart.membres, recharger, perdu]);

  // Après une action réussie : recharger, puis prévenir les autres pour qu'ils rechargent aussi.
  const apres = async (erreur: string | null) => {
    if (erreur) return erreur;
    await recharger();
    void canal.current?.envoyer({ type: "salon_change", version: version.current });
    return null;
  };

  const quitter = async () => {
    await quitterSalon(salonId);
    void canal.current?.envoyer({ type: "salon_change", version: version.current + 1 });
    router.replace("/multi");
  };
  const actionsPartie = useMemo<ActionsPartieMulti>(() => ({
    etat: () => etatPartie(salonId),
    repondre: (questionId, debut, fin) => repondrePartie(salonId, questionId, debut, fin),
    prevenir: () => void canal.current?.envoyer({ type: "partie_change" }),
  }), [salonId]);

  if (enJeu) {
    return <PartieMulti membres={etat.membres} presents={presents} actions={actionsPartie} signal={signalPartie}
      quitter={() => void quitter()} retour={() => { setEnJeu(false); void recharger(); }} />;
  }

  return <EcranSalon etat={etat} presents={presents} chat={chat.salon} maintenant={chat.maintenant}
    lien={`${typeof window === "undefined" ? "" : window.location.origin}/multi/salon/${salonId}`}
    actions={{
      modifier: async (changements) => {
        const r = await modifierSalon(salonId, changements);
        return apres(r.ok ? null : r.erreur);
      },
      accepter: async (membreId) => {
        const r = await accepterMembre(salonId, membreId);
        return apres(r.ok ? null : r.erreur);
      },
      expulser: async (membreId) => {
        const r = await expulserMembre(salonId, membreId);
        return apres(r.ok ? null : r.erreur);
      },
      quitter,
      lancer: async () => {
        const r = await lancerPartie(salonId);
        return apres(r.ok ? null : r.erreur);
      },
    }} />;
}
