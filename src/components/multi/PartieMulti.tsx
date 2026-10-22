"use client";

// Partie Convivial (#140) : l'écran de partie du solo (frise plein écran, clic ou cases JJ/MM/AAAA), branché
// sur la partie du salon. Le serveur fixe les horaires et corrige ; on lui redemande l'état aux échéances,
// quand un autre joueur prévient (« partie_change » sur le canal), et toutes les 3 s par sécurité.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HistoricDate } from "@/lib/game/dates";
import { habillageDe } from "@/lib/game/habillages";
import { capitaliser, precisionDepuis, urlIllustration } from "@/lib/game/partie";
import { bornesDe, type Choix } from "@/lib/solo/choix";
import { estimerDecalage, type Echantillon } from "@/lib/multi/horloge";
import { chronoAccelere, classement, correctionPour, phaseDe, prochainRendezVous, type EtatPartie, type QuestionMulti } from "@/lib/multi/partie";
import type { MembreSalon } from "@/lib/multi/salon";
import { EcranPartie, type Correction, type ReponsePeriode } from "@/components/partie/EcranPartie";
import s from "./partie-multi.module.css";

export type ActionsPartieMulti = {
  etat: () => Promise<EtatPartie | null>;
  repondre: (questionId: string, debut: HistoricDate, fin?: HistoricDate | null) => Promise<{ ok: true } | { ok: false; erreur: string }>;
  /** Prévenir les autres que la partie a changé (réponse envoyée). */
  prevenir: () => void;
};

type Props = {
  membres: MembreSalon[];
  presents: ReadonlySet<string>;
  actions: ActionsPartieMulti;
  /** Augmente quand un autre joueur prévient : on redemande l'état. */
  signal: number;
  /** Fin de partie : retour au salon. */
  retour: () => void;
  quitter: () => void;
  /** Aperçu : état et heure figés. */
  depart?: EtatPartie | null;
};

// Mêmes couleurs que les pions du salon (--j1 à --j6), en clair : la frise ne voit pas ces variables.
const COULEURS = ["#8a2f2b", "#2f6b8a", "#5b7a3a", "#8a5a2f", "#6b3a8a", "#2f8a7a"];

export function PartieMulti({ membres, presents, actions, signal, retour, quitter, depart = null }: Props) {
  const [etat, setEtat] = useState<EtatPartie | null>(depart);
  const [decalage, setDecalage] = useState(0);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const echantillons = useRef<Echantillon[]>([]);
  const etatRef = useRef(etat);
  // Réponse envoyée : la correction arrive quand la question est close pour tout le monde.
  const attente = useRef<{ id: string; resoudre: (c: Correction) => void } | null>(null);

  const appliquer = useCallback((e: EtatPartie) => {
    etatRef.current = e;
    setEtat(e);
    const a = attente.current;
    if (a && e.question?.id === a.id && e.question.revelee_le) {
      attente.current = null;
      a.resoudre(correctionPour(e.question, e.moi)!);
    }
  }, []);

  const charger = useCallback(async () => {
    const envoi = Date.now();
    const e = await actions.etat();
    const reception = Date.now();
    if (!e) return;
    // Horloge du serveur : la mesure au plus court aller-retour parmi les 10 dernières.
    echantillons.current = [...echantillons.current.slice(-9), { envoi, serveur: e.heure_serveur, reception }];
    setDecalage(estimerDecalage(echantillons.current).decalage);
    appliquer(e);
  }, [actions, appliquer]);

  useEffect(() => {
    if (depart) return;
    const premier = setTimeout(() => void charger(), 0);
    const filet = setInterval(() => void charger(), 3000);
    return () => { clearTimeout(premier); clearInterval(filet); };
  }, [charger, depart]);
  useEffect(() => {
    if (signal > 0 && !depart) {
      const t = setTimeout(() => void charger(), 0);
      return () => clearTimeout(t);
    }
  }, [signal, charger, depart]);
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  // Aux échéances (fin du chrono, question suivante), redemander l'état juste après.
  const rendezVous = etat ? prochainRendezVous(etat) : null;
  useEffect(() => {
    if (rendezVous == null || depart) return;
    const t = setTimeout(() => void charger(), Math.max(0, rendezVous - (Date.now() + decalage)) + 150);
    return () => clearTimeout(t);
  }, [rendezVous, decalage, charger, depart]);

  const serveur = maintenant + decalage;
  const phase = etat ? phaseDe(etat, serveur) : null;
  const question = phase && (phase.type === "question" || phase.type === "revelation") ? phase.question : null;
  // Un objet stable tant que l'échéance ne change pas (le mode chrono peut la rapprocher).
  const finMs = question ? Date.parse(question.limite_le) - decalage : null;
  const totalMs = (etat?.partie.duree_question ?? 30) * 1000;
  const chrono = useMemo(() => (finMs == null ? undefined : { finMs, totalMs }), [finMs, totalMs]);

  if (!etat || !phase) return <div className={s.plein}><p className={s.grand}>Chargement de la partie…</p></div>;

  const pseudo = (id: string) => membres.find((m) => m.id === id)?.pseudo ?? "Joueur parti";
  const couleur = (id: string) => {
    const m = membres.find((x) => x.id === id);
    return COULEURS[((m?.ordre ?? 1) - 1) % COULEURS.length];
  };
  const hote = membres.find((m) => m.est_hote)?.id;
  const lignes = classement(etat);
  const tableau = (fin = false) => (
    <section className={`${s.classement} ${fin ? s.final : ""}`} aria-label="Classement">
      <h2><span>Classement</span>{!fin && <span>Q{question?.position ?? etat.prochaine?.position ?? etat.partie.total}/{etat.partie.total}</span>}</h2>
      <ol>
        {lignes.map((l) => (
          <li key={l.membreId} className={l.membreId === etat.moi ? s.moi : undefined}>
            <span className={s.rang}>{l.rang}</span>
            <span className={s.pion} style={{ background: couleur(l.membreId) }} aria-hidden>{[...pseudo(l.membreId)][0]?.toUpperCase()}</span>
            <span className={s.nom}>
              {pseudo(l.membreId)}
              {l.membreId === hote && <span title="Hôte"> ♛</span>}
              {l.aValide && <span className={s.valide} title="A validé"> ✓</span>}
              {!presents.has(l.membreId) && <span className={s.absent}> · reconnexion…</span>}
            </span>
            <b className={`${s.points} date`}>{l.points.toLocaleString("fr-FR")}</b>
          </li>
        ))}
      </ol>
      {!fin && lignes.length > 3 && <p className={s.plus}>+{lignes.length - 3} joueur{lignes.length > 4 ? "s" : ""}</p>}
    </section>
  );

  if (phase.type === "fin") {
    return (
      <div className={s.plein}>
        <div className={s.boiteFin}>
          <span className={s.inventaire}>Partie terminée · {etat.partie.contenu.titre ?? "Toute l'Histoire"}</span>
          <h1>{lignes[0] ? `${pseudo(lignes[0].membreId)} l'emporte !` : "Partie terminée"}</h1>
          {tableau(true)}
          <button type="button" className={s.bouton} onClick={retour}>Retour au salon</button>
        </div>
      </div>
    );
  }

  if (phase.type === "decompte") {
    const reste = Math.max(0, Math.ceil((phase.debutMs - serveur) / 1000));
    return (
      <div className={s.plein}>
        <button type="button" className={s.quitter} onClick={quitter}>← Quitter</button>
        <div className={s.boiteFin}>
          <span className={s.inventaire}>{phase.position === 1 ? "La partie commence" : "Question suivante"} · {etat.partie.contenu.titre ?? "Toute l'Histoire"}</span>
          <h1>Question {phase.position} sur {etat.partie.total}</h1>
          <p className={`${s.decompte} date`} aria-live="polite">{reste > 0 ? reste : "…"}</p>
        </div>
      </div>
    );
  }

  const q = question as QuestionMulti;
  // La frise se limite au pack, au thème ou à la période joués, comme en solo.
  const { type, id } = etat.partie.contenu;
  const choix = type === "pack" || type === "theme" || type === "periode" ? { mode: type, [type]: id, difficulte: etat.partie.precision } as Choix : null;
  const bornes = choix ? bornesDe(choix) : null;
  const joueurs = etat.scores.length;
  const accelere = chronoAccelere(etat);
  const dejaRepondu = q.ont_valide.includes(etat.moi) || q.revelee_le != null;

  // Envoi de la réponse, puis attente de la clôture (tous ont validé, ou fin du chrono).
  async function corrigerAvec(questionId: string, debut: HistoricDate | null, fin?: HistoricDate | null): Promise<Correction> {
    if (debut) {
      const r = await actions.repondre(questionId, debut, fin);
      if (!r.ok && r.erreur !== "Temps écoulé" && r.erreur !== "Réponse déjà envoyée") throw new Error(r.erreur);
      actions.prevenir();
    }
    return new Promise<Correction>((resoudre) => {
      attente.current = { id: questionId, resoudre };
      const e = etatRef.current;
      if (e) appliquer(e);
      void charger();
    });
  }

  const suivanteDans = phase.type === "revelation" && phase.suivanteMs != null ? Math.max(0, Math.ceil((phase.suivanteMs - serveur) / 1000)) : null;
  return (
    <EcranPartie
      key={q.id}
      question={{
        id: q.id, titre: capitaliser(q.titre), precision: precisionDepuis(etat.partie.precision),
        numero: q.position, total: etat.partie.total, periode: q.periode,
        illustrationUrl: urlIllustration(q.image_path) ?? undefined,
      }}
      chrono={chrono}
      bornes={bornes}
      habillage={habillageDe(choix, bornes)}
      corriger={(id, rep) => corrigerAvec(id, rep)}
      corrigerPeriode={(id, rep: ReponsePeriode | null) => corrigerAvec(id, rep?.debut ?? null, rep?.fin ?? null)}
      multi={{
        inventaire: <>
          {" · "}<span className={s.valides}>{q.ont_valide.length} / {joueurs} ont validé</span>
          {accelere && !q.revelee_le && <> · <span className={s.accelere}>Mode chrono : plus que 10 s !</span></>}
        </>,
        autour: <div className={s.autour}>{tableau()}</div>,
        quitter: <button type="button" className={s.quitterJeu} onClick={quitter}>← Quitter</button>,
        attente: "Réponse envoyée · on attend les autres",
        apresCorrection: <p className={s.suite} role="status">
          {suivanteDans != null ? `Question suivante dans ${suivanteDans} s` : "Résultats dans un instant…"}
        </p>,
        dejaRepondu,
        // Mode invisible : les pions des autres apparaissent à la correction seulement.
        pions: q.revelee_le ? (q.reponses ?? []).filter((r) => r.membre_id !== etat.moi).map((r) => ({
          id: r.membre_id, pseudo: pseudo(r.membre_id), couleur: couleur(r.membre_id),
          date: { year: r.debut.year, month: r.debut.month ?? null, day: r.debut.day ?? null },
          fin: r.fin ? { year: r.fin.year, month: r.fin.month ?? null, day: r.fin.day ?? null } : null,
        })) : undefined,
      }}
    />
  );
}
