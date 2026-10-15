"use client";

import { useEffect, useRef, useState } from "react";
import { ajouterQuestions, creerQuestion, rechercherQuestions } from "@/app/admin/packs/actions";
import type { AdminPack, ContentChange, NewEvent, SearchFilters, SearchPage } from "@/lib/admin-packs/types";
import { erreurEvenement } from "@/lib/admin-packs/validation";
import { formatHistoricDate } from "@/lib/game/dates";
import styles from "./packs.module.css";

const EMPTY: NewEvent = { title: "", description: "", niveau: 1, kind: "event", territory: "", date_status: "EXACT",
  start_year: null, start_month: null, start_day: null, end_year: null, end_month: null, end_day: null, date_text: "", sources: [""] };
const niveaux = ["Débutant", "Intermédiaire", "Expert"];
const integer = (value: FormDataEntryValue | null) => value === null || value === "" ? null : Number(value);

export default function AjouterQuestions({ packId, packs, onClose, onSaved }: {
  packId: string; packs: AdminPack[]; onClose: () => void; onSaved: (data: ContentChange, destination: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const request = useRef<{ id: string; payload: string } | null>(null);
  const [mode, setMode] = useState("search");
  const [destination, setDestination] = useState(packId);
  const [filters, setFilters] = useState<SearchFilters>({ query: "", niveau: null, yearMin: null, yearMax: null, page: 0 });
  const [results, setResults] = useState<SearchPage | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [event, setEvent] = useState<NewEvent>(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<SearchPage | null>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  function close() { if (!busy.current) { dialog.current?.close(); onClose(); } }
  async function run(operation: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null);
    try { await operation(); } catch { setError("La connexion a été interrompue. Réessayez avec la même saisie."); }
    finally { busy.current = false; setPending(false); }
  }
  async function search(f: SearchFilters) {
    await run(async () => {
      const r = await rechercherQuestions(packId, f);
      if (r.ok) { setResults(r.data); setFilters(f); } else setError(r.message);
    });
  }
  function saved(data: ContentChange, target: string) { dialog.current?.close(); onSaved(data, target); }
  async function add() {
    await run(async () => { const r = await ajouterQuestions(packId, selected); if (r.ok) saved(r.data, packId); else setError(r.message); });
  }
  async function create() {
    const problem = erreurEvenement(event);
    if (problem) { setError(problem); return; }
    await run(async () => {
      const payload = JSON.stringify({ destination, event });
      if (!request.current || request.current.payload !== payload) request.current = { id: crypto.randomUUID(), payload };
      const r = await creerQuestion(request.current.id, destination, event);
      if (r.ok) saved(r.data, destination); else setError(r.message);
    });
  }
  function update<K extends keyof NewEvent>(key: K, value: NewEvent[K]) {
    setEvent((e) => ({ ...e, [key]: value }));
    if (key === "title") setDuplicates(null);
  }
  return <dialog ref={dialog} aria-labelledby="ajout-title" className={`${styles.dialog} ${styles.addDialog}`}
    onCancel={(e) => { e.preventDefault(); close(); }}>
    <div className={styles.heading}>
      <h2 id="ajout-title" className="font-titre text-2xl">Ajouter des questions</h2>
      <button type="button" className={styles.historyButton} disabled={pending} onClick={close} aria-label="Fermer l’ajout">Fermer</button>
    </div>
    <p className="inventaire">{packs.find((p) => p.id === packId)?.title}</p>
    <div className={styles.modeChoice} role="group" aria-label="Type d’ajout">
      <button className={styles.action} disabled={pending} aria-pressed={mode === "search"} onClick={() => { setMode("search"); setError(null); }}>Rechercher une question existante</button>
      <button className={styles.action} disabled={pending} aria-pressed={mode === "create"} onClick={() => { setMode("create"); setError(null); }}>Créer une nouvelle question</button>
    </div>
    {mode === "search" ? <>
      <p className="text-sm">Recherchez dans tous les événements. Les questions déjà présentes sont signalées ; les questions retirées peuvent être réintégrées.</p>
      <form className={styles.filters} onSubmit={(e) => {
        e.preventDefault(); const data = new FormData(e.currentTarget);
        void search({ query: String(data.get("query") ?? ""), niveau: integer(data.get("niveau")),
          yearMin: integer(data.get("yearMin")), yearMax: integer(data.get("yearMax")), page: 0 });
      }}>
        <label>Titre recherché<input name="query" type="search" maxLength={500} defaultValue={filters.query} /></label>
        <label>Niveau recherché<select name="niveau" defaultValue=""><option value="">Tous</option>{niveaux.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select></label>
        <label>À partir de l’année<input name="yearMin" type="number" min={-1000000} max={1000000} placeholder="−500" /></label>
        <label>Jusqu’à l’année<input name="yearMax" type="number" min={-1000000} max={1000000} placeholder="2026" /></label>
        <button className={styles.action} disabled={pending} type="submit">Rechercher</button>
      </form>
      <p className="text-sm text-encre-douce">Années négatives pour les dates avant J.-C., sans année zéro. Les périodes qui croisent cet intervalle sont incluses.</p>
      <div aria-live="polite" aria-busy={pending}>
        {results && <>
          <p className="inventaire">Page {filters.page + 1} · {selected.length} sélectionnée(s)</p>
          {results.items.length === 0 && <p>Aucune question trouvée.</p>}
          <ul className={styles.searchResults}>{results.items.map((q) => <li key={q.id}>
            <label className={styles.searchItem}>
              <input type="checkbox" disabled={pending || (q.associated && !q.removed) || (!selected.includes(q.id) && selected.length >= 100)}
                checked={selected.includes(q.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, q.id] : ids.filter((id) => id !== q.id))} />
              <span><strong className="font-titre">{q.title}</strong><br />
                <span className="font-date">{q.date_text || (q.start_year === null ? "Date non renseignée" : `${formatHistoricDate({ year: q.start_year, month: q.start_month, day: q.start_day }, "jour")}${q.end_year === null ? "" : ` – ${formatHistoricDate({ year: q.end_year, month: q.end_month, day: q.end_day }, "jour")}`}`)}</span>
                {" · "}{niveaux[q.niveau - 1]}<br />
                <small>Packs : {q.packs.map((p) => `${p.title}${p.removed ? " (retirée)" : ""}`).join(", ") || "Aucun"}</small><br />
                {q.removed ? "À réintégrer — historique conservé" : q.associated ? "Déjà dans ce pack" : "Disponible pour ce pack"}
              </span>
            </label>
          </li>)}</ul>
          <nav aria-label="Pages de recherche" className={styles.modeChoice}>
            <button className={styles.action} disabled={pending || filters.page === 0} onClick={() => void search({ ...filters, page: filters.page - 1 })}>Précédente</button>
            <button className={styles.action} disabled={pending || !results.has_more} onClick={() => void search({ ...filters, page: filters.page + 1 })}>Suivante</button>
          </nav>
        </>}
      </div>
      {error && <p role="alert" className="text-oxyde">{error}</p>}
      <div className={styles.dialogActions}>
        <button className={styles.action} disabled={pending} onClick={close}>Annuler</button>
        <button className={styles.confirm} disabled={pending || !selected.length} onClick={() => void add()}>{pending ? "En cours…" : `Ajouter / réintégrer (${selected.length})`}</button>
      </div>
    </> : <form className={styles.creationForm} onSubmit={(e) => { e.preventDefault(); void create(); }}>
      <fieldset disabled={pending} className={styles.editForm}>
        <legend className="font-titre text-xl">Informations générales</legend>
        <label>Titre de la question<input required maxLength={500} value={event.title} onChange={(e) => update("title", e.target.value)} /></label>
        <button type="button" className={styles.action} onClick={() => void run(async () => {
          const r = await rechercherQuestions(destination, { query: event.title, niveau: null, yearMin: null, yearMax: null, page: 0 });
          if (r.ok) setDuplicates(r.data); else setError(r.message);
        })}>Vérifier les doublons</button>
        {duplicates && <div role="status">{duplicates.items.length ? <>Événements proches : {duplicates.items.map((q) => q.title).join(" ; ")}. Utilisez la recherche pour les rattacher.</> : "Aucun titre correspondant trouvé. Les titres identiques seront aussi contrôlés à l’enregistrement."}</div>}
        <label>Description historique courte<textarea required maxLength={3000} rows={3} value={event.description} onChange={(e) => update("description", e.target.value)} /></label>
        <label>Niveau de la nouvelle question<select value={event.niveau} onChange={(e) => update("niveau", Number(e.target.value))}>{niveaux.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select></label>
        <label>Pack de destination<select value={destination} onChange={(e) => setDestination(e.target.value)}>{packs.map((p) => <option key={p.id} value={p.id}>{p.title}{p.parent_id ? " (sous-pack)" : ""}</option>)}</select></label>
        <label>Type de contenu<select value={event.kind} onChange={(e) => update("kind", e.target.value as NewEvent["kind"])}><option value="event">Événement historique</option><option value="film">Sortie de film</option></select></label>
        {event.kind === "film" && <label>Territoire de sortie<input required maxLength={150} value={event.territory} onChange={(e) => update("territory", e.target.value)} placeholder="France, États-Unis…" /></label>}
        {event.kind === "film" && <p className="text-sm">Le territoire sera ajouté au titre pour préciser la sortie demandée aux joueurs.</p>}
      </fieldset>
      <fieldset disabled={pending} className={styles.editForm}>
        <legend className="font-titre text-xl">Datation</legend>
        <p className="text-sm">N’indiquez que la précision attestée par vos sources. Année négative avant J.-C. ; aucune année zéro. Sans année, la période textuelle est obligatoire et la question restera non jouable.</p>
        <div className={styles.dateFields}>{(["start", "end"] as const).map((prefix) => <fieldset key={prefix}>
          <legend>{prefix === "start" ? "Date / début" : "Fin de période (facultative)"}</legend>
          {(["year", "month", "day"] as const).map((part) => {
            const key = `${prefix}_${part}` as const;
            return <label key={key}>{part === "year" ? "Année" : part === "month" ? "Mois" : "Jour"}<input type="number" aria-label={`${prefix === "start" ? "Début" : "Fin"} : ${part === "year" ? "année" : part === "month" ? "mois" : "jour"}`}
              min={part === "year" ? -1000000 : 1} max={part === "year" ? 1000000 : part === "month" ? 12 : 31}
              value={event[key] ?? ""} onChange={(e) => update(key, e.target.value === "" ? null : Number(e.target.value))} /></label>;
          })}
        </fieldset>)}</div>
        <p role="status" className="text-sm">Précision : {event.start_year === null ? "période textuelle, non jouable" : event.end_year !== null ? "intervalle, selon les dates renseignées" : event.start_day !== null ? "jour" : event.start_month !== null ? "mois" : "année"}.</p>
        <label>Libellé historique de la date / période<input maxLength={500} required={event.start_year === null} value={event.date_text} onChange={(e) => update("date_text", e.target.value)} placeholder="Facultatif si la date est renseignée" /></label>
        <label>Statut historique<select value={event.date_status} onChange={(e) => update("date_status", e.target.value as NewEvent["date_status"])}>
          <option value="EXACT">Exact</option><option value="CONVENTIONAL">Conventionnel</option><option value="TRADITIONAL">Traditionnel</option><option value="APPROXIMATE">Approximatif</option><option value="DISPUTED">Discuté</option>
        </select></label>
      </fieldset>
      <fieldset disabled={pending} className={styles.editForm}>
        <legend className="font-titre text-xl">Sources historiques</legend>
        <p className="text-sm">URL ou référence vérifiable (ouvrage, auteur, édition et page). Pour un film, la source doit justifier la date dans le territoire choisi.</p>
        {event.sources.map((s, i) => <label key={i}>Source {i + 1}<input required minLength={8} maxLength={2000} value={s}
          onChange={(e) => update("sources", event.sources.map((v, j) => j === i ? e.target.value : v))} /></label>)}
        <div className={styles.modeChoice}>
          <button type="button" className={styles.action} disabled={event.sources.length >= 10} onClick={() => update("sources", [...event.sources, ""])}>Ajouter une source</button>
          {event.sources.length > 1 && <button type="button" className={styles.action} onClick={() => update("sources", event.sources.slice(0, -1))}>Retirer la dernière source</button>}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-oxyde">{error}</p>}
      <div className={styles.dialogActions}>
        <button type="button" className={styles.action} disabled={pending} onClick={close}>Annuler</button>
        <button type="submit" className={styles.confirm} disabled={pending}>{pending ? "Enregistrement…" : "Créer et ajouter au pack"}</button>
      </div>
    </form>}
  </dialog>;
}
