import type { Metadata } from "next";
import Link from "next/link";
import { getAccount } from "@/lib/account";
import { partiesOuvertes } from "./actions";
import { CreerSalon } from "@/components/multi/CreerSalon";
import { RejoindreCode } from "@/components/multi/RejoindreCode";
import { PartiesOuvertes } from "@/components/multi/PartiesOuvertes";
import styles from "@/components/multi/accueil.module.css";

export const metadata: Metadata = { title: "Jouer à plusieurs · Kiffeurs d'Histoire" };

const ERREURS: Record<string, string> = {
  salon_perdu: "Tu n'es plus dans ce salon (absent trop longtemps, expulsé, ou salon fermé).",
};

// Accueil « Jouer à plusieurs » (maquettes accueil-pc et accueil-tel) : créer (#136), rejoindre avec un code
// et parties ouvertes (#137). La colonne « Amis » arrive avec #139.
export default async function MultiPage({ searchParams }: PageProps<"/multi">) {
  const { erreur } = await searchParams;
  const compte = await getAccount();
  const ouvertes = compte ? await partiesOuvertes() : null;
  return <main className={styles.ecran}>
    <Link href="/" className={styles.retour}>← Accueil</Link>
    <header className={styles.titre}>
      <span className={styles.inventaire}>Jouer à plusieurs</span>
      <h1>Défiez vos amis<span className={styles.surPc}> sur la frise</span></h1>
      <Link href="/multi/aide" className={styles.aide}>Comment ça marche&nbsp;?</Link>
    </header>
    {typeof erreur === "string" && ERREURS[erreur] && <p className={styles.erreur} role="alert">{ERREURS[erreur]}</p>}
    <div className={styles.colonnes}>
      <CreerSalon connecte={Boolean(compte)} />
      <RejoindreCode connecte={Boolean(compte)} />
      <PartiesOuvertes connecte={Boolean(compte)} depart={ouvertes} />
    </div>
  </main>;
}
