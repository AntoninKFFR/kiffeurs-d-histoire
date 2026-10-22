import type { Metadata } from "next";
import Link from "next/link";
import type { PartieOuverte } from "@/app/multi/actions";
import type { Reglages } from "@/lib/multi/salon";
import { CreerSalon } from "@/components/multi/CreerSalon";
import { RejoindreCode } from "@/components/multi/RejoindreCode";
import { PartiesOuvertes } from "@/components/multi/PartiesOuvertes";
import styles from "@/components/multi/accueil.module.css";

export const metadata: Metadata = { title: "Aperçu de « Jouer à plusieurs » · Kiffeurs d'Histoire", robots: { index: false, follow: false } };

const r = (choix: Reglages["contenu"]["choix"], cible: Reglages["contenu"]["cible"], questions: 5 | 10 | 20, precision: Reglages["precision"]): Reglages =>
  ({ questions, precision, questions_periode: true, mode_visible: false, mode_chrono: false, contenu: { choix, categories: ["pack", "theme"], cible } });

const EXEMPLES: PartieOuverte[] = [
  { id: "00000000-0000-4000-8000-000000000001", hote: "Hugo", mode: "convivial", reglages: r("direct", { type: "periode", id: "xixe" }, 10, "YEAR"), joueurs: 5, max_joueurs: 8, etat: "attente", moi: false },
  { id: "00000000-0000-4000-8000-000000000002", hote: "Inès", mode: "convivial", reglages: r("mystere", null, 20, "MONTH"), joueurs: 2, max_joueurs: 6, etat: "attente", moi: false },
  { id: "00000000-0000-4000-8000-000000000003", hote: "Paul", mode: "un_contre_un", reglages: r("pick_ban", null, 10, "YEAR"), joueurs: 1, max_joueurs: 2, etat: "attente", moi: false },
  { id: "00000000-0000-4000-8000-000000000004", hote: "Lulu_1515", mode: "convivial", reglages: r("vote", null, 10, "YEAR"), joueurs: 6, max_joueurs: 8, etat: "partie", moi: false },
];

// Aperçu de l'accueil multijoueur avec des salons fictifs : ?compte=0 pour la vue d'un invité.
export default async function ApercuMulti({ searchParams }: PageProps<"/apercu/multi">) {
  const { compte } = await searchParams;
  const connecte = compte !== "0";
  return <main className={styles.ecran}>
    <Link href="/apercu" className={styles.retour}>← Accueil</Link>
    <header className={styles.titre}>
      <span className={styles.inventaire}>Jouer à plusieurs</span>
      <h1>Défiez vos amis<span className={styles.surPc}> sur la frise</span></h1>
    </header>
    <div className={styles.colonnes}>
      <CreerSalon connecte={connecte} />
      <RejoindreCode connecte={connecte} />
      <PartiesOuvertes connecte={connecte} depart={connecte ? EXEMPLES : null} />
    </div>
  </main>;
}
