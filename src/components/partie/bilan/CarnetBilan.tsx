import { useEffect, useRef, type KeyboardEvent } from "react";
import { formatHistoricDate } from "@/lib/game/dates";
import type { ReponseBilan } from "@/lib/game/bilan";

export function CarnetBilan({ reponses, selection, choisir }: { reponses: ReponseBilan[]; selection: number; choisir: (index: number) => void }) {
  const q = reponses[selection];
  const debut = Math.floor(selection / 10) * 10;
  const boutons = useRef<HTMLElement>(null);
  const focaliser = useRef(false);
  useEffect(() => {
    if (focaliser.current) {
      boutons.current?.querySelector<HTMLButtonElement>(`[data-index="${selection}"]`)?.focus();
      focaliser.current = false;
    }
  }, [selection]);
  function naviguer(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const cible = e.key === "ArrowRight" ? Math.min(index + 1, reponses.length - 1)
      : e.key === "ArrowLeft" ? Math.max(index - 1, 0) : e.key === "Home" ? 0 : e.key === "End" ? reponses.length - 1 : null;
    if (cible === null) return;
    e.preventDefault();
    const visible = boutons.current?.querySelector<HTMLButtonElement>(`[data-index="${cible}"]`);
    focaliser.current = !visible; choisir(cible); visible?.focus();
  }
  return <section className="review" aria-label="Détail et navigation des réponses">
    <div className="review-header">
      <div className="review-label"><span className="eyebrow">VOTRE CARNET DE RÉPONSES</span><span className="quiet">Choisissez une question</span></div>
      <nav className="question-tabs" aria-label="Choisir une réponse" ref={boutons}>
        {reponses.slice(debut, debut + 10).map((r, indice) => { const i = debut + indice; return <button key={r.id} data-index={i} type="button" aria-pressed={selection === i} aria-controls="reponse-bilan"
          aria-label={`Question ${r.position} : ${r.titre} · ${r.etat}`} data-exact={r.exacte} data-expired={r.expiree}
          onClick={() => choisir(i)} onKeyDown={(e) => naviguer(e, i)}>{String(r.position).padStart(2, "0")}</button>; })}
      </nav>
    </div>
    {reponses.length > 10 && <div className="range-picker" role="group" aria-label="Parcourir le carnet">
      <button type="button" className="plain-action" disabled={debut === 0} onClick={() => choisir(debut - 10)}>← Dix précédentes</button>
      <span className="folio">REPÈRES {debut + 1}–{Math.min(debut + 10, reponses.length)} SUR {reponses.length}</span>
      <button type="button" className="plain-action" disabled={debut + 10 >= reponses.length} onClick={() => choisir(debut + 10)}>Dix suivantes →</button>
    </div>}
    {q ? <article id="reponse-bilan" className="answer-sheet" aria-live="polite">
      <div className="answer-heading"><span className="eyebrow">QUESTION {String(q.position).padStart(2, "0")}</span><h3>{q.titre}</h3>
        <p>{q.etat} · Précision : {q.accuracy.toLocaleString("fr-FR")} %{q.periode
          ? (q.ecart || q.periode.ecartFin) && ` · Écart : début ${q.ecart ?? "exact"}, fin ${q.periode.ecartFin ?? "exacte"}`
          : q.ecart && ` · Écart : ${q.ecart}`}</p>
      </div>
      <dl className="answer-date correct"><dt>{q.periode ? "Période attendue" : "Date attendue"}</dt><dd>{formatHistoricDate(q.attendue, q.precision)}
        {q.periode && <> → {formatHistoricDate(q.periode.attendueFin, q.precision)}</>}</dd></dl>
      <dl className="answer-date"><dt>Votre réponse</dt><dd className={q.dateJoueur ? undefined : "answer-text"}>
        {q.dateJoueur ? formatHistoricDate(q.dateJoueur, q.precision) : q.texteJoueur ?? (q.expiree ? "Temps écoulé" : "Sans réponse")}
        {q.dateJoueur && q.periode?.dateJoueurFin && <> → {formatHistoricDate(q.periode.dateJoueurFin, q.precision)}</>}
      </dd></dl>
      <div className="answer-points"><b>{q.points}</b><span>POINTS / 100</span></div>
    </article> : <p className="answer-sheet">Aucune réponse disponible pour cette partie.</p>}
    <div className="answer-navigation">
      <button type="button" className="plain-action" disabled={selection <= 0 || !q} onClick={() => choisir(selection - 1)}>← Question précédente</button>
      <span className="folio">{q ? `QUESTION ${String(q.position).padStart(2, "0")} SUR ${reponses.length}` : "AUCUNE QUESTION"}</span>
      <button type="button" className="plain-action" disabled={selection >= reponses.length - 1 || !q} onClick={() => choisir(selection + 1)}>Question suivante →</button>
    </div>
  </section>;
}
