import type { Metadata } from "next";
import { ApercuPartieMulti } from "./ApercuPartieMulti";

export const metadata: Metadata = { title: "Aperçu de la partie à plusieurs · Kiffeurs d'Histoire", robots: { index: false, follow: false } };

// Aperçu de la partie Convivial (#140) contre des joueurs fictifs : ?chrono=1 pour le mode chrono.
export default async function ApercuPartieMultiPage({ searchParams }: PageProps<"/apercu/partie-multi">) {
  const { chrono } = await searchParams;
  return <ApercuPartieMulti chrono={chrono === "1"} />;
}
