"use client";

import { useEffect, useState } from "react";
import { lancer } from "@/app/partie/actions";
import { NIVEAUX, CHAPITRES_ACTIFS } from "@/lib/apprendre/catalogue";
import { CHAPITRES, DIFFICULTES, ecrireChoix, lireChoix, nombreQuestions, type Longueur } from "@/lib/solo/choix";
import { LongueurPartie, useDisponibilite } from "./LongueurPartie";
import { QuestionsPeriode } from "./QuestionsPeriode";
import type { SoloDifficulty } from "@/lib/game/solo";
import { BarreLancer, ChoixDifficulte, difficulteJouable, ecrireMemoire, Etape, lireMemoire } from "./communs";
import styles from "./choix.module.css";

const MEMOIRE = "histoire-choix-scolaire";
const MEMOIRE_INVERSE = "histoire-choix-inverse-scolaire";
const duNiveau = (niveau: string) => CHAPITRES_ACTIFS.filter((c) => c.niveauSlug === niveau);

export function ChoixScolaire({ inverse = false }: { inverse?: boolean }) {
  const memoire = inverse ? MEMOIRE_INVERSE : MEMOIRE;
  const [niveau, setNiveau] = useState<string | null>(null);
  const [coches, setCoches] = useState<string[]>([]);
  // Difficulté proposée par défaut : l'année seule, comme dans les manuels.
  const [difficulte, setDifficulte] = useState<SoloDifficulty>("YEAR");
  const [longueur, setLongueur] = useState<Longueur>(10);
  const [periodes, setPeriodes] = useState(true);

  // Reprend le dernier choix du joueur, connu seulement du navigateur.
  useEffect(() => {
    const memorise = lireMemoire(memoire);
    const choix = memorise && lireChoix(memorise);
    if (!choix?.chapitres) return;
    const premier = CHAPITRES.find((c) => c.id === choix.chapitres![0])!;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reprise unique du stockage local
    setNiveau(premier.niveauSlug);
    setCoches(choix.chapitres.filter((id) => CHAPITRES.find((c) => c.id === id)?.niveauSlug === premier.niveauSlug));
    setDifficulte(choix.difficulte);
    setLongueur(choix.longueur ?? 10);
    setPeriodes(choix.periodes !== false);
  }, [memoire]);

  const choisirNiveau = (slug: string) => {
    setNiveau(slug);
    setCoches(duNiveau(slug).map((c) => c.id));
  };
  const basculer = (id: string) => setCoches((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  // Un ancien choix mémorisé reste lisible et rejouable, avec une indication claire.
  const chapitres = niveau ? [...duNiveau(niveau),...CHAPITRES.filter(c => c.etat === "historique" && c.niveauSlug === niveau && coches.includes(c.id))] : [];
  const selection = lireChoix(new URLSearchParams({ mode: "scolaire", difficulte, chapitres: coches.join(","), longueur: String(longueur), ...(inverse ? { sens: "inverse" } : periodes ? {} : { periodes: "0" }) }));
  const disponibilite = useDisponibilite(selection);
  const comptes = disponibilite.comptes;
  // Inversé : toujours la date exacte, sans choix de difficulté.
  const jouable = inverse ? (comptes === null || comptes.DAY > 0 ? "DAY" : null) : difficulteJouable(comptes, difficulte, 1);
  const choix = selection && jouable ? { ...selection, difficulte: jouable } : null;
  const disponibles = jouable ? comptes?.[jouable] ?? null : comptes ? 0 : null;
  const nombre = nombreQuestions(longueur, disponibles);
  const nomNiveau = NIVEAUX.find((n) => n.slug === niveau)?.nom;

  return (
    <form action={lancer} onSubmit={() => choix && ecrireMemoire(memoire, ecrireChoix(choix))} className="grid gap-[22px]">
      {choix && <input type="hidden" name="c" value={ecrireChoix(choix)} />}

      <Etape numero={1} titre="Ton niveau">
        <ul className={`${styles.tuiles} ${styles.petites}`}>
          {NIVEAUX.map((n) => (
            <li key={n.slug}>
              <button type="button" className={styles.tuile} aria-pressed={niveau === n.slug} onClick={() => choisirNiveau(n.slug)}>
                <b>{n.nom}</b>
                <small>{duNiveau(n.slug).length} chapitres</small>
              </button>
            </li>
          ))}
        </ul>
      </Etape>

      {niveau && (
        <Etape numero={2} titre="Les chapitres à réviser">
          <div className="flex flex-wrap gap-x-4 text-sm">
            <button type="button" className="cible underline" onClick={() => setCoches(chapitres.map((c) => c.id))}>Tout cocher</button>
            <button type="button" className="cible underline" onClick={() => setCoches([])}>Tout décocher</button>
          </div>
          <ul className={`${styles.tuiles} ${styles.larges}`}>
            {chapitres.map((c) => (
              <li key={c.id}>
                <label className={`${styles.tuile} ${styles.case}`}>
                  <input type="checkbox" checked={coches.includes(c.id)} onChange={() => basculer(c.id)} />
                  <span className={styles.coche} aria-hidden="true">{coches.includes(c.id) ? "✓" : ""}</span>
                  <b>{c.titre}{c.etat === "historique" ? " · parcours historique" : ""}</b>
                </label>
              </li>
            ))}
          </ul>
        </Etape>
      )}

      {niveau && !inverse && (
        <Etape numero={3} titre="Difficulté">
          <ChoixDifficulte comptes={comptes} valeur={jouable} onChange={setDifficulte} minimum={1} />
        </Etape>
      )}

      {niveau && <Etape numero={inverse ? 3 : 4} titre="Longueur de la partie">
        <LongueurPartie valeur={longueur} disponibles={disponibles} erreur={disponibilite.erreur}
          reessayer={disponibilite.reessayer} onChange={setLongueur} />
      </Etape>}
      {niveau && !inverse && <Etape numero={5} titre="Questions période">
        <QuestionsPeriode valeur={periodes} onChange={setPeriodes} />
      </Etape>}
      <BarreLancer
        pret={choix != null && nombre !== null}
        resume={
          choix && nombre !== null ? (
            <><b>{nombre} question{nombre > 1 ? "s" : ""}</b> · {nomNiveau}, {coches.length} chapitre{coches.length > 1 ? "s" : ""} {inverse ? " · date exacte" : <> · {DIFFICULTES.find((d) => d.valeur === jouable)?.titre}</>}</>
          ) : !niveau ? "Choisis ton niveau." : !coches.length ? "Coche au moins un chapitre." : "Choisis une longueur disponible pour jouer."
        }
      />
    </form>
  );
}
