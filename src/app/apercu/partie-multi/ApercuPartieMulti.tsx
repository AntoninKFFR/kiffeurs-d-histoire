"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PartieMulti, type ActionsPartieMulti, type ChatPartie, type CurseurJoueur } from "@/components/multi/PartieMulti";
import type { MessageChat } from "@/lib/multi/chat";
import type { HabillageFin } from "@/lib/multi/bilan";
import type { MembreSalon } from "@/lib/multi/salon";
import { creerSimulation, joueursSimules } from "./simulation";

const PSEUDOS = ["Maxou", "Antonin", "Lulu_1515", "Clément", "Sarah", "Hugo", "Inès", "Jules", "Chloé", "Nora"];
const membres = (dix: boolean, duel: boolean): MembreSalon[] => joueursSimules(dix, duel).map((id, k) => ({
  id, pseudo: PSEUDOS[k], est_hote: k === 0, invite: k === 3 || k === 4, ordre: k + 1, en_attente: false,
}));

type Options = { chrono: boolean; visible: boolean; dix: boolean; fin?: HabillageFin; contenu?: "vote" | "mystere" | "pickban" };

// Partie de 5 questions contre des joueurs fictifs. ?chrono=1 : mode chrono ; ?visible=1 : mode visible ;
// ?joueurs=10 : dix joueurs (mesure de fluidité du mode visible) ; ?fin=musee ou ?fin=gazette : habillage de
// l'écran de fin (sinon celui de l'époque des questions, la gazette ici) ; ?contenu=vote ou ?contenu=mystere :
// vote des joueurs ou roulette avant la première question (#144) ; ?contenu=pickban : 1 contre 1 contre Antonin,
// avec pick & ban (#145). Rien n'est envoyé.
export function ApercuPartieMulti(options: Options) {
  const [partie, setPartie] = useState(0);
  return <PartieSimulee key={partie} {...options} rejouer={() => setPartie((n) => n + 1)} />;
}

function PartieSimulee({ chrono, visible, dix, fin, contenu, rejouer }: Options & { rejouer: () => void }) {
  const router = useRouter();
  const simulation = useMemo(() => creerSimulation({ chrono, dix, contenu }), [chrono, dix, contenu]);
  const [signal, setSignal] = useState(0);
  const actions = useMemo<ActionsPartieMulti>(() => ({
    etat: async () => simulation.etat(Date.now()),
    repondre: async (id, debut, fin) => simulation.repondre(id, debut, fin, Date.now()),
    voter: async (choix) => simulation.voter(choix, Date.now()),
    bannir: async (choix) => simulation.bannir(choix, Date.now()),
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
  // Comme le canal en vrai : on prévient dès qu'un joueur fictif fait clore une question.
  useEffect(() => {
    let vu = "";
    const id = setInterval(() => {
      const e = simulation.etat(Date.now());
      const q = e.question;
      const cle = `${q?.id}-${q?.revelee_le}-${e.partie.etat}-${e.vote?.votes.length}-${e.pick_ban?.bans.length}`;
      if (cle !== vu) setSignal((n) => n + 1);
      vu = cle;
    }, 200);
    return () => clearInterval(id);
  }, [simulation]);
  // Chat : mes émotes, et celles des joueurs fictifs (relues toutes les 500 ms).
  const [miens, setMiens] = useState<MessageChat[]>([]);
  const [leurs, setLeurs] = useState<MessageChat[]>([]);
  useEffect(() => {
    const id = setInterval(() => setLeurs(simulation.reactions(Date.now()).map((m) => ({ ...m, cle: `${m.membreId}-${m.recu}` }))), 500);
    return () => clearInterval(id);
  }, [simulation]);
  const chat = useMemo<ChatPartie>(() => ({
    messages: [...leurs, ...miens].sort((a, b) => a.recu - b.recu),
    masques: new Set(),
    dire: (id) => { const recu = Date.now(); setMiens((l) => [...l, { cle: `m1-${recu}`, membreId: "m1", id, recu }]); return null; },
  }), [leurs, miens]);
  const duel = contenu === "pickban";
  const liste = useMemo(() => membres(dix, duel), [dix, duel]);
  const presents = useMemo(() => new Set(liste.map((m) => m.id).filter((id) => dix || id !== "m5")), [liste, dix]);
  return <PartieMulti membres={liste} presents={presents} actions={actions} signal={signal}
    modeVisible={visible} abonnerCurseurs={abonnerCurseurs} habillageFin={fin} chat={chat}
    quitter={() => router.push("/apercu")} retour={rejouer} />;
}
