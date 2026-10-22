"use client";

// Fin de partie (#143). Deux habillages validés par Maxou (22 oct. 2026) : la salle de musée par défaut (socles de
// marbre, portraits en camée, laurier), la gazette d'époque quand la partie portait sur l'époque des journaux.
import { useEffect, useState, type CSSProperties } from "react";
import { classementFinal, coupDeMaitre, habillageFin, plusGrosRate, romain, type BilanPartie, type HabillageFin } from "@/lib/multi/bilan";
import { LIBELLES_PRECISION, type MembreSalon } from "@/lib/multi/salon";
import s from "./fin-partie.module.css";

const RETOUR = 15;

type Props = {
  bilan: BilanPartie;
  membres: MembreSalon[];
  moi: string;
  couleur: (membreId: string) => string;
  retour: () => void;
  quitter: () => void;
  /** Aperçu : imposer un habillage au lieu de celui de l'époque. */
  habillage?: HabillageFin;
};

// Couronne de laurier autour du portrait du vainqueur : deux branches qui se rejoignent en bas, nouées d'un ruban.
const FEUILLES = [-1, 1].flatMap((sens) => Array.from({ length: 10 }, (_, i) => {
  const a = (100 + i * 16) * (Math.PI / 180);
  const x = 80 - sens * 62 * Math.cos(a), y = 74 + 62 * Math.sin(a);
  return [-6, 6].map((d) => ({ x: x + sens * d * -1, y, angle: sens * (i * 16 + 10) }));
}).flat());
function Laurier() {
  return (
    <svg viewBox="0 0 160 150" className={s.laurier} aria-hidden>
      <g fill="currentColor">
        {FEUILLES.map((f, i) => <ellipse key={i} cx={f.x} cy={f.y} rx="5" ry="11" transform={`rotate(${f.angle} ${f.x} ${f.y})`} />)}
      </g>
      <path d="M62 140q18-10 36 0M80 136l-12 14M80 136l12 14" stroke="#8a2f2b" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function FinPartie({ bilan, membres, moi, couleur, retour, quitter, habillage }: Props) {
  const [reste, setReste] = useState(RETOUR);
  useEffect(() => {
    const id = setInterval(() => setReste((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (reste <= 0) retour(); }, [reste, retour]);

  const membre = (id: string) => membres.find((m) => m.id === id);
  const pseudo = (id: string) => membre(id)?.pseudo ?? "Joueur parti";
  const initiale = (id: string) => [...pseudo(id)][0]?.toUpperCase();
  const gazette = (habillage ?? habillageFin(bilan)) === "gazette";
  const rangs = classementFinal(bilan);
  const premiers = rangs.filter((r) => r.rang === 1);
  const coup = coupDeMaitre(bilan);
  const rate = plusGrosRate(bilan);
  // Podium : 2e à gauche, 1er au centre, 3e à droite.
  const podium = [rangs[1], rangs[0], rangs[2]].map((r, i) => r && { ...r, marche: [2, 1, 3][i] });
  const gagnant = rangs[0] && rangs[0].points > 0 && premiers.length === 1 ? pseudo(rangs[0].membreId) : null;
  const titre = premiers.length > 1 && rangs[0].points > 0 ? `Égalité entre ${premiers.map((r) => pseudo(r.membreId)).join(" et ")} !`
    : gagnant ? (gazette ? `${gagnant} triomphe au terme d'une lutte acharnée !` : `${gagnant} entre dans l'Histoire !`)
    : "Partie terminée";
  const contenu = `${bilan.partie.contenu.titre ?? "Toute l'Histoire"} · ${bilan.partie.total} questions`;

  return (
    <div className={`${s.fin} ${gazette ? s.gazette : s.musee}`}>
      {gazette ? (
        <header className={s.une}>
          <div className={s.bandeau}>
            <span>Édition du {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
            <span>{contenu}</span>
            <span>Prix : 0 sou</span>
          </div>
          <div className={s.journal}>La Gazette des Kiffeurs</div>
          <h1>{titre}</h1>
        </header>
      ) : (
        <header className={s.tete}>
          <span className={s.inventaire}>Fin de partie · {contenu} · {LIBELLES_PRECISION[bilan.partie.precision]}</span>
          <h1>{titre}</h1>
          <span className={s.fleuron} aria-hidden>— ❦ —</span>
        </header>
      )}

      <div className={s.podium} aria-label="Podium">
        {podium.map((r, i) => r ? (
          <div key={r.membreId} className={s.marche} data-marche={r.marche}>
            <span className={s.portrait}>
              {r.rang === 1 && r.points > 0 && <Laurier />}
              <span className={s.camee} style={{ "--c": couleur(r.membreId) } as CSSProperties}><span>{initiale(r.membreId)}</span></span>
            </span>
            <span className={s.cartel}>
              <span className={s.nom}>{pseudo(r.membreId)}</span>
              <span className={`${s.pts} date`}>{r.points.toLocaleString("fr-FR")}</span>
            </span>
            <span className={s.socle}><span className={s.chiffre}>{romain(r.rang)}</span></span>
          </div>
        ) : <div key={`vide-${i}`} className={s.marche} aria-hidden />)}
      </div>

      <div className={s.cote}>
        <section className={`${s.classement} ${rangs.length > 5 ? s.nombreux : ""}`} aria-label="Classement final"
          style={{ "--lignes": Math.ceil(rangs.length / 2) } as CSSProperties}>
          <h2>
            <span>{gazette ? "Résultats officiels" : "Classement final"}</span>
            <span>{rangs.length} joueur{rangs.length > 1 ? "s" : ""}</span>
          </h2>
          <ol>
            {rangs.map((r) => (
              <li key={r.membreId} className={r.membreId === moi ? s.moi : undefined}>
                <span className={s.rang}>{romain(r.rang)}</span>
                <span className={s.petitPion} style={{ background: couleur(r.membreId) }} aria-hidden>{initiale(r.membreId)}</span>
                <span className={s.ligneNom}>
                  {pseudo(r.membreId)}
                  {membre(r.membreId)?.est_hote && <span title="Hôte"> ♛</span>}
                  {membre(r.membreId)?.invite && <span className={s.invite}>invité</span>}
                </span>
                <b className={`${s.total} date`}>{r.points.toLocaleString("fr-FR")}</b>
              </li>
            ))}
          </ol>
        </section>
        {coup && (
          <p className={`${s.fait} ${s.coup}`}>
            <span className={s.inventaire}>{gazette ? "Exploit du jour" : "Coup de maître"}</span>
            <span><b>{pseudo(coup.membreId)}</b> a trouvé « {coup.titre} » <b>{coup.texte}</b>.</span>
          </p>
        )}
        {rate && (
          <p className={`${s.fait} ${s.rate}`}>
            <span className={s.inventaire}>{gazette ? "Bévue du jour" : "Plus gros raté"}</span>
            <span><b>{pseudo(rate.membreId)}</b> a placé « {rate.titre} » {rate.texte}.</span>
          </p>
        )}
        <div className={s.boutons}>
          <button type="button" className={s.quitter} onClick={quitter}>Quitter</button>
          <button type="button" className={s.retour} onClick={retour}>Retour au salon <small>({Math.max(0, reste)} s)</small></button>
        </div>
      </div>
    </div>
  );
}
