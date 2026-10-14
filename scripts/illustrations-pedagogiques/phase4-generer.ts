// Génération déterministe, exclusivement locale et sans écrasement.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { scenesPhase4, type ScenePhase4 } from "./phase4-scenes";
import { palettePhase4, placerPhase4 } from "./phase4-objets";
export const BASE_PHASE4="41060638e7c3e75f89669d68ecc7c5734f0627d0";
const dossier="content/illustrations";
const sha=(contenu:Buffer|string)=>createHash("sha256").update(contenu).digest("hex");
const traitSol=`<path d="M10 108h140" stroke="${palettePhase4.sauge}"/>`;
const eau=`<path d="M10 104q18-6 36 0t36 0t36 0t30 0" stroke="${palettePhase4.sauge}"/>`;
// Reprise de placer() et du vis-à-vis validés dans generer.ts #66.
// Les positions ne dépendent jamais de l'identifiant, d'un hasard ou d'une horloge.
export function genererSVG(scene:ScenePhase4):string {
  const [a,b,c]=scene.objets;
  const place=placerPhase4;
  let dessin:string;
  switch (scene.composition) {
    case "visavis": dessin=place(a,4,14,1)+ (c?place(b,88,40,0.72)+place(c,110,4,0.32):place(b,84,27,0.85))+traitSol; break;
    case "groupe": dessin=place(a,4,20,0.98)+place(b,86,28,0.86)+(c?place(c,112,3,0.32):"")+traitSol; break;
    case "institution": dessin=place(a,4,16,0.98)+place(b,86,30,0.85)+(c?place(c,110,2,0.34):"")+traitSol; break;
    case "reunion": dessin=place(a,4,18,0.98)+place(b,85,23,0.85)+(c?place(c,111,2,0.32):"")+traitSol; break;
    case "signature": dessin=place(a,4,16,0.96)+place(b,85,32,0.86)+(c?place(c,108,1,0.36):"")+traitSol; break;
    case "atelier": dessin=place(a,4,16,0.98)+place(b,86,30,0.85)+(c?place(c,108,2,0.34):"")+traitSol; break;
    case "memoire": dessin=place(a,4,18,0.96)+place(b,88,30,0.82)+(c?place(c,111,2,0.34):"")+traitSol; break;
    case "rivage": dessin=place(a,4,11,0.96)+place(b,85,25,0.86)+(c?place(c,110,2,0.33):"")+eau; break;
    case "naval": dessin=place(a,4,9,0.9)+`<g transform="translate(160 0) scale(-1 1)">${place(b,4,22,0.9)}</g>`+(c?place(c,66,2,0.34):"")+eau;
      // Rivages/détroit symboliques, sans prétention de frontière ou position réelle.
      if(scene.event==="EVT-0374") dessin=`<path d="M0 7q34 14 66 0M94 114q32-12 66-2" stroke="${palettePhase4.sauge}"/>`+dessin;
      if(scene.event==="EVT-0383") dessin=place(a,4,16,0.82)+`<g transform="translate(160 0) scale(-1 1)">${place(b,4,16,0.82)}</g><path d="M62 86l17-10l12 4l-6 16z" fill="${palettePhase4.sauge}"/>`+eau;
      break;
    case "division": dessin=place(a,4,16,0.94)+place(b,85,30,0.85)+(c?place(c,109,2,0.34):"")+traitSol; break;
    case "couronnes": dessin=place(a,4,2,0.85)+place(b,88,2,0.85)+place(c,59,60,0.55)+traitSol; break;
    case "union": dessin=place(a,4,30,0.85)+place(b,88,30,0.85)+place(c,61,0,0.5)+traitSol; break;
    case "collines": dessin=`<path d="M4 100q28-36 66 0M66 100q38-44 90 0" stroke="${palettePhase4.sauge}"/>`+place(a,8,30,0.75)+place(b,89,20,0.8)+`<path d="M4 111q40-12 74-4t78-2" stroke="${palettePhase4.sauge}"/>`; break;
    case "tunnel": dessin=place(a,5,16,0.85)+place(a,88,16,0.85)+`<path d="M18 92h124M18 98h124" stroke="${palettePhase4.sauge}"/>`+traitSol; break;
    case "orbite": dessin=place(a,9,14,1.25)+place(b,106,72,0.44)+`<path d="M18 108q24-12 66 0" stroke="${palettePhase4.sauge}"/>`; break;
    case "traversee": dessin=`<path d="M62 8q24 24 4 50t8 54M82 8q24 24 4 50t8 54" stroke="${palettePhase4.sauge}"/>`+place(a,3,16,0.94)+place(b,92,26,0.86)+place(c,108,2,0.32); break;
    case "cargaison": dessin=place(a,4,9,1)+`<g transform="rotate(28 101 53)">${place(b,83,28,0.48)}</g>`+place(c,102,68,0.6)+eau; break;
    case "desert": dessin=place(a,4,11,0.96)+place(b,85,25,0.86)+`<path d="M4 108q26-18 52 0M50 108q32-26 64 0M110 108q22-14 44 0" stroke="${palettePhase4.laiton}"/>`; break;
    case "montagne": dessin=`<path d="M4 34L28 8l18 20l20-16l22 22M88 36l24-26l14 20l14-16l16 24" stroke="${palettePhase4.sauge}"/>`+place(a,4,22,0.96)+place(b,87,35,0.82)+traitSol; break;
    case "canal": dessin=`<path d="M2 14h6v94H2zM78 14h6v94h-6z" fill="${palettePhase4.sauge}" stroke="none"/>`+place(a,6,19,0.85)+place(b,86,28,0.85)+`<path d="M12 102h60" stroke="${palettePhase4.sauge}"/>`+traitSol; break;
    default: throw new Error(`Composition inconnue : ${scene.composition}`);
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120"><rect width="160" height="120" fill="${palettePhase4.papier}"/><g fill="none" stroke="${palettePhase4.encre}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${dessin}</g></svg>\n`;
  if(Buffer.byteLength(svg)>8192) throw new Error(`SVG trop lourd : ${scene.event}`);
  return svg;
}
// Les 331 empreintes sont calculées depuis les blobs du SHA demandé,
// et non depuis le manifeste pilote (qui ne contient que 120 références).
export function verifierStockPhase4():Set<string> {
  const chemins=execFileSync("git",["ls-tree","-r","--name-only",BASE_PHASE4,"--",dossier],{encoding:"utf8"}).trim().split(/\r?\n/).filter(p=>p.endsWith(".svg"));
  if(chemins.length!==331) throw new Error(`Base historique inattendue : ${chemins.length} SVG`);
  const blobs=execFileSync("git",["cat-file","--batch"],{input:chemins.map(p=>`${BASE_PHASE4}:${p}\n`).join(""),maxBuffer:16*1024*1024});
  let offset=0;
  for(const chemin of chemins) {
    const finEntete=blobs.indexOf(10,offset), entete=blobs.subarray(offset,finEntete).toString("utf8");
    const resultat=/^[a-f\d]+ blob (\d+)$/.exec(entete);
    if(finEntete<offset||!resultat) throw new Error(`Blob de référence inaccessible : ${chemin}`);
    const taille=Number(resultat[1]), historique=blobs.subarray(finEntete+1,finEntete+1+taille);
    offset=finEntete+1+taille+1;
    if(sha(historique)!==sha(readFileSync(chemin))) throw new Error(`Ancien SVG modifié : ${chemin}`);
  }
  if(offset!==blobs.length) throw new Error("Réponse Git de référence incomplète.");
  return new Set(chemins.map(p=>p.slice(dossier.length+1)));
}
export function produirePhase4(verifier=false):void {
  const proteges=verifierStockPhase4();
  const nouveaux=new Set(scenesPhase4.map(s=>`${s.event}.svg`));
  if(nouveaux.size!==203 || [...nouveaux].some(n=>proteges.has(n))) throw new Error("Le catalogue doit couvrir exactement 203 événements absents de la base.");
  for(const scene of scenesPhase4) for(const ref of scene.references_DA) if(!proteges.has(ref)) throw new Error(`Référence DA absente de la base : ${ref}`);
  const inattendus=readdirSync(dossier).filter(n=>n.endsWith(".svg")&&!proteges.has(n)&&!nouveaux.has(n));
  if(inattendus.length) throw new Error(`SVG hors inventaire : ${inattendus.join(", ")}`);
  // Tous les chemins et tous les contenus passent les contrôles avant toute écriture.
  const sorties=scenesPhase4.map(scene=>({nom:`${dossier}/${scene.event}.svg`,svg:genererSVG(scene)}));
  const hashes=sorties.map(s=>sha(s.svg));
  if(new Set(hashes).size!==203) throw new Error("Deux dessins sont identiques ; revoir les intentions et compositions.");
  if(verifier) {
    for(const sortie of sorties) if(!existsSync(sortie.nom)||!readFileSync(sortie.nom).equals(Buffer.from(sortie.svg))) throw new Error(`Reproduction différente : ${sortie.nom}`);
    console.log("203 SVG reproduits et comparés sans écriture ; 331 empreintes historiques intactes.");
  } else {
    const presents=sorties.filter(s=>existsSync(s.nom));
    if(presents.length) throw new Error(`Écrasement refusé avant toute création : ${presents.map(s=>s.nom).join(", ")}. Utiliser --verifier pour comparer sans écrire.`);
    for(const sortie of sorties) writeFileSync(sortie.nom,sortie.svg,{flag:"wx"});
    verifierStockPhase4();
    if(readdirSync(dossier).filter(n=>n.endsWith(".svg")).length!==534) throw new Error("Effectif final différent de 331 + 203.");
    console.log("203 nouveaux SVG créés avec wx ; 331 SVG historiques inchangés ; 534 SVG au total.");
  }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve("scripts/illustrations-pedagogiques/phase4-generer.ts")) {
  const args=process.argv.slice(2);
  if(args.length>1 || (args.length===1&&!['--verifier','--reproduire'].includes(args[0]))) throw new Error("Usage : phase4-generer.ts [--verifier|--reproduire]");
  produirePhase4(args.length===1);
}
