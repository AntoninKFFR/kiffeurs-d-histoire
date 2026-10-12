"use client";

import { useEffect, useRef, useState } from "react";
import { enregistrerTestChapitre } from "@/app/apprendre/actions";
import { noterTestSession } from "@/lib/progression/session";
import { pourcentage } from "@/lib/profil/types";
import type { SoloDifficulty } from "@/lib/game/solo";

type Props = {
  chapitre: string;
  partie: string;
  precision: number;
  difficulte: SoloDifficulty;
  edition?: string;
  connecte: boolean;
  /** Partie jouée sans compte, en cours de rattachement au compte connecté : on attend la fin de la sauvegarde. */
  anonyme: boolean;
};

// Enregistre le résultat d'un test de chapitre, une seule fois : dans le compte (le serveur relit la précision
// dans la partie terminée), ou dans la session du navigateur sans compte.
export function EnregistrerTest({ chapitre, partie, precision, difficulte, edition, connecte, anonyme }: Props) {
  const [message, setMessage] = useState<string>();
  const fait = useRef<string>(null);
  useEffect(() => {
    if (connecte && anonyme) return;
    if (fait.current === partie) return;
    fait.current = partie;
    if (!connecte) {
      const meilleur = noterTestSession(chapitre, partie, precision, difficulte,edition);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- message affiché une fois, après lecture du stockage de session
      setMessage(meilleur ? "Nouveau meilleur test de ce chapitre, gardé tant que cet onglet reste ouvert." : "Résultat gardé tant que cet onglet reste ouvert.");
      return;
    }
    enregistrerTestChapitre(partie).then((r) => {
      setMessage(r.erreur ? "Ton résultat n'a pas pu être ajouté à ta progression. Recharge la page pour réessayer."
        : r.meilleur ? `Nouveau meilleur test de ce chapitre : ${pourcentage(r.precision ?? null)}.`
        : `Progression enregistrée. Ton meilleur test de ce chapitre reste à ${pourcentage(r.precision ?? null)}.`);
    }).catch(() => setMessage("Ton résultat n'a pas pu être ajouté à ta progression. Recharge la page pour réessayer."));
  }, [chapitre, partie, precision, difficulte, edition, connecte, anonyme]);
  if (connecte && anonyme) return null;
  return <p role="status" className="m-0 border border-sauge bg-vert-de-gris px-4 py-3">{message ?? "Enregistrement de ton résultat…"}</p>;
}
