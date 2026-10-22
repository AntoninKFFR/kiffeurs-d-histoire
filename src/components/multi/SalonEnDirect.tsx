"use client";

// Salon branché sur la base et le temps réel (#135, #136) : état par l'action etatSalon, présence par le
// canal du salon, battement toutes les 10 s, et un avis « salon_change » diffusé après chaque modification.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ouvrirCanalSalon, type CanalSalon } from "@/lib/multi/canal";
import { demarrerBattement } from "@/lib/multi/battement";
import type { EtatSalon } from "@/lib/multi/salon";
import { accepterMembre, battementSalon, etatSalon, expulserMembre, modifierSalon, quitterSalon } from "@/app/multi/actions";
import { EcranSalon } from "./EcranSalon";

export function SalonEnDirect({ depart }: { depart: EtatSalon }) {
  const router = useRouter();
  const [etat, setEtat] = useState(depart);
  const [presents, setPresents] = useState<ReadonlySet<string>>(new Set([depart.moi]));
  const canal = useRef<CanalSalon | null>(null);
  const version = useRef(depart.salon.version);
  const salonId = depart.salon.id;

  const perdu = useCallback(() => router.replace("/multi?erreur=salon_perdu"), [router]);
  const recharger = useCallback(async () => {
    const suivant = await etatSalon(salonId);
    if (!suivant) return perdu();
    version.current = suivant.salon.version;
    setEtat(suivant);
  }, [salonId, perdu]);

  useEffect(() => {
    const moi = depart.membres.find((m) => m.id === depart.moi)!;
    const c = ouvrirCanalSalon(createClient(), salonId, { membreId: moi.id, pseudo: moi.pseudo }, {
      surEvenement: (e) => { if (e.type === "salon_change" && e.version > version.current) void recharger(); },
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

  return <EcranSalon etat={etat} presents={presents}
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
      quitter: async () => {
        await quitterSalon(salonId);
        void canal.current?.envoyer({ type: "salon_change", version: version.current + 1 });
        router.replace("/multi");
      },
      // Branché sur la partie avec #140.
      lancer: async () => "Le lancement de la partie arrive bientôt.",
    }} />;
}
