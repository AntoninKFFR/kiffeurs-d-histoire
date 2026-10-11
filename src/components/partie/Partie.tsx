"use client";

import Link from "next/link";
import { useState } from "react";
import type { HistoricDate } from "@/lib/game/dates";
import type { Vue } from "@/lib/game/frise";
import { capitaliser, chronoDepuis, correctionDepuis, precisionDepuis, urlIllustration } from "@/lib/game/partie";
import type { MethodeSaisie, SoloCorrection, SoloDate, SoloDateQuestion, SoloQuestion, SoloResult } from "@/lib/game/solo";
import { Bilan } from "./Bilan";
import { EcranPartie, type Correction, type ReponsePeriode } from "./EcranPartie";

// Les trois appels au moteur serveur (src/app/solo/actions.ts), passés par la page.
export type ActionsPartie = {
  soumettre: (gameId: string, questionId: string, reponse: SoloDate | null, methode?: MethodeSaisie | null) => Promise<SoloCorrection>;
  /** Question période (#94) : le début et la fin ; `null` constate l'expiration. */
  soumettrePeriode?: (gameId: string, questionId: string, reponse: { debut: SoloDate; fin: SoloDate } | null, methode?: MethodeSaisie | null) => Promise<SoloCorrection>;
  suivante: (gameId: string) => Promise<SoloQuestion | null>;
  terminer: (gameId: string) => Promise<SoloResult>;
};

type Props = {
  gameId: string;
  total: number;
  /** Première question : celle qui est en cours quand la page s'ouvre (reprise après rechargement comprise). */
  question: SoloDateQuestion;
  actions: ActionsPartie;
  connecte: boolean;
  anonyme: boolean;
  /** Choix d'origine, pour « Rejouer » au bilan. */
  relance?: string;
  /** Période couverte par le choix : la frise s'y limite. */
  bornes?: Vue | null;
};

export function Partie({ gameId, total, question: premiere, actions, connecte, anonyme, relance, bornes }: Props) {
  const [question, setQuestion] = useState(premiere);
  const [chrono, setChrono] = useState(() => chronoDepuis(premiere, Date.now()));
  const [resultat, setResultat] = useState<SoloResult | null>(null);
  const nombre = question.question_count ?? total;

  async function corriger(questionId: string, reponse: HistoricDate | null, methode?: MethodeSaisie | null): Promise<Correction> {
    return correctionDepuis(await actions.soumettre(gameId, questionId, reponse, methode));
  }

  async function corrigerPeriode(questionId: string, reponse: ReponsePeriode | null, methode?: MethodeSaisie | null): Promise<Correction> {
    return correctionDepuis(await actions.soumettrePeriode!(gameId, questionId, reponse, methode));
  }

  async function suivante() {
    const q = await actions.suivante(gameId);
    if (q && "title" in q) {
      setQuestion(q);
      setChrono(chronoDepuis(q, Date.now()));
      return;
    }
    setResultat(await actions.terminer(gameId));
  }

  if (resultat) {
    return (
      <div className="flex flex-1 flex-col">
        <Bilan resultat={resultat} connecte={connecte} anonyme={anonyme} relance={relance} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {!connecte && (
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-filet bg-blanc-cartel px-4 py-2 text-sm text-encre-douce">
          <span>Tu joues sans compte : la partie ne sera pas sauvegardée.</span>
          <Link href={`/connexion?next=${encodeURIComponent(`/partie/${gameId}`)}`} className="font-bold text-encre underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      )}
      <EcranPartie
        key={question.question_id}
        corriger={corriger}
        corrigerPeriode={actions.soumettrePeriode ? corrigerPeriode : undefined}
        chrono={chrono}
        bornes={bornes}
        suivante={{ libelle: question.position >= nombre ? "Voir le bilan" : "Question suivante", action: suivante }}
        question={{
          id: question.question_id,
          titre: capitaliser(question.title),
          precision: precisionDepuis(question.difficulty),
          numero: question.position,
          total: nombre,
          illustrationUrl: urlIllustration(question.image_path) ?? undefined,
          periode: question.periode === true,
        }}
      />
    </div>
  );
}
