"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CarteApprendre } from "@/lib/apprendre/cartes";
import { cadrageChapitre, debutCarte, marqueursCartes } from "@/lib/apprendre/frise";
import { Frise } from "@/components/frise/Frise";
import { useVue } from "@/components/frise/useVue";
import { versT } from "@/lib/game/frise";
import Link from "next/link";
import { Badge, BadgeNiveau } from "@/components/ui/Badge";
import { Bouton } from "@/components/ui/Bouton";
import { TesterChapitre } from "./TesterChapitre";
import s from "./apprendre.module.css";

// Un seul écran sur ordinateur : la liste à gauche, la frise du chapitre en haut, la carte ouverte dessous.
export function DecouvrirChapitre({ cartes, chapitre }: { cartes: CarteApprendre[]; chapitre?: { id: string; titre: string; niveau: string;edition?:string } }) {
  const [selection, setSelection] = useState<string | null>(cartes[0]?.card_id ?? null);
  const cadre = useMemo(() => cadrageChapitre(cartes), [cartes]);
  const controle = useVue("jour", cadre.bornes, cadre.plage);
  const { placer, animer, vueRef } = controle;
  const boutons = useRef(new Map<string, HTMLButtonElement>());
  const panneau = useRef<HTMLElement>(null);
  const index = cartes.findIndex((c) => c.card_id === selection);
  const carte = cartes[index];
  const marqueurs = useMemo(() => marqueursCartes(cartes, selection), [cartes, selection]);

  useEffect(() => { placer(cadre.plage.debut, cadre.plage.fin); }, [cadre, placer]);

  function ouvrir(id: string) {
    setSelection(id);
    const date = debutCarte(cartes.find((c) => c.card_id === id)!);
    if (date) {
      const t = versT(date), vue = vueRef.current;
      if (t < vue.debut + (vue.fin - vue.debut) * 0.08 || t > vue.fin - (vue.fin - vue.debut) * 0.08) {
        const rayon = (vue.fin - vue.debut) / 2;
        animer(t - rayon, t + rayon);
      }
    }
    requestAnimationFrame(() => {
      const el = panneau.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      // Sur mobile, l'écran défile : rendre la carte ouverte visible.
      const rect = el.getBoundingClientRect();
      if (rect.top > window.innerHeight - 160 || rect.bottom < 0) {
        el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }
    });
  }
  function fermer() {
    if (selection) boutons.current.get(selection)?.focus();
    setSelection(null);
  }

  return <div className={s.ecran}>
    <header className={s.barre}>
      <Link href="/apprendre" className={s.retour}>← Chapitres</Link>
      {chapitre && <BadgeNiveau niveau={chapitre.niveau} />}
      {chapitre && <h1>{chapitre.titre}</h1>}
      <span className="text-sm text-encre-douce">{cartes.length} cartes</span>
      {chapitre && <TesterChapitre chapitre={chapitre.id} edition={chapitre.edition} />}
    </header>
    <div className={s.corps}>
      <nav aria-label="Cartes du chapitre" className={s.liste}>
        <h2>Les cartes</h2>
        <ol>
          {cartes.map((c, i) => <li key={c.card_id}>
            <button type="button" aria-pressed={selection === c.card_id} onClick={() => ouvrir(c.card_id)} className="cible"
              ref={(el) => { if (el) boutons.current.set(c.card_id, el); else boutons.current.delete(c.card_id); }}>
              <span className="date">{i + 1}</span>
              <span className="min-w-0 break-words">{c.title}</span>
            </button>
          </li>)}
        </ol>
      </nav>
      <div className={s.droite}>
        <section aria-label="Frise du chapitre" className={s.frise}>
          <Frise precision="jour" mode="lecture" remplir toutVoir
            plageInitiale={{ debut: { year: Math.floor(cadre.plage.debut) || -1 }, fin: { year: Math.ceil(cadre.plage.fin) || 1 } }}
            controle={controle} marqueurs={marqueurs} onMarqueur={ouvrir} presentationMarqueurs="illustree" />
          <p className={s.note}>Les périodes sont placées à leur début.</p>
        </section>
        {carte ? <article ref={panneau} tabIndex={-1} aria-labelledby="titre-carte" className={s.detail}
          onKeyDown={(e) => {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (e.key === "Escape") { e.preventDefault(); fermer(); }
            if (e.key === "ArrowLeft" && index > 0) { e.preventDefault(); ouvrir(cartes[index - 1].card_id); }
            if (e.key === "ArrowRight" && index < cartes.length - 1) { e.preventDefault(); ouvrir(cartes[index + 1].card_id); }
          }}>
          <div className={s.haut}>
            <span aria-live="polite">Carte {index + 1} sur {cartes.length}</span>
            <nav aria-label="Parcourir les cartes" className={s.navigation}>
              <Bouton variante="secondaire" disabled={index === 0} onClick={() => ouvrir(cartes[index - 1].card_id)}>← Précédente</Bouton>
              <Bouton variante="secondaire" disabled={index === cartes.length - 1} onClick={() => ouvrir(cartes[index + 1].card_id)}>Suivante →</Bouton>
              <button type="button" onClick={fermer} className="cible underline">Fermer</button>
            </nav>
          </div>
          <div className={s.detailGrille}>
            {/* SVG du dépôt, servi sous card_id ; aucun chemin d'événement. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG 160×120 déjà optimisé, URL applicative sûre */}
            <img src={`/api/pedagogie/illustration/${encodeURIComponent(carte.card_id)}`} alt="" width={160} height={120} />
            <div className={s.texte}>
              <header>
                <p className="date text-xl text-oxyde">{carte.date_text}</p>
                <h2 id="titre-carte">{carte.title}</h2>
              </header>
              <p>{carte.body}</p>
              <p className={s.retenir}><strong>À retenir :</strong> {carte.takeaway.replace(/^À retenir :\s*/, "")}</p>
              <ul className={s.notions} aria-label="Notions clés">
                {carte.key_concepts.map((notion) => <li key={notion}><Badge ton="laiton">{notion}</Badge></li>)}
              </ul>
            </div>
          </div>
        </article> : <p className={s.vide}>Choisis une carte sur la frise ou dans la liste pour la lire.</p>}
      </div>
    </div>
  </div>;
}
