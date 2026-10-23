"use client";

// Vote, Thème Mystère (#144) et pick & ban (#145) : ce qui précède la première question quand l'hôte n'a pas
// choisi le contenu. Maquettes : docs/maquettes/v1.3/vote-pc.png, roulette-pc.png, pickban-pc.png et pickban-tel.png.
// Le serveur tient le vote et les bans, tire la roulette et fixe les horaires ; ces écrans ne font que les montrer,
// à l'heure du serveur.
import { useState, type CSSProperties } from "react";
import { Motif } from "@/components/charte/Motif";
import { ChronoCirculaire } from "@/components/ui/ChronoCirculaire";
import { detailContenu, motifContenu } from "@/lib/multi/contenu";
import { bandeRoulette, decompteVotes, lirePickBan, type PickBan, type TiragePartie, type VotePartie } from "@/lib/multi/partie";
import type { MembreSalon } from "@/lib/multi/salon";
import type { SoloDifficulty } from "@/lib/game/solo";
import s from "./choix-partie.module.css";

const ETIQUETTES = { pack: "Pack", periode: "Période", theme: "Thème" } as const;
const PLURIELS = { pack: "Packs", periode: "Périodes", theme: "Thèmes" } as const;
const PRECISIONS: Record<SoloDifficulty, string> = { YEAR: "Année", MONTH: "Mois", DAY: "Jour" };

type Commun = {
  membres: MembreSalon[];
  couleur: (id: string) => string;
  /** Heure du serveur (ms). */
  serveur: number;
  quitter: () => void;
};

/** « Sarah n'a pas encore voté », « Sarah et Hugo n'ont… », « 3 joueurs n'ont… ». */
export function phraseAttente(noms: string[]): string {
  if (noms.length === 0) return "Tout le monde a voté.";
  if (noms.length === 1) return `${noms[0]} n'a pas encore voté.`;
  if (noms.length === 2) return `${noms[0]} et ${noms[1]} n'ont pas encore voté.`;
  return `${noms.length} joueurs n'ont pas encore voté.`;
}

export function VoteMulti({ vote, membres, moi, jeJoue, categories, couleur, serveur, quitter, voter }: Commun & {
  vote: VotePartie;
  moi: string;
  jeJoue: boolean;
  categories: readonly ("pack" | "periode" | "theme")[];
  voter: (choix: number) => Promise<{ ok: true } | { ok: false; erreur: string }>;
}) {
  // Mon vote s'affiche tout de suite ; le serveur confirme au prochain état.
  const [envoye, setEnvoye] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { voix, monChoix } = decompteVotes(vote, moi);
  const choix = envoye ?? monChoix;
  const joueurs = membres.filter((m) => !m.en_attente);
  const ontVote = new Set(vote.votes.map((v) => v.membre_id));
  if (envoye != null && jeJoue) ontVote.add(moi);
  const restant = Math.max(0, (Date.parse(vote.fin) - serveur) / 1000);
  const hote = membres.find((m) => m.est_hote)?.pseudo;
  const pseudo = (id: string) => membres.find((m) => m.id === id)?.pseudo ?? "?";

  async function choisir(i: number) {
    if (!jeJoue || i === choix) return;
    setEnvoye(i);
    setErreur(null);
    const r = await voter(i);
    if (!r.ok) { setEnvoye(null); setErreur(r.erreur); }
  }

  return (
    <div className={`${s.plein} ${s.vote}`}>
      <button type="button" className={s.quitter} onClick={quitter}>← Quitter le salon</button>
      <header className={s.tete}>
        <span className={s.inventaire}>{hote ? `Le salon de ${hote} · ` : ""}Vote · {ontVote.size} vote{ontVote.size > 1 ? "s" : ""} sur {joueurs.length}</span>
        <h1>Sur quoi joue-t-on ?</h1>
      </header>
      <div className={s.chrono}><ChronoCirculaire restant={restant} total={vote.duree} taille={76} /></div>
      <ul className={s.cartes} aria-label="Propositions">
        {vote.propositions.map((p, i) => {
          // Mon pion suit mon vote affiché (envoyé ou confirmé).
          const pions = voix[i].filter((id) => id !== moi);
          if (choix === i && jeJoue) pions.push(moi);
          const detail = detailContenu(p);
          return <li key={`${p.type}-${p.id}`}>
            <button type="button" className={s.carte} data-choisi={choix === i} aria-pressed={choix === i} disabled={!jeJoue}
              onClick={() => void choisir(i)}>
              <span className={s.illu}><Motif nom={motifContenu(p)} className={s.motif} /></span>
              <span className={s.tag}>{ETIQUETTES[p.type]}</span>
              <b className={s.titre}>{p.titre}</b>
              {detail && <span className={s.detail}>{detail}</span>}
              <span className={s.votes} aria-label={`${pions.length} vote${pions.length > 1 ? "s" : ""}`}>
                {pions.map((id) => <span key={id} className={s.pion} style={{ background: couleur(id) }} title={pseudo(id)}>
                  {[...pseudo(id)][0]?.toUpperCase()}</span>)}
              </span>
              {choix === i && <span className={s.monVote}>✓ Votre vote</span>}
            </button>
          </li>;
        })}
      </ul>
      <footer className={s.pied}>
        {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
        <p>{!jeJoue ? "Vous rejoindrez la partie suivante : regardez le vote. " : choix == null ? "Touchez une carte pour voter. " : ""}
          {phraseAttente(joueurs.filter((m) => !ontVote.has(m.id)).map((m) => m.pseudo))} En cas d&apos;égalité, la roulette tranche.</p>
        {categories.length > 0 && <p>Proposé parmi : <b>{categories.map((c) => PLURIELS[c]).join(" · ")}</b> (cochés par l&apos;hôte)</p>}
      </footer>
    </div>
  );
}

/** Durée de la roulette (histoire.durees_choix_multi) : elle tourne, ralentit, puis s'arrête sur le gagnant. */
export const DUREE_ROULETTE = 6000;
const ROTATION = 4600;
const ARRET = 24;

export function RouletteMulti({ tirage, egalite, total, precision, debutMs, serveur, quitter }: Omit<Commun, "membres" | "couleur"> & {
  tirage: TiragePartie;
  /** Roulette d'un vote à égalité (sinon : Thème Mystère). */
  egalite: boolean;
  total: number;
  precision: SoloDifficulty;
  /** Première question (heure du serveur, ms). */
  debutMs: number;
}) {
  const depart = Date.parse(tirage.fin) - DUREE_ROULETTE;
  // Même animation pour tous : on la décale du temps déjà écoulé sur l'horloge du serveur (fixé à l'arrivée).
  const [retard] = useState(() => Math.max(0, serveur - depart));
  const arretee = serveur - depart >= ROTATION;
  const bande = bandeRoulette(tirage, ARRET);
  const reste = Math.max(0, Math.ceil((debutMs - serveur) / 1000));
  const style = { "--arret": ARRET, animationDelay: `-${retard}ms`, animationDuration: `${ROTATION}ms` } as CSSProperties;
  const finalistes = tirage.candidats.length;
  return (
    <div className={`${s.plein} ${s.roulette}`}>
      <button type="button" className={s.quitter} onClick={quitter}>← Quitter le salon</button>
      <header className={s.tete}>
        <span className={s.inventaire}>{egalite ? `Égalité entre ${finalistes} propositions · la roulette tranche` : "Thème Mystère · tiré pour tout le salon"}</span>
        <h1>La roulette décide…</h1>
      </header>
      <div className={s.fenetre} data-arretee={arretee} aria-hidden="true">
        <div className={s.bande} style={style}>
          {bande.map((c, i) => <div key={i} className={s.case} data-gagnante={arretee && i === ARRET}>
            <span className={s.illu}><Motif nom={motifContenu(c)} className={s.motif} /></span>
            <b>{c.titre}</b>
          </div>)}
        </div>
        <span className={s.repere} />
      </div>
      <div className={s.annonce} role="status">
        {arretee ? <>
          <h2>{tirage.gagnant.titre}</h2>
          <p>{total} questions · {PRECISIONS[precision]} · {reste > 0 ? `la partie commence dans ${reste} s` : "c'est parti !"}</p>
        </> : <p>La roulette tourne…</p>}
      </div>
    </div>
  );
}

type Resultat = Promise<{ ok: true } | { ok: false; erreur: string }>;

export function PickBanMulti({ pickBan, membres, moi, couleur, serveur, debutMs, total, precision, quitter, bannir }: Commun & {
  pickBan: PickBan;
  moi: string;
  /** Pick & ban fini : première question (heure du serveur, ms). */
  debutMs: number | null;
  total: number;
  precision: SoloDifficulty;
  bannir: (choix: number) => Resultat;
}) {
  // La carte visée, puis le ban envoyé (affiché tout de suite, le serveur confirme au prochain état).
  const [vise, setVise] = useState<{ tour: number; choix: number } | null>(null);
  const [envoi, setEnvoi] = useState<{ tour: number; choix: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const lu = lirePickBan(pickBan);
  const tour = pickBan.bans.length;
  const enCours = envoi?.tour === tour ? envoi : null;
  const aMoi = lu.joueur === moi && !enCours;
  const choix = vise?.tour === tour && !lu.bannis.has(vise.choix) ? vise.choix : null;
  const pseudo = (id: string | null) => membres.find((m) => m.id === id)?.pseudo ?? "Joueur parti";
  const initiale = (id: string | null) => [...pseudo(id)][0]?.toUpperCase();
  const restant = pickBan.tour_fin ? Math.max(0, Math.ceil((Date.parse(pickBan.tour_fin) - serveur) / 1000)) : 0;
  const retenue = lu.retenue != null ? pickBan.propositions[lu.retenue] : null;
  const debutDans = debutMs != null ? Math.max(0, Math.ceil((debutMs - serveur) / 1000)) : null;
  const restantes = lu.restantes.length - (enCours ? 1 : 0);

  async function confirmer() {
    if (choix == null || !aMoi) return;
    setEnvoi({ tour, choix });
    setErreur(null);
    const r = await bannir(choix);
    if (!r.ok) { setEnvoi(null); setErreur(r.erreur); }
  }

  const joueur = (id: string, cote: "g" | "d") => (
    <div className={s.joueur} data-cote={cote} data-actif={lu.joueur === id}>
      <span className={s.grosPion} style={{ background: couleur(id) }} aria-hidden>{initiale(id)}</span>
      <span>
        <b>{pseudo(id)}{id === moi ? " (toi)" : ""}</b>
        <small>a banni {lu.bansDe(id)}{lu.joueur === id ? (id === moi ? " · à toi" : " · son tour") : ""}</small>
      </span>
    </div>
  );
  // Moi à gauche, l'adversaire à droite (comme la maquette).
  const gauche = pickBan.ordre.includes(moi) ? moi : pickBan.ordre[0];
  const droite = pickBan.ordre.find((id) => id !== gauche);

  return (
    <div className={`${s.plein} ${s.pickban}`}>
      <button type="button" className={s.quitter} onClick={quitter}>← Quitter</button>
      <header className={s.duel}>
        {gauche && joueur(gauche, "g")}
        <div className={s.vs}><span className={s.inventaire}>1 contre 1 · pick &amp; ban</span><b className="date">VS</b></div>
        {droite && joueur(droite, "d")}
      </header>
      <div className={s.consigne} role="status">
        {retenue ? <>
          <h1>On joue : {retenue.titre}</h1>
          <p>{total} questions · {PRECISIONS[precision]} · {debutDans ? `la partie commence dans ${debutDans} s` : "c'est parti !"}</p>
        </> : aMoi ? <>
          <h1>À toi de bannir</h1>
          <p>Il reste {restantes} choix : bannis-en un. Temps : <b className={`${s.secondes} date`}>{restant}</b> s (sinon au hasard)</p>
        </> : <>
          <h1>{enCours ? "Ban envoyé…" : `${pseudo(lu.joueur)} bannit…`}</h1>
          <p>Il reste {restantes} choix. Temps : <b className={`${s.secondes} date`}>{restant}</b> s (sinon au hasard)</p>
        </>}
      </div>
      <ul className={s.propositions} aria-label="Propositions">
        {pickBan.propositions.map((p, i) => {
          const ban = lu.bannis.get(i) ?? (enCours?.choix === i ? { membre_id: moi, hasard: false } : null);
          return <li key={`${p.type}-${p.id}`}>
            <button type="button" className={s.prop} data-banni={!!ban} data-vise={choix === i && !ban} data-retenue={lu.retenue === i}
              disabled={!aMoi || !!ban} aria-pressed={choix === i}
              aria-label={`${p.titre}${ban ? `, banni${ban.hasard ? " au hasard" : ` par ${pseudo(ban.membre_id)}`}` : ""}`}
              onClick={() => setVise({ tour, choix: i })}>
              {ban && <span className={s.par} style={{ background: ban.membre_id ? couleur(ban.membre_id) : undefined }}
                title={ban.hasard ? "Banni au hasard (temps écoulé)" : `Banni par ${pseudo(ban.membre_id)}`}>
                {ban.hasard ? "?" : initiale(ban.membre_id)}</span>}
              <span className={s.illu}><Motif nom={motifContenu(p)} className={s.motif} /></span>
              <b className={s.titre}>{p.titre}</b>
              <span className={s.detail}>{ETIQUETTES[p.type]}</span>
            </button>
          </li>;
        })}
      </ul>
      <footer className={s.action}>
        {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
        {aMoi && <button type="button" className={s.bannir} disabled={choix == null} onClick={() => void confirmer()}>
          {choix == null ? "Touche une carte à bannir" : `Bannir « ${pickBan.propositions[choix].titre} »`}</button>}
      </footer>
    </div>
  );
}
