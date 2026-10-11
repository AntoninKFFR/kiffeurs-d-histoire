import Link from "next/link";
import { lancer } from "@/app/partie/actions";
import SaveGame from "@/app/partie/[id]/SaveGame";
import type { SoloResult } from "@/lib/game/solo";
import { cheminChapitre } from "@/lib/apprendre/catalogue";
import { CHAPITRES, ecrireChoix, lireChoix, relanceEnregistree, libelleNiveau } from "@/lib/solo/choix";
import { choixMystere } from "@/lib/solo/mystere";
import { BoutonMystere } from "@/components/choix/BoutonMystere";
import { EnregistrerTest } from "@/components/pedagogie/EnregistrerTest";
import { BilanInteractif } from "./bilan/BilanInteractif";

type Props = {
  resultat: SoloResult;
  connecte: boolean;
  /** Partie encore anonyme, à rattacher au compte connecté. */
  anonyme: boolean;
  /** Choix d'origine, conservé tel quel pour rejouer. */
  relance?: string;
};

export function Bilan({ resultat, connecte, anonyme, relance }: Props) {
  const { game_id: id, questions, average_accuracy: precision } = resultat;
  const suite = `/partie/${id}`;
  const enregistre = relanceEnregistree(resultat.replay_filters);
  const choix = (resultat.replay_filters?.mystery || resultat.replay_filters?.expertOnly !== undefined ? enregistre : relance) ?? enregistre ?? `mode=general&difficulte=${questions[0]?.unit ?? "YEAR"}`;
  const origine = lireChoix(new URLSearchParams(choix));
  const mystere = origine?.mystere && (origine.mode === "pack" || origine.mode === "theme");
  const chapitreTeste = origine?.test ? CHAPITRES.find((c) => c.id === origine.chapitres?.[0]) : undefined;
  const unite = questions[0]?.unit === "DAY" ? "JOUR" : questions[0]?.unit === "MONTH" ? "MOIS" : "ANNÉE";
  const contexte = chapitreTeste ? `Test du chapitre · ${chapitreTeste.titre}`
    : `${resultat.direction === "inverse" ? "SOLO INVERSÉ" : "SOLO LIBRE"}${origine?.niveau ? ` · ${libelleNiveau(origine)}` : ""} · PRÉCISION ${unite}${mystere ? ` · THÈME MYSTÈRE${resultat.replay_filters?.mysteryLabel ? ` : ${resultat.replay_filters.mysteryLabel}` : ""}` : ""}`;

  // Ce slot reste monté au même endroit pendant toute la navigation du carnet.
  // La sauvegarde et la progression gardent leurs effets et actions d'origine.
  const actions = <div className="hero-actions">
    <form action={lancer}><input type="hidden" name="c" value={choix} /><button type="submit" className="replay">{mystere ? "Rejouer ce thème" : "Rejouer"} <span aria-hidden="true">↗</span></button></form>
    {mystere && origine && <BoutonMystere choix={ecrireChoix(choixMystere(origine))} relance />}
    <Link className="change-mode" href="/">Changer de mode</Link>
    {chapitreTeste && <Link className="chapter-action" href={cheminChapitre(chapitreTeste)}>Revoir le chapitre</Link>}
    <div className="save">
      {!connecte ? <p>Tu as joué sans compte : cette partie ne sera pas sauvegardée. <Link href={`/connexion?next=${encodeURIComponent(suite)}`} className="font-bold underline underline-offset-4">Se connecter pour la sauvegarder</Link></p>
        : anonyme ? <SaveGame gameId={id} /> : <p role="status">✓ Partie sauvegardée dans ton compte KFFR.</p>}
    </div>
    {/* Comme avant, la simple relecture depuis le profil ne réenregistre pas un test. */}
    {chapitreTeste && origine && relance && <div className="chapter-status"><EnregistrerTest chapitre={chapitreTeste.id} partie={id} precision={precision}
      difficulte={origine.difficulte} connecte={connecte} anonyme={anonyme} /></div>}
  </div>;
  return <BilanInteractif resultat={resultat} contexte={contexte} actions={actions} />;
}
