"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { creerSalon } from "@/app/multi/actions";
import styles from "./accueil.module.css";

const MODES = [
  { mode: "convivial" as const, titre: "Convivial", texte: "De 2 à 10 joueurs. Points cumulés, votes, roulette Mystère." },
  { mode: "un_contre_un" as const, titre: "1 contre 1", texte: "Un duel, avec pick & ban des thèmes, packs ou périodes." },
];

export function CreerSalon({ connecte }: { connecte: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"convivial" | "un_contre_un">("convivial");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [deplie, setDeplie] = useState(false);

  const creer = async () => {
    setEnvoi(true);
    setErreur(null);
    const r = await creerSalon(mode);
    if (r.ok) return router.push(`/multi/salon/${r.salonId}`);
    setEnvoi(false);
    setErreur(r.erreur);
  };

  return <>
  {!deplie && <button type="button" className={`${styles.principal} ${styles.creerTel}`} onClick={() => setDeplie(true)}>Créer un salon</button>}
  <section className={`${styles.boite} ${styles.creer} ${deplie ? styles.deplie : ""}`} aria-label="Créer un salon">
    <h2>Créer un salon</h2>
    <div className={styles.corps}>
      {MODES.map((m) => <button key={m.mode} type="button" className={styles.mode} aria-pressed={mode === m.mode}
        onClick={() => setMode(m.mode)}><b>{m.titre}</b><span>{m.texte}</span></button>)}
      {erreur && <p className={styles.erreur} role="alert">{erreur}</p>}
    </div>
    <div className={styles.pied}>
      {deplie && <button type="button" className={`${styles.lien} ${styles.creerTel}`} onClick={() => setDeplie(false)}>← Retour</button>}
      {connecte
        ? <button type="button" className={styles.principal} disabled={envoi} onClick={creer}>Créer mon salon</button>
        : <Link href="/connexion?next=/multi" className={styles.principal} style={{ display: "grid", placeItems: "center" }}>Se connecter</Link>}
      <span className={styles.note}>Compte requis pour créer un salon</span>
    </div>
  </section>
  </>;
}
