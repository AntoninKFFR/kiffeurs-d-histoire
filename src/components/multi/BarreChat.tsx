"use client";

// Barre « Dire » du salon (#138, maquettes salon-pc et salon-tel) : des émotes en accès direct, puis un menu
// avec toutes les émotes et les phrases par famille. Pas de texte libre.
import { useEffect, useRef, useState } from "react";
import { EMOTES, FAMILLES_PHRASES, PHRASES, urlEmote, type Emote, type FamillePhrase } from "@/lib/multi/chat-catalogue";
import { elementChat, type MessageChat } from "@/lib/multi/chat";
import styles from "./salon.module.css";

export function ImageEmote({ emote, taille = 24 }: { emote: Emote; taille?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- petits SVG statiques, pas besoin d'optimisation
  return <img src={urlEmote(emote.id)} alt={`${emote.nom} ${emote.action}`} width={taille} height={taille} />;
}

/** Contenu d'une bulle ou du dernier message : le dessin de l'émote, ou la phrase entre guillemets. */
export function ContenuChat({ id }: { id: string }) {
  const el = elementChat(id);
  if (!el) return null;
  return el.type === "emote" ? <ImageEmote emote={el.emote} taille={28} /> : <>« {el.phrase.texte} »</>;
}

const FAMILLES = Object.keys(FAMILLES_PHRASES) as FamillePhrase[];

export function BarreChat({ dire, dernier, auteur }: {
  dire: (id: string) => string | null; dernier: MessageChat | null; auteur: (membreId: string) => string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !boite.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", fermer);
    return () => { document.removeEventListener("mousedown", fermer); document.removeEventListener("keydown", fermer); };
  }, [ouvert]);
  useEffect(() => {
    if (!refus) return;
    const t = setTimeout(() => setRefus(null), 2000);
    return () => clearTimeout(t);
  }, [refus]);

  const envoyer = (id: string) => {
    const erreur = dire(id);
    if (erreur) setRefus(erreur);
    else setOuvert(false);
  };

  return <div className={styles.chat} ref={boite}>
    <span className={`${styles.inventaire} ${styles.surPc}`}>Dire</span>
    {EMOTES.slice(0, 8).map((e, i) => <button key={e.id} type="button" className={`${styles.emote} ${i >= 4 ? styles.surPc : ""}`}
      title={`${e.nom} ${e.action}`} onClick={() => envoyer(e.id)}><ImageEmote emote={e} /></button>)}
    <button type="button" className={styles.phrases} aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>Phrases ▾</button>
    <span className={`${styles.dernier} ${styles.surPc}`} aria-live="polite">
      {refus ? <span className={styles.refus}>{refus}</span>
        : dernier && <><b>{auteur(dernier.membreId)}</b> <ContenuChat id={dernier.id} /></>}
    </span>
    {refus && <span className={`${styles.refus} ${styles.surTelephone}`} role="status">{refus}</span>}
    {ouvert && <div className={styles.menuChat} role="dialog" aria-label="Émotes et phrases">
      <div className={styles.familleChat}>
        <span className={styles.inventaire}>Émotes</span>
        <div className={styles.grilleEmotes}>
          {EMOTES.map((e) => <button key={e.id} type="button" className={styles.emote} title={`${e.nom} ${e.action}`}
            onClick={() => envoyer(e.id)}><ImageEmote emote={e} /></button>)}
        </div>
      </div>
      {FAMILLES.map((f) => <div key={f} className={styles.familleChat}>
        <span className={styles.inventaire}>{FAMILLES_PHRASES[f]}</span>
        {PHRASES.filter((p) => p.famille === f).map((p) => <button key={p.id} type="button" className={styles.phrase}
          onClick={() => envoyer(p.id)}>{p.texte}</button>)}
      </div>)}
    </div>}
  </div>;
}
