"use client";

// « Parties ouvertes » (#137) : salons ouverts des comptes, rafraîchis toutes les 5 s quand la page est visible.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { partiesOuvertes, rejoindreParLien, type PartieOuverte } from "@/app/multi/actions";
import { titreContenu } from "@/lib/multi/contenu";
import { LIBELLES_PRECISION } from "@/lib/multi/salon";
import styles from "./accueil.module.css";

export function PartiesOuvertes({ connecte, depart }: { connecte: boolean; depart: PartieOuverte[] | null }) {
  const router = useRouter();
  const [liste, setListe] = useState(depart);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);

  useEffect(() => {
    if (!connecte) return;
    const rafraichir = () => { if (document.visibilityState === "visible") void partiesOuvertes().then((l) => l && setListe(l)); };
    const minuteur = setInterval(rafraichir, 5000);
    document.addEventListener("visibilitychange", rafraichir);
    return () => { clearInterval(minuteur); document.removeEventListener("visibilitychange", rafraichir); };
  }, [connecte]);

  const rejoindre = async (p: PartieOuverte) => {
    if (p.moi) return router.push(`/multi/salon/${p.id}`);
    setEnvoi(p.id);
    setErreur(null);
    const r = await rejoindreParLien(p.id);
    if (r.ok) return router.push(`/multi/salon/${r.salonId}`);
    setEnvoi(null);
    setErreur(r.erreur);
  };

  return <section className={styles.boite} aria-label="Parties ouvertes">
    <h2><span>Parties ouvertes</span>{liste && <span className={styles.discret}>{liste.length} salon{liste.length > 1 ? "s" : ""}</span>}</h2>
    {!connecte
      ? <div className={styles.corps}><p className={styles.note}>Les parties ouvertes sont réservées aux joueurs avec un compte.</p>
        <Link href="/connexion?next=/multi" className={styles.lien}>Se connecter</Link></div>
      : liste === null ? <div className={styles.corps}><p className={styles.note}>Liste momentanément indisponible.</p></div>
        : liste.length === 0 ? <div className={styles.corps}><p className={styles.note}>Aucun salon ouvert pour l&apos;instant. Crée le tien et choisis « Ouvert » dans ses réglages.</p></div>
          : <ul className={styles.ouvertes}>
            {liste.map((p) => {
              const enPartie = p.etat === "partie";
              const complet = p.joueurs >= p.max_joueurs;
              return <li key={p.id} className={styles.ouverte}>
                <div>
                  <b>Salon de {p.hote ?? "…"}</b>
                  <span className={styles.note}>
                    {p.mode === "un_contre_un" ? "1 contre 1" : "Convivial"} · {titreContenu(p.reglages)}
                    <span className={styles.surPc}> · {p.reglages.questions} q. · {LIBELLES_PRECISION[p.reglages.precision]}</span>
                    <span className={styles.surTelephone}> · {p.joueurs}/{p.max_joueurs}</span>
                    {enPartie && <b className={styles.enCours}> · partie en cours</b>}
                  </span>
                  <span className={`${styles.places} ${styles.surPc}`} aria-label={`${p.joueurs} joueurs sur ${p.max_joueurs}`}>
                    {Array.from({ length: p.max_joueurs }, (_, i) => <i key={i} className={i < p.joueurs ? "" : styles.libre} />)}
                  </span>
                </div>
                <button type="button" disabled={envoi !== null || (complet && !p.moi)} onClick={() => rejoindre(p)}>
                  {p.moi ? "Revenir" : complet ? "Complet" : enPartie ? "Attendre" : <><span className={styles.surPc}>Rejoindre</span><span className={styles.surTelephone}>Go</span></>}
                </button>
              </li>;
            })}
          </ul>}
    {erreur && <p className={`${styles.erreur} ${styles.corps}`} role="alert">{erreur}</p>}
  </section>;
}
