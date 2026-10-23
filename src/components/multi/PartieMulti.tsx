"use client";

// Partie Convivial (#140) : l'écran de partie du solo (frise plein écran, clic ou cases JJ/MM/AAAA), branché
// sur la partie du salon. Le serveur fixe les horaires et corrige ; on lui redemande l'état aux échéances,
// quand un autre joueur prévient (« partie_change » sur le canal), et toutes les 3 s par sécurité.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HistoricDate } from "@/lib/game/dates";
import { habillageDe } from "@/lib/game/habillages";
import { capitaliser, precisionDepuis, urlIllustration } from "@/lib/game/partie";
import { bornesDe, type Choix } from "@/lib/solo/choix";
import { versT } from "@/lib/game/frise";
import { creerLimiteur, doitDiffuser, rapprocher } from "@/lib/multi/curseurs";
import { estimerDecalage, type Echantillon } from "@/lib/multi/horloge";
import { DUREE_BULLE, elementChat, type MessageChat } from "@/lib/multi/chat";
import {
  chronoAccelere, classement, closeAvantLaFin, correctionPour, etapeRevelation, phaseDe, prochainRendezVous, REVELATION_DATE,
  type EtatPartie, type LigneClassement, type QuestionMulti,
} from "@/lib/multi/partie";
import type { BilanPartie, HabillageFin } from "@/lib/multi/bilan";
import type { MembreSalon } from "@/lib/multi/salon";
import { EcranPartie, type Correction, type ReponsePeriode } from "@/components/partie/EcranPartie";
import type { PionFrise } from "@/components/frise/Frise";
import { EMOTES } from "@/lib/multi/chat-catalogue";
import { ContenuChat, ImageEmote } from "./BarreChat";
import { FinPartie } from "./FinPartie";
import s from "./partie-multi.module.css";

export type ActionsPartieMulti = {
  etat: () => Promise<EtatPartie | null>;
  repondre: (questionId: string, debut: HistoricDate, fin?: HistoricDate | null) => Promise<{ ok: true } | { ok: false; erreur: string }>;
  /** Prévenir les autres que la partie a changé (réponse envoyée). */
  prevenir: () => void;
  /** Mode visible : diffuser mon curseur sur le canal du salon. */
  curseur: (c: CurseurJoueur) => void;
  /** Fin de partie : podium, classement final et faits marquants (#143). */
  bilan: () => Promise<BilanPartie | null>;
};

/** Curseur d'un joueur, tel qu'il circule sur le canal (mode visible). */
export type CurseurJoueur = { membreId: string; question: string; debut: HistoricDate; fin: HistoricDate | null };
type Position = { question: string; t: number; tFin: number | null; debut: HistoricDate; fin: HistoricDate | null };

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
  /** Réglage de l'hôte : on voit les curseurs des autres pendant la question (#141). */
  modeVisible?: boolean;
  /** Reçoit les curseurs des autres (mode visible) ; renvoie de quoi se désabonner. */
  abonnerCurseurs?: (recevoir: (c: CurseurJoueur) => void) => () => void;
  /** Aperçu : habillage imposé à l'écran de fin. */
  habillageFin?: HabillageFin;
  /** Chat du salon pendant la partie : émotes seules, en bulle à côté du joueur dans le classement (#142). */
  chat?: ChatPartie;
};

export type ChatPartie = { messages: readonly MessageChat[]; masques: ReadonlySet<string>; dire: (id: string) => string | null };

// « Réagir » pendant la révélation (maquette revelation-pc) : rire, duel, couronne, sablier.
const REACTIONS = ["napoleon-rire", "duel", "couronne", "sablier"].map((id) => EMOTES.find((e) => e.id === id)!);

// Mêmes couleurs que les pions du salon (--j1 à --j6), en clair : la frise ne voit pas ces variables.
const COULEURS = ["#8a2f2b", "#2f6b8a", "#5b7a3a", "#8a5a2f", "#6b3a8a", "#2f8a7a"];

export function PartieMulti({ membres, presents, actions, signal, retour, quitter, depart = null, modeVisible = false, abonnerCurseurs, habillageFin, chat }: Props) {
  const [etat, setEtat] = useState<EtatPartie | null>(depart);
  const [decalage, setDecalage] = useState(0);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const echantillons = useRef<Echantillon[]>([]);
  const etatRef = useRef(etat);
  // Réponse envoyée : la correction arrive quand la question est close pour tout le monde.
  const attente = useRef<{ id: string; resoudre: (c: Correction) => void } | null>(null);

  // Révélation en trois temps : la bonne date (et ma correction) arrive après les placements de chacun.
  const decalageRef = useRef(0);
  const appliquer = useCallback((e: EtatPartie) => {
    etatRef.current = e;
    setEtat(e);
    const a = attente.current;
    if (a && e.question?.id === a.id && e.question.revelee_le) {
      attente.current = null;
      const correction = correctionPour(e.question, e.moi)!;
      const reste = Date.parse(e.question.revelee_le) + REVELATION_DATE - (Date.now() + decalageRef.current);
      if (reste > 0) setTimeout(() => a.resoudre(correction), reste); else a.resoudre(correction);
    }
  }, []);

  const charger = useCallback(async () => {
    const envoi = Date.now();
    const e = await actions.etat();
    const reception = Date.now();
    if (!e) return;
    // Horloge du serveur : la mesure au plus court aller-retour parmi les 10 dernières.
    echantillons.current = [...echantillons.current.slice(-9), { envoi, serveur: e.heure_serveur, reception }];
    decalageRef.current = estimerDecalage(echantillons.current).decalage;
    setDecalage(decalageRef.current);
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

  // Mode visible : cibles reçues du canal, positions affichées lissées vers elles (images d'animation).
  const cibles = useRef(new Map<string, Position>());
  const [affiches, setAffiches] = useState<ReadonlyMap<string, Position>>(new Map());
  useEffect(() => {
    if (!modeVisible || !abonnerCurseurs) return;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let image = 0;
    let avant = performance.now();
    const animer = (ici: number) => {
      const dt = ici - avant;
      avant = ici;
      image = 0;
      let encore = false;
      setAffiches((anciens) => {
        const suivants = new Map<string, Position>();
        for (const [id, c] of cibles.current) {
          const a = anciens.get(id);
          if (reduit || !a || a.question !== c.question) { suivants.set(id, c); continue; }
          const t = rapprocher(a.t, c.t, dt);
          const tFin = c.tFin == null ? null : rapprocher(a.tFin ?? c.tFin, c.tFin, dt);
          if (t !== c.t || tFin !== c.tFin) encore = true;
          suivants.set(id, { ...c, t, tFin });
        }
        return suivants;
      });
      if (encore) image = requestAnimationFrame(animer);
    };
    const desabonner = abonnerCurseurs((c) => {
      cibles.current.set(c.membreId, { question: c.question, debut: c.debut, fin: c.fin, t: versT(c.debut), tFin: c.fin ? versT(c.fin) : null });
      if (!image) { avant = performance.now(); image = requestAnimationFrame(animer); }
    });
    return () => { desabonner(); cancelAnimationFrame(image); };
  }, [modeVisible, abonnerCurseurs]);

  // Mon curseur : 10 envois par seconde au plus, et seulement s'il a bougé.
  const limiteur = useMemo(() => creerLimiteur(actions.curseur), [actions]);
  useEffect(() => () => limiteur.arreter(), [limiteur]);
  const dernierEnvoi = useRef("");

  const serveur = maintenant + decalage;
  const phase = etat ? phaseDe(etat, serveur) : null;
  const question = phase && (phase.type === "question" || phase.type === "revelation") ? phase.question : null;
  // Fin de partie : le bilan se demande une fois (réessai toutes les 3 s s'il n'est pas encore prêt).
  const [bilan, setBilan] = useState<BilanPartie | null>(null);
  const fini = phase?.type === "fin";
  useEffect(() => {
    if (!fini || bilan) return;
    let actif = true;
    const demander = () => void actions.bilan().then((b) => { if (actif && b) setBilan(b); });
    const t = setTimeout(demander, 0);
    const filet = setInterval(demander, 3000);
    return () => { actif = false; clearTimeout(t); clearInterval(filet); };
  }, [fini, bilan, actions]);
  // Un objet stable tant que l'échéance ne change pas (le mode chrono peut la rapprocher).
  // Plus de chrono une fois la question close.
  const finMs = question && !question.revelee_le ? Date.parse(question.limite_le) - decalage : null;
  const totalMs = (etat?.partie.duree_question ?? 30) * 1000;
  const chrono = useMemo(() => (finMs == null ? undefined : { finMs, totalMs }), [finMs, totalMs]);

  if (!etat || !phase) return <div className={s.plein}><p className={s.grand}>Chargement de la partie…</p></div>;

  const pseudo = (id: string) => membres.find((m) => m.id === id)?.pseudo ?? "Joueur parti";
  const couleur = (id: string) => {
    const m = membres.find((x) => x.id === id);
    return COULEURS[((m?.ordre ?? 1) - 1) % COULEURS.length];
  };
  const hote = membres.find((m) => m.est_hote)?.id;
  const etape = phase.type === "revelation" ? etapeRevelation(phase.question, serveur) : undefined;
  const lignes = classement(etat, etape);
  // En partie, seules les émotes s'affichent (une phrase du salon attendra le retour au salon).
  const visibles = chat ? chat.messages.filter((m) => !chat.masques.has(m.membreId) && elementChat(m.id)?.type === "emote") : [];
  const bulle = (membreId: string) => [...visibles].reverse().find((m) => m.membreId === membreId && maintenant - m.recu < DUREE_BULLE);
  const tableau = (fin = false) => (
    <section className={`${s.classement} ${fin ? s.final : ""}`} aria-label="Classement">
      <h2><span>Classement</span>{!fin && <span>{etape === "classement" ? `Après Q${question?.position}` : `Q${question?.position ?? etat.prochaine?.position ?? etat.partie.total}/${etat.partie.total}`}</span>}</h2>
      <ListeClassement lignes={lignes} rendu={(l) => {
        const b = bulle(l.membreId);
        return <>
          <span className={s.rang}>{l.rang}</span>
          <span className={s.pion} style={{ background: couleur(l.membreId) }} aria-hidden>{[...pseudo(l.membreId)][0]?.toUpperCase()}</span>
          <span className={s.nom}>
            {pseudo(l.membreId)}
            {l.membreId === hote && <span title="Hôte"> ♛</span>}
            {l.aValide && <span className={s.valide} title="A validé"> ✓</span>}
            {l.gain != null && <span className={s.gain}> +{l.gain}</span>}
            {!!l.mouvement && <span className={l.mouvement > 0 ? s.monte : s.descend} title={l.mouvement > 0 ? "Gagne des places" : "Perd des places"}>
              {" "}{l.mouvement > 0 ? "▲" : "▼"}{Math.abs(l.mouvement)}</span>}
            {l.gain === null && presents.has(l.membreId) && <span className={s.absent}> · pas de réponse</span>}
            {!presents.has(l.membreId) && <span className={s.absent}> · reconnexion…</span>}
            {b && <span key={b.cle} className={s.bulle} role="status"><ContenuChat id={b.id} /></span>}
          </span>
          <b className={`${s.points} date`}>{l.points.toLocaleString("fr-FR")}</b>
        </>;
      }} moi={etat.moi} />
      {!fin && lignes.length > 3 && <p className={s.plus}>+{lignes.length - 3} joueur{lignes.length > 4 ? "s" : ""}</p>}
    </section>
  );
  const reagir = chat && phase.type === "revelation" && (
    <div className={s.reagir}>
      <span className={s.inventaire}>Réagir</span>
      {REACTIONS.map((e) => <button key={e.id} type="button" title={`${e.nom} ${e.action}`} onClick={() => chat.dire(e.id)}>
        <ImageEmote emote={e} taille={22} /></button>)}
    </div>
  );

  if (phase.type === "fin") {
    if (bilan) return <FinPartie bilan={bilan} membres={membres} moi={etat.moi} couleur={couleur} retour={retour} quitter={quitter} habillage={habillageFin} />;
    return (
      <div className={s.plein}>
        <div className={s.boiteFin}>
          <span className={s.inventaire}>Partie terminée · {etat.partie.contenu.titre ?? "Toute l'Histoire"}</span>
          <h1>Le podium arrive…</h1>
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
  const diffuser = doitDiffuser(modeVisible, phase.type === "question", q.ont_valide.includes(etat.moi));
  const versPion = (id: string, debut: HistoricDate, fin: HistoricDate | null): PionFrise =>
    ({ id, pseudo: pseudo(id), couleur: couleur(id), date: debut, fin });
  const pions: PionFrise[] | undefined = q.revelee_le
    // À la correction : les réponses de tous (mode visible comme invisible).
    ? (q.reponses ?? []).filter((r) => r.membre_id !== etat.moi).map((r) => ({
      ...versPion(r.membre_id,
        { year: r.debut.year, month: r.debut.month ?? null, day: r.debut.day ?? null },
        r.fin ? { year: r.fin.year, month: r.fin.month ?? null, day: r.fin.day ?? null } : null),
      points: r.points, pile: r.ecart === 0 && (r.ecart_fin ?? 0) === 0,
    }))
    // Mode visible : les curseurs en direct de cette question.
    : modeVisible ? [...affiches].filter(([id, p]) => id !== etat.moi && p.question === q.id).map(([id, p]) => ({
      ...versPion(id, p.debut, p.fin), t: p.t, tFin: p.tFin ?? undefined, direct: true, valide: q.ont_valide.includes(id),
    })) : undefined;

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
        inventaire: q.revelee_le ? <>
          {" · "}<span className={s.accelere}>Révélation</span>
          {" · "}{closeAvantLaFin(q) ? "Tout le monde a validé" : "Temps écoulé"}
        </> : <>
          {" · "}<span className={s.valides}>{q.ont_valide.length} / {joueurs} ont validé</span>
          {accelere && !q.revelee_le && <> · <span className={s.accelere}>Mode chrono : plus que 10 s !</span></>}
        </>,
        autour: <div className={s.autour}>{tableau()}{reagir}</div>,
        quitter: <button type="button" className={s.quitterJeu} onClick={quitter}>← Quitter</button>,
        attente: q.revelee_le ? "Et la bonne réponse est…" : "Réponse envoyée · on attend les autres",
        apresCorrection: <p className={s.suite} role="status">
          {suivanteDans != null ? `Question suivante dans ${suivanteDans} s` : "Résultats dans un instant…"}
        </p>,
        dejaRepondu,
        pions,
        // Mode invisible : rien n'est diffusé, pas seulement masqué.
        surCurseur: diffuser ? (debut, fin) => {
          const cle = JSON.stringify([q.id, debut, fin]);
          if (cle === dernierEnvoi.current) return;
          dernierEnvoi.current = cle;
          limiteur.pousser({ membreId: etat.moi, question: q.id, debut, fin });
        } : undefined,
      }}
    />
  );
}

// Liste du classement : quand l'ordre change (révélation), chaque ligne glisse de son ancienne place à la nouvelle.
function ListeClassement({ lignes, rendu, moi }: { lignes: LigneClassement[]; rendu: (l: LigneClassement) => React.ReactNode; moi: string }) {
  const liste = useRef<HTMLOListElement>(null);
  const avant = useRef(new Map<string, number>());
  const ordre = lignes.map((l) => l.membreId).join();
  useLayoutEffect(() => {
    const el = liste.current;
    if (!el) return;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = [...el.querySelectorAll<HTMLLIElement>("li[data-id]")];
    for (const li of items) {
      const ancien = avant.current.get(li.dataset.id!);
      const delta = ancien == null ? 0 : ancien - li.offsetTop;
      if (delta && !reduit) {
        li.animate([{ transform: `translateY(${delta}px)` }, { transform: "none" }], { duration: 600, easing: "cubic-bezier(.2,.7,.2,1)" });
      }
    }
    avant.current = new Map(items.map((li) => [li.dataset.id!, li.offsetTop]));
  }, [ordre]);
  return <ol ref={liste}>
    {lignes.map((l) => <li key={l.membreId} data-id={l.membreId} className={l.membreId === moi ? s.moi : undefined}>{rendu(l)}</li>)}
  </ol>;
}
