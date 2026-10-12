import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { CHAPITRES, CHAPITRES_ACTIFS, CHAPITRES_HISTORIQUES, cheminChapitre, cheminEdition, NIVEAUX } from "@/lib/apprendre/catalogue";
import { nombre, pourcentage } from "@/lib/profil/types";
import { LIBELLE_DIFFICULTE, type Progression } from "@/lib/progression/types";
import styles from "./Profil.module.css";

// Progression pédagogique du joueur connecté : chapitres découverts et meilleur test par chapitre,
// regroupés par niveau. `null` = lecture impossible : on le dit, sans inventer de zéros.
export function ProgressionPedagogique({ progression }: { progression: Progression | null }) {
  return (
    <section aria-labelledby="progression-titre" className="border-t border-filet pt-5">
      <h2 id="progression-titre" className={styles.heading}>Ton parcours pédagogique</h2>
      {!progression ? (
        <p role="alert" className={styles.muted}>
          Ta progression est momentanément indisponible. Elle reste enregistrée ; recharge la page dans quelques instants.
        </p>
      ) : <Parcours progression={progression} />}
    </section>
  );
}

function Parcours({ progression }: { progression: Progression }) {
  const lignes = CHAPITRES_ACTIFS.flatMap(c => progression.chapitres[c.id] ? [progression.chapitres[c.id]] : []);
  const decouverts = lignes.filter((p) => p.decouvert).length;
  const testes = lignes.filter((p) => p.precision != null).length;
  if (!decouverts && !testes && !progression.historique?.length && !CHAPITRES_HISTORIQUES.some(c => progression.chapitres[c.id])) {
    return (
      <div className={styles.empty}>
        <h3 className={styles.heading}>Un premier chapitre, puis des repères.</h3>
        <p>Ouvre un chapitre pour le découvrir, puis teste-toi : tes chapitres découverts et ton meilleur test apparaîtront ici.</p>
        <Link href="/apprendre" className={styles.link}>Découvrir un chapitre →</Link>
      </div>
    );
  }
  return (
    <>
      <p className={styles.muted}>
        {nombre(decouverts)} chapitre{decouverts > 1 ? "s" : ""} découvert{decouverts > 1 ? "s" : ""} sur {CHAPITRES_ACTIFS.length}
        {" · "}{nombre(testes)} testé{testes > 1 ? "s" : ""}. Le meilleur test garde la précision la plus haute, quelle que soit la difficulté choisie.
      </p>
      <div className="grid gap-2">
        {NIVEAUX.map((n) => {
          const chapitres = CHAPITRES_ACTIFS.filter((c) => c.niveauSlug === n.slug);
          const vus = chapitres.filter((c) => progression.chapitres[c.id]?.decouvert).length;
          const essayes = chapitres.filter((c) => progression.chapitres[c.id]?.precision != null).length;
          return (
            <details key={n.slug} open={vus + essayes > 0} className="border border-filet bg-blanc-cartel">
              <summary className="cible cursor-pointer px-3 py-2 font-bold">
                {n.nom}
                <span className="font-normal text-encre-douce"> · {vus} sur {chapitres.length} découverts · {essayes} testés</span>
              </summary>
              <ul className="m-0 grid list-none gap-1 p-3 pt-0">
                {chapitres.map((c) => {
                  const p = progression.chapitres[c.id];
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link href={cheminChapitre(c)} className="min-w-0 break-words underline underline-offset-4">{c.titre}</Link>
                      {p?.decouvert && <Badge ton="sauge">Découvert</Badge>}
                      {p?.precision != null && (
                        <Badge ton="laiton">
                          Meilleur test : {pourcentage(p.precision)}{p.difficulte ? ` · ${LIBELLE_DIFFICULTE[p.difficulte]}` : ""}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
      {CHAPITRES_HISTORIQUES.length > 0 && <section aria-label="Résultats historiques" className="grid gap-2">
        <h3 className={styles.heading}>Tes résultats historiques</h3>
        <p className={styles.muted}>Ces résultats restent conservés sur les anciens chapitres. Ils ne sont pas transférés aux nouvelles séquences.</p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {CHAPITRES_HISTORIQUES.filter(c => progression.chapitres[c.id]).map(c => {
            const p = progression.chapitres[c.id];
            return <li key={c.id}>
              <Link href={cheminChapitre(c)} className={styles.link}>{c.titre}</Link>
              {p.decouvert && <Badge ton="sauge">Découvert</Badge>}
              {p.precision != null && <Badge ton="laiton">Meilleur test : {pourcentage(p.precision)}{p.difficulte ? ` · ${LIBELLE_DIFFICULTE[p.difficulte]}` : ""}</Badge>}
            </li>;
          })}
        </ul>
      </section>}
      {Boolean(progression.historique?.length) && <section aria-label="Éditions historiques" className="grid gap-2">
        <h3 className={styles.heading}>Tes éditions historiques</h3>
        <p className={styles.muted}>Chaque résultat reste associé aux cartes apprises dans cette édition.</p>
        <ul className="m-0 grid list-none gap-2 p-0">{progression.historique?.map(h=>{
          const c=CHAPITRES.find(c=>c.id===h.chapter_id);
          if(!c) return null;
          return <li key={`${c.id}@${h.version}`}>
            <Link href={cheminEdition(c,h.version)} className={styles.link}>{c.titre} · {h.version===c.content_version?'avant complétion':'parcours complété'}</Link>
            {h.progression.decouvert && <Badge ton="sauge">Découvert</Badge>}
            {h.progression.precision!=null && <Badge ton="laiton">Meilleur test : {pourcentage(h.progression.precision)}{h.progression.difficulte?` · ${LIBELLE_DIFFICULTE[h.progression.difficulte]}`:""}</Badge>}
          </li>;
        })}</ul>
      </section>}
      <Link href="/apprendre" className={styles.link}>Découvrir un chapitre →</Link>
    </>
  );
}
