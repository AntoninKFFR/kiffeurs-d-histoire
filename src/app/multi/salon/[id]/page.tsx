import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { etatSalon, rejoindreParLien } from "@/app/multi/actions";
import { getAccount } from "@/lib/account";
import { SalonEnDirect } from "@/components/multi/SalonEnDirect";
import { RejoindreInvite } from "@/components/multi/RejoindreInvite";

export const metadata: Metadata = { title: "Salon · Kiffeurs d'Histoire", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Écran du salon, et aussi la cible du lien d'invitation : un compte entre aussitôt avec son pseudo KFFR,
// un invité choisit d'abord un pseudo (#134).
export default async function SalonPage({ params }: PageProps<"/multi/salon/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return <RejoindreInvite salonId={null} erreur="Lien d'invitation invalide." />;
  const etat = await etatSalon(id);
  if (etat) return <SalonEnDirect depart={etat} />;
  if (await getAccount()) {
    const entree = await rejoindreParLien(id);
    if (!entree.ok) return <RejoindreInvite salonId={id} compte erreur={entree.erreur} />;
    redirect(`/multi/salon/${id}`);
  }
  return <RejoindreInvite salonId={id} />;
}
