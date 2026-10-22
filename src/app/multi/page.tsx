import type { Metadata } from "next";
import Link from "next/link";
import { getAccount } from "@/lib/account";
import { CreerSalon } from "@/components/multi/CreerSalon";
import styles from "@/components/multi/accueil.module.css";

export const metadata: Metadata = { title: "Jouer à plusieurs · Kiffeurs d'Histoire" };

const ERREURS: Record<string, string> = {
  salon_perdu: "Tu n'es plus dans ce salon (absent trop longtemps, expulsé, ou salon fermé).",
};

// Accueil « Jouer à plusieurs » (maquette accueil-pc) : la colonne « Créer un salon » (#136).
// « Rejoindre avec un code » et « Parties ouvertes » arrivent avec #137, « Amis » avec #139.
export default async function MultiPage({ searchParams }: PageProps<"/multi">) {
  const { erreur } = await searchParams;
  const compte = await getAccount();
  return <main className={styles.ecran}>
    <Link href="/" className={styles.retour}>← Accueil</Link>
    <header className={styles.titre}>
      <span className={styles.inventaire}>Jouer à plusieurs</span>
      <h1>Défiez vos amis sur la frise</h1>
    </header>
    {typeof erreur === "string" && ERREURS[erreur] && <p className={styles.erreur} role="alert">{ERREURS[erreur]}</p>}
    <div className={styles.colonnes}>
      <CreerSalon connecte={Boolean(compte)} />
    </div>
  </main>;
}
