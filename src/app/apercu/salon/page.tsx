import type { Metadata } from "next";
import { ApercuSalon } from "./ApercuSalon";

export const metadata: Metadata = { title: "Aperçu du salon · Kiffeurs d'Histoire", robots: { index: false, follow: false } };

// Aperçu de l'écran du salon (#136) : ?vue=joueur pour le voir comme un invité.
export default async function ApercuSalonPage({ searchParams }: PageProps<"/apercu/salon">) {
  const { vue } = await searchParams;
  return <ApercuSalon vue={vue === "joueur" ? "joueur" : "hote"} />;
}
