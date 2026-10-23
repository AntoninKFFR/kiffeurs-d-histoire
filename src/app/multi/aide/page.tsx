import type { Metadata } from "next";
import Link from "next/link";
import { Motif } from "@/components/charte/Motif";
import styles from "@/components/multi/aide.module.css";

export const metadata: Metadata = { title: "Jouer à plusieurs : mode d'emploi · Kiffeurs d'Histoire" };

type Fiche = { motif: string; titre: string; contenu: React.ReactNode };

// Aide « Jouer à plusieurs » (#146) : une fiche par étape, du salon au podium. Textes relus par Maxou.
const FICHES: Fiche[] = [
  { motif: "donjon", titre: "Créer un salon", contenu: <>
    <p>Il faut un compte, le même que pour KFFR Contrée. Dans « Jouer à plusieurs », choisis <b>Convivial</b> (de 2 à
      10 joueurs) ou <b>1 contre 1</b>, puis « Créer le salon ».</p>
    <p>Tu deviens l&apos;hôte (♛) : tu règles la partie et c&apos;est toi qui la lances.</p>
  </> },
  { motif: "parchemin", titre: "Inviter tes amis", contenu: <>
    <p>Chaque salon a un <b>code en forme de date</b>, par exemple 14/07/1789, et un lien d&apos;invitation. Envoie
      l&apos;un ou l&apos;autre : tes amis tapent le code dans « Rejoindre avec un code » ou ouvrent le lien.</p>
    <p>Un salon <b>ouvert</b> apparaît aussi dans « Parties ouvertes », pour les joueurs qui ont un compte.</p>
  </> },
  { motif: "plume", titre: "Sans compte", contenu: <>
    <p>On peut rejoindre un salon sans compte, avec un pseudo choisi pour l&apos;occasion, mais seulement par code ou
      par lien. Le 1 contre 1 et les parties ouvertes demandent un compte.</p>
    <p>Arrivé pendant une partie ? Tu attends la suivante : l&apos;hôte t&apos;accepte ou te refuse.</p>
  </> },
  { motif: "ecu", titre: "Les réglages de l'hôte", contenu: <ul>
    <li>5, 10 ou 20 questions, précision à l&apos;année, au mois ou au jour, questions « période » ou non.</li>
    <li><b>Mode visible</b> : on voit où les autres se placent sur la frise. Par défaut, c&apos;est invisible.</li>
    <li><b>Mode chrono</b> : dès que quelqu&apos;un répond, les autres n&apos;ont plus que 10 secondes.</li>
  </ul> },
  { motif: "boussole", titre: "Sur quoi joue-t-on ?", contenu: <ul>
    <li><b>L&apos;hôte choisit</b> un pack, une période ou un thème.</li>
    <li><b>Mystère</b> : la roulette tire au sort, la même pour tout le salon.</li>
    <li><b>Vote</b> (Convivial) : trois propositions, 15 secondes pour voter. En cas d&apos;égalité, la roulette tranche.</li>
    <li><b>Pick &amp; ban</b> (1 contre 1) : sept propositions ; chacun en bannit une à son tour, en 10 secondes.
      La dernière est jouée.</li>
  </ul> },
  { motif: "globe", titre: "Une question", contenu: <>
    <p>30 secondes pour placer la date : clique sur la frise ou tape-la dans les cases. Dès que tout le monde a validé,
      on découvre les réponses de chacun, puis la bonne date, puis le classement bouge.</p>
    <p>Les points se comptent comme en solo : plus tu es près et rapide, plus tu marques.</p>
  </> },
  { motif: "couronne", titre: "Fin de partie", contenu: <>
    <p>Le podium, le classement final, le coup de maître et le plus gros raté de la partie. Puis tout le monde revient
      dans le salon pour une revanche.</p>
  </> },
  { motif: "journal", titre: "Discuter", contenu: <>
    <p>Pas de texte libre : des <b>émotes</b> historiques et des <b>phrases toutes faites</b>. En partie, seules les
      émotes s&apos;affichent, à côté de ton nom. Un joueur te dérange ? Tu peux le masquer, pour toi seul.</p>
    <p>Connexion coupée ? Tu as 30 secondes pour revenir avant de quitter le salon.</p>
  </> },
];

export default function AideMultiPage() {
  return <main className={styles.ecran}>
    <Link href="/multi" className={styles.retour}>← Jouer à plusieurs</Link>
    <header className={styles.titre}>
      <span className={styles.inventaire}>Jouer à plusieurs · Mode d&apos;emploi</span>
      <h1>Comment ça marche ?</h1>
    </header>
    <ol className={styles.fiches}>
      {FICHES.map((f, i) => <li key={f.titre} className={styles.fiche}>
        <span className={styles.numero}>{i + 1}</span>
        <Motif nom={f.motif} className={styles.motif} />
        <h2>{f.titre}</h2>
        <div className={styles.texte}>{f.contenu}</div>
      </li>)}
    </ol>
    <Link href="/multi" className={styles.principal}>Créer ou rejoindre un salon</Link>
  </main>;
}
