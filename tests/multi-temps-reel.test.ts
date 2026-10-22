import { expect, it } from "vitest";
import { estimerDecalage, resteAvant, synchroniserHorloge } from "@/lib/multi/horloge";
import { actionOptimiste } from "@/lib/multi/optimiste";
import { delaiReconnexion, lireEvenement, nomCanal } from "@/lib/multi/canal";

it("garde la mesure au plus court aller-retour", () => {
  const d = estimerDecalage([
    { envoi: 0, serveur: 5300, reception: 400 }, // bruitée
    { envoi: 1000, serveur: 6050, reception: 1100 },
  ]);
  expect(d).toEqual({ decalage: 5000, allerRetour: 100 });
});

it("synchronise une horloge locale en avance de 3 s à moins de 0,3 s près", async () => {
  let t = 1_000_000;
  const local = () => t;
  const serveurVrai = () => t - 3000;
  const lire = async () => { t += 40; const s = serveurVrai(); t += 60; return s; };
  const { decalage } = await synchroniserHorloge(lire, 5, local);
  expect(Math.abs(decalage - -3000)).toBeLessThan(300);
  expect(resteAvant(serveurVrai() + 10_000, decalage, local)).toBeGreaterThan(9700);
  expect(resteAvant(0, decalage, local)).toBe(0);
});

it("annule l'affichage optimiste si le serveur refuse", async () => {
  let affiche = "avant";
  const refus = await actionOptimiste({
    appliquer: () => { affiche = "après"; },
    envoyer: () => Promise.reject(new Error("refusé")),
    annuler: () => { affiche = "avant"; },
  });
  expect(refus.ok).toBe(false);
  expect(affiche).toBe("avant");
  const ok = await actionOptimiste({ appliquer: () => { affiche = "après"; }, envoyer: async () => 1, annuler: () => {} });
  expect(ok).toEqual({ ok: true, valeur: 1 });
  expect(affiche).toBe("après");
});

it("ne laisse passer que des événements bien formés", () => {
  expect(nomCanal("abc")).toBe("histoire-salon:abc");
  expect(lireEvenement({ type: "chat", membreId: "m1", id: "berezina" })).toEqual({ type: "chat", membreId: "m1", id: "berezina" });
  expect(lireEvenement({ type: "chat", membreId: "m1", id: "Texte libre" })).toBeNull();
  expect(lireEvenement({ type: "curseur", membreId: "m1", annee: 1789, mois: "juillet" })).toEqual({ type: "curseur", membreId: "m1", annee: 1789 });
  expect(lireEvenement({ type: "reponse", annee: 1789 })).toBeNull();
  expect(lireEvenement(null)).toBeNull();
});

it("espace les tentatives de reconnexion jusqu'à 8 s", () => {
  expect([1, 2, 3, 4, 5, 9].map(delaiReconnexion)).toEqual([500, 1000, 2000, 4000, 8000, 8000]);
});
