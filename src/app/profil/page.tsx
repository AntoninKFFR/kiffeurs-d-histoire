import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountForm from "@/components/AccountForm";
import { getAccount } from "@/lib/account";
import { safeNextPath } from "@/lib/authRedirect";
import { signOut } from "@/app/connexion/actions";
import { Sceau } from "@/components/charte/Sceau";
import { Historique } from "@/components/profil/Historique";
import { Statistiques } from "@/components/profil/Statistiques";
import styles from "@/components/profil/Profil.module.css";
import { chargerHistorique, chargerStatistiques } from "@/lib/profil/serveur";
import { lireProgressionJoueur } from "@/lib/progression/serveur";
import { cursorValide } from "@/lib/profil/types";
import { ReessayerCarnet } from "@/components/profil/ReessayerCarnet";
import { accesAdministrateur } from "@/lib/admin-packs/serveur";

export const metadata = {
  title: "Mon profil · Kiffeurs d’Histoire",
  robots: { index: false, follow: false },
};

async function Carnet({
  statistiques,
  cursor,
  next,
}: {
  statistiques: boolean;
  cursor: string | null;
  next: string;
}) {
  const result = await (
    statistiques
      ? Promise.all([
          chargerStatistiques(),
          // La progression pédagogique ne bloque pas le carnet : indisponible, elle le dit seule.
          lireProgressionJoueur().catch(() => null),
        ]).then(([data, progression]) => ({ kind: "stats" as const, data, progression }))
      : chargerHistorique(cursor).then((data) => ({
          kind: "history" as const,
          data,
        }))
  ).catch(() => null);
  if (!result) {
    return (
      <div role="alert" className="py-6">
        <h2 className={styles.heading}>
          Ton carnet est momentanément indisponible.
        </h2>
        <p>
          Tes parties restent sauvegardées. Réessaie dans quelques instants.
        </p>
        <ReessayerCarnet />
      </div>
    );
  }
  return result.kind === "stats" ? (
    <Statistiques data={result.data} progression={result.progression} />
  ) : (
    <Historique data={result.data} cursor={cursor} next={next} />
  );
}

export default async function ProfilPage({
  searchParams,
}: PageProps<"/profil">) {
  const { next, onglet, curseur } = await searchParams;
  const destination = typeof next === "string" ? safeNextPath(next) : "/profil";
  const account = await getAccount();
  const statistiques = onglet === "statistiques";
  const cursor = cursorValide(curseur);
  const returnQuery = new URLSearchParams();
  if (statistiques) returnQuery.set("onglet", "statistiques");
  if (cursor) returnQuery.set("curseur", cursor);
  if (destination !== "/profil") returnQuery.set("next", destination);
  const returnPath = `/profil${returnQuery.size ? `?${returnQuery}` : ""}`;
  if (!account) redirect(`/connexion?next=${encodeURIComponent(returnPath)}`);
  const admin = await accesAdministrateur();
  const historyHref =
    destination === "/profil"
      ? "/profil"
      : `/profil?next=${encodeURIComponent(destination)}`;
  const statsHref = `/profil?onglet=statistiques${destination === "/profil" ? "" : `&next=${encodeURIComponent(destination)}`}`;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Sceau taille={64} />
        <div className="min-w-0">
          <p className="inventaire">Cabinet personnel</p>
          <h1 className={styles.title}>{account.username ?? "Ton profil"}</h1>
          <p className={styles.muted}>
            Tes parties, tes repères, ton histoire.
          </p>
        </div>
      </header>
      {!account.username && (
        <section
          className={`${styles.paper} mb-5`}
          aria-labelledby="pseudo-titre"
        >
          <h2 id="pseudo-titre" className={styles.heading}>
            Choisis ton pseudo pour sauvegarder tes parties.
          </h2>
          <p className="mb-4">Il sera aussi utilisé dans KFFR Contrée.</p>
          <div className="max-w-sm">
            <AccountForm kind="profile" username="" next={destination} />
          </div>
        </section>
      )}
      <div className={styles.paper}>
        <nav aria-label="Rubriques du profil" className={styles.tabs}>
          <Link
            className={styles.tab}
            href={historyHref}
            aria-current={!statistiques ? "page" : undefined}
          >
            Historique
          </Link>
          <Link
            className={styles.tab}
            href={statsHref}
            aria-current={statistiques ? "page" : undefined}
          >
            Statistiques
          </Link>
        </nav>
        <Suspense
          key={`${statistiques}-${cursor}`}
          fallback={
            <p role="status" className="py-8">
              Ouverture de ton carnet…
            </p>
          }
        >
          <Carnet
            statistiques={statistiques}
            cursor={cursor}
            next={destination}
          />
        </Suspense>
      </div>
      {admin && <section className={`${styles.paper} mt-5`} aria-labelledby="espace-admin-titre">
        <p className="inventaire">Cabinet de l’équipe</p>
        <h2 id="espace-admin-titre" className={styles.heading}>Mon espace administrateur</h2>
        <nav aria-label="Administration" className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link href="/admin/indicateurs" prefetch={false} className="rounded border border-filet p-4 text-oxyde underline">Indicateurs et statistiques</Link>
          <Link href="/admin/packs" prefetch={false} className="rounded border border-filet p-4 text-oxyde underline">Gestion des packs et questions</Link>
        </nav>
      </section>}
      <details className={`${styles.paper} ${styles.account}`}>
        <summary>Ton compte KFFR</summary>
        <div className={styles.accountBody}>
          <p>Email : {account.user.email}</p>
          {account.username && (
            <>
              <p>Le nouveau pseudo sera aussi utilisé dans KFFR Contrée.</p>
              <AccountForm
                kind="profile"
                username={account.username}
                next={destination}
              />
            </>
          )}
          <form action={signOut}>
            <button type="submit" className={styles.link}>
              Déconnexion
            </button>
          </form>
        </div>
      </details>
    </main>
  );
}
