import { notFound } from "next/navigation";
import { CHAPITRES, editionConnue, trouverChapitre } from "@/lib/apprendre/catalogue";
import { chargerCartesChapitre } from "@/lib/apprendre/cartes-serveur";
import { DecouvrirChapitre } from "@/components/pedagogie/DecouvrirChapitre";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() {
  return CHAPITRES.flatMap(c=>c.editions?.length?[c.content_version,...c.editions].map(version=>({niveau:c.niveauSlug,chapitre:c.slug,version})):[]);
}
export default async function EditionPage({params}:PageProps<"/apprendre/[niveau]/[chapitre]/edition/[version]">) {
  const {niveau,chapitre,version}=await params,c=trouverChapitre(niveau,chapitre);
  if (!c || !editionConnue(c,version)) notFound();
  const cartes=await chargerCartesChapitre(c.id,version);
  if (!cartes.length) notFound();
  return <main className="flex flex-1 flex-col">
    <p className="conteneur py-4">{version===c.content_version?'Parcours avant complétion':'Parcours complété'}. Ses tests et résultats restent attachés à cette édition.</p>
    <DecouvrirChapitre cartes={cartes} chapitre={{id:c.id,titre:c.titre,niveau:c.niveau,edition:version}} />
  </main>;
}
