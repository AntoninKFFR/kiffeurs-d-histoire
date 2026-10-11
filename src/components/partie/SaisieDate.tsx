"use client";

import { useEffect, useRef } from "react";
import type { Precision } from "@/lib/game/dates";
import { CHAMPS_VIDES, chiffres, corrigerCases, ordreChamps, type Champs, type Cle } from "@/lib/game/saisie";
import s from "./partie.module.css";

// Le « - » reste visible devant l'année et veut dire av. J.-C.
function normaliser(c: Champs): Champs {
  const av = /[-−]/.test(c.annee) && !/\+/.test(c.annee);
  return corrigerCases({
    jour: chiffres(c.jour).slice(0, 2),
    mois: chiffres(c.mois).slice(0, 2),
    annee: (av ? "-" : "") + chiffres(c.annee).slice(0, 4),
  });
}

type Props = {
  precision: Precision;
  champs: Champs;
  onChange: (c: Champs) => void;
  onFocusChange: (enSaisie: boolean) => void;
  onValider: () => void;
  verrouille: boolean;
  /** Consigne affichée au-dessus des cases (question période : le début, puis la fin). */
  consigne?: string;
};

const LIBELLES: Record<Cle, { label: string; exemple: string; max: number }> = {
  jour: { label: "Jour", exemple: "JJ", max: 2 },
  mois: { label: "Mois", exemple: "MM", max: 2 },
  annee: { label: "Année", exemple: "AAAA", max: 6 },
};

export function SaisieDate({ precision, champs, onChange, onFocusChange, onValider, verrouille, consigne = "Tapez la date ou cliquez sur la frise" }: Props) {
  const refs = { jour: useRef<HTMLInputElement>(null), mois: useRef<HTMLInputElement>(null), annee: useRef<HTMLInputElement>(null) };
  const ordre = ordreChamps(precision);
  const av = champs.annee.startsWith("-");

  const changer = (c: Champs) => onChange(normaliser(c));

  function suivant(cle: Cle) {
    const i = ordre.indexOf(cle);
    const el = i >= 0 && i < ordre.length - 1 ? refs[ordre[i + 1]].current : null;
    el?.focus();
    el?.select();
  }

  function saisir(cle: Cle, valeur: string, base: Champs = champs) {
    changer({ ...base, [cle]: valeur });
    // Saut automatique dès que le jour ou le mois ne peut plus s'allonger.
    const v = chiffres(valeur);
    if (cle === "jour" && (v.length === 2 || (v.length === 1 && +v > 3))) suivant(cle);
    if (cle === "mois" && (v.length === 2 || (v.length === 1 && +v > 1))) suivant(cle);
  }

  function versAvantJC(avant: boolean) {
    refs.annee.current?.focus();
    changer({ ...champs, annee: (avant ? "-" : "") + chiffres(champs.annee) });
  }

  function touche(cle: Cle, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
      onValider();
    } else if (e.key === "Backspace" && !e.currentTarget.value) {
      const i = ordre.indexOf(cle);
      if (i > 0) {
        e.preventDefault();
        refs[ordre[i - 1]].current?.focus();
      }
    } else if ((e.key === "-" || e.key === "Subtract") && cle !== "annee") {
      // « - » tapé dans le jour ou le mois : on file vers l'année en av. J.-C.
      e.preventDefault();
      versAvantJC(true);
    } else if ((e.key === "/" || e.key === "." || e.key === " ") && cle !== "annee") {
      e.preventDefault();
      suivant(cle);
    }
  }

  // Taper un chiffre n'importe où démarre une nouvelle saisie dans la première case.
  const dernier = useRef({ ordre, saisir, versAvantJC });
  useEffect(() => {
    dernier.current = { ordre, saisir, versAvantJC };
  });
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (verrouille || e.ctrlKey || e.metaKey || e.altKey) return;
      const cible = e.target as HTMLElement;
      if (cible.closest("input, textarea, select, [contenteditable]")) return;
      const { ordre, saisir, versAvantJC } = dernier.current;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const premier = ordre[0];
        refs[premier].current?.focus();
        saisir(premier, e.key, CHAMPS_VIDES);
      } else if (e.key === "-" || e.key === "Subtract") {
        e.preventDefault();
        versAvantJC(true);
      }
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
    // refs est stable : objets useRef recréés à l'identique à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verrouille]);

  return (
    <div className={s.saisie}>
      <span className={s.consigneSaisie}>{consigne}</span>
      <div className={s.cases}>
        {ordre.map((cle) => (
          <div key={cle} className={cle === "annee" ? `${s.case} ${s.caseAnnee}` : s.case}>
            <label htmlFor={`saisie-${cle}`}>{LIBELLES[cle].label}</label>
            <input
              ref={refs[cle]}
              id={`saisie-${cle}`}
              className="date"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={LIBELLES[cle].max}
              placeholder={LIBELLES[cle].exemple}
              aria-describedby="saisie-aide"
              value={champs[cle]}
              disabled={verrouille}
              onChange={(e) => saisir(cle, e.target.value)}
              onKeyDown={(e) => touche(cle, e)}
              onFocus={(e) => {
                e.target.select();
                onFocusChange(true);
              }}
              onBlur={() => onFocusChange(false)}
            />
          </div>
        ))}
      </div>
      <div className={s.ere} role="group" aria-label="Avant ou après Jésus-Christ">
        <button type="button" aria-pressed={!av} disabled={verrouille} onPointerDown={(e) => e.preventDefault()} onClick={() => versAvantJC(false)}>
          apr. J.-C.
        </button>
        <button type="button" aria-pressed={av} disabled={verrouille} onPointerDown={(e) => e.preventDefault()} onClick={() => versAvantJC(true)}>
          av. J.-C.
        </button>
      </div>
      <span className={s.aideSaisie} id="saisie-aide">
        {ordre.length > 1 && `${ordre.map((c, i) => (i ? LIBELLES[c].label.toLowerCase() : LIBELLES[c].label)).join(", puis ")} : la case suivante s'ouvre toute seule. `}« - » devant l&apos;année pour av. J.-C. Entrée pour valider.
      </span>
    </div>
  );
}
