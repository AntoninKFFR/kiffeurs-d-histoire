"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { modifierQuestion } from "@/app/admin/packs/actions";
import type { AdminPack, PackQuestion } from "@/lib/admin-packs/types";
import { formatHistoricDate } from "@/lib/game/dates";
import styles from "./packs.module.css";
import CorrectionQuestion from "./CorrectionQuestion";
import AjouterQuestions from "./AjouterQuestions";
import { useRouter } from "next/navigation";

const NIVEAUX = { 1: "Débutant", 2: "Intermédiaire", 3: "Expert" } as const;

function dateQuestion(q: PackQuestion): string {
  if (q.date_text) return q.date_text;
  if (q.start_year == null) return "Date non renseignée";
  const debut = formatHistoricDate({ year: q.start_year, month: q.start_month, day: q.start_day }, "jour");
  if (q.end_year == null) return debut;
  return `${debut} – ${formatHistoricDate({ year: q.end_year, month: q.end_month, day: q.end_day }, "jour")}`;
}

export default function AdministrationPacks({ initialPacks, selectedId, initialQuestions }: {
  initialPacks: AdminPack[]; selectedId: string | null; initialQuestions: PackQuestion[];
}) {
  const [packs, setPacks] = useState(initialPacks);
  const [questions, setQuestions] = useState(initialQuestions);
  const [search, setSearch] = useState("");
  const [niveau, setNiveau] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState<PackQuestion | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [editor, setEditor] = useState<{ question: PackQuestion; mode: "edition" | "historique" } | null>(null);
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const busy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const selected = packs.find((p) => p.id === selectedId);

  useEffect(() => {
    if (confirmation && !dialog.current?.open) dialog.current?.showModal();
    if (!confirmation && dialog.current?.open) dialog.current?.close();
  }, [confirmation]);

  useEffect(() => {
    const element = workspace.current;
    if (!element) return;
    // Tenir compte de la vraie hauteur de l'en-tête et des textes, même au zoom.
    const mesurer = () => {
      const top = `${element.getBoundingClientRect().top + window.scrollY}px`;
      if (element.style.getPropertyValue("--panel-top") !== top) element.style.setProperty("--panel-top", top);
    };
    mesurer();
    const observer = new ResizeObserver(mesurer);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", mesurer);
    return () => { observer.disconnect(); window.removeEventListener("resize", mesurer); };
  }, []);

  // Recherche et filtres sont locaux : aucun appel supplémentaire à Supabase.
  const needle = search.trim().toLocaleLowerCase("fr-FR");
  const visible = questions.filter((q) => q.title.toLocaleLowerCase("fr-FR").includes(needle)
    && (!niveau || String(q.niveau) === niveau)
    && (!status || (status === "removed" ? q.removed : q.playable)));

  async function modifier(q: PackQuestion, removed: boolean, motif = "") {
    if (!selectedId || busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice(null);
    try {
      const result = await modifierQuestion(selectedId, q.id, removed, motif);
      if (!result.ok) {
        setNotice({ error: true, text: result.message });
        return;
      }
      setPacks(result.data.packs);
      setQuestions(result.data.questions);
      setConfirmation(null);
      setReason("");
      setNotice({ error: false, text: result.data.changed
        ? `${q.title} : ${removed ? "question retirée du pack. Vous pouvez la remettre." : "question remise dans le pack."}`
        : "Cette action avait déjà été effectuée. La liste est à jour." });
    } catch {
      setNotice({ error: true, text: "La connexion a été interrompue. Réessayez pour confirmer l’état de la question." });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <main className="conteneur flex-1 py-8">
    <p className="inventaire">Cabinet de l’équipe · Inventaire des packs</p>
    <div className={styles.heading}>
      <h1 className="font-titre text-3xl">Relire les packs</h1>
      <Link href="/admin/indicateurs" className="text-oxyde underline">Indicateurs de réussite</Link>
    </div>
    <p className="mb-6 max-w-3xl text-encre-douce">Choisissez un pack pour en relire les questions.
      Les questions listées sont celles directement associées au pack. Un retrait du parent s’applique aussi
      à son union ; un retrait du sous-pack reste limité à sa branche.</p>
    {packs.length === 0 ? <p>Aucun pack disponible.</p> : <div ref={workspace} className={styles.layout}>
      <nav aria-label="Packs" className={styles.packs} tabIndex={0}>
        <h2 className="inventaire">{packs.length} packs</h2>
        {packs.map((p) => <Link key={p.id} href={`/admin/packs?pack=${encodeURIComponent(p.id)}`}
          prefetch={false} aria-current={p.id === selectedId ? "page" : undefined}
          aria-disabled={pending || undefined} tabIndex={pending ? -1 : undefined}
          onClick={(e) => { if (busy.current) e.preventDefault(); }} className={styles.pack}>
          <span className="font-titre">{p.title}</span>
          {p.parent_id && <small>Sous-pack de {packs.find((parent) => parent.id === p.parent_id)?.title ?? p.parent_id}</small>}
          <span className="text-sm text-encre-douce">{p.playable} jouables · {p.retired} retirées · {p.total} au total</span>
          {packs.some((c) => c.parent_id === p.id) && <small>{p.scope_playable} jouables avec les sous-packs</small>}
          {!p.active && <span className="inventaire">Pack inactif</span>}
        </Link>)}
      </nav>
      <section aria-label="Questions du pack" className={styles.content} aria-busy={pending}>
        <h2 className="font-titre text-2xl">{selected?.title}</h2>
        <button className={`${styles.confirm} self-start my-3`} disabled={pending || !selectedId} onClick={() => setAdding(true)}>Ajouter des questions</button>
        {packs.some((c) => c.parent_id === selectedId) && <p className="text-sm text-encre-douce">
          Pour les questions propres aux sous-packs, ouvrez le sous-pack correspondant dans la liste.</p>}
        <p className="text-sm text-encre-douce">{selected?.playable} questions jouables à l’année, tous niveaux.
          La disponibilité en partie dépend aussi de la précision et du niveau choisis.</p>
        <div className={styles.filters}>
          <label>Rechercher par titre<input type="search" value={search}
            onChange={(e) => setSearch(e.target.value)} placeholder="Titre d’une question" /></label>
          <label>Niveau<select value={niveau} onChange={(e) => setNiveau(e.target.value)}>
            <option value="">Tous les niveaux</option>
            {Object.entries(NIVEAUX).map(([n, label]) => <option key={n} value={n}>{label}</option>)}
          </select></label>
          <label>Statut<select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option><option value="playable">Jouables</option>
            <option value="removed">Retirées</option>
          </select></label>
        </div>
        {notice && <p role={notice.error ? "alert" : "status"} className={notice.error ? "text-oxyde" : "text-encre"}>{notice.text}</p>}
        <p className="inventaire">{visible.length} sur {questions.length} questions</p>
        {visible.length === 0 ? <p>Aucune question pour cette sélection.</p> : <div key={selectedId}
          className={styles.tableScroll} role="region" aria-label="Liste des questions" tabIndex={0}>
          <table className={styles.table}>
            <caption className="sr-only">Questions, dates et actions pour {selected?.title}</caption>
            <thead><tr><th scope="col">Question</th><th scope="col">Date</th><th scope="col">Niveau</th>
              <th scope="col">Statut</th><th scope="col">Action</th></tr></thead>
            <tbody>{visible.map((q) => <tr key={q.id} data-removed={q.removed || undefined}>
              <th scope="row"><span className="font-titre">{q.title}</span><small className={styles.eventId}>{q.id}</small>
                {q.last_change && <details className={styles.detail}><summary>Dernière modification</summary>
                  <p>{q.last_change.operation === "retirer" ? "Retrait" : "Réintégration"} le {new Date(q.last_change.occurred_at)
                    .toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}<br />
                    Administrateur : {q.last_change.admin_id}<br />Motif : {q.last_change.reason || "Non renseigné"}</p>
                </details>}
              </th>
              <td className="font-date">{dateQuestion(q)}</td><td>{NIVEAUX[q.niveau]}</td>
              <td><span className={q.removed ? styles.retired : styles.badge}>
                {q.removed ? "Retirée" : q.playable ? "Jouable" : "Non jouable"}</span></td>
              <td><div className={styles.rowActions}><button disabled={pending} className={styles.action} onClick={() => {
                if (q.removed) void modifier(q, false);
                else { setReason(""); setNotice(null); setConfirmation(q); }
              }}>{q.removed ? "Remettre" : "Retirer"}</button>
                <button disabled={pending} className={styles.action}
                  onClick={() => setEditor({ question: q, mode: "edition" })}>Modifier</button>
                <button disabled={pending} className={styles.historyButton}
                  onClick={() => setEditor({ question: q, mode: "historique" })}>Historique</button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
    </div>}
    {adding && selectedId && <AjouterQuestions packId={selectedId} packs={packs} onClose={() => setAdding(false)} onSaved={(data, destination) => {
      setPacks(data.packs); setAdding(false);
      if (destination === selectedId) { setQuestions(data.questions); setSearch(""); setNiveau(""); setStatus(""); }
      else router.push(`/admin/packs?pack=${encodeURIComponent(destination)}`);
      setNotice({ error: false, text: data.event_id ? "Question créée et ajoutée au pack." : `${data.added} question(s) ajoutée(s), ${data.restored} réintégrée(s). La liste est à jour.` });
    }} />}
    {editor && selectedId && <CorrectionQuestion key={`${editor.question.id}-${editor.mode}`}
      question={editor.question} packId={selectedId} mode={editor.mode} onClose={() => setEditor(null)}
      onSaved={(data) => {
        setPacks(data.packs); setQuestions(data.questions); setEditor(null);
        setNotice({ error: false, text: data.changed ? "Correction enregistrée pour tous les packs concernés." : "Aucun changement : la question est à jour." });
      }} />}
    <dialog ref={dialog} aria-labelledby="retrait-title" className={styles.dialog}
      onCancel={(e) => { if (pending) e.preventDefault(); else setConfirmation(null); }}>
      <h2 id="retrait-title" className="font-titre text-2xl">Retirer cette question du pack ?</h2>
      <p>{confirmation?.title}</p>
      <p className="text-sm text-encre-douce">Vous pourrez la remettre à tout moment. Les parties déjà lancées gardent leur tirage.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (confirmation) void modifier(confirmation, true, reason); }}>
        <label className={styles.reason}>Motif facultatif<textarea maxLength={1000} value={reason} disabled={pending}
          onChange={(e) => setReason(e.target.value)} rows={3} /></label>
        {notice?.error && <p role="alert" className="text-oxyde">{notice.text}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.action} disabled={pending} onClick={() => setConfirmation(null)}>Annuler</button>
          <button type="submit" className={styles.confirm} disabled={pending}>{pending ? "Enregistrement…" : "Confirmer le retrait"}</button>
        </div>
      </form>
    </dialog>
  </main>;
}
