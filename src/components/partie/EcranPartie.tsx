"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { aLaPrecision, formatHistoricDate, type HistoricDate, type Precision } from "@/lib/game/dates";
import { dateCourte, REGLAGES, versT, VUE_DE_BASE, type Vue } from "@/lib/game/frise";
import type { Chrono } from "@/lib/game/partie";
import type { MethodeSaisie } from "@/lib/game/solo";
import { Motif } from "@/components/charte/Motif";
import { Frise } from "@/components/frise/Frise";
import { useVue } from "@/components/frise/useVue";
import { BandeEpoques } from "./BandeEpoques";
import { useSaisieFrise } from "@/components/saisie/useSaisieFrise";
import { ChronoCirculaire } from "@/components/ui/ChronoCirculaire";
import { SaisieDate } from "./SaisieDate";
import { useSaisieVisible } from "./useSaisieVisible";
import type { HabillageId } from "@/lib/game/habillages";
import s from "./partie.module.css";

// Ce que le navigateur sait d'une question : jamais la date attendue, ni la description avant la réponse.
export type QuestionPublique = {
  id: string;
  titre: string;
  description?: string;
  inventaire?: string;
  /** Motif de la charte (public/motifs.svg) : aperçu et démonstrations. */
  illustration?: string;
  /** Illustration de l'événement, servie par Supabase Storage. */
  illustrationUrl?: string;
  precision: Precision;
  numero: number;
  total: number;
  /** Question période (#94) : le joueur place le début puis la fin. */
  periode?: boolean;
};

/** Réponse à une question période : le début et la fin, la fin jamais avant le début. */
export type ReponsePeriode = { debut: HistoricDate; fin: HistoricDate };

// Renvoyé par le serveur une fois la réponse envoyée.
export type Correction = {
  bonne: HistoricDate;
  points: number;
  ecart: string | null;
  description?: string | null;
  /** Le temps était écoulé : la question vaut 0. */
  expiree?: boolean;
  /** Question période : la vraie fin, et l'écart sur la fin (`ecart` porte alors sur le début). */
  bonneFin?: HistoricDate;
  ecartFin?: string | null;
};

type Props = {
  question: QuestionPublique;
  /** `null` : le temps est écoulé, on demande la correction sans réponse. */
  corriger: (questionId: string, reponse: HistoricDate | null, methode?: MethodeSaisie | null) => Promise<Correction>;
  /** Correction d'une question période ; `null` : le temps est écoulé. */
  corrigerPeriode?: (questionId: string, reponse: ReponsePeriode | null, methode?: MethodeSaisie | null) => Promise<Correction>;
  /** Chrono affiché (le serveur fait foi). Sans lui, pas de chrono. */
  chrono?: Chrono;
  /** Bouton après la correction. Sans lui (aperçu), la question se rejoue. */
  suivante?: { libelle: string; action: () => Promise<void> };
  /** Période jouée (pack, thème, chapitres…) : la frise ne montre qu'elle. Sans elle, toute l'histoire. */
  bornes?: Vue | null;
  /** Habillage de frise de la période jouée (#97). */
  habillage?: HabillageId | null;
  /** Multijoueur (#140) : la suite est automatique, ces réglages adaptent l'écran du solo. */
  multi?: {
    /** À la suite de « Question 4 sur 10 » : qui a validé, mode chrono. */
    inventaire?: ReactNode;
    /** Posé sur la frise en haut à droite : le classement. */
    autour?: ReactNode;
    /** Remplace le lien « Quitter ». */
    quitter?: ReactNode;
    /** Bouton pendant l'attente de la correction (les autres jouent encore). */
    attente: string;
    /** Remplace le bouton après la correction (la question suivante arrive seule). */
    apresCorrection: ReactNode;
    /** Rechargement : la réponse est déjà partie (ou la question close), on attend la correction. */
    dejaRepondu?: boolean;
  };
};

const BRAVO: Record<Precision, string> = { annee: "Pile la bonne année !", mois: "Pile le bon mois !", jour: "Pile le bon jour !" };
const PILE: Record<Precision, string> = { annee: "pile la bonne année", mois: "pile le bon mois", jour: "pile le bon jour" };

// La fin tombe-t-elle avant le début, à la précision jouée ?
const finAvantDebut = (debut: HistoricDate, fin: HistoricDate, precision: Precision) =>
  versT(aLaPrecision(fin, precision)) < versT(aLaPrecision(debut, precision));

export function EcranPartie({ question, corriger, corrigerPeriode, chrono, suivante, bornes, habillage, multi }: Props) {
  const { precision } = question;
  const periode = Boolean(question.periode && corrigerPeriode);
  const { debut, fin } = bornes ?? VUE_DE_BASE;
  const cadre = useMemo(() => ({ debut, fin }), [debut, fin]);
  const controle = useVue(precision, cadre, cadre);
  const { vue, animer } = controle;
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [passage, setPassage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [restant, setRestant] = useState(chrono ? chrono.totalMs / 1000 : 0);
  // Question période : deux saisies reliées à la même frise, le début puis la fin.
  const saisieDebut = useSaisieFrise(precision, controle);
  const saisieFin = useSaisieFrise(precision, controle);
  const [etape, setEtape] = useState<"debut" | "fin">("debut");
  const active = periode && etape === "fin" ? saisieFin : saisieDebut;
  const autre = periode ? (etape === "fin" ? saisieDebut : saisieFin) : null;
  const { champs, reponse, complete, setEnSaisie, enSaisie, changerChamps } = active;
  const methode = periode ? (saisieFin.methode ?? saisieDebut.methode) : saisieDebut.methode;
  const debutJoueur = saisieDebut.reponse;
  const finJoueur = saisieFin.reponse;
  const inversee = periode && debutJoueur != null && finJoueur != null && saisieDebut.complete && saisieFin.complete && finAvantDebut(debutJoueur, finJoueur, precision);
  const periodeComplete = saisieDebut.complete && saisieFin.complete && !inversee;
  // Tant que la fin manque, le bouton du début mène à la fin.
  const versLaFin = periode && etape === "debut" && !saisieFin.complete;
  const pret = periode ? (versLaFin ? saisieDebut.complete : periodeComplete) : complete;
  const enCours = useRef(false);
  const expireTente = useRef(false);
  const ecran = useRef<HTMLElement>(null);
  useSaisieVisible(ecran);

  async function envoyer(rep: HistoricDate | ReponsePeriode | null) {
    if (enCours.current) return;
    enCours.current = true;
    setEnvoi(true);
    setErreur(null);
    try {
      const brute = periode
        ? await corrigerPeriode!(question.id, rep && "debut" in rep ? rep : null, rep ? methode : null)
        : await corriger(question.id, rep && !("debut" in rep) ? rep : null, rep ? methode : null);
      // La bonne réponse est donnée à la précision jouée : l'année seule en précision Année.
      const c = { ...brute, bonne: aLaPrecision(brute.bonne, precision), bonneFin: brute.bonneFin && aLaPrecision(brute.bonneFin, precision) };
      setCorrection(c);
      if (periode) setEtape("debut");
      // La frise montre la bonne date (ou période), et la réponse quand il y en a une.
      const ts = [c.bonne, c.bonneFin, ...(rep ? ("debut" in rep ? [rep.debut, rep.fin] : [rep]) : [])]
        .filter((d): d is HistoricDate => d != null).map(versT);
      const min = Math.min(...ts);
      const max = Math.max(...ts);
      const marge = Math.max(REGLAGES[precision].marge, (max - min) * (periode ? 0.25 : 1.2));
      animer(min - marge, max + marge);
    } catch {
      setErreur("La connexion a été perdue : ta réponse n'est pas partie. Réessaie.");
    } finally {
      enCours.current = false;
      setEnvoi(false);
    }
  }

  // Le chrono n'est qu'un affichage : à zéro on demande la correction, le serveur constate l'expiration.
  const envoyerRef = useRef(envoyer);
  useEffect(() => {
    envoyerRef.current = envoyer;
  });
  // Rechargement en multi : rien à envoyer, on attend la correction comme après une réponse.
  const dejaRepondu = useRef(multi?.dejaRepondu);
  useEffect(() => {
    if (dejaRepondu.current) {
      expireTente.current = true;
      void envoyerRef.current(null);
    }
  }, []);
  useEffect(() => {
    if (!chrono || correction) return;
    const tic = () => {
      const r = Math.max(0, (chrono.finMs - Date.now()) / 1000);
      setRestant(r);
      if (r <= 0 && !expireTente.current) {
        expireTente.current = true;
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
      if (!suivante) {
        // Aperçu : on rejoue la même question.
        setCorrection(null);
        saisieDebut.reinitialiser();
        saisieFin.reinitialiser();
        setEtape("debut");
        return;
      }
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
    if (periode) {
      if (versLaFin) {
        if (saisieDebut.complete) setEtape("fin");
        return;
      }
      if (!periodeComplete || !debutJoueur || !finJoueur) {
        if (!saisieDebut.complete) setEtape("debut");
        return;
      }
      await envoyer({ debut: debutJoueur, fin: finJoueur });
      return;
    }
    if (!complete || !reponse) return;
    await envoyer(reponse);
  }

  // Un clic sur la frise pose la borne en cours ; au début, il passe ensuite à la fin.
  function poserSurFrise(d: HistoricDate, origine: "clic" | "glisse" | "clavier") {
    active.poserSurFrise(d);
    if (periode && etape === "debut" && origine === "clic" && !saisieFin.reponse) setEtape("fin");
  }

  // Temps écoulé sans que la correction ait pu arriver (réseau coupé) : un bouton pour redemander.
  const expirePerdue = erreur != null && restant <= 0 && !correction;
  const description = correction?.description ?? question.description;

  // Sous la frise, de gauche à droite : la carte de la question, la saisie, puis Valider qui devient la correction.
  const illustration = question.illustrationUrl ? (
    // Dessin SVG léger (8 Ko) : pas d'optimisation d'image nécessaire.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={question.illustrationUrl} alt="" width={160} height={120} />
  ) : question.illustration ? (
    <Motif nom={question.illustration} viewBox="0 0 160 120" />
  ) : (
    <Motif nom="parchemin" viewBox="0 0 48 48" className={s.pictogramme} />
  );
  const boutonValider = expirePerdue ? (
    <button type="button" className={s.valider} onClick={() => void envoyer(null)}>
      Réessayer
    </button>
  ) : (
    <button type="button" className={s.valider} onClick={valider} disabled={envoi || passage || (!correction && !pret)}>
      {correction ? (suivante?.libelle ?? "Rejouer cette question") : envoi && multi ? multi.attente : versLaFin ? "Placer la fin →" : "Valider ma réponse"}
    </button>
  );
  const reponseBoite = (
    <div className={s.rangee}>
      <div data-superposition className={`${s.boite} ${s.carteBas}`}>
        <div className={s.illustration}>{illustration}</div>
        <div className={s.carteTexte}>
          <span className={s.inventaire}>
            Question {question.numero} sur {question.total}
          </span>
          <strong>{question.titre}</strong>
        </div>
      </div>
      <div data-superposition data-corrige={correction ? "" : undefined} className={`${s.boite} ${s.colonneSaisie}`}>
        {periode && (
          <div className={s.bornes} role="group" aria-label="Début et fin de la période">
            {(["debut", "fin"] as const).map((b) => {
              const d = b === "debut" ? debutJoueur : finJoueur;
              return (
                <button key={b} type="button" aria-pressed={etape === b} disabled={correction != null || envoi}
                  onPointerDown={(e) => e.preventDefault()} onClick={() => setEtape(b)}>
                  <span>{b === "debut" ? "Début" : "Fin"}</span>
                  <b className="date">{d ? dateCourte(aLaPrecision(d, precision)) : "…"}</b>
                </button>
              );
            })}
          </div>
        )}
        <SaisieDate
          key={periode ? etape : undefined}
          consigne={periode ? (etape === "debut" ? "Le début : tapez la date ou cliquez sur la frise" : "La fin : tapez la date ou cliquez sur la frise") : undefined}
          precision={precision}
          champs={champs}
          onChange={changerChamps}
          onFocusChange={setEnSaisie}
          onValider={valider}
          verrouille={correction != null || envoi}
        />
        {inversee && !correction && (
          <p role="alert" className={s.erreur}>
            La fin ne peut pas être avant le début.
          </p>
        )}
        {erreur && (
          <p role="alert" className={s.erreur}>
            {erreur}
          </p>
        )}
      </div>
      <div data-superposition className={s.colonneAction}>
        {correction ? (
          <div className={`${s.boite} ${s.resultat}`} role="status">
            <span className={s.inventaire}>
              Réponse : {formatHistoricDate(correction.bonne, precision)}
              {correction.bonneFin && <> → {formatHistoricDate(correction.bonneFin, precision)}</>}
            </span>
            <span className={`${s.points} date`}>{correction.points} pts</span>
            <span>
              {correction.expiree
                ? "Temps écoulé : cette question vaut 0 point."
                : correction.bonneFin
                  ? `Début : ${correction.ecart ? `écart de ${correction.ecart}` : PILE[precision]}. Fin : ${correction.ecartFin ? `écart de ${correction.ecartFin}` : PILE[precision]}.`
                  : correction.ecart
                    ? `Écart de ${correction.ecart}.`
                    : BRAVO[precision]}
            </span>
            {description && <span className={s.explication}>{description}</span>}
            {multi ? multi.apresCorrection : boutonValider}
          </div>
        ) : (
          boutonValider
        )}
      </div>
    </div>
  );

  // Boîte du haut : la carte de la question, à l'horizontale.
  const carte = (
    <div className={`${s.carteH}${question.titre.length > 70 ? ` ${s.titreLong}` : question.titre.length > 40 ? ` ${s.titreMoyen}` : ""}`}>
      <div className={s.illustration}>{illustration}</div>
      <div className={s.carteTexte}>
        <span className={s.inventaire}>
          {question.inventaire ? `${question.inventaire} · ` : ""}Question {question.numero} sur {question.total}
          {multi?.inventaire}
        </span>
        <h2>{question.titre}</h2>
        {periode ? (
          <p className={s.consigne}>
            <span className={s.badgePeriode}>Début et fin</span> {REGLAGES[precision].consigne.replace("À trouver : ", "À trouver pour les deux : ")}
          </p>
        ) : (
          <p className={s.consigne}>{REGLAGES[precision].consigne}</p>
        )}
      </div>
      {chrono && !correction && <ChronoCirculaire restant={restant} total={chrono.totalMs / 1000} taille={72} />}
    </div>
  );

  return (
    <section ref={ecran} className={s.jeu} aria-label="Écran de partie">
      <Frise
        precision={precision}
        habillage={habillage}
        controle={controle}
        reponse={correction && periode ? debutJoueur : reponse}
        onReponse={poserSurFrise}
        enSaisie={enSaisie}
        periode={periode ? (correction ? { etape: "debut", autre: finJoueur } : { etape, autre: autre?.reponse ?? null }) : null}
        correction={correction && { bonne: correction.bonne, titre: question.titre, bonneFin: correction.bonneFin }}
        haut={
          <>
            {multi?.quitter ?? (
              <Link href="/" className={s.quitter}>
                ← Quitter
              </Link>
            )}
            {carte}
            {multi?.autour}
          </>
        }
        sous={<BandeEpoques vue={vue} animer={animer} bornes={cadre} />}
        bas={reponseBoite}
      />
    </section>
  );
}
