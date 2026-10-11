"use client";

import { useEffect, useState } from "react";
import { compterQuestions } from "@/app/solo/disponibilite";
import { ecrireChoix, nombreQuestions, type Choix, type Comptes, type Longueur } from "@/lib/solo/choix";
import styles from "./choix.module.css";

export function useDisponibilite(choix: Choix | null) {
  // Précision et longueur ne modifient pas les trois décomptes ; pas de requête à chaque clic.
  const cle = choix ? ecrireChoix({ ...choix, difficulte: "YEAR", longueur: undefined, periodes: undefined }) : null;
  const [lecture, setLecture] = useState<{ cle: string; comptes?: Comptes; erreur?: boolean }>();
  const [tentative, reessayer] = useState(0);
  useEffect(() => {
    if (!cle) return;
    let actif = true;
    const timer = setTimeout(() => {
      compterQuestions(cle).then((comptes) => { if (actif) setLecture({ cle, comptes }); })
        .catch(() => { if (actif) setLecture({ cle, erreur: true }); });
    }, 180);
    return () => { actif = false; clearTimeout(timer); };
  }, [cle, tentative]);
  const actuelle = lecture?.cle === cle ? lecture : undefined;
  return { comptes: actuelle?.comptes ?? null, erreur: actuelle?.erreur ?? false,
    reessayer: () => { setLecture(undefined); reessayer((n) => n + 1); } };
}

export function LongueurPartie({ valeur, disponibles, erreur, reessayer, onChange }: {
  valeur: Longueur; disponibles: number | null; erreur: boolean; reessayer: () => void; onChange: (v: Longueur) => void;
}) {
  return <>
    <div className={`${styles.difficultes} ${styles.longueurs}`} role="group" aria-label="Longueur de la partie">
      {([5, 10, 20, "tout"] as const).map((v) => {
        const n = nombreQuestions(v, disponibles);
        return <button key={v} className={styles.difficulte} type="button" aria-pressed={valeur === v}
          disabled={n === null} onClick={() => onChange(v)}>
          <b>{v === "tout" ? "Tout" : `${v} questions`}</b>
          <small>{v === "tout" ? n === null ? "100 questions au maximum" : `${n} question${n > 1 ? "s" : ""}${disponibles! > 100 ? " · maximum 100" : ""}` : n === null && disponibles !== null ? "Pas assez de questions" : v === 10 ? "La partie classique" : v === 5 ? "Quelques repères" : "Une longue traversée"}</small>
        </button>;
      })}
    </div>
    <p role={erreur ? "alert" : "status"} className="m-0 text-sm text-encre-douce">
      {erreur ? <>Décompte indisponible. <button type="button" className="cible underline" onClick={reessayer}>Réessayer</button></>
        : disponibles === null ? "Vérification des questions jouables…"
        : `${disponibles} question${disponibles > 1 ? "s" : ""} réellement jouable${disponibles > 1 ? "s" : ""}.`}
    </p>
  </>;
}
