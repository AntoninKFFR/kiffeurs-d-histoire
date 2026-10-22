"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ouvrirCanalSalon, type CanalSalon, type EtatCanal, type Present } from "@/lib/multi/canal";
import { synchroniserHorloge, type Decalage } from "@/lib/multi/horloge";

const NB_MESURES = 60;

function percentile(valeurs: number[], p: number): number {
  if (valeurs.length === 0) return NaN;
  const triees = [...valeurs].sort((a, b) => a - b);
  return triees[Math.min(triees.length - 1, Math.floor((p / 100) * triees.length))];
}

const ms = (x: number) => (Number.isFinite(x) ? `${Math.round(x)} ms` : "…");

export function TestLatence({ salon }: { salon: string }) {
  const [etat, setEtat] = useState<EtatCanal>("connexion");
  const [presents, setPresents] = useState<Present[]>([]);
  const [allersRetours, setAllersRetours] = useState<number[]>([]);
  const [horloge, setHorloge] = useState<Decalage | "indisponible" | null>(null);
  const canal = useRef<CanalSalon | null>(null);

  useEffect(() => {
    const client = createClient();
    const moi: Present = { membreId: crypto.randomUUID(), pseudo: `onglet-${Math.floor(Math.random() * 1000)}` };
    let n = 0;

    const c = ouvrirCanalSalon(client, `test-${salon}`, moi, {
      surEtat: setEtat,
      surPresents: setPresents,
      surEvenement: (e) => {
        // Chaque onglet renvoie les pings des autres et mesure l'aller-retour des siens (horloge locale).
        if (e.type === "ping" && e.de !== moi.membreId) {
          void c.envoyer({ type: "pong", de: moi.membreId, pour: e.de, n: e.n, envoi: e.envoi, renvoi: Date.now() });
        } else if (e.type === "pong" && e.pour === moi.membreId) {
          const mesure = Date.now() - e.envoi;
          setAllersRetours((l) => [...l, mesure].slice(-NB_MESURES));
        }
      },
    });
    canal.current = c;
    const minuteur = setInterval(() => {
      n += 1;
      void c.envoyer({ type: "ping", de: moi.membreId, n, envoi: Date.now() });
    }, 1000);

    synchroniserHorloge(async () => {
      const { data, error } = await client.schema("histoire").rpc("heure_serveur");
      if (error) throw error;
      return Number(data);
    }).then(setHorloge, () => setHorloge("indisponible"));

    return () => {
      clearInterval(minuteur);
      void c.fermer();
    };
  }, [salon]);

  const unSens = allersRetours.map((x) => x / 2);
  const autres = Math.max(0, presents.length - 1);

  return (
    <main className="mx-auto grid w-full max-w-[640px] gap-6 px-4 pt-8 pb-16">
      <h1 className="font-date text-3xl">Test de latence</h1>
      <p>
        Ouvre cette page dans un second onglet ou sur un autre appareil (même adresse). Chaque onglet envoie un
        message par seconde, les autres le renvoient aussitôt.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border border-filet bg-blanc-cartel p-4">
        <dt>Canal</dt>
        <dd>test-{salon} · {etat}</dd>
        <dt>Autres onglets</dt>
        <dd>{autres}</dd>
        <dt>Mesures</dt>
        <dd>{allersRetours.length}</dd>
        <dt>Aller simple, médiane</dt>
        <dd>{ms(percentile(unSens, 50))}</dd>
        <dt>Aller simple, 95 %</dt>
        <dd>{ms(percentile(unSens, 95))}</dd>
        <dt>Aller-retour, médiane</dt>
        <dd>{ms(percentile(allersRetours, 50))}</dd>
        <dt>Écart avec l&apos;horloge du serveur</dt>
        <dd>
          {horloge === null ? "…" : horloge === "indisponible"
            ? "indisponible (migration #135 pas encore appliquée)"
            : `${ms(horloge.decalage)} (aller-retour ${ms(horloge.allerRetour)})`}
        </dd>
      </dl>
      <p className="text-sm">Objectif : aller simple sous 200 ms (médiane), 95 % des messages sous 400 ms.</p>
    </main>
  );
}
