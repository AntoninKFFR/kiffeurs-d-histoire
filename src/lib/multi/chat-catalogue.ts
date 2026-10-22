// Catalogue du chat restreint des salons (#132, validé par Maxou le 22 oct. 2026).
// Pas de texte libre : le client n'envoie qu'un identifiant de ce catalogue, et le serveur refuse tout le reste (#138).
// Les identifiants sont stables : on peut en ajouter, jamais en renommer ni en réutiliser un.
// Les dessins sont dans public/emotes/<id>.svg (64 × 64, style encre de la charte).

export type EmoteId =
  | "napoleon-rire" | "chevalier-salut" | "momie-peur" | "pharaon-blase"
  | "legionnaire-ave" | "viking-colere" | "sans-culotte-chante" | "mousquetaire-clin"
  | "cro-magnon-perplexe" | "astronaute-bravo" | "sablier" | "couronne"
  | "parchemin" | "duel" | "canon" | "laurier";

export type Emote = {
  id: EmoteId;
  /** Personnage ou objet, puis ce qu'il exprime : sert de texte alternatif et d'infobulle. */
  nom: string;
  action: string;
};

export const EMOTES: readonly Emote[] = [
  { id: "napoleon-rire", nom: "Napoléon", action: "rit" },
  { id: "chevalier-salut", nom: "Chevalier", action: "salue" },
  { id: "momie-peur", nom: "Momie", action: "a peur" },
  { id: "pharaon-blase", nom: "Pharaon", action: "est blasé" },
  { id: "legionnaire-ave", nom: "Légionnaire", action: "« Ave ! »" },
  { id: "viking-colere", nom: "Viking", action: "est furieux" },
  { id: "sans-culotte-chante", nom: "Révolutionnaire", action: "chante" },
  { id: "mousquetaire-clin", nom: "Mousquetaire", action: "fait un clin d'œil" },
  { id: "cro-magnon-perplexe", nom: "Homme préhistorique", action: "est perplexe" },
  { id: "astronaute-bravo", nom: "Astronaute", action: "applaudit" },
  { id: "sablier", nom: "Sablier", action: "« Presse-toi ! »" },
  { id: "couronne", nom: "Couronne", action: "« Bien joué ! »" },
  { id: "parchemin", nom: "Parchemin", action: "« Je l'avais lu ! »" },
  { id: "duel", nom: "Épées croisées", action: "« En garde ! »" },
  { id: "canon", nom: "Canon", action: "« Boum ! »" },
  { id: "laurier", nom: "Laurier", action: "« Victoire ! »" },
];

export type FamillePhrase = "saluer" | "encourager" | "taquiner" | "feliciter" | "reagir";

export type Phrase = {
  id: string;
  famille: FamillePhrase;
  texte: string;
};

export const FAMILLES_PHRASES: Record<FamillePhrase, string> = {
  saluer: "Saluer",
  encourager: "Encourager",
  taquiner: "Taquiner",
  feliciter: "Féliciter",
  reagir: "Réagir, au revoir",
};

export const PHRASES: readonly Phrase[] = [
  { id: "ave-compagnons", famille: "saluer", texte: "Ave, compagnons !" },
  { id: "oyez", famille: "saluer", texte: "Oyez, oyez !" },
  { id: "bonjour-citoyens", famille: "saluer", texte: "Bien le bonjour, citoyens !" },
  { id: "meilleure-epoque", famille: "saluer", texte: "Que la meilleure époque gagne !" },
  { id: "a-vos-frises", famille: "saluer", texte: "À vos frises, prêts, partez !" },
  { id: "histoire-avec-toi", famille: "encourager", texte: "Courage, l'Histoire est avec toi !" },
  { id: "rome-un-jour", famille: "encourager", texte: "Rome ne s'est pas faite en un jour." },
  { id: "la-garde", famille: "encourager", texte: "Tiens bon, la Garde meurt mais ne se rend pas !" },
  { id: "encore-un-effort", famille: "encourager", texte: "Encore un effort, citoyen !" },
  { id: "waterloo-passager", famille: "encourager", texte: "Pas de panique, ce n'est qu'un Waterloo passager." },
  { id: "veni-vidi-rate", famille: "taquiner", texte: "Veni, vidi… raté !" },
  { id: "revise-alesia", famille: "taquiner", texte: "T'as révisé à Alésia ou quoi ?" },
  { id: "berezina", famille: "taquiner", texte: "Ça sent la Bérézina…" },
  { id: "coupe-le-score", famille: "taquiner", texte: "Qu'on lui coupe… le score !" },
  { id: "prehistoire", famille: "taquiner", texte: "Tu dates de la préhistoire, toi." },
  { id: "chapeau-bas", famille: "feliciter", texte: "Chapeau bas, mousquetaire !" },
  { id: "digne-historien", famille: "feliciter", texte: "Digne d'un historien !" },
  { id: "au-jour-pres", famille: "feliciter", texte: "Au jour près, respect !" },
  { id: "roi-de-la-frise", famille: "feliciter", texte: "Vive le roi… de la frise !" },
  { id: "austerlitz", famille: "feliciter", texte: "Un Austerlitz, ça !" },
  { id: "sacrebleu", famille: "reagir", texte: "Sacrebleu !" },
  { id: "toutatis", famille: "reagir", texte: "Par Toutatis !" },
  { id: "eureka", famille: "reagir", texte: "Eurêka !" },
  { id: "revanche", famille: "reagir", texte: "Revanche ?" },
  { id: "adieu", famille: "reagir", texte: "Je retourne à mes parchemins. Adieu !" },
];

export function urlEmote(id: EmoteId): string {
  return `/emotes/${id}.svg`;
}

/** Vrai si l'identifiant reçu fait partie du catalogue (émote ou phrase). */
export function estDansLeCatalogue(id: string): boolean {
  return EMOTES.some((e) => e.id === id) || PHRASES.some((p) => p.id === id);
}
