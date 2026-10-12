"use client";

import Link from "next/link";
import { useState } from "react";
import type { Vue } from "@/lib/game/frise";
import { chronoDepuis, correctionInverseDepuis, dateDepuis, estInverse, precisionDepuis } from "@/lib/game/partie";
import type { SoloCorrection, SoloInverseQuestion, SoloQuestion, SoloResult } from "@/lib/game/solo";
import { Bilan } from "./Bilan";
import type { HabillageId } from "@/lib/game/habillages";
import { EcranInverse } from "./EcranInverse";

// Les trois appels au moteur serveur (src/app/solo/actions.ts), passés par la page.
export type ActionsPartieInverse = {
  soumettre: (gameId: string, questionId: string, reponse: string | null) => Promise<SoloCorrection>;
  suivante: (gameId: string) => Promise<SoloQuestion | null>;
  terminer: (gameId: string) => Promise<SoloResult>;
};

type Props = {
  gameId: string;
  total: number;
  question: SoloInverseQuestion;
  actions: ActionsPartieInverse;
  connecte: boolean;
  anonyme: boolean;
  relance?: string;
  bornes?: Vue | null;
  /** Habillage de frise de la période jouée (#97). */
  habillage?: HabillageId | null;
};

export function PartieInverse({ gameId, total, question: premiere, actions, connecte, anonyme, relance, bornes, habillage }: Props) {
  const [question, setQuestion] = useState(premiere);
  const [chrono, setChrono] = useState(() => chronoDepuis(premiere, Date.now()));
  const [resultat, setResultat] = useState<SoloResult | null>(null);
  const nombre = question.question_count ?? total;

  async function suivante() {
    const q = await actions.suivante(gameId);
    if (q && estInverse(q)) {
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
      <EcranInverse
        key={question.question_id}
        chrono={chrono}
        bornes={bornes}
        habillage={habillage}
        corriger={async (questionId, reponse) => correctionInverseDepuis(await actions.soumettre(gameId, questionId, reponse))}
        suivante={{ libelle: question.position >= nombre ? "Voir le bilan" : "Question suivante", action: suivante }}
        question={{
          id: question.question_id,
          date: dateDepuis(question.date),
          precision: precisionDepuis(question.date_precision),
          numero: question.position,
          total: nombre,
        }}
      />
    </div>
  );
}
