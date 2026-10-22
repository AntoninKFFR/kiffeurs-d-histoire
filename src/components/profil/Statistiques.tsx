import Link from "next/link";
import {
  MODES_PROFIL,
  nombre,
  pourcentage,
  type Statistiques as DonneesStatistiques,
  type StatsMulti,
} from "@/lib/profil/types";
import { GraphiquePrecision } from "./GraphiquePrecision";
import type { Progression } from "@/lib/progression/types";
import { ProgressionPedagogique } from "./ProgressionPedagogique";
import styles from "./Profil.module.css";

export function Statistiques({ data, progression = null, multi = null }: { data: DonneesStatistiques; progression?: Progression | null; multi?: StatsMulti | null }) {
  return (
    <div className={styles.stack}>
      <section aria-labelledby="statistiques-titre">
        <h2 id="statistiques-titre" className={styles.heading}>
          Ton carnet de résultats
        </h2>
        <dl className={styles.metrics}>
          {(
            [
              ["Parties terminées", nombre(data.games)],
              ["Précision moyenne", pourcentage(data.average_accuracy)],
              ["Score moyen par question", nombre(data.average_points_per_question ?? null)],
              ["Meilleur score par question", nombre(data.best_points_per_question ?? null)],
            ] as const
          ).map(([label, value]) => (
            <div className={styles.metric} key={label}>
              <dt className={styles.muted}>{label}</dt>
              <dd className={styles.value}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className={`${styles.muted} mt-4`}>
          Chaque partie compte autant. On compare son total divisé par son nombre
          de questions, sur 100 points par question : une partie longue ne gagne
          pas grâce à sa longueur. Le chrono et la précision restent pris en compte.
        </p>
        {!data.games && (
          <div className={styles.empty}>
            <h3 className={styles.heading}>
              Une première partie, puis des repères.
            </h3>
            <p>
              Après ta première partie sauvegardée, tu retrouveras ici ta
              précision et tes meilleurs résultats.
            </p>
            <Link className={styles.link} href="/">
              Jouer une partie →
            </Link>
          </div>
        )}
      </section>
      {multi && (
        <section aria-labelledby="multi-titre">
          <h2 id="multi-titre" className={styles.heading}>
            À plusieurs
          </h2>
          <dl className={styles.metrics}>
            {(
              [
                ["Parties multi jouées", nombre(multi.parties)],
                ["Victoires", nombre(multi.victoires)],
              ] as const
            ).map(([label, value]) => (
              <div className={styles.metric} key={label}>
                <dt className={styles.muted}>{label}</dt>
                <dd className={styles.value}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {data.modes.length > 0 && (
        <section aria-labelledby="modes-titre">
          <h2 id="modes-titre" className={styles.heading}>
            À chaque mode, ses repères
          </h2>
          <div className={styles.modeGrid}>
            {data.modes.map((mode) => (
              <article className={styles.game} key={mode.mode}>
                <h3 className="text-lg">{MODES_PROFIL[mode.mode]}</h3>
                <p className={`${styles.muted} mt-1`}>
                  {nombre(mode.games)} {mode.games === 1 ? "partie" : "parties"}{" "}
                  · {pourcentage((mode.games / data.games) * 100)} du total
                </p>
                <div className={styles.bar} aria-hidden="true">
                  <span
                    style={{ width: `${(mode.games / data.games) * 100}%` }}
                  />
                </div>
                <dl className="mt-4 grid gap-2">
                  <div>
                    <dt className={styles.muted}>Précision moyenne</dt>
                    <dd className="date text-2xl">
                      {pourcentage(mode.average_accuracy)}
                    </dd>
                  </div>
                  <div>
                    <dt className={styles.muted}>Meilleur score par question</dt>
                    <dd className="date text-2xl">
                      {nombre(mode.best_points_per_question ?? null)}{" "}
                      <span className="text-base font-normal">points / question</span>
                    </dd>
                  </div>
                  <div>
                    <dt className={styles.muted}>Score moyen par question</dt>
                    <dd>{nombre(mode.average_points_per_question ?? null)} points / question</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
      {data.accuracy_over_time.length > 0 && (
        <section aria-labelledby="evolution-titre">
          <h2 id="evolution-titre" className={styles.heading}>
            Ta précision au fil du temps
          </h2>
          <GraphiquePrecision points={data.accuracy_over_time} />
        </section>
      )}
      {data.games > 0 && (
        <section aria-labelledby="contextes-titre">
          <h2 id="contextes-titre" className={styles.heading}>
            Tes terrains de jeu
          </h2>
          <p className={`${styles.muted} mb-4`}>
            Selon les filtres choisis au lancement. Une partie sur plusieurs
            chapitres compte dans chacun : son score reste celui de la partie
            entière.
          </p>
          {(["pack", "theme", "chapter"] as const).map((kind) => {
            const rows = data.contexts.filter((c) => c.kind === kind);
            if (!rows.length) return null;
            return (
              <table className={`${styles.table} mb-5`} key={kind}>
                <caption className="text-left font-titre text-lg">
                  {
                    {
                      pack: "Par pack",
                      theme: "Par thème",
                      chapter: "Par chapitre",
                    }[kind]
                  }
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      {
                        { pack: "Pack", theme: "Thème", chapter: "Chapitre" }[
                          kind
                        ]
                      }
                    </th>
                    <th scope="col">Parties</th>
                    <th scope="col">Précision</th>
                    <th scope="col">Record / question</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c, i) => (
                    <tr key={i}>
                      <th scope="row">
                        {c.label}
                        {c.level && (
                          <span className={`block ${styles.muted}`}>
                            {c.level}
                          </span>
                        )}
                      </th>
                      <td>{nombre(c.games)}</td>
                      <td>{pourcentage(c.average_accuracy)}</td>
                      <td>{nombre(c.best_points_per_question ?? null)} pts / question</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })}
          {!data.contexts.length && (
            <p className={styles.muted}>
              Aucun pack, thème ou chapitre enregistré pour ces parties.
            </p>
          )}
          {data.games_without_context > 0 && (
            <p className={styles.muted}>
              {nombre(data.games_without_context)}{" "}
              {data.games_without_context === 1
                ? "partie ancienne sans contexte enregistré"
                : "parties anciennes sans contexte enregistré"}
              . Leurs résultats comptent dans les statistiques globales.
            </p>
          )}
        </section>
      )}
      <ProgressionPedagogique progression={progression} />
    </div>
  );
}
