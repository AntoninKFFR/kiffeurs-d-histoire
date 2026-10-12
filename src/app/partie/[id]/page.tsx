import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { finishGame, nextQuestion, submitAnswer, submitPeriodAnswer } from "@/app/solo/actions";
import { Bilan } from "@/components/partie/Bilan";
import { Partie } from "@/components/partie/Partie";
import { PartieInverse } from "@/components/partie/PartieInverse";
import { getAccount } from "@/lib/account";
import { estInverse } from "@/lib/game/partie";
import { bornesDe, lireChoix } from "@/lib/solo/choix";
import { chargerPacksJouables } from "@/app/solo/packs";

function Indisponible({ titre, texte }: { titre: string; texte: string }) {
  return (
    <main className="conteneur grid flex-1 grid-cols-1 content-start gap-3 py-12">
      <h1 className="text-3xl">{titre}</h1>
      <p className="m-0 text-encre-douce">{texte}</p>
      <Link href="/" className="font-bold underline underline-offset-4">
        Lancer une nouvelle partie
      </Link>
    </main>
  );
}

// Joue une partie solo : la question en cours, sa correction, puis le bilan.
// Au rechargement, `nextQuestion` rend la question en cours avec son chrono d'origine, ou `null` quand tout est répondu.
export default async function PartiePage({ params, searchParams }: PageProps<"/partie/[id]">) {
  const { id } = await params;
  const { n, c } = await searchParams;
  const account = await getAccount();
  // Choix d'origine de la partie, rejoué tel quel par « Rejouer » (relu et validé par l'action).
  const relance = typeof c === "string" ? c : undefined;
  // La frise se limite à la période du choix (pack, thème, chapitres…), à 10 ans près.
  const choix = relance ? lireChoix(new URLSearchParams(relance)) : null;
  let bornes = choix ? bornesDe(choix) : null;
  if (choix?.mode === "pack" && choix.pack) {
    try {
      const [pack] = await chargerPacksJouables(choix.niveau ?? 1, Boolean(choix.sens), choix.pack, Boolean(choix.expertOnly));
      if (pack?.b) {
        const [debut, fin] = pack.b;
        const milieu = (debut + fin) / 2;
        bornes = fin - debut >= 30 ? { debut, fin }
          : { debut: Math.max(-3500, milieu - 15), fin: Math.min(2030, milieu + 15) };
      }
    } catch { /* Une lecture du catalogue échouée ne bloque pas la reprise de partie. */ }
  }
  const requete = new URLSearchParams();
  if (typeof n === "string") requete.set("n", n);
  if (relance) requete.set("c", relance);
  const suite = `/partie/${id}${requete.size ? `?${requete}` : ""}`;
  if (account && !account.username) redirect(`/profil?next=${encodeURIComponent(suite)}`);
  const anonyme = (await cookies()).has(`histoire-solo-${id}`);

  // Le nombre de questions ne sert qu'à l'affichage (« 4 sur 10 ») : le serveur décide de la fin.
  const total = Math.min(100, Math.max(1, Number.parseInt(typeof n === "string" ? n : "", 10) || 10));

  let question;
  try {
    question = await nextQuestion(id);
  } catch {
    return <Indisponible titre="Partie indisponible" texte="Cette partie est inaccessible ou expirée." />;
  }

  if (question && estInverse(question)) {
    return (
      <main className="flex flex-1 flex-col">
        <PartieInverse
          gameId={id}
          total={total}
          question={question}
          actions={{ soumettre: submitAnswer, suivante: nextQuestion, terminer: finishGame }}
          connecte={Boolean(account)}
          anonyme={anonyme}
          relance={relance}
          bornes={bornes}
        />
      </main>
    );
  }

  if (question) {
    return (
      <main className="flex flex-1 flex-col">
        <Partie
          gameId={id}
          total={total}
          question={question}
          actions={{ soumettre: submitAnswer, soumettrePeriode: submitPeriodAnswer, suivante: nextQuestion, terminer: finishGame }}
          connecte={Boolean(account)}
          anonyme={anonyme}
          relance={relance}
          bornes={bornes}
        />
      </main>
    );
  }

  let resultat;
  try {
    resultat = await finishGame(id);
  } catch {
    return <Indisponible titre="Bilan indisponible" texte="Cette partie est inaccessible ou expirée." />;
  }
  return (
    <main className="flex flex-1 flex-col">
      <Bilan resultat={resultat} connecte={Boolean(account)} anonyme={anonyme} relance={relance} />
    </main>
  );
}
