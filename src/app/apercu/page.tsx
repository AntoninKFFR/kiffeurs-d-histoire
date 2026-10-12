import Link from "next/link";
import type { Precision } from "@/lib/game/dates";
import { Logo } from "@/components/charte/Sceau";
import { EcranPartie } from "@/components/partie/EcranPartie";
import { estHabillage, LISTE_HABILLAGES } from "@/lib/game/habillages";
import { corrigerDemo } from "./actions";

export const metadata = { title: "Aperçu de l'écran de partie · Kiffeurs d'Histoire" };

const PRECISIONS: { p: Precision; libelle: string }[] = [
  { p: "annee", libelle: "Année" },
  { p: "mois", libelle: "Mois et année" },
  { p: "jour", libelle: "Jour, mois et année" },
];

// Aperçu de l'écran de partie avec une question de démonstration,
// le temps que les vraies parties soient branchées sur la base.
export default async function ApercuPage({ searchParams }: PageProps<"/apercu">) {
  const { precision: demandee, habillage: habilleDemande } = await searchParams;
  const precision = PRECISIONS.find((x) => x.p === demandee)?.p ?? "jour";
  const habillage = estHabillage(habilleDemande) ? habilleDemande : null;
  const lien = (p: Precision, h: string | null) => `/apercu?precision=${p}${h ? `&habillage=${h}` : ""}`;

  return (
    <main className="mx-auto grid w-full max-w-[1180px] gap-7 px-4 pt-7 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <Logo surTitre="Aperçu de l'écran de partie" />
        <nav className="grid gap-1" aria-label="Précision demandée">
          <span className="inventaire">Démo : précision demandée</span>
          <div className="flex flex-wrap border border-filet bg-blanc-cartel text-[13px]">
            {PRECISIONS.map(({ p, libelle }) => (
              <Link
                key={p}
                href={lien(p, habillage)}
                aria-current={p === precision ? "page" : undefined}
                className="border-filet px-3 py-1.5 text-encre-douce not-first:border-l aria-[current=page]:bg-encre aria-[current=page]:text-papier"
              >
                {libelle}
              </Link>
            ))}
          </div>
        </nav>
        <nav className="grid gap-1" aria-label="Habillage de la frise">
          <span className="inventaire">Démo : habillage de la frise (#97)</span>
          <div className="flex flex-wrap border border-filet bg-blanc-cartel text-[13px]">
            {[{ id: null, nom: "Frise V1" }, ...LISTE_HABILLAGES].map((h) => (
              <Link
                key={h.id ?? "v1"}
                href={lien(precision, h.id)}
                aria-current={h.id === habillage ? "page" : undefined}
                className="border-filet px-3 py-1.5 text-encre-douce not-first:border-l aria-[current=page]:bg-encre aria-[current=page]:text-papier"
              >
                {h.nom}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <EcranPartie
        key={`${precision}-${habillage}`}
        habillage={habillage}
        corriger={corrigerDemo}
        question={{
          id: `demo-bastille-${precision}`,
          titre: "Prise de la Bastille",
          description: "Le peuple de Paris s'empare de la forteresse royale, symbole de l'arbitraire.",
          inventaire: "Inv. MOD-0412 · Histoire moderne",
          illustration: "bastille",
          precision,
          numero: 4,
          total: 10,
        }}
      />
    </main>
  );
}
