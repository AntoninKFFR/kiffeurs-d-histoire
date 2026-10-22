"use client";

// « Rejoindre avec un code » (#137) : trois cases JJ / MM / AAAA comme en partie (mêmes corrections :
// mois 13 → 12, 31 février → 28 ou 29), pavé numérique sur téléphone ; pseudo seulement sans compte.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rejoindreParCode } from "@/app/multi/actions";
import { refusPseudoInvite } from "@/lib/multi/salon";
import { CHAMPS_VIDES, chiffres, corrigerCases, type Champs, type Cle } from "@/lib/game/saisie";
import styles from "./accueil.module.css";

const CASES: { cle: Cle; titre: string; max: number }[] = [
  { cle: "jour", titre: "Jour", max: 2 },
  { cle: "mois", titre: "Mois", max: 2 },
  { cle: "annee", titre: "Année", max: 4 },
];

export function RejoindreCode({ connecte }: { connecte: boolean }) {
  const router = useRouter();
  const [champs, setChamps] = useState<Champs>(CHAMPS_VIDES);
  const [pseudo, setPseudo] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const refs = { jour: useRef<HTMLInputElement>(null), mois: useRef<HTMLInputElement>(null), annee: useRef<HTMLInputElement>(null) };

  const saisir = (cle: Cle, valeur: string) => {
    const v = chiffres(valeur).slice(0, cle === "annee" ? 4 : 2);
    setChamps((c) => corrigerCases({ ...c, [cle]: v }));
    if (cle === "jour" && (v.length === 2 || (v.length === 1 && +v > 3))) refs.mois.current?.focus();
    if (cle === "mois" && (v.length === 2 || (v.length === 1 && +v > 1))) refs.annee.current?.focus();
  };

  const rejoindre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!champs.jour || !champs.mois || champs.annee.length !== 4) return setErreur("Le code est une date complète : JJ / MM / AAAA.");
    if (!connecte) {
      const refus = refusPseudoInvite(pseudo);
      if (refus) return setErreur(refus);
    }
    setEnvoi(true);
    setErreur(null);
    const r = await rejoindreParCode(`${champs.jour}/${champs.mois}/${champs.annee}`, connecte ? undefined : pseudo);
    if (r.ok) return router.push(`/multi/salon/${r.salonId}`);
    setEnvoi(false);
    setErreur(r.erreur);
  };

  return <form className={styles.boite} aria-label="Rejoindre avec un code" onSubmit={rejoindre}>
    <h2>Rejoindre avec un code</h2>
    <div className={styles.corps}>
      <span className={`${styles.note} ${styles.surPc}`}>Le code est une date : demandez-la à l&apos;hôte.</span>
      <div className={styles.cases}>
        {CASES.map((c, i) => <div key={c.cle} className={styles.caseCode}>
          {i > 0 && <span className={styles.separateur} aria-hidden>/</span>}
          <label>
            <span className={styles.surPc}>{c.titre}</span>
            <input ref={refs[c.cle]} id={`code-${c.cle}`} inputMode="numeric" autoComplete="off" aria-label={c.titre}
              className={c.cle === "annee" ? styles.annee : undefined} placeholder={c.cle === "annee" ? "AAAA" : c.cle === "jour" ? "JJ" : "MM"}
              value={champs[c.cle]} maxLength={c.max} onChange={(e) => saisir(c.cle, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !e.currentTarget.value && i > 0) refs[CASES[i - 1].cle].current?.focus();
                if ((e.key === "/" || e.key === ".") && i < 2) { e.preventDefault(); refs[CASES[i + 1].cle].current?.focus(); }
              }} />
          </label>
        </div>)}
      </div>
      {!connecte && <label className={styles.champ}>
        Votre pseudo pour la partie (sans compte)
        <input id="code-pseudo" value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={16} autoComplete="nickname" />
      </label>}
      {erreur && <p className={styles.erreur} role="alert">{erreur}</p>}
    </div>
    <div className={styles.pied}>
      <button type="submit" className={`${styles.principal} ${styles.secondaireTel}`} disabled={envoi}>Rejoindre</button>
      <span className={`${styles.note} ${styles.surPc}`}>Un lien d&apos;invitation fonctionne aussi</span>
    </div>
  </form>;
}
