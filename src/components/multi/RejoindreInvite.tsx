"use client";

// Entrée par le lien d'invitation (#134, #136) : un invité choisit son pseudo pour la partie.
// Même champ que la colonne « Rejoindre avec un code » de la maquette d'accueil.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rejoindreParLien } from "@/app/multi/actions";
import { refusPseudoInvite } from "@/lib/multi/salon";
import styles from "./accueil.module.css";

export function RejoindreInvite({ salonId, erreur: erreurDepart, compte = false }: { salonId: string | null; erreur?: string; compte?: boolean }) {
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [erreur, setErreur] = useState(erreurDepart ?? null);
  const [envoi, setEnvoi] = useState(false);

  const rejoindre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;
    const refus = refusPseudoInvite(pseudo);
    if (refus) return setErreur(refus);
    setEnvoi(true);
    const r = await rejoindreParLien(salonId, pseudo);
    if (r.ok) return router.refresh();
    setEnvoi(false);
    setErreur(r.erreur);
  };

  return <main className={styles.ecran}>
    <Link href="/" className={styles.retour}>← Accueil</Link>
    <header className={styles.titre}>
      <span className={styles.inventaire}>Jouer à plusieurs</span>
      <h1>Rejoindre un salon</h1>
    </header>
    <form className={`${styles.boite} ${styles.seul}`} onSubmit={rejoindre}>
      <h2>Invitation</h2>
      <div className={styles.corps}>
        {salonId && !compte && <label className={styles.champ}>
          Votre pseudo pour la partie (sans compte)
          <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={16} autoComplete="nickname" autoFocus required />
        </label>}
        {erreur && <p className={styles.erreur} role="alert">{erreur}</p>}
      </div>
      <div className={styles.pied}>
        {salonId && !compte
          ? <button type="submit" className={styles.principal} disabled={envoi}>Rejoindre</button>
          : <Link href="/multi" className={styles.principal} style={{ display: "grid", placeItems: "center" }}>Jouer à plusieurs</Link>}
        {!compte && <span className={styles.note}>Avec un compte, tu entres directement avec ton pseudo. <Link href={salonId ? `/connexion?next=/multi/salon/${salonId}` : "/connexion?next=/multi"}>Se connecter</Link></span>}
      </div>
    </form>
  </main>;
}
