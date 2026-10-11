"use client";

import { useState } from "react";
import { Partie, type ActionsPartie } from "@/components/partie/Partie";
import { gapInUnit } from "@/lib/game/dates";
import type { SoloCorrection, SoloDateQuestion, SoloResult } from "@/lib/game/solo";

const DUREE_MS = 15_000;
type Sujet = { titre: string; date: { year: number; month: number; day: number }; fin?: { year: number; month: number; day: number }; description: string };
const SUJETS: Sujet[] = [
  { titre: "Prise de la Bastille", date: { year: 1789, month: 7, day: 14 }, description: "Le peuple de Paris s'empare de la forteresse royale." },
  { titre: "Armistice de Rethondes mettant fin aux combats de la Première Guerre mondiale sur le front occidental", date: { year: 1918, month: 11, day: 11 }, description: "les combats cessent sur le front occidental, après quatre années d'une guerre qui a mobilisé des millions de soldats et bouleversé les sociétés européennes. Le texte est volontairement long pour vérifier qu'il tient en entier dans la boîte de réponse." },
  { titre: "sacre de Charlemagne", date: { year: 800, month: 12, day: 25 }, description: "Le roi des Francs est couronné empereur à Rome." },
  // Question période (#94) : le début puis la fin.
  { titre: "Première Guerre mondiale", date: { year: 1914, month: 7, day: 28 }, fin: { year: 1918, month: 11, day: 11 }, description: "La guerre éclate fin juillet 1914 et prend fin avec l'armistice du 11 novembre 1918." },
];

function question(i: number): SoloDateQuestion {
  const maintenant = Date.now();
  return {
    question_id: `demo-${i + 1}`,
    position: i + 1,
    difficulty: "DAY",
    title: SUJETS[i].titre,
    image_path: null,
    asked_at: new Date(maintenant).toISOString(),
    deadline: new Date(maintenant + DUREE_MS).toISOString(),
    server_time: new Date(maintenant).toISOString(),
    ...(SUJETS[i].fin ? { periode: true as const } : {}),
  };
}

type DateDemo = { year: number | null; month: number | null; day: number | null };
type DetailQuestion = SoloCorrection & { position: number; title: string; answer: DateDemo; answer_end?: DateDemo };

// Faux moteur : même contrat que src/app/solo/actions.ts, sans base de données.
function creerMoteur(): ActionsPartie {
  let i = 0;
  const corrections: DetailQuestion[] = [];
  return {
    async soumettre(_g, qid, reponse) {
      const bonne = SUJETS[i].date;
      const ecart = reponse ? gapInUnit(reponse, bonne, "jour") : null;
      const points = reponse ? Math.round(100 * Math.exp(-(ecart ?? 0) / 73)) : 0;
      const c: SoloCorrection = { question_id: qid, correct_date: bonne, gap: ecart, unit: "DAY", accuracy: points, points, expired: !reponse, description: SUJETS[i].description };
      corrections.push({ ...c, position: i + 1, title: SUJETS[i].titre, answer: { year: reponse?.year ?? null, month: reponse?.month ?? null, day: reponse?.day ?? null } });
      return c;
    },
    async soumettrePeriode(_g, qid, reponse) {
      const { date: bonne, fin: bonneFin } = SUJETS[i];
      const note = (r: { year: number } | undefined, b: { year: number }) => r ? Math.round(100 * Math.exp(-gapInUnit(r, b, "jour") / 73)) : 0;
      const pd = note(reponse?.debut, bonne);
      const pf = note(reponse?.fin, bonneFin!);
      const points = Math.round((pd + pf) / 2);
      const c: SoloCorrection = { question_id: qid, correct_date: bonne, gap: reponse ? gapInUnit(reponse.debut, bonne, "jour") : null,
        unit: "DAY", accuracy: points, points, expired: !reponse, description: SUJETS[i].description,
        periode: true, correct_end_date: bonneFin!, end_gap: reponse ? gapInUnit(reponse.fin, bonneFin!, "jour") : null, start_accuracy: pd, end_accuracy: pf };
      const vers = (d?: { year: number; month?: number | null; day?: number | null }) => ({ year: d?.year ?? null, month: d?.month ?? null, day: d?.day ?? null });
      corrections.push({ ...c, position: i + 1, title: SUJETS[i].titre, answer: vers(reponse?.debut), answer_end: vers(reponse?.fin) });
      return c;
    },
    async suivante() {
      i += 1;
      return i < SUJETS.length ? question(i) : null;
    },
    async terminer(gameId): Promise<SoloResult> {
      const total = corrections.reduce((s, c) => s + c.points, 0);
      return {
        game_id: gameId,
        state: "finished",
        question_count: SUJETS.length,
        average_accuracy: Math.round(total / SUJETS.length),
        total_points: total,
        direction: "date",
        questions: corrections as Extract<SoloResult, { direction: "date" }>["questions"],
      };
    },
  };
}

export function DemoPartie() {
  const [actions] = useState(creerMoteur);
  const [premiere] = useState(() => question(0));
  return <Partie gameId="demo" total={SUJETS.length} question={premiere} actions={actions} connecte anonyme={false} />;
}
