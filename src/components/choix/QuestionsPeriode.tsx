import styles from "./choix.module.css";

/** Option des questions « période » (#94) : activées par défaut, coupables avant de lancer. */
export function QuestionsPeriode({ valeur, onChange }: { valeur: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`${styles.difficultes} ${styles.options}`} role="group" aria-label="Questions période">
      <button type="button" className={styles.difficulte} aria-pressed={valeur} onClick={() => onChange(true)}>
        <b>Activées</b>
        <small>Pour un événement qui dure, trouve le début et la fin (2 questions sur 10 au plus)</small>
      </button>
      <button type="button" className={styles.difficulte} aria-pressed={!valeur} onClick={() => onChange(false)}>
        <b>Coupées</b>
        <small>Une seule date par question</small>
      </button>
    </div>
  );
}
