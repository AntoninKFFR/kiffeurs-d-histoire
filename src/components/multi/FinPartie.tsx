"use client";

// Fin de partie (#143), d'après la maquette validée (docs/maquettes/v1.3/podium-pc.png) : podium des trois
// premiers, classement final, coup de maître et plus gros raté, puis retour automatique au salon.
import { useEffect, useState, type CSSProperties } from "react";
import { classementFinal, coupDeMaitre, plusGrosRate, type BilanPartie } from "@/lib/multi/bilan";
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
};

export function FinPartie({ bilan, membres, moi, couleur, retour, quitter }: Props) {
  const [reste, setReste] = useState(RETOUR);
  useEffect(() => {
    const id = setInterval(() => setReste((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (reste <= 0) retour(); }, [reste, retour]);

  const membre = (id: string) => membres.find((m) => m.id === id);
  const pseudo = (id: string) => membre(id)?.pseudo ?? "Joueur parti";
  const initiale = (id: string) => [...pseudo(id)][0]?.toUpperCase();
  const rangs = classementFinal(bilan);
  const premiers = rangs.filter((r) => r.rang === 1);
  const coup = coupDeMaitre(bilan);
  const rate = plusGrosRate(bilan);
  // Podium : 2e à gauche, 1er au centre, 3e à droite (comme la maquette).
  const podium = [rangs[1], rangs[0], rangs[2]].map((r, i) => r && { ...r, marche: [2, 1, 3][i] });
  const titre = premiers.length > 1 ? `Égalité entre ${premiers.map((r) => pseudo(r.membreId)).join(" et ")} !`
    : rangs[0] && rangs[0].points > 0 ? `${pseudo(rangs[0].membreId)} remporte la partie !` : "Partie terminée";

  return (
    <div className={s.fin}>
      <header className={s.tete}>
        <span className={s.inventaire}>
          Fin de partie · {bilan.partie.contenu.titre ?? "Toute l'Histoire"} · {bilan.partie.total} questions · {LIBELLES_PRECISION[bilan.partie.precision]}
        </span>
        <h1>{titre}</h1>
      </header>

      <div className={s.podium} aria-label="Podium">
        {podium.map((r, i) => r ? (
          <div key={r.membreId} className={`${s.marche} ${r.marche === 1 ? s.or : ""}`} data-marche={r.marche}>
            {r.marche === 1 && <span className={s.couronne} aria-hidden>♛</span>}
            <span className={s.pion} style={{ background: couleur(r.membreId) }} aria-hidden>{initiale(r.membreId)}</span>
            <span className={s.nom}>{pseudo(r.membreId)}</span>
            <span className={`${s.pts} date`}>{r.points.toLocaleString("fr-FR")}</span>
            <span className={s.socle}><span className="date">{r.rang}</span></span>
          </div>
        ) : <div key={`vide-${i}`} className={s.marche} aria-hidden />)}
      </div>

      <div className={s.cote}>
        <section className={`${s.classement} ${rangs.length > 5 ? s.nombreux : ""}`} aria-label="Classement final"
          style={{ "--lignes": Math.ceil(rangs.length / 2) } as CSSProperties}>
          <h2><span>Classement final</span><span>{rangs.length} joueur{rangs.length > 1 ? "s" : ""}</span></h2>
          <ol>
            {rangs.map((r) => (
              <li key={r.membreId} className={r.membreId === moi ? s.moi : undefined}>
                <span className={s.rang}>{r.rang}</span>
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
            <span className={s.inventaire}>Coup de maître</span>
            <span><b>{pseudo(coup.membreId)}</b> a trouvé « {coup.titre} » <b>{coup.texte}</b>.</span>
          </p>
        )}
        {rate && (
          <p className={`${s.fait} ${s.rate}`}>
            <span className={s.inventaire}>Plus gros raté</span>
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
