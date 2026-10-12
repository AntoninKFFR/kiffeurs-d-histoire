"use client";

import { useId, useState } from "react";
import { lancer } from "@/app/partie/actions";
import { Bouton } from "@/components/ui/Bouton";
import { QUESTIONS_MIN_TEST } from "@/lib/progression/types";
import type { SoloDifficulty } from "@/lib/game/solo";
import { comptesDe, DIFFICULTES, ecrireChoix, QUESTIONS, type Choix } from "@/lib/solo/choix";
import s from "./apprendre.module.css";

// « Me tester sur ce chapitre » : une partie solo scolaire sur ce seul chapitre, lancée par le même chemin que /scolaire.
// Le test ne porte que sur les cartes du chapitre (ce qu'on vient d'apprendre) : il compte autant de questions que de cartes jouables, 10 au plus et 5 au minimum.
export function TesterChapitre({ chapitre,edition }: { chapitre: string;edition?:string }) {
  const idSelect = useId();
  const comptes = comptesDe({ mode: "scolaire", chapitres: [chapitre], test: true,edition });
  const possible = (d: SoloDifficulty) => comptes == null || comptes[d] >= QUESTIONS_MIN_TEST;
  const [difficulte, setDifficulte] = useState<SoloDifficulty>("YEAR");
  const jouable = possible(difficulte) ? difficulte : (DIFFICULTES.find((d) => possible(d.valeur))?.valeur ?? null);
  const choix: Choix | null = jouable ? { mode: "scolaire", difficulte: jouable, chapitres: [chapitre], test: true,...(edition?{edition}:{}) } : null;
  const questions = choix && comptes ? Math.min(QUESTIONS, comptes[choix.difficulte]) : QUESTIONS;

  if (!choix) {
    return <div className={s.tester}>
      <Bouton disabled aria-describedby="test-indisponible">Me tester sur ce chapitre</Bouton>
      <small id="test-indisponible">Ce chapitre compte trop peu de cartes pour un test.</small>
    </div>;
  }
  return <form action={lancer} className={s.tester}>
    <input type="hidden" name="c" value={ecrireChoix(choix)} />
    <div className={s.testeur}>
      <label htmlFor={idSelect} className="sr-only">Précision du test</label>
      <select id={idSelect} value={choix.difficulte} onChange={(e) => setDifficulte(e.target.value as SoloDifficulty)}
        className="cible border border-filet bg-papier px-2 py-2 text-sm text-encre">
        {DIFFICULTES.map((d) => <option key={d.valeur} value={d.valeur} disabled={!possible(d.valeur)}>
          Trouver {d.aide}
        </option>)}
      </select>
      <Bouton type="submit">Me tester sur ce chapitre</Bouton>
    </div>
    <small>{questions} questions sur les cartes de ce chapitre</small>
  </form>;
}
