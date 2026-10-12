import { notFound } from "next/navigation";
import { CHAPITRES, CHAPITRES_ACTIFS, cheminChapitre, trouverChapitre } from "@/lib/apprendre/catalogue";
import Link from "next/link";
import { chargerCartesChapitre } from "@/lib/apprendre/cartes-serveur";
import { SuiviDecouverte } from "@/components/pedagogie/SuiviDecouverte";
import { DecouvrirChapitre } from "@/components/pedagogie/DecouvrirChapitre";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() {
  return CHAPITRES.map((c) => ({ niveau: c.niveauSlug, chapitre: c.slug }));
}
export async function generateMetadata({ params }: PageProps<"/apprendre/[niveau]/[chapitre]">) {
  const { niveau, chapitre } = await params;
  const c = trouverChapitre(niveau, chapitre);
  return { title: c ? `${c.titre} · ${c.niveau} · Kiffeurs d’Histoire` : "Chapitre introuvable" };
}
export default async function ChapitrePage({ params }: PageProps<"/apprendre/[niveau]/[chapitre]">) {
  const { niveau, chapitre } = await params;
  const c = trouverChapitre(niveau, chapitre);
  if (!c) notFound();
  const cartes = await chargerCartesChapitre(c.id);
  if (!cartes.length) notFound();
  return <main className="flex flex-1 flex-col">
    {c.etat === "historique" && <aside className="conteneur grid gap-2 py-4" aria-label="Parcours historique">
      <p>Ce parcours historique reste disponible pour retrouver tes cartes et tes résultats. Les nouvelles séquences ont leur propre progression.</p>
      <ul>{CHAPITRES_ACTIFS.filter(child => child.parent_id === c.id).map(child => <li key={child.id}><Link href={cheminChapitre(child)}>{child.titre}</Link></li>)}</ul>
    </aside>}
    <DecouvrirChapitre cartes={cartes} chapitre={{ id: c.id, titre: c.titre, niveau: c.niveau }} />
    <SuiviDecouverte chapitre={c.id} />
  </main>;
}
