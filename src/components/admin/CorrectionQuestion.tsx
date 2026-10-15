"use client";

import { useEffect, useRef, useState } from "react";
import { consulterHistorique, enregistrerCorrection } from "@/app/admin/packs/actions";
import type { EditorialChange, EditorialResult, PackQuestion } from "@/lib/admin-packs/types";
import styles from "./packs.module.css";
import HistoriqueContenu from "./HistoriqueContenu";

const NIVEAUX = { 1: "Débutant", 2: "Intermédiaire", 3: "Expert" } as const;

export default function CorrectionQuestion({ question, packId, mode, onClose, onSaved }: {
  question: PackQuestion; packId: string; mode: "edition" | "historique";
  onClose: () => void; onSaved: (data: EditorialResult) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [title, setTitle] = useState(question.title);
  const [niveau, setNiveau] = useState(question.niveau);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(mode === "historique");
  const [history, setHistory] = useState<EditorialChange[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  useEffect(() => {
    if (!historyOpen) return;
    let active = true;
    consulterHistorique(question.id).then((result) => {
      if (!active) return;
      if (result.ok) setHistory(result.history);
      else setHistoryError(result.message);
    }).catch(() => {
      if (active) setHistoryError("La connexion a été interrompue. Réessayez.");
    });
    return () => { active = false; };
  }, [question.id, historyOpen, attempt]);

  function fermer() {
    dialog.current?.close();
    onClose();
  }

  async function enregistrer() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await enregistrerCorrection(packId, question.id, title, niveau, reason, question.title, question.niveau);
      if (result.ok) { dialog.current?.close(); onSaved(result.data); }
      else setError(result.message);
    } catch {
      setError("La connexion a été interrompue. Réessayez pour confirmer la correction.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="correction-title"
    onCancel={(e) => { e.preventDefault(); if (!busy.current) fermer(); }}>
    <h2 id="correction-title" className="font-titre text-2xl">
      {mode === "edition" ? "Modifier la question" : "Historique des corrections"}</h2>
    <p className="inventaire">{question.id}</p>
    {mode === "edition" ? <>
      <p className="text-sm text-encre-douce">Le titre et le niveau s’appliquent à tous les packs et modes utilisant cet événement.
        Les parties déjà lancées gardent leurs questions et réponses acceptées.</p>
      <form onSubmit={(e) => { e.preventDefault(); void enregistrer(); }} className={styles.editForm}>
        <label htmlFor="correction-question-title">Titre de la question</label>
        <input id="correction-question-title" value={title} onChange={(e) => setTitle(e.target.value)}
          required maxLength={500} disabled={pending} />
        <label htmlFor="correction-question-niveau">Niveau de la question</label>
        <select id="correction-question-niveau" value={niveau} disabled={pending}
          onChange={(e) => setNiveau(Number(e.target.value) as PackQuestion["niveau"])}>
          {Object.entries(NIVEAUX).map(([n, label]) => <option key={n} value={n}>{label}</option>)}
        </select>
        <label htmlFor="correction-question-reason">Motif de modification facultatif</label>
        <textarea id="correction-question-reason" value={reason} onChange={(e) => setReason(e.target.value)}
          maxLength={1000} rows={3} disabled={pending} />
        {error && <p role="alert" className="text-oxyde">{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.action} disabled={pending} onClick={fermer}>Annuler</button>
          <button type="submit" className={styles.confirm} disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </form>
      <button type="button" className={styles.historyButton} onClick={() => {
        setHistory(null); setHistoryError(null); setHistoryOpen((open) => !open);
      }}
        aria-expanded={historyOpen}>Historique des corrections</button>
    </> : <p>{question.title}</p>}
    {historyOpen && <section aria-label="Historique des corrections">
      {historyError ? <><p role="alert" className="text-oxyde">{historyError}</p>
        <button className={styles.action} onClick={() => {
          setHistory(null); setHistoryError(null); setAttempt((n) => n + 1);
        }}>Réessayer l’historique</button></>
        : history === null ? <p role="status">Chargement de l’historique…</p>
          : history.length === 0 ? <p>Aucune correction enregistrée.</p>
            : <ol className={styles.history}>{history.map((change) => <li key={change.id}>
              <p className="inventaire">{new Date(change.occurred_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</p>
              <p><strong>Ancien titre :</strong> {change.old_title}<br /><strong>Nouveau titre :</strong> {change.new_title}</p>
              <p>Niveau : {NIVEAUX[change.old_niveau]} → {NIVEAUX[change.new_niveau]}</p>
              <p className="text-sm">Administrateur : {change.admin_id}<br />Motif : {change.reason || "Non renseigné"}</p>
            </li>)}</ol>}
    </section>}
    <HistoriqueContenu eventId={question.id} />
    {mode === "historique" && <div className={styles.dialogActions}>
      <button type="button" className={styles.action} onClick={fermer}>Fermer</button>
    </div>}
  </dialog>;
}
