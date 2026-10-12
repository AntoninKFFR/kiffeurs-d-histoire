// Régénère les SVG d'habillage de la frise (public/habillages/) : une trame et une scène plein écran par période.
// Commande : `node scripts/generer-habillages.mjs public/habillages`.
// Déterministe : même résultat à chaque lancement. Les couleurs et opacités de trame sont vérifiées par tests/habillages.test.tsx.
import { writeFileSync } from "node:fs";
const sortie = process.argv[2] ?? "public/habillages";
let graine = 7;
const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
const r1 = (n) => Math.round(n * 10) / 10;
const svg = (l, h, corps) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${h}" width="${l}" height="${h}">${corps}</svg>\n`;
// Les scènes sont dessinées pour un horizon à 62 % ; on les remonte de 80 pour que le sujet occupe le ciel libre, au-dessus de l'axe.
const monter = (c) => c.replace(/<\/defs>/, '</defs><g transform="translate(0 -80)">') + '</g>';
const ecrire = (nom, s) => { writeFileSync(`${sortie}/${nom}`, s); console.log(nom, s.length, "octets"); };

// ---------- Tranchées : carte d'état-major jaunie ----------
{
  let c = '<g stroke="#6b5434" stroke-opacity=".09" stroke-width="1" shape-rendering="crispEdges"><path d="M0 30H240M0 90H240M0 150H240M0 210H240M30 0V240M90 0V240M150 0V240M210 0V240"/></g>';
  c += '<defs><radialGradient id="t"><stop offset="0" stop-color="#7a5a2c" stop-opacity=".09"/><stop offset="1" stop-color="#7a5a2c" stop-opacity="0"/></radialGradient></defs>';
  for (const [x, y, r] of [[60, 70, 46], [180, 170, 56], [200, 30, 30], [20, 200, 34]]) c += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#t)"/>`;
  let fibres = "";
  for (let i = 0; i < 70; i++) { const x = r1(alea() * 240), y = r1(alea() * 240), l = r1(2 + alea() * 6), a = alea() * Math.PI; fibres += `M${x} ${y}l${r1(Math.cos(a) * l)} ${r1(Math.sin(a) * l)}`; }
  c += `<path d="${fibres}" stroke="#5c4526" stroke-opacity=".16" stroke-width=".7" fill="none"/>`;
  ecrire("tranchees-fond.svg", svg(240, 240, c));
}
// ---------- Antiquité : tesselles de mosaïque ----------
{
  const teintes = ["#a4552f", "#c98a3c", "#7d8f86", "#e9d8a6", "#8a6a3a", "#b86f45"];
  let c = "";
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const t = teintes[Math.floor(alea() * teintes.length)];
    c += `<rect x="${i * 12 + 1}" y="${j * 12 + 1}" width="10" height="10" fill="${t}" fill-opacity="${r1(0.04 + alea() * 0.06)}"/>`;
  }
  ecrire("mosaique-fond.svg", svg(96, 96, c));
}
// ---------- Conquête spatiale : ciel étoilé ----------
{
  let c = "";
  for (let i = 0; i < 70; i++) {
    const x = r1(alea() * 400), y = r1(alea() * 400), r = r1(0.5 + alea() * alea() * 1.6), o = r1(0.3 + alea() * 0.6);
    c += `<circle cx="${x}" cy="${y}" r="${r}" fill="#f2efe2" fill-opacity="${o}"/>`;
  }
  for (const [x, y] of [[90, 120], [310, 60], [220, 300], [40, 340]]) c += `<path d="M${x} ${y - 6}l1.3 4.7 4.7 1.3-4.7 1.3-1.3 4.7-1.3-4.7-4.7-1.3 4.7-1.3z" fill="#f2efe2" fill-opacity=".85"/>`;
  ecrire("espace-fond.svg", svg(400, 400, c));
}

// ---------- Scènes plein écran (1600×900, affichées en « cover » derrière la frise) ----------
// Pur décor de fond : très pâle, réparti sur tout l'écran (jamais une bande collée à la frise), identique quelle que soit la date.
const crete = (base, amp, pas = 40) => {
  let d = `M-20 ${base}`;
  for (let x = -20 + pas; x < 1620; x += pas) d += `L${x} ${Math.round(base + (alea() - 0.5) * amp)}`;
  return `${d}L1620 ${base}V1000H-20z`;
};

// Tranchées : ciel de fumée, crêtes dévastées, avions de la Grande Guerre, barbelés et coquelicots.
{
  const avion = (x, y, s, rot) => `<g transform="translate(${x} ${y}) scale(${s}) rotate(${rot})"><path d="M-24 0l10-3h32l8 3-8 3h-32z"/><rect x="-12" y="-11" width="28" height="2.4"/><rect x="-12" y="7" width="28" height="2.4"/><path d="M-6 -9V7M12 -9V7M-24 0l-4-9h5l4 9z" stroke="#3a2d1f" stroke-width="1" fill="none"/><rect x="26" y="-6" width="1.6" height="12"/></g>`;
  const souche = (x, y, h) => `<path d="M${x - 5} ${y}l2-${h}l-6-14l8 8l1-16l5 14l8-9l-4 15l2 ${h}z"/>`;
  const fumee = (x, y, n) => { let c = ""; for (let i = 0; i < n; i++) c += `<circle cx="${r1(x + Math.sin(i * 1.3) * 12)}" cy="${y - i * 26}" r="${14 + i * 7}"/>`; return c; };
  let c = '<defs><radialGradient id="s"><stop offset="0" stop-color="#fff1c2" stop-opacity=".7"/><stop offset="1" stop-color="#fff1c2" stop-opacity="0"/></radialGradient>';
  c += '<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2" stop-opacity="0"/><stop offset="1" stop-color="#fff1c2" stop-opacity=".7"/></linearGradient>';
  c += '<linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98a45" stop-opacity="0"/><stop offset="1" stop-color="#b98a45" stop-opacity=".16"/></linearGradient></defs>';
  c += '<rect width="1600" height="640" fill="url(#h)"/><circle cx="1170" cy="300" r="300" fill="url(#s)"/>';
  // faisceaux de projecteurs
  c += '<path d="M240 590L110 0H250zM1380 590L1500 0H1380z" fill="url(#b)" opacity=".35" transform="translate(0 0)"/>';
  // nuages de fumée
  c += '<g fill="#7d6a48" fill-opacity=".045"><ellipse cx="330" cy="150" rx="260" ry="26"/><ellipse cx="900" cy="95" rx="320" ry="22"/><ellipse cx="1330" cy="380" rx="240" ry="20"/><ellipse cx="620" cy="320" rx="200" ry="16"/></g>';
  // avions
  c += `<g fill="#3a2d1f" fill-opacity=".2" stroke-opacity=".2">${avion(430, 190, 1.5, -6)}${avion(760, 120, 1, 4)}${avion(1240, 210, 1.3, -3)}</g>`;
  // crête lointaine, souches brisées et fumées
  c += `<path d="${crete(560, 26)}" fill="#7a6544" fill-opacity=".08"/>`;
  c += `<g fill="#4a3a26" fill-opacity=".08">${souche(180, 566, 50)}${souche(700, 566, 38)}${souche(1010, 562, 56)}${souche(1460, 568, 44)}</g>`;
  c += `<g fill="#6b5a40" fill-opacity=".045">${fumee(520, 560, 5)}${fumee(1280, 556, 6)}${fumee(820, 560, 4)}</g>`;
  // seconde crête, plus proche
  c += `<path d="${crete(640, 30, 50)}" fill="#5b4a33" fill-opacity=".07"/>`;
  c += `<g fill="#3a2d1f" fill-opacity=".09">${souche(360, 646, 70)}${souche(900, 644, 62)}${souche(1330, 650, 76)}</g>`;
  // premier plan : terre retournée, barbelés, coquelicots
  c += `<path d="${crete(740, 22, 60)}" fill="#3f3120" fill-opacity=".12"/>`;
  let fil = "M-10 722";
  for (let x = 0; x < 1620; x += 24) fil += "q6 -12 12 0t12 0";
  c += `<g stroke="#3a2d1f" stroke-opacity=".26" stroke-width="2" fill="none"><path d="${fil}"/><path d="${fil}" transform="translate(12 18)"/></g>`;
  c += '<g fill="#3a2d1f" fill-opacity=".25">' + Array.from({ length: 14 }, (_, i) => `<rect x="${60 + i * 118}" y="682" width="5" height="62"/>`).join("") + "</g>";
  c += '<g fill="#8a2f2b" fill-opacity=".32">' + Array.from({ length: 22 }, () => `<circle cx="${Math.round(alea() * 1600)}" cy="${Math.round(770 + alea() * 100)}" r="${Math.round(3 + alea() * 3)}"/>`).join("") + "</g>";
  ecrire("tranchees-scene.svg", svg(1600, 900, monter(c)));
}

// Antiquité : temple à fronton, mer, olivier, trirème, hirondelles et frise de grecques.
{
  const colonne = (x, y, h) => `<rect x="${x - 18}" y="${y - 9}" width="36" height="9"/><rect x="${x - 13}" y="${y}" width="26" height="${h}"/><rect x="${x - 18}" y="${y + h}" width="36" height="9"/>`;
  const canne = (x, y, h) => `M${x - 5} ${y}V${y + h}M${x} ${y}V${y + h}M${x + 5} ${y}V${y + h}`;
  let c = '<defs><radialGradient id="s"><stop offset="0" stop-color="#f4c26b" stop-opacity=".4"/><stop offset="1" stop-color="#f4c26b" stop-opacity="0"/></radialGradient>';
  c += '<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f8f8a" stop-opacity="0"/><stop offset=".3" stop-color="#5f8f8a" stop-opacity=".08"/><stop offset="1" stop-color="#5f8f8a" stop-opacity="0"/></linearGradient><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3a65a" stop-opacity="0"/><stop offset="1" stop-color="#e3a65a" stop-opacity=".1"/></linearGradient></defs>';
  c += '<rect width="1600" height="600" fill="url(#h)"/><circle cx="1230" cy="200" r="260" fill="url(#s)"/><circle cx="1230" cy="200" r="64" fill="#d9892f" fill-opacity=".14"/>';
  // collines et mer
  c += `<path d="${crete(520, 50, 120)}" fill="#8a6a3a" fill-opacity=".05"/>`;
  c += '<rect x="-20" y="556" width="1640" height="70" fill="url(#m)"/>';
  let vagues = "";
  for (let y = 574; y < 620; y += 16) for (let x = (y % 32) * 2; x < 1600; x += 70) vagues += `M${x} ${y}q9 -6 18 0t18 0`;
  c += `<path d="${vagues}" stroke="#4d7d78" stroke-opacity=".2" stroke-width="2" fill="none"/>`;
  // trirème à voile carrée
  c += '<g fill="#6e4328" fill-opacity=".12"><path d="M1230 586h200l-26 22h-150z"/><rect x="1328" y="506" width="4" height="82"/><path d="M1290 510h82l-10 52h-62z" fill="#a4552f" fill-opacity=".2"/></g>';
  // temple
  c += '<g fill="#6e4328" fill-opacity=".08">';
  c += '<path d="M520 400L800 318L1080 400z"/><rect x="540" y="400" width="520" height="22"/>';
  c += [600, 700, 800, 900, 1000].map((x) => colonne(x, 440, 92)).join("");
  c += '<rect x="520" y="541" width="560" height="10"/><rect x="500" y="551" width="600" height="10"/><rect x="480" y="561" width="640" height="10"/></g>';
  c += `<path d="${[600, 700, 800, 900, 1000].map((x) => canne(x, 449, 74)).join("")}" stroke="#f4ead0" stroke-opacity=".32" stroke-width="2" fill="none"/>`;
  // second temple lointain et cyprès
  c += '<g fill="#6e4328" fill-opacity=".06"><path d="M140 470l90-34 90 34zM150 470h160v66H150z"/>' + [190, 235, 280].map((x) => `<rect x="${x - 6}" y="470" width="12" height="66" fill="#f4ead0" fill-opacity=".5"/>`).join("") + '</g>';
  c += '<g fill="#4b5f3a" fill-opacity=".09"><path d="M1160 560c-20-60-14-110 0-150c14 40 20 90 0 150z"/><path d="M1200 560c-16-48-10-90 0-120c10 30 16 70 0 120z"/></g>';
  // olivier
  c += '<path d="M360 700c4-60 10-90-10-130l16-8c10 22 14 40 16 60c8-26 24-44 40-60l10 12c-22 22-30 50-30 100z" fill="#6e4328" fill-opacity=".12"/><g fill="#4b5f3a" opacity=".11"><ellipse cx="330" cy="540" rx="80" ry="38"/><ellipse cx="430" cy="520" rx="90" ry="40"/><ellipse cx="380" cy="490" rx="70" ry="30"/></g>';
  // hirondelles
  c += '<path d="M470 160q10 -9 20 0q10 -9 20 0M560 120q8 -7 16 0q8 -7 16 0M900 230q9 -8 18 0q9 -8 18 0M1020 90q7 -6 14 0q7 -6 14 0" stroke="#3a2d1f" stroke-opacity=".3" stroke-width="2.4" fill="none"/>';
  // sol : amphores, grecque et rangée de tesselles
  c += '<g fill="#a4552f" fill-opacity=".17"><path d="M120 770c-26 8-26 52 0 62c26-10 26-54 0-62zM132 748h-24l3 22h18z"/><path d="M1460 790c-22 7-22 44 0 53c22-9 22-46 0-53zM1470 772h-20l3 18h14z"/></g>';
  let k = "";
  for (let x = 0; x < 1640; x += 40) k += `M${x} 842V824H${x + 28}V838H${x + 12}V832`;
  c += `<path d="${k}" stroke="#6e4328" stroke-opacity=".24" stroke-width="3" fill="none"/>`;
  c += '<rect x="-20" y="850" width="1640" height="160" fill="#a4552f" fill-opacity=".12"/>';
  ecrire("mosaique-scene.svg", svg(1600, 900, monter(c)));
}

// Conquête spatiale : nébuleuses, Terre qui se lève sur l'horizon lunaire, planète à anneaux, fusée et satellite.
{
  let c = '<defs>';
  for (const [id, col] of [["n1", "#3552a8"], ["n2", "#6a3a9a"], ["n3", "#1c4a86"]]) c += `<radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity=".3"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
  c += '<radialGradient id="t" cx=".35" cy=".35"><stop offset="0" stop-color="#5a9be0"/><stop offset=".6" stop-color="#1f56a8"/><stop offset="1" stop-color="#0c2a63"/></radialGradient>';
  c += '<radialGradient id="p" cx=".35" cy=".35"><stop offset="0" stop-color="#e2c590"/><stop offset="1" stop-color="#6b4a2c"/></radialGradient></defs>';
  c += '<circle cx="360" cy="240" r="480" fill="url(#n1)"/><circle cx="1250" cy="430" r="420" fill="url(#n2)"/><circle cx="800" cy="720" r="560" fill="url(#n3)"/>';
  // orbite
  c += '<ellipse cx="760" cy="360" rx="470" ry="110" transform="rotate(-10 760 360)" fill="none" stroke="#9db4d8" stroke-opacity=".16" stroke-width="2" stroke-dasharray="3 12"/>';
  // planète à anneaux
  c += '<g transform="rotate(-18 250 330)"><ellipse cx="250" cy="330" rx="170" ry="34" fill="none" stroke="#d9c08a" stroke-opacity=".28" stroke-width="11"/><circle cx="250" cy="330" r="80" fill="url(#p)" fill-opacity=".6"/><path d="M80 330A170 34 0 0 0 420 330" fill="none" stroke="#d9c08a" stroke-opacity=".34" stroke-width="11"/></g>';
  // Spoutnik
  c += '<g transform="translate(780 300) rotate(-12)" stroke="#cfd8ee" stroke-opacity=".6" stroke-width="2" fill="none"><circle r="15" fill="#cfd8ee" fill-opacity=".45" stroke="none"/><path d="M-12 -5l-60 -30M-12 5l-60 30M12 -5l60 -30M12 5l60 30"/></g>';
  // fusée à trois étages et traînée
  c += '<g transform="translate(470 430) rotate(24)" fill="#cfd8ee" fill-opacity=".3"><path d="M-8 60V-30l8 -22l8 22V60z"/><path d="M-8 60l-12 20h40l-12 -20z" fill-opacity=".4"/><rect x="-8" y="-8" width="16" height="3" fill="#0d1630"/><path d="M-6 80q6 40 0 80q-6 -40 0 -80z" fill="#f2c26b" fill-opacity=".22"/></g>';
  // surface lunaire et Terre qui se lève
  c += '<circle cx="1230" cy="330" r="90" fill="url(#t)" fill-opacity=".62"/><path d="M1170 310c16-16 32-12 46-24c-5 21 6 32-5 53c-16 6-32-8-41-29zM1250 360c19-5 40 8 56-5c-3 21-24 37-46 35c-8-11-11-21-10-30z" fill="#4f8a58" fill-opacity=".4"/>';
  c += `<path d="${crete(640, 36, 60)}" fill="#050a18" fill-opacity=".92"/>`;
  c += '<g fill="none" stroke="#9db4d8" stroke-opacity=".22" stroke-width="2"><ellipse cx="260" cy="700" rx="90" ry="14"/><ellipse cx="760" cy="830" rx="130" ry="18"/><ellipse cx="1260" cy="780" rx="100" ry="13"/><ellipse cx="520" cy="880" rx="60" ry="9"/></g>';
  // module lunaire et drapeau
  c += '<g fill="#cfd8ee" fill-opacity=".34"><path d="M820 590h46l8 20h-62zM832 570h22v20h-22z"/><path d="M826 610l-14 22M868 610l14 22" stroke="#cfd8ee" stroke-opacity=".34" stroke-width="3"/><rect x="1180" y="560" width="3" height="46"/><rect x="1183" y="560" width="30" height="20" fill-opacity=".5"/></g>';
  ecrire("espace-scene.svg", svg(1600, 900, monter(c)));
}
