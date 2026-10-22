import type { Metadata } from "next";
import { TestLatence } from "./TestLatence";

export const metadata: Metadata = {
  title: "Test de latence · Kiffeurs d'Histoire",
  robots: { index: false, follow: false },
};

// Page interne (#135), liée nulle part : ouvrir la même adresse dans deux onglets ou deux appareils
// pour mesurer l'aller-retour d'un message entre joueurs à travers Supabase Realtime.
export default async function TestLatencePage({ searchParams }: PageProps<"/multi/test-latence">) {
  const { salon } = await searchParams;
  const nom = typeof salon === "string" && /^[a-z0-9-]{1,40}$/i.test(salon) ? salon : "essai";
  return <TestLatence salon={nom} />;
}
