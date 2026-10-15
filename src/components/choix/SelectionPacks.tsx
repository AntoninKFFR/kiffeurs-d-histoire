"use client";

import { Fragment, useEffect, useRef } from "react";
import { estPackFun } from "@/lib/solo/packs-fun";
import { nombreQuestions, type Longueur } from "@/lib/solo/choix";
import { packsRacines, type PackJouable } from "@/lib/solo/packs";
import type { SoloDifficulty } from "@/lib/game/solo";
import styles from "./choix.module.css";

export function SelectionPacks({ packs, ouvert, selection, precision, longueur, onOuvrir, onChoisir }: {
  packs: PackJouable[]; ouvert: string | null; selection: string; precision: SoloDifficulty;
  longueur: Longueur; onOuvrir: (id: string | null) => void; onChoisir: (id: string) => void;
}) {
  const parent = packs.find((p) => p.id === ouvert);
  const heading = useRef<HTMLHeadingElement>(null);
  const listeElement = useRef<HTMLUListElement>(null);
  const navigation = useRef<string | null>(ouvert);
  useEffect(() => {
    if (navigation.current !== ouvert) {
      if (listeElement.current) listeElement.current.scrollTop = 0;
      heading.current?.focus();
    }
    navigation.current = ouvert;
  }, [ouvert]);
  const racines = packsRacines(packs);
  const liste = parent ? [parent, ...packs.filter((p) => p.parent_id === parent.id)]
    : [...racines.filter(p => estPackFun(p.id)), ...racines.filter(p => !estPackFun(p.id))];
  const groupesFun = !parent && liste.some(p => estPackFun(p.id));
  return <div className={styles.selectionPacks}>
    <h3 ref={heading} tabIndex={-1}>{parent ? parent.titre : "Packs disponibles"}</h3>
    {parent && <button type="button" className={styles.retour}
      onClick={() => onOuvrir(packs.find((p) => p.id === parent.parent_id)?.id ?? null)}>
      ← {packs.find((p) => p.id === parent.parent_id)?.titre ?? "Tous les packs"}
    </button>}
    <ul ref={listeElement} className={styles.listePacks} aria-label={parent ? `Sous-packs de ${parent.titre}` : "Packs disponibles"}>
      {liste.map((p, index) => {
        const enfants = packs.some((c) => c.parent_id === p.id);
        const tout = p.id === parent?.id;
        const n = p.comptes[precision];
        const impossible = nombreQuestions(longueur, n) === null;
        const debutGroupe = groupesFun && (index === 0 || estPackFun(liste[index - 1].id) !== estPackFun(p.id));
        return <Fragment key={p.id}>
          {debutGroupe && <li className={styles.rubriquePacks}><h4>{estPackFun(p.id) ? "Pour le fun" : "Les autres packs"}</h4></li>}
          <li className={enfants && !tout ? styles.packParent : undefined}>
          <button type="button" className={styles.tuile} disabled={impossible}
            aria-label={enfants && !tout ? `Jouer tout ${p.titre} · ${n} questions disponibles${impossible ? " · Pas assez pour cette longueur" : ""}` : undefined}
            aria-pressed={selection === p.id} onClick={() => onChoisir(p.id)}>
            <b>{tout ? `Tout le pack ${p.titre}` : p.titre}</b>
            <small>{n} question{n > 1 ? "s" : ""} disponible{n > 1 ? "s" : ""}
              {impossible ? " · Pas assez pour cette longueur" : ""}</small>
            {enfants && !tout && <span className={styles.actionPack}>Jouer tout {p.titre}</span>}
          </button>
          {enfants && !tout && <button type="button" className={styles.sousThemes}
            aria-label={`Voir les sous-thèmes de ${p.titre}`} onClick={() => onOuvrir(p.id)}>
            Voir les sous-thèmes →
          </button>}
        </li></Fragment>;
      })}
    </ul>
  </div>;
}
