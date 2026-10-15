"use client";
import { useState } from "react";
import { consulterHistoriqueContenu } from "@/app/admin/packs/actions";
import type { ContentHistory } from "@/lib/admin-packs/types";
import styles from "./packs.module.css";

export default function HistoriqueContenu({ eventId }: { eventId: string }) {
  const [data, setData] = useState<ContentHistory | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    if (pending) return;
    setPending(true); setError(null);
    try {
      const result = await consulterHistoriqueContenu(eventId);
      if (result.ok) setData(result.data); else setError(result.message);
    } catch { setError("L’historique est momentanément indisponible."); }
    finally { setPending(false); }
  }
  return <details className="mt-4" onToggle={(e) => { if (e.currentTarget.open && !data) void load(); }}>
    <summary className={styles.historyButton}>Création, sources et rattachements</summary>
    {pending && <p role="status">Chargement…</p>}
    {error && <><p role="alert">{error}</p><button className={styles.action} onClick={() => void load()}>Réessayer</button></>}
    {data && <>
      {data.creation && <div className="text-sm">
        <p>Créée le {new Date(data.creation.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} par {data.creation.admin_id}</p>
        {data.creation.territory && <p>Territoire de sortie : {data.creation.territory}</p>}
        <ul>{data.creation.sources.map((source, i) => <li key={i}>{source}</li>)}</ul>
      </div>}
      {data.operations.length === 0 ? <p>Aucun ajout administratif enregistré.</p> : <ol className={styles.history}>{data.operations.map((op) => <li key={op.id}>
        {op.operation === "creer" ? "Création" : op.operation === "ajouter" ? "Rattachement" : "Réintégration"} · {op.pack_id}<br />
        {new Date(op.occurred_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · {op.admin_id}
      </li>)}</ol>}
    </>}
  </details>;
}
