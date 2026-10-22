"use client";

// Écran du salon (#136), d'après les maquettes validées (docs/maquettes/v1.3/salon-pc.png, salon-tel.png).
// Purement affichage : les données et les actions viennent de SalonEnDirect (ou de l'aperçu).
import { useState } from "react";
import { CATEGORIES, decrireCible, optionsContenu, titreContenu } from "@/lib/multi/contenu";
import { LIBELLES_PRECISION, PLACES_CONVIVIAL, type Categorie, type ChoixContenu, type EtatSalon, type Reglages } from "@/lib/multi/salon";
import { DUREE_BULLE, type MessageChat } from "@/lib/multi/chat";
import { BarreChat, ContenuChat } from "./BarreChat";
import styles from "./salon.module.css";

export type ActionsSalon = {
  modifier: (changements: { reglages?: Partial<Reglages>; visibilite?: "prive" | "ouvert"; maxJoueurs?: number }) => Promise<string | null>;
  expulser: (membreId: string) => Promise<string | null>;
  accepter: (membreId: string) => Promise<string | null>;
  quitter: () => void;
  lancer: () => Promise<string | null>;
};

const COULEURS = ["--j1", "--j2", "--j3", "--j4", "--j5", "--j6"];

function Segments<T extends string | number | boolean>({ options, valeur, actif, onChoisir, nom }: {
  options: { valeur: T; titre: string }[]; valeur: T; actif: boolean; nom: string; onChoisir: (v: T) => void;
}) {
  return <span className={styles.segments} role="group" aria-label={nom}>
    {options.map((o) => <button key={String(o.valeur)} type="button" aria-pressed={o.valeur === valeur}
      disabled={!actif} onClick={() => o.valeur !== valeur && onChoisir(o.valeur)}>{o.titre}</button>)}
  </span>;
}

function Case({ coche, actif, onChange, children }: { coche: boolean; actif: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return <label className={styles.case}>
    <input type="checkbox" checked={coche} disabled={!actif} onChange={(e) => onChange(e.target.checked)} />
    <span className={styles.coche} aria-hidden>{coche ? "✓" : ""}</span>{children}
  </label>;
}

function ChoisirContenu({ type: depart, selection, onChoisir, onFermer }: {
  type: Categorie; selection: string | null; onChoisir: (type: Categorie, id: string) => void; onFermer: () => void;
}) {
  const [type, setType] = useState<Categorie>(depart);
  return <div className={styles.voile} onClick={onFermer}>
    <div className={styles.fenetre} role="dialog" aria-modal aria-label="Choisir le contenu" onClick={(e) => e.stopPropagation()}>
      <header><h2>Choisir le contenu</h2><button type="button" className={styles.fermer} onClick={onFermer}>Fermer</button></header>
      <div className={styles.onglets}>
        {CATEGORIES.map((c) => <button key={c.type} type="button" aria-pressed={c.type === type} onClick={() => setType(c.type)}>{c.titre}</button>)}
      </div>
      <ul className={styles.options}>
        {optionsContenu(type).map((o) => <li key={o.id}>
          <button type="button" className={styles.option} aria-pressed={o.id === selection} onClick={() => onChoisir(o.type, o.id)}>
            <b>{o.titre}</b><small>{o.detail}</small>
          </button>
        </li>)}
      </ul>
    </div>
  </div>;
}

/** Chat restreint (#138) : messages reçus (les plus récents à la fin), joueurs masqués localement. */
export type ChatSalon = {
  messages: readonly MessageChat[];
  masques: ReadonlySet<string>;
  dire: (id: string) => string | null;
  masquer: (membreId: string, oui: boolean) => void;
};

export function EcranSalon({ etat, presents, lien, actions, chat, maintenant }: {
  etat: EtatSalon; presents: ReadonlySet<string>; lien: string; actions: ActionsSalon; chat: ChatSalon;
  /** Heure locale du dernier rendu, pour savoir quelles bulles sont encore affichées. */
  maintenant: number;
}) {
  const { salon, membres, moi } = etat;
  const r = salon.reglages;
  const hote = membres.find((m) => m.est_hote);
  const suisHote = hote?.id === moi;
  const duel = salon.mode === "un_contre_un";
  const [message, setMessage] = useState<string | null>(null);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const [copie, setCopie] = useState<"code" | "lien" | null>(null);
  const [jour, mois, annee] = salon.code.split("/");

  const agir = async (action: Promise<string | null>) => {
    setMessage(null);
    const erreur = await action;
    if (erreur) setMessage(erreur);
  };
  const regler = (reglages: Partial<Reglages>) => agir(actions.modifier({ reglages }));
  const contenu = (c: Partial<Reglages["contenu"]>) => regler({ contenu: { ...r.contenu, ...c } });
  const copier = async (quoi: "code" | "lien") => {
    const texte = quoi === "code" ? salon.code : lien;
    try {
      if (quoi === "lien" && typeof navigator.share === "function" && window.matchMedia("(max-width: 760px)").matches) {
        await navigator.share({ title: "Kiffeurs d'Histoire", text: `Rejoins mon salon : code ${salon.code}`, url: lien });
        return;
      }
      await navigator.clipboard.writeText(texte);
      setCopie(quoi);
      setTimeout(() => setCopie(null), 2000);
    } catch {
      setMessage(quoi === "code" ? `Code : ${salon.code}` : `Lien : ${lien}`);
    }
  };

  const choixPossibles: { valeur: ChoixContenu; titre: string }[] = duel
    ? [{ valeur: "direct", titre: "Je choisis" }, { valeur: "pick_ban", titre: "Pick & ban" }, { valeur: "mystere", titre: "Mystère" }]
    : [{ valeur: "direct", titre: "Je choisis" }, { valeur: "vote", titre: "Vote" }, { valeur: "mystere", titre: "Mystère" }];
  const cible = decrireCible(r.contenu.cible);
  const categories = r.contenu.categories;
  const basculerCategorie = (c: Categorie, oui: boolean) => {
    const suivantes = oui ? [...categories, c] : categories.filter((x) => x !== c);
    if (suivantes.length === 0) return setMessage("Garde au moins une catégorie.");
    void contenu({ categories: CATEGORIES.map((x) => x.type).filter((x) => suivantes.includes(x)) });
  };
  const assez = membres.length >= 2;
  const enPartie = salon.etat === "partie";
  const visibles = chat.messages.filter((m) => !chat.masques.has(m.membreId));
  const bulle = (membreId: string) => [...visibles].reverse().find((m) => m.membreId === membreId && maintenant - m.recu < DUREE_BULLE);
  const pseudoDe = (membreId: string) => membres.find((m) => m.id === membreId)?.pseudo ?? "Un joueur";

  return <div className={styles.ecran}>
    <header className={styles.haut}>
      <div className={styles.gauche}>
        <button type="button" className={styles.quitter} onClick={actions.quitter}>← Quitter le salon</button>
        <div className={styles.nom}>
          <span className={styles.inventaire}>
            Salon · {duel ? "1 contre 1" : "Convivial"} · {salon.visibilite === "ouvert" ? "Ouvert" : "Privé"}
            <span className={styles.surTelephone}> · {membres.length}/{salon.max_joueurs}</span>
          </span>
          <h1>Le salon de {hote?.pseudo ?? "…"}</h1>
          <span className={styles.note}>
            {membres.length} joueur{membres.length > 1 ? "s" : ""} sur {salon.max_joueurs} · {enPartie ? "partie en cours" : "en attente du lancement"}
          </span>
        </div>
      </div>
      <div className={styles.code}>
        <div className={styles.inventaire}>Code du salon</div>
        <div className={styles.valeur} aria-label={`Code ${salon.code}`}>{jour}<i>/</i>{mois}<i>/</i>{annee}</div>
        <div className={styles.actionsCode}>
          <button type="button" onClick={() => copier("code")}>{copie === "code" ? "Code copié" : "Copier le code"}</button>
          <button type="button" onClick={() => copier("lien")}>{copie === "lien" ? "Lien copié" : <><span className={styles.surPc}>Copier le lien</span><span className={styles.surTelephone}>Partager le lien</span></>}</button>
        </div>
      </div>
      <div />
    </header>

    <div className={styles.colonnes}>
      <section className={styles.boite} aria-label="Joueurs">
        <h2><span>Joueurs</span><span>{membres.length} / {salon.max_joueurs}</span></h2>
        <ul className={styles.joueurs}>
          {membres.map((m) => { const b = bulle(m.id); const masque = chat.masques.has(m.id); return <li key={m.id} className={styles.joueur}>
            <span className={styles.pion} style={{ background: `var(${COULEURS[(m.ordre - 1) % COULEURS.length]})` }} aria-hidden>
              {[...m.pseudo][0]?.toUpperCase()}
            </span>
            <span className={styles.pseudo}>
              {m.pseudo}
              {m.est_hote && <span className={styles.couronne} title="Hôte">♛</span>}
              {m.invite && <span className={styles.invite}>invité</span>}
              {m.id === moi && <span className={styles.note}>(toi)</span>}
              {m.en_attente && <span className={styles.attente}>{m.id === moi ? "l'hôte doit t'accepter" : "arrivé en cours de partie"}</span>}
            </span>
            <span className={styles.actionsJoueur}>
              {m.id !== moi && <button type="button" className={styles.expulser} aria-pressed={masque}
                onClick={() => chat.masquer(m.id, !masque)} aria-label={`${masque ? "Afficher" : "Masquer"} les messages de ${m.pseudo}`}
                title="Pour toi seulement">{masque ? "Masqué" : "Masquer"}</button>}
              {suisHote && m.id !== moi && m.en_attente && <button type="button" className={styles.accepter} onClick={() => agir(actions.accepter(m.id))} aria-label={`Accepter ${m.pseudo}`}>Accepter</button>}
              {suisHote && m.id !== moi && <button type="button" className={styles.expulser} onClick={() => agir(actions.expulser(m.id))}
                aria-label={`${m.en_attente ? "Refuser" : "Expulser"} ${m.pseudo}`}>{m.en_attente ? "Refuser" : "Expulser"}</button>}
            </span>
            <span className={`${styles.point} ${presents.has(m.id) ? "" : styles.absent}`}
              title={presents.has(m.id) ? "Connecté" : "Déconnecté"} />
            {b && <span key={b.cle} className={styles.bulle} role="status"><ContenuChat id={b.id} /></span>}
          </li>; })}
          {Array.from({ length: Math.max(0, salon.max_joueurs - membres.length) }, (_, i) =>
            <li key={`vide-${i}`} className={styles.vide}>Place libre</li>)}
        </ul>
      </section>

      <section className={`${styles.boite} ${styles.boiteReglages} ${reglagesOuverts ? styles.ouvert : ""}`} aria-label="Réglages de la partie">
        <h2>
          <span>{reglagesOuverts ? "Réglages de la partie" : <><span className={styles.surPc}>Réglages de la partie</span><span className={styles.surTelephone}>Réglages</span></>}</span>
          {reglagesOuverts
            ? <button type="button" onClick={() => setReglagesOuverts(false)}>Fermer ✕</button>
            : <>
              <span className={`${styles.discret} ${styles.surPc}`}>♛ seul l&apos;hôte modifie</span>
              {suisHote && <button type="button" className={styles.surTelephone} onClick={() => setReglagesOuverts(true)}>Modifier ▸</button>}
            </>}
        </h2>
        <div className={styles.resume}>
          <b>{titreContenu(r)}</b>
          <span>{r.questions} questions · {LIBELLES_PRECISION[r.precision]}{r.questions_periode ? " · périodes incluses" : ""}</span>
          <span className={styles.note}>Curseurs {r.mode_visible ? "visibles" : "invisibles"} · Mode chrono {r.mode_chrono ? "activé" : "désactivé"}</span>
        </div>
        <div className={styles.reglages}>
          <span className={styles.libelle}>Contenu</span>
          <div className={styles.ligne}>
            <Segments nom="Choix du contenu" options={choixPossibles} valeur={r.contenu.choix} actif={suisHote}
              onChoisir={(choix) => contenu({ choix })} />
            {r.contenu.choix !== "direct" && CATEGORIES.map((c) =>
              <Case key={c.type} coche={categories.includes(c.type)} actif={suisHote} onChange={(oui) => basculerCategorie(c.type, oui)}>{c.titre}</Case>)}
          </div>
          <span className={styles.libelle} />
          {r.contenu.choix === "direct"
            ? <div className={styles.contenu}>
              <span className={styles.vignette} aria-hidden>⚜</span>
              <div><b>{cible?.titre ?? "Toute l'Histoire"}</b><div className={styles.note}>{cible?.detail ?? "Toutes les périodes, tous les thèmes"}</div></div>
              {suisHote && <button type="button" onClick={() => setChoixOuvert(true)}>Changer</button>}
            </div>
            : <span className={styles.note}>
              {r.contenu.choix === "mystere" && "La roulette tirera le contenu au lancement, le même pour tout le salon."}
              {r.contenu.choix === "vote" && "Le jeu proposera trois contenus des catégories cochées ; chacun vote en 15 s."}
              {r.contenu.choix === "pick_ban" && "Sept propositions des catégories cochées ; chacun en bannit à tour de rôle."}
            </span>}

          <span className={styles.libelle}>Nombre de questions</span>
          <div className={styles.ligne}>
            <Segments nom="Nombre de questions" valeur={r.questions} actif={suisHote} onChoisir={(questions) => regler({ questions })}
              options={[5, 10, 20].map((n) => ({ valeur: n as 5 | 10 | 20, titre: String(n) }))} />
          </div>

          <span className={styles.libelle}>Précision</span>
          <div className={styles.ligne}>
            <Segments nom="Précision" valeur={r.precision} actif={suisHote} onChoisir={(precision) => regler({ precision })}
              options={(["YEAR", "MONTH", "DAY"] as const).map((p) => ({ valeur: p, titre: LIBELLES_PRECISION[p] }))} />
            <Case coche={r.questions_periode} actif={suisHote} onChange={(questions_periode) => regler({ questions_periode })}>
              Questions « période » (début et fin)
            </Case>
          </div>

          <span className={styles.libelle}>Curseurs des autres</span>
          <div className={styles.ligne}>
            <Segments nom="Curseurs des autres" valeur={r.mode_visible} actif={suisHote} onChoisir={(mode_visible) => regler({ mode_visible })}
              options={[{ valeur: true, titre: "Visibles" }, { valeur: false, titre: "Invisibles" }]} />
            <span className={styles.note}>Visibles : on voit où chacun se place, en direct.</span>
          </div>

          <span className={styles.libelle}>Mode chrono</span>
          <div className={styles.ligne}>
            <Segments nom="Mode chrono" valeur={r.mode_chrono} actif={suisHote} onChoisir={(mode_chrono) => regler({ mode_chrono })}
              options={[{ valeur: true, titre: "Activé" }, { valeur: false, titre: "Désactivé" }]} />
            <span className={styles.note}>Activé : après la 1<sup>re</sup> réponse, il reste 10 s aux autres.</span>
          </div>

          <span className={styles.libelle}>Salon</span>
          <div className={styles.ligne}>
            <Segments nom="Visibilité" valeur={salon.visibilite} actif={suisHote} onChoisir={(visibilite) => agir(actions.modifier({ visibilite }))}
              options={[{ valeur: "prive" as const, titre: "Privé" }, { valeur: "ouvert" as const, titre: "Ouvert" }]} />
            {!duel && <>
              <span className={styles.note}>Places</span>
              <span className={styles.segments} role="group" aria-label="Places">
                {PLACES_CONVIVIAL.map((n) => <button key={n} type="button" aria-pressed={n === salon.max_joueurs}
                  disabled={!suisHote || n < membres.length}
                  onClick={() => n !== salon.max_joueurs && agir(actions.modifier({ maxJoueurs: n }))}>{n}</button>)}
              </span>
            </>}
          </div>
        </div>
      </section>
    </div>

    <div className={styles.bas}>
      <BarreChat dire={chat.dire} dernier={visibles.at(-1) ?? null} auteur={pseudoDe} />
      {message && <p className={styles.message} role="alert">{message}</p>}
      <button type="button" className={styles.lancer} disabled={!suisHote || !assez || enPartie}
        onClick={() => agir(actions.lancer())}>
        Lancer la partie
        <small>{enPartie ? "partie en cours" : !assez ? "il faut au moins 2 joueurs"
          : suisHote ? `${membres.length} joueurs prêts` : `${hote?.pseudo ?? "l'hôte"} lance la partie`}</small>
      </button>
    </div>

    {choixOuvert && <ChoisirContenu type={r.contenu.cible?.type ?? "pack"} selection={r.contenu.cible?.id ?? null}
      onFermer={() => setChoixOuvert(false)}
      onChoisir={(type, id) => { setChoixOuvert(false); void contenu({ cible: { type, id } }); }} />}
  </div>;
}
