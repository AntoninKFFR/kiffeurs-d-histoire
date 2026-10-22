"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PartieMulti, type ActionsPartieMulti } from "@/components/multi/PartieMulti";
import type { MembreSalon } from "@/lib/multi/salon";
import { creerSimulation } from "./simulation";

const MEMBRES: MembreSalon[] = [
  { id: "m1", pseudo: "Maxou", est_hote: true, invite: false, ordre: 1, en_attente: false },
  { id: "m2", pseudo: "Antonin", est_hote: false, invite: false, ordre: 2, en_attente: false },
  { id: "m3", pseudo: "Lulu_1515", est_hote: false, invite: false, ordre: 3, en_attente: false },
  { id: "m4", pseudo: "Clément", est_hote: false, invite: true, ordre: 4, en_attente: false },
  { id: "m5", pseudo: "Sarah", est_hote: false, invite: true, ordre: 5, en_attente: false },
];

// Partie de 5 questions contre des joueurs fictifs ; ?chrono=1 active le mode chrono. Rien n'est envoyé.
export function ApercuPartieMulti({ chrono }: { chrono: boolean }) {
  const [partie, setPartie] = useState(0);
  return <PartieSimulee key={partie} chrono={chrono} rejouer={() => setPartie((n) => n + 1)} />;
}

function PartieSimulee({ chrono, rejouer }: { chrono: boolean; rejouer: () => void }) {
  const router = useRouter();
  const simulation = useMemo(() => creerSimulation({ chrono }), [chrono]);
  const [signal, setSignal] = useState(0);
  const actions = useMemo<ActionsPartieMulti>(() => ({
    etat: async () => simulation.etat(Date.now()),
    repondre: async (id, debut, fin) => simulation.repondre(id, debut, fin, Date.now()),
    prevenir: () => setSignal((n) => n + 1),
  }), [simulation]);
  return <PartieMulti membres={MEMBRES} presents={new Set(["m1", "m2", "m3", "m4"])} actions={actions} signal={signal}
    quitter={() => router.push("/apercu")} retour={rejouer} />;
}
