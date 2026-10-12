"use client";

import { useFormStatus } from "react-dom";
import { DIFFICULTES, NIVEAUX, niveauPossible, type Choix, type Comptes } from "@/lib/solo/choix";
import type { SoloDifficulty, SoloNiveau } from "@/lib/game/solo";
import styles from "./choix.module.css";

/** Lit le dernier choix mémorisé dans le navigateur (stockage local indisponible ou vide : rien). */
export function lireMemoire(cle: string): URLSearchParams | null {
  try {
    const brut = window.localStorage.getItem(cle);
    return brut ? new URLSearchParams(brut) : null;
  } catch {
    return null;
  }
}

export function ecrireMemoire(cle: string, valeur: string) {
  try {
    window.localStorage.setItem(cle, valeur);
  } catch {
    // Navigation privée ou stockage bloqué : le choix ne sera simplement pas retenu.
  }
}

/** Première difficulté jouable, en partant de celle demandée. */
export function difficulteJouable(comptes: Comptes | null, voulue: SoloDifficulty, minimum = 10): SoloDifficulty | null {
  const possible = (d: SoloDifficulty) => comptes === null || comptes[d] >= minimum;
  if (possible(voulue)) return voulue;
  return DIFFICULTES.find((d) => possible(d.valeur))?.valeur ?? null;
}

type Contenu = Pick<Choix, "mode" | "periode" | "pack" | "theme">;

/** Niveau demandé s'il remplit une partie, sinon le plus proche au-dessus (plus d'événements), sinon en dessous. */
export function niveauJouable(contenu: Contenu, voulu: SoloNiveau, precisions: SoloDifficulty[]): SoloNiveau | null {
  const ordre = [voulu, ...NIVEAUX.map((n) => n.valeur).filter((n) => n > voulu), ...NIVEAUX.map((n) => n.valeur).filter((n) => n < voulu).reverse()];
  return ordre.find((n) => niveauPossible(contenu, n, precisions)) ?? null;
}

export function ChoixNiveau({ contenu, precisions, valeur, expertOnly = false, onChange, verifierCatalogue = true }: { contenu: Contenu; precisions: SoloDifficulty[]; valeur: SoloNiveau | null; expertOnly?: boolean; onChange: (n: SoloNiveau, expertOnly: boolean) => void; verifierCatalogue?: boolean }) {
  return (
    <div className={`${styles.difficultes} ${styles.niveaux}`} role="group" aria-label="Niveau">
      {NIVEAUX.map((n) => {
        const possible = !verifierCatalogue || n.expertOnly || niveauPossible(contenu, n.valeur, precisions);
        return (
          <button key={`${n.valeur}:${Boolean(n.expertOnly)}`} type="button" className={styles.difficulte} aria-pressed={valeur === n.valeur && expertOnly === Boolean(n.expertOnly)} disabled={!possible} onClick={() => onChange(n.valeur, Boolean(n.expertOnly))}>
            <b>{n.titre}</b>
            <small>{possible ? n.aide : "Pas assez de questions ici"}</small>
          </button>
        );
      })}
    </div>
  );
}

export function ChoixDifficulte({ comptes, valeur, onChange, minimum = 10 }: { comptes: Comptes | null; valeur: SoloDifficulty | null; onChange: (d: SoloDifficulty) => void; minimum?: number }) {
  return (
    <div className={styles.difficultes} role="group" aria-label="Précision">
      {DIFFICULTES.map((d) => {
        const possible = comptes === null || comptes[d.valeur] >= minimum;
        return (
          <button key={d.valeur} type="button" className={styles.difficulte} aria-pressed={valeur === d.valeur} disabled={!possible} onClick={() => onChange(d.valeur)}>
            <b>{d.titre}</b>
            <small>{possible ? `Trouve ${d.aide}` : "Pas assez de questions ici"}</small>
          </button>
        );
      })}
    </div>
  );
}

export function BarreLancer({ resume, pret }: { resume: React.ReactNode; pret: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className={styles.lancer}>
      <p className={styles.resume}>{resume}</p>
      <button type="submit" className={styles.jouer} disabled={!pret || pending}>
        {pending ? "Préparation…" : "Jouer"}
      </button>
    </div>
  );
}

export function Etape({ numero, titre, children }: { numero: number; titre: string; children: React.ReactNode }) {
  return (
    <section className={styles.etape}>
      <h2><b>{numero}</b>{titre}</h2>
      {children}
    </section>
  );
}
