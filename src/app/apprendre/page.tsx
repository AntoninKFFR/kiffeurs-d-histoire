import type { Metadata } from "next";
import { CHAPITRES_ACTIFS } from "@/lib/apprendre/catalogue";
import { ChoisirChapitre } from "@/components/pedagogie/ChoisirChapitre";

export const metadata: Metadata = { title: "Découvrir un chapitre · Kiffeurs d’Histoire" };
export const dynamic = "force-static";

export default function Apprendre() {
  return <main className="conteneur grid flex-1 content-start gap-8 py-8">
    <header className="grid gap-3">
      <span className="inventaire">Cabinet de curiosités · Apprendre</span>
      <h1 className="text-4xl leading-tight">Découvrir un chapitre</h1>
      <p className="m-0 max-w-prose text-encre-douce">Choisis ton niveau, puis explore les cartes et la frise de ton chapitre. Les dates sont visibles pour t’aider à réviser.</p>
    </header>
    <ChoisirChapitre chapitres={CHAPITRES_ACTIFS} />
  </main>;
}
