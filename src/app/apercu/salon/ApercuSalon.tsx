"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { EcranSalon } from "@/components/multi/EcranSalon";
import { useChatSalon } from "@/components/multi/useChatSalon";
import type { EtatSalon } from "@/lib/multi/salon";

const DEPART: EtatSalon = {
  salon: {
    id: "00000000-0000-4000-8000-000000000136", code: "17/03/1642", mode: "convivial", visibilite: "prive",
    max_joueurs: 8, etat: "attente", version: 1,
    reglages: { questions: 10, precision: "YEAR", questions_periode: true, mode_visible: false, mode_chrono: false,
      contenu: { choix: "direct", categories: ["pack", "periode"], cible: { type: "periode", id: "xixe" } } },
  },
  moi: "m1",
  membres: [
    { id: "m1", pseudo: "Maxou", est_hote: true, invite: false, ordre: 1, en_attente: false },
    { id: "m2", pseudo: "Antonin", est_hote: false, invite: false, ordre: 2, en_attente: false },
    { id: "m3", pseudo: "Lulu_1515", est_hote: false, invite: false, ordre: 3, en_attente: false },
    { id: "m4", pseudo: "Clément", est_hote: false, invite: true, ordre: 4, en_attente: false },
    { id: "m5", pseudo: "Sarah", est_hote: false, invite: true, ordre: 5, en_attente: true },
  ],
};

// Aperçu de l'écran du salon avec des joueurs fictifs : les réglages changent pour de vrai, rien n'est envoyé.
export function ApercuSalon({ vue }: { vue: "hote" | "joueur" }) {
  const router = useRouter();
  const [etat, setEtat] = useState<EtatSalon>({ ...DEPART, moi: vue === "hote" ? "m1" : "m4" });
  const chat = useChatSalon(etat.moi, () => {});
  const { recevoir } = chat;
  // Quelques messages fictifs pour voir les bulles et le dernier message.
  useEffect(() => {
    const t1 = setTimeout(() => recevoir("m2", "ave-compagnons"), 300);
    const t2 = setTimeout(() => recevoir("m3", "napoleon-rire"), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [recevoir]);
  return <EcranSalon etat={etat} chat={chat.salon} maintenant={chat.maintenant} presents={new Set(["m1", "m2", "m3", "m4"])} lien="https://k-iffeur-d-histoire.vercel.app/multi/salon/exemple"
    actions={{
      modifier: async ({ reglages, visibilite, maxJoueurs }) => {
        setEtat((e) => ({ ...e, salon: { ...e.salon, version: e.salon.version + 1,
          reglages: { ...e.salon.reglages, ...reglages }, visibilite: visibilite ?? e.salon.visibilite, max_joueurs: maxJoueurs ?? e.salon.max_joueurs } }));
        return null;
      },
      accepter: async (id) => { setEtat((e) => ({ ...e, membres: e.membres.map((m) => m.id === id ? { ...m, en_attente: false } : m) })); return null; },
      expulser: async (id) => { setEtat((e) => ({ ...e, membres: e.membres.filter((m) => m.id !== id) })); return null; },
      quitter: () => router.push("/apercu"),
      lancer: async () => "Aperçu : la partie multijoueur arrive avec #140.",
    }} />;
}
