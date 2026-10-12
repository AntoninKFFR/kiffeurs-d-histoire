"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { aLaPrecision, formatHistoricDate, type HistoricDate, type Precision } from "@/lib/game/dates";
import { versT, VUE_DE_BASE, type Vue } from "@/lib/game/frise";
import type { Chrono, CorrectionInverseAffichee } from "@/lib/game/partie";
import { Motif } from "@/components/charte/Motif";
import { Frise } from "@/components/frise/Frise";
import { useVue } from "@/components/frise/useVue";
import { ChronoCirculaire } from "@/components/ui/ChronoCirculaire";
import { BandeEpoques } from "./BandeEpoques";
import { useSaisieVisible } from "./useSaisieVisible";
import type { HabillageId } from "@/lib/game/habillages";
import s from "./partie.module.css";

// Mode inversé : la date est donnée (en grand et sur la frise), le joueur écrit l'événement.
// Le navigateur ne connaît jamais le titre attendu avant la correction, et aucune suggestion n'est proposée.
export type QuestionInverse = {
  id: string;
  date: HistoricDate;
  precision: Precision;
  numero: number;
  total: number;
};

type Props = {
  question: QuestionInverse;
  /** `null` : le temps est écoulé, on demande la correction sans réponse. */
  corriger: (questionId: string, reponse: string | null) => Promise<CorrectionInverseAffichee>;
  chrono?: Chrono;
  suivante: { libelle: string; action: () => Promise<void> };
  /** Période jouée : la frise ne montre qu'elle. */
  bornes?: Vue | null;
  /** Habillage de frise de la période jouée (#97). */
  habillage?: HabillageId | null;
};

export function EcranInverse({ question, corriger, chrono, suivante, bornes, habillage }: Props) {
  const { precision } = question;
  const date = useMemo(() => aLaPrecision(question.date, precision), [question.date, precision]);
  const { debut, fin } = bornes ?? VUE_DE_BASE;
  const cadre = useMemo(() => ({ debut, fin }), [debut, fin]);
  const controle = useVue(precision, cadre, cadre);
  const { animer } = controle;
  const [texte, setTexte] = useState("");
  const [correction, setCorrection] = useState<CorrectionInverseAffichee | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [passage, setPassage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [restant, setRestant] = useState(chrono ? chrono.totalMs / 1000 : 0);
  const enCours = useRef(false);
  const expireTente = useRef(false);
  const ecran = useRef<HTMLElement>(null);
  useSaisieVisible(ecran);

  async function envoyer(rep: string | null) {
    if (enCours.current) return;
    enCours.current = true;
    setEnvoi(true);
    setErreur(null);
    try {
      const c = await corriger(question.id, rep);
      setCorrection(c);
    } catch {
      setErreur("La connexion a été perdue : ta réponse n'est pas partie. Réessaie.");
    } finally {
      enCours.current = false;
      setEnvoi(false);
    }
  }

  // Début du tour : la frise s'ouvre sur toute la période, puis zoome doucement vers la date donnée
  // (environ 40 ans de large, pour garder le contexte de l'époque).
  const { placer, vueRef, arreter } = controle;
  // Nombres (et non objets) en dépendances : l'animation ne repart pas si la page recrée la question.
  const t = versT(date);
  const cible = Math.max(2, Math.min(40, (cadre.fin - cadre.debut) / 4));
  useEffect(() => {
    // Sur une période courte (pack, chapitre), la frise est déjà resserrée : on zoome au quart de sa largeur.
    let image = 0;
    const attente = setTimeout(() => {
      const depart = vueRef.current;
      const s0 = depart.fin - depart.debut;
      const c0 = (depart.debut + depart.fin) / 2;
      const t0 = performance.now();
      const etape = (maintenant: number) => {
        const k = Math.min(1, (maintenant - t0) / 2200);
        const q = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        // L'étendue varie en proportion (de milliers d'années à 40 ans) : le zoom reste régulier à l'œil.
        const span = Math.exp(Math.log(s0) + (Math.log(cible) - Math.log(s0)) * q);
        const centre = c0 + (t - c0) * q;
        placer(centre - span / 2, centre + span / 2);
        if (k < 1) image = requestAnimationFrame(etape);
      };
      image = requestAnimationFrame(etape);
    }, 1000);
    return () => {
      clearTimeout(attente);
      cancelAnimationFrame(image);
      arreter();
    };
  }, [t, cible, placer, vueRef, arreter]);

  const envoyerRef = useRef(envoyer);
  useEffect(() => {
    envoyerRef.current = envoyer;
  });
  useEffect(() => {
    if (!chrono || correction) return;
    const tic = () => {
      const r = Math.max(0, (chrono.finMs - Date.now()) / 1000);
      setRestant(r);
      if (r <= 0 && !expireTente.current) {
        expireTente.current = true;
        // Le temps est écoulé : le serveur constate l'expiration (0 point), ce qui a été tapé ne compte plus.
        void envoyerRef.current(null);
      }
    };
    tic();
    const id = setInterval(tic, 250);
    return () => clearInterval(id);
  }, [chrono, correction]);

  async function valider() {
    if (passage || envoi) return;
    if (correction) {
      setPassage(true);
      setErreur(null);
      try {
        await suivante.action();
      } catch {
        setErreur("Impossible de continuer : la connexion a été perdue. Réessaie.");
        setPassage(false);
      }
      return;
    }
    if (!texte.trim()) return;
    await envoyer(texte.trim());
  }

  const expirePerdue = erreur != null && restant <= 0 && !correction;
  const dateTexte = formatHistoricDate(date, precision);

  const bouton = expirePerdue ? (
    <button type="button" className={s.valider} onClick={() => void envoyer(null)}>
      Réessayer
    </button>
  ) : (
    <button type="button" className={s.valider} onClick={valider} disabled={envoi || passage || (!correction && !texte.trim())}>
      {correction ? suivante.libelle : "Valider ma réponse"}
    </button>
  );

  const bas = (
    <div className={s.rangeeInverse}>
      {!correction && (
      <div data-superposition className={`${s.boite} ${s.colonneSaisie}`}>
        {/* Aucune suggestion ni correction automatique : elles pourraient révéler les titres. */}
        <input
          id="reponse-inverse"
          aria-label={`Quel événement s'est passé en ${dateTexte} ?`}
          className={s.champTexte}
          type="text"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void valider();
            }
          }}
          disabled={correction != null || envoi}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={200}
          placeholder="Écris l'événement…"
          autoFocus
        />
        <span className={s.aideSaisie}>Accents, majuscules et petites fautes ne comptent pas. Entrée pour valider.</span>
        {erreur && (
          <p role="alert" className={s.erreur}>
            {erreur}
          </p>
        )}
      </div>
      )}
      <div data-superposition className={s.colonneAction}>
        {correction ? (
          <div className={`${s.boite} ${s.resultat}`} role="status">
            <span className={s.inventaire}>
              {correction.expiree ? "Temps écoulé" : correction.correcte ? "Bonne réponse !" : "Pas tout à fait"}
            </span>
            <span className={`${s.points} date`}>{correction.points} pts</span>
            <span>
              Il fallait trouver : <b>{correction.titre}</b>
              {texte.trim() && !correction.expiree && <i className={s.tapee}> (ta réponse : « {texte.trim()} »)</i>}
            </span>
            {correction.description && <span className={s.explication}>{correction.description}</span>}
            {bouton}
          </div>
        ) : (
          bouton
        )}
      </div>
    </div>
  );

  const carte = (
    <div className={s.carteH}>
      <div className={s.illustration}>
        <Motif nom="boussole" viewBox="0 0 48 48" className={s.pictogramme} />
      </div>
      <div className={s.carteTexte}>
        <span className={s.inventaire}>
          Question {question.numero} sur {question.total}
        </span>
        <h2 className={`${s.dateGrande} date`}>{dateTexte}</h2>
        <p className={s.consigne}>Quel événement s&apos;est produit à cette date ?</p>
      </div>
      {chrono && !correction && <ChronoCirculaire restant={restant} total={chrono.totalMs / 1000} taille={72} />}
    </div>
  );

  return (
    <section ref={ecran} className={s.jeu} aria-label="Écran de partie, mode inversé">
      <Frise
        precision={precision}
        mode="lecture"
        habillage={habillage}
        controle={controle}
        dateDonnee={date}
        correction={correction && { bonne: date, titre: correction.titre }}
        haut={
          <>
            <Link href="/" className={s.quitter}>
              ← Quitter
            </Link>
            {carte}
          </>
        }
        sous={<BandeEpoques vue={controle.vue} animer={animer} bornes={cadre} />}
        bas={bas}
      />
    </section>
  );
}
