// Aperçu de la partie Convivial (#140) : un faux serveur dans le navigateur, avec des joueurs fictifs
// qui répondent tout seuls. Il suit les règles de histoire.etat_partie (décompte 3 s, chrono 30 s, clôture
// quand tous ont validé, révélation 8 s, mode chrono 10 s) ; le score reprend la formule du solo, en Année.
import type { HistoricDate } from "@/lib/game/dates";
import type { BilanPartie } from "@/lib/multi/bilan";
import type { EtatPartie, PropositionContenu, TiragePartie } from "@/lib/multi/partie";

type Question = { id: string; titre: string; annee: number; fin?: number; description: string };
type Reponse = { annee: number; fin?: number; recue: number; points: number; ecart: number; ecartFin?: number };
type Horaire = { posee: number; limite: number; revelee: number | null };

const QUESTIONS: Question[] = [
  { id: "q1", titre: "Prise de la Bastille", annee: 1789, description: "Le 14 juillet 1789, les Parisiens prennent la forteresse royale." },
  { id: "q2", titre: "Sacre de Napoléon Ier", annee: 1804, description: "Napoléon se couronne empereur à Notre-Dame de Paris." },
  { id: "q3", titre: "Guerre de Cent Ans", annee: 1337, fin: 1453, description: "Un conflit de plus d'un siècle entre les rois de France et d'Angleterre." },
  { id: "q4", titre: "Abolition de l'esclavage en France", annee: 1848, description: "Le décret de Victor Schœlcher abolit l'esclavage dans les colonies françaises." },
  { id: "q5", titre: "Révolution de Juillet", annee: 1830, description: "Les Trois Glorieuses renversent Charles X." },
];
const DECOMPTE = 3000;
const DUREE = 30000;
const REVELATION = 8000;
const RAPIDE = 10000;
const VOTE = 15000;
const ROULETTE = 6000;
// Vote (#144) : une proposition par catégorie ; Antonin et Clément pour la Révolution, Lulu pour les Sciences.
const PROPOSITIONS: PropositionContenu[] = [
  { type: "pack", id: "COL-0066", titre: "Révolution française" },
  { type: "periode", id: "xixe", titre: "XIXe siècle" },
  { type: "theme", id: "TAG-0127", titre: "Sciences" },
];
const VOTES_BOTS: [string, number, number][] = [["m2", 3000, 0], ["m3", 5000, 2], ["m4", 9000, 0], ["m6", 4000, 1], ["m7", 6000, 2],
  ["m8", 7000, 1], ["m9", 8000, 0], ["m10", 11000, 2]];
const MYSTERES: PropositionContenu[] = [
  { type: "periode", id: "antiquite", titre: "Antiquité" }, { type: "periode", id: "moyen-age", titre: "Moyen Âge" },
  { type: "periode", id: "epoque-moderne", titre: "Époque moderne" }, { type: "periode", id: "xixe", titre: "XIXe siècle" },
  { type: "periode", id: "guerres-mondiales", titre: "Guerres mondiales" }, { type: "periode", id: "depuis-1945", titre: "Depuis 1945" },
];
type Bot = { apres: number[]; ecart: number[] };
// Joueurs fictifs : quand ils répondent (s après la question) et de combien ils se trompent.
// Partie de 5 : Sarah (m5) est déconnectée. Partie de 10 (mesure du mode visible) : 9 joueurs fictifs.
const BOTS_5: Record<string, Bot> = {
  m2: { apres: [6, 9, 5, 12, 7], ecart: [0, 2, -4, 1, 3] },
  m3: { apres: [11, 5, 18, 8, 13], ecart: [3, 0, 10, 0, -1] },
  m4: { apres: [17, 21, 24, 19, 26], ecart: [-13, 8, -25, 20, 5] },
};
const BOTS_10: Record<string, Bot> = Object.fromEntries(Array.from({ length: 9 }, (_, k) => [`m${k + 2}`, {
  apres: QUESTIONS.map((_, i) => 6 + ((k * 7 + i * 5) % 20)),
  ecart: QUESTIONS.map((_, i) => ((k * 13 + i * 7) % 31) - 15),
}]));
export const joueursSimules = (dix: boolean) => (dix ? Array.from({ length: 10 }, (_, k) => `m${k + 1}`) : ["m1", "m2", "m3", "m4", "m5"]);

function points(ecart: number, ecoule: number): number {
  const p = 100 * Math.max(0, 1 - Math.abs(ecart) / 50);
  return Math.round(p * (0.7 + 0.3 * Math.max(0, DUREE / 1000 - ecoule) / (DUREE / 1000)));
}

// La partie commence au premier appel (décompte de 3 s).
// ?contenu=vote : 15 s de vote d'abord (les joueurs fictifs votent ; égalité, donc roulette, si je vote Sciences) ;
// ?contenu=mystere : la roulette tire une période pour tout le salon.
export function creerSimulation({ chrono = false, moi = "m1", dix = false, contenu = "direct" as "direct" | "vote" | "mystere" } = {}) {
  const BOTS = dix ? BOTS_10 : BOTS_5;
  const MEMBRES_JOUEURS = joueursSimules(dix);
  const horaires: Horaire[] = [];
  let debut: number | null = null;
  const votes = new Map<string, { choix: number; quand: number }>();
  let voteClos: number | null = contenu === "vote" ? null : 0;
  let tirage: TiragePartie | null = null;
  let joue: PropositionContenu & { mystere?: boolean } = { type: "periode", id: "xixe", titre: "XIXe siècle" };

  function roulette(candidats: PropositionContenu[], gagnant: PropositionContenu, fin: number): TiragePartie {
    return { candidats, gagnant, fin: new Date(fin).toISOString() };
  }

  // Avant les questions : le vote (clos quand tous les présents ont voté, ou à 15 s), ou la roulette Mystère.
  function preparer(maintenant: number) {
    if (debut == null) {
      debut = maintenant;
      if (contenu === "mystere") {
        joue = { ...MYSTERES[3], mystere: true };
        tirage = roulette([MYSTERES[0], MYSTERES[1], MYSTERES[5], MYSTERES[3], MYSTERES[2], MYSTERES[4]], MYSTERES[3], maintenant + ROULETTE);
        horaires.push({ posee: maintenant + ROULETTE + DECOMPTE, limite: maintenant + ROULETTE + DECOMPTE + DUREE, revelee: null });
      } else if (contenu === "direct") {
        horaires.push({ posee: maintenant + DECOMPTE, limite: maintenant + DECOMPTE + DUREE, revelee: null });
      }
    }
    if (voteClos != null) return;
    for (const [id, apres, choix] of VOTES_BOTS) {
      if (MEMBRES_JOUEURS.includes(id) && !votes.has(id) && debut + apres <= maintenant) votes.set(id, { choix, quand: debut + apres });
    }
    const presents = MEMBRES_JOUEURS.filter((m) => dix || m !== "m5");
    const tous = presents.every((m) => votes.has(m));
    if (!tous && maintenant < debut + VOTE) return;
    voteClos = tous ? Math.max(...[...votes.values()].map((v) => v.quand)) : debut + VOTE;
    const voix = PROPOSITIONS.map((_, i) => [...votes.values()].filter((v) => v.choix === i).length);
    const ex = PROPOSITIONS.filter((_, i) => voix[i] === Math.max(...voix));
    let posee = voteClos + DECOMPTE;
    joue = ex[0];
    if (ex.length > 1) {
      tirage = roulette(ex, ex[0], voteClos + ROULETTE);
      posee += ROULETTE;
    }
    horaires.push({ posee, limite: posee + DUREE, revelee: null });
  }
  const reponses = new Map<string, Map<string, Reponse>>(QUESTIONS.map((q) => [q.id, new Map()]));
  let terminee = false;

  function repondreA(i: number, membre: string, annee: number, fin: number | undefined, quand: number) {
    const q = QUESTIONS[i];
    const h = horaires[i];
    const r = reponses.get(q.id)!;
    if (r.has(membre) || quand < h.posee || quand > h.limite || h.revelee != null) return false;
    const ecoule = (quand - h.posee) / 1000;
    const ecart = annee - q.annee;
    const ecartFin = q.fin != null && fin != null ? fin - q.fin : undefined;
    const pts = ecartFin != null ? Math.round((points(ecart, ecoule) + points(ecartFin, ecoule)) / 2) : points(ecart, ecoule);
    r.set(membre, { annee, fin, recue: quand, points: pts, ecart: Math.abs(ecart), ecartFin: ecartFin != null ? Math.abs(ecartFin) : undefined });
    if (chrono) h.limite = Math.min(h.limite, quand + RAPIDE);
    return true;
  }

  function avancer(maintenant: number) {
    preparer(maintenant);
    if (horaires.length === 0) return;
    for (;;) {
      const i = horaires.length - 1;
      const h = horaires[i];
      if (terminee || maintenant < h.posee) return;
      // Les joueurs fictifs répondent à leur heure (avant la clôture).
      for (const [id, bot] of Object.entries(BOTS)) {
        const quand = h.posee + bot.apres[i] * 1000;
        const q = QUESTIONS[i];
        if (quand <= Math.min(maintenant, h.limite) && h.revelee == null) {
          repondreA(i, id, q.annee + bot.ecart[i], q.fin != null ? q.fin + bot.ecart[i] : undefined, quand);
        }
      }
      if (h.revelee != null) return;
      const presents = MEMBRES_JOUEURS.filter((m) => dix || m !== "m5");
      const tous = presents.every((m) => reponses.get(QUESTIONS[i].id)!.has(m));
      if (maintenant <= h.limite && !tous) return;
      const fin = tous ? Math.max(...[...reponses.get(QUESTIONS[i].id)!.values()].map((r) => r.recue)) : h.limite;
      h.revelee = Math.min(fin, h.limite);
      if (i + 1 >= QUESTIONS.length) { terminee = true; return; }
      horaires.push({ posee: h.revelee + REVELATION, limite: h.revelee + REVELATION + DUREE, revelee: null });
    }
  }

  function etat(maintenant: number): EtatPartie {
    avancer(maintenant);
    const posees = horaires.filter((h) => h.posee <= maintenant);
    const i = posees.length - 1;
    const prochaine = horaires.findIndex((h) => h.posee > maintenant);
    const q = i >= 0 ? QUESTIONS[i] : null;
    const h = i >= 0 ? horaires[i] : null;
    const iso = (t: number) => new Date(t).toISOString();
    const date = (annee?: number) => (annee == null ? undefined : { year: annee });
    return {
      partie: { id: "apercu", numero: 1, etat: terminee ? "terminee" : voteClos == null ? "vote" : "en_cours", contenu: voteClos == null ? {} : joue,
        precision: "YEAR", mode_chrono: chrono, total: QUESTIONS.length, duree_question: DUREE / 1000, duree_revelation: REVELATION / 1000,
        categories: contenu === "mystere" ? ["periode"] : ["pack", "periode", "theme"] },
      vote: voteClos == null ? { propositions: PROPOSITIONS, fin: iso(debut! + VOTE), duree: VOTE / 1000,
        votes: [...votes.entries()].sort((a, b) => a[1].quand - b[1].quand).map(([m, v]) => ({ membre_id: m, choix: v.choix })) } : null,
      tirage,
      heure_serveur: maintenant,
      moi,
      je_joue: true,
      question: q && h ? {
        id: q.id, position: i + 1, titre: q.titre, image_path: null, periode: q.fin != null,
        posee_le: iso(h.posee), limite_le: iso(h.limite), revelee_le: h.revelee != null ? iso(h.revelee) : null,
        ont_valide: [...reponses.get(q.id)!.entries()].sort((a, b) => a[1].recue - b[1].recue).map(([m]) => m),
        ...(h.revelee != null ? {
          correction: { debut: { year: q.annee }, fin: date(q.fin), description: q.description },
          reponses: [...reponses.get(q.id)!.entries()].map(([m, r]) => ({ membre_id: m, debut: { year: r.annee }, fin: date(r.fin),
            ecart: r.ecart, ecart_fin: r.ecartFin, unite: "YEAR" as const, points: r.points })),
        } : {}),
      } : null,
      prochaine: prochaine >= 0 ? { position: prochaine + 1, posee_le: iso(horaires[prochaine].posee) } : null,
      scores: MEMBRES_JOUEURS.map((m) => ({ membre_id: m, points: QUESTIONS.reduce((total, x, k) =>
        total + (horaires[k]?.revelee != null ? reponses.get(x.id)!.get(m)?.points ?? 0 : 0), 0) })),
    };
  }

  function voter(choix: number, maintenant: number) {
    preparer(maintenant);
    if (voteClos != null) return { ok: false as const, erreur: "Le vote est clos" };
    votes.set(moi, { choix, quand: maintenant });
    preparer(maintenant);
    return { ok: true as const };
  }

  function repondre(questionId: string, debut: HistoricDate, fin: HistoricDate | null | undefined, maintenant: number) {
    avancer(maintenant);
    const i = QUESTIONS.findIndex((q) => q.id === questionId);
    if (i < 0 || i >= horaires.length) return { ok: false as const, erreur: "Question inactive" };
    return repondreA(i, moi, debut.year, fin?.year, maintenant) ? { ok: true as const } : { ok: false as const, erreur: "Temps écoulé" };
  }

  // Mode visible : où chaque joueur fictif promène son curseur, d'un point de départ jusqu'à sa réponse.
  function curseurs(maintenant: number): { membreId: string; question: string; annee: number; fin?: number }[] {
    avancer(maintenant);
    const i = horaires.length - 1;
    const h = horaires[i];
    const q = QUESTIONS[i];
    if (!h || maintenant < h.posee + 800 || h.revelee != null) return [];
    return Object.entries(BOTS).map(([id, bot], k) => {
      const fin = q.annee + bot.ecart[i];
      const depart = fin + (k % 2 ? 40 : -35) + k * 3;
      const p = Math.min(1, (maintenant - h.posee - 800) / (bot.apres[i] * 1000 - 800));
      const vague = Math.sin(maintenant / 350 + k) * 6 * (1 - p);
      const annee = Math.round(depart + (fin - depart) * (1 - (1 - p) ** 2) + vague) || 1;
      return { membreId: id, question: q.id, annee, ...(q.fin != null ? { fin: annee + (q.fin - q.annee) } : {}) };
    });
  }

  // Fin de partie (#143) : comme histoire.bilan_partie, une fois la partie terminée.
  function bilan(maintenant: number): BilanPartie | null {
    const e = etat(maintenant);
    if (!terminee) return null;
    return {
      partie: { id: e.partie.id, numero: 1, contenu: e.partie.contenu, precision: "YEAR", total: QUESTIONS.length },
      questions: QUESTIONS.map((q, i) => ({
        position: i + 1, titre: q.titre,
        correction: { debut: { year: q.annee }, ...(q.fin != null ? { fin: { year: q.fin } } : {}) },
        reponses: [...reponses.get(q.id)!.entries()].map(([m, r]) => ({ membre_id: m, debut: { year: r.annee },
          ecart: r.ecart, unite: "YEAR" as const, points: r.points, secondes: (r.recue - horaires[i].posee) / 1000 })),
      })),
      scores: e.scores,
    };
  }

  // Réactions des joueurs fictifs (#142) : Antonin envoie une émote 3 s après chaque révélation.
  function reactions(maintenant: number): { membreId: string; id: string; recu: number }[] {
    avancer(maintenant);
    const EMOTES = ["couronne", "napoleon-rire", "duel", "sablier", "couronne"];
    return horaires.flatMap((h, i) => h.revelee != null && h.revelee + 3000 <= maintenant
      ? [{ membreId: "m2", id: EMOTES[i % EMOTES.length], recu: h.revelee + 3000 }] : []);
  }

  return { etat, repondre, voter, curseurs, bilan, reactions };
}
