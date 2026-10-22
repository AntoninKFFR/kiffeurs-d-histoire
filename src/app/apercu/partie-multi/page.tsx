import type { Metadata } from "next";
import { ApercuPartieMulti } from "./ApercuPartieMulti";

export const metadata: Metadata = { title: "Aperçu de la partie à plusieurs · Kiffeurs d'Histoire", robots: { index: false, follow: false } };

// Aperçu de la partie Convivial (#140, #141) contre des joueurs fictifs : ?chrono=1, ?visible=1, ?joueurs=10.
export default async function ApercuPartieMultiPage({ searchParams }: PageProps<"/apercu/partie-multi">) {
  const { chrono, visible, joueurs } = await searchParams;
  return <ApercuPartieMulti chrono={chrono === "1"} visible={visible === "1"} dix={joueurs === "10"} />;
}
