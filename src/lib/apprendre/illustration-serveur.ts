import "server-only";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { lireCsv } from "../../../scripts/csv";
import { motifChapitre,CHAPITRES } from "./catalogue";

let cartes: Map<string, { event: string; chapitre: string }> | undefined;
function correspondances() {
  if (!cartes) {
    // Chemin littéral pour limiter le traçage Turbopack à ce fichier optionnel.
    const enfant = path.join(process.cwd(),"content/pedagogie/cartes-sous-chapitres.csv");
    const lignes = [...lireCsv(path.join(process.cwd(), "content/pedagogie/cartes-v1.csv")),...(existsSync(enfant) ? lireCsv(enfant) : [])];
    const disponibles=new Set(CHAPITRES.map(c=>c.id));
    cartes = new Map(lignes.filter(c=>disponibles.has(c.chapter_id)).map(c => [c.card_id,{event:c.event_id,chapitre:c.chapter_id}]));
  }
  return cartes;
}

function dessinDedie(carte: { event: string }): string | null {
  if (/^EVT-\d{4}$/.test(carte.event)) {
    const fichier = path.join(process.cwd(), "content/illustrations", `${carte.event}.svg`);
    if (existsSync(fichier)) {
      const svg = readFileSync(fichier, "utf8").replace(/<!--[\s\S]*?-->/g, "");
      // Assets du dépôt déjà contrôlés ; refus d'un identifiant ou contenu actif.
      if (Buffer.byteLength(svg) <= 8192 && !/EVT-\d|event_id|<script|<foreignObject|\bon\w+\s*=|\bhref\s*=|<!DOCTYPE/i.test(svg)) return svg;
    }
  }
  return null;
}

export function illustrationDediee(cardId: string): boolean {
  const carte = correspondances().get(cardId);
  // Même lookup et même validation que la réponse SVG : un motif ne compte jamais.
  return carte != null && dessinDedie(carte) != null;
}

export function illustrationCarte(cardId: string): string | null {
  // Lookup exact avant tout accès fichier : ni chemin libre, ni entrée EVT.
  const carte = correspondances().get(cardId);
  if (!carte) return null;
  const svg = dessinDedie(carte);
  if (svg) return svg;
  const motifs = readFileSync(path.join(process.cwd(), "public/motifs.svg"), "utf8");
  const nom = motifChapitre(carte.chapitre);
  const dessin = new RegExp(`<symbol id="m-${nom}"[^>]*>([\\s\\S]*?)</symbol>`).exec(motifs)?.[1];
  if (!dessin) throw new Error("Illustration momentanément indisponible.");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120"><rect width="160" height="120" fill="#f3f2ec"/><g transform="translate(56 36)" color="#1d2a3a">${dessin}</g></svg>`;
}
