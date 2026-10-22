"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PartieMulti, type ActionsPartieMulti, type CurseurJoueur } from "@/components/multi/PartieMulti";
import type { MembreSalon } from "@/lib/multi/salon";
import { creerSimulation, joueursSimules } from "./simulation";

const PSEUDOS = ["Maxou", "Antonin", "Lulu_1515", "Clément", "Sarah", "Hugo", "Inès", "Jules", "Chloé", "Nora"];
const membres = (dix: boolean): MembreSalon[] => joueursSimules(dix).map((id, k) => ({
  id, pseudo: PSEUDOS[k], est_hote: k === 0, invite: k === 3 || k === 4, ordre: k + 1, en_attente: false,
}));

type Options = { chrono: boolean; visible: boolean; dix: boolean };

// Partie de 5 questions contre des joueurs fictifs. ?chrono=1 : mode chrono ; ?visible=1 : mode visible ;
// ?joueurs=10 : dix joueurs (mesure de fluidité du mode visible). Rien n'est envoyé.
export function ApercuPartieMulti(options: Options) {
  const [partie, setPartie] = useState(0);
  return <PartieSimulee key={partie} {...options} rejouer={() => setPartie((n) => n + 1)} />;
}

function PartieSimulee({ chrono, visible, dix, rejouer }: Options & { rejouer: () => void }) {
  const router = useRouter();
  const simulation = useMemo(() => creerSimulation({ chrono, dix }), [chrono, dix]);
  const [signal, setSignal] = useState(0);
  const actions = useMemo<ActionsPartieMulti>(() => ({
    etat: async () => simulation.etat(Date.now()),
    repondre: async (id, debut, fin) => simulation.repondre(id, debut, fin, Date.now()),
    prevenir: () => setSignal((n) => n + 1),
    curseur: () => {},
    bilan: async () => simulation.bilan(Date.now()),
  }), [simulation]);
  // Les joueurs fictifs envoient leur curseur 10 fois par seconde, comme le ferait le canal.
  const abonnerCurseurs = useCallback((recevoir: (c: CurseurJoueur) => void) => {
    const id = setInterval(() => {
      for (const c of simulation.curseurs(Date.now())) {
        recevoir({ membreId: c.membreId, question: c.question, debut: { year: c.annee, month: null, day: null },
          fin: c.fin != null ? { year: c.fin, month: null, day: null } : null });
      }
    }, 100);
    return () => clearInterval(id);
  }, [simulation]);
  const liste = useMemo(() => membres(dix), [dix]);
  const presents = useMemo(() => new Set(liste.map((m) => m.id).filter((id) => dix || id !== "m5")), [liste, dix]);
  return <PartieMulti membres={liste} presents={presents} actions={actions} signal={signal}
    modeVisible={visible} abonnerCurseurs={abonnerCurseurs}
    quitter={() => router.push("/apercu")} retour={rejouer} />;
}
