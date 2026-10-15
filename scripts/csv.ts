import { readFileSync } from "node:fs";

export type LigneCsv = Record<string, string>;

// CSV UTF-8/BOM, virgules, guillemets échappés et cellules multilignes.
export function lireCsv(fichier: string): LigneCsv[] {
  return lireTexteCsv(readFileSync(fichier,"utf8"),fichier);
}
export function lireTexteCsv(contenu:string,fichier='contenu CSV'):LigneCsv[]{
  const texte = contenu.replace(/^\uFEFF/, "");
  const lignes: string[][] = [];
  let ligne: string[] = [], cellule = "", guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { cellule += '"'; i++; }
      else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"') guillemets = true;
    else if (c === ",") { ligne.push(cellule); cellule = ""; }
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = "";
    } else cellule += c;
  }
  if (guillemets) throw new Error(`CSV : guillemets non fermés dans ${fichier}`);
  if (cellule || ligne.length) { ligne.push(cellule); lignes.push(ligne); }
  const [entetes, ...donnees] = lignes.filter((l) => l.some(Boolean));
  if (!entetes || new Set(entetes).size !== entetes.length) throw new Error(`CSV : en-têtes invalides dans ${fichier}`);
  return donnees.map((l, i) => {
    if (l.length !== entetes.length) throw new Error(`CSV : ligne ${i + 2} de largeur incorrecte dans ${fichier}`);
    return Object.fromEntries(entetes.map((h, j) => [h, l[j].trim()]));
  });
}
