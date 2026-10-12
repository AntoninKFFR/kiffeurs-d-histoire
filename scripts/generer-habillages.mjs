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
  // zeppelin : le sujet de l'habillage, dans le ciel libre à droite
  c += '<g opacity=".30" fill="#3a2d1f"><ellipse cx="1180" cy="270" rx="230" ry="46"/><path d="M958 270l-44-52h20l48 36zM958 270l-44 52h20l48-36z"/><path d="M1120 312h86v22h-86z"/></g>';
  c += '<g stroke="#efe6cd" stroke-opacity=".5" stroke-width="2.5" fill="none">' + Array.from({ length: 9 }, (_, k) => `<path d="M${1000 + k * 46} 226V314"/>`).join("") + '<path d="M960 270H1410"/></g>';
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
  c += '<g fill="#6e4328" fill-opacity=".12" transform="translate(-640 0)"><path d="M1230 586h200l-26 22h-150z"/><rect x="1328" y="506" width="4" height="82"/><path d="M1290 510h82l-10 52h-62z" fill="#a4552f" fill-opacity=".2"/></g>';
  // temple sur son rocher : le sujet de l'habillage, dans le ciel libre à droite ; le rocher descend jusqu'à la mer, derrière la frise
  const colonnes = Array.from({ length: 7 }, (_, k) => 895 + 55 * k);
  c += '<path d="M730 604C800 564 836 510 880 470H1240C1290 510 1330 564 1400 604z" fill="#8a6a3a" opacity=".2"/>';
  c += '<path d="M800 570l40-32M880 556l60-52M1010 540l-40-40M1180 548l50-48M1250 520l60 44" stroke="#6e4328" stroke-opacity=".12" stroke-width="3" fill="none"/>';
  c += '<g opacity=".34" fill="#6e4328"><path d="M860 322L1060 258L1260 322z"/><rect x="870" y="326" width="380" height="20"/>';
  c += colonnes.map((x) => `<rect x="${x - 15}" y="346" width="30" height="8"/><rect x="${x - 11}" y="354" width="22" height="84"/><rect x="${x - 15}" y="438" width="30" height="7"/>`).join("");
  c += '<rect x="860" y="445" width="400" height="9"/><rect x="850" y="454" width="420" height="9"/></g>';
  c += '<path d="M940 270L1060 232L1180 270" stroke="#f4ead0" stroke-opacity=".5" stroke-width="3" fill="none"/>';
  c += `<path d="${colonnes.map((x) => `M${x - 4} 356V436M${x + 4} 356V436`).join("")}" stroke="#f4ead0" stroke-opacity=".45" stroke-width="2" fill="none"/>`;
  // second temple lointain et cyprès
  c += '<g fill="#6e4328" fill-opacity=".06"><path d="M140 470l90-34 90 34zM150 470h160v66H150z"/>' + [190, 235, 280].map((x) => `<rect x="${x - 6}" y="470" width="12" height="66" fill="#f4ead0" fill-opacity=".5"/>`).join("") + '</g>';
  c += '<g fill="#4b5f3a" fill-opacity=".09" transform="translate(300 40)"><path d="M1160 560c-20-60-14-110 0-150c14 40 20 90 0 150z"/><path d="M1200 560c-16-48-10-90 0-120c10 30 16 70 0 120z"/></g>';
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

// Conquête spatiale : peu d'éléments, pour ne pas charger l'écran : nébuleuses, une Terre qui se lève sur l'horizon lunaire.
{
  let c = '<defs>';
  for (const [id, col] of [["n1", "#3552a8"], ["n2", "#6a3a9a"], ["n3", "#1c4a86"]]) c += `<radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity=".3"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
  c += '<radialGradient id="t" cx=".35" cy=".35"><stop offset="0" stop-color="#5a9be0"/><stop offset=".6" stop-color="#1f56a8"/><stop offset="1" stop-color="#0c2a63"/></radialGradient></defs>';
  c += '<circle cx="360" cy="240" r="480" fill="url(#n1)"/><circle cx="1250" cy="430" r="420" fill="url(#n2)"/><circle cx="800" cy="720" r="560" fill="url(#n3)"/>';
  // Terre qui se lève
  c += '<g transform="translate(-60 50)"><circle cx="1230" cy="330" r="90" fill="url(#t)" fill-opacity=".62"/><path d="M1170 310c16-16 32-12 46-24c-5 21 6 32-5 53c-16 6-32-8-41-29zM1250 360c19-5 40 8 56-5c-3 21-24 37-46 35c-8-11-11-21-10-30z" fill="#4f8a58" fill-opacity=".4"/></g>';
  // horizon lunaire et cratères
  c += `<path d="${crete(640, 36, 60)}" fill="#050a18" fill-opacity=".92"/>`;
  c += '<g fill="none" stroke="#9db4d8" stroke-opacity=".22" stroke-width="2"><ellipse cx="260" cy="700" rx="90" ry="14"/><ellipse cx="760" cy="830" rx="130" ry="18"/><ellipse cx="1260" cy="780" rx="100" ry="13"/><ellipse cx="520" cy="880" rx="60" ry="9"/></g>';
ecrire("espace-scene.svg", svg(1600, 900, monter(c)));
}

// ---------- Cinq autres périodes (propositions) : même principe, un sujet bien visible à droite, au-dessus du halo ----------
const nuage = (x, y, k) => `<g><ellipse cx="${x}" cy="${y}" rx="${70 * k}" ry="${16 * k}"/><ellipse cx="${x + 40 * k}" cy="${y - 10 * k}" rx="${46 * k}" ry="${14 * k}"/><ellipse cx="${x - 36 * k}" cy="${y - 6 * k}" rx="${40 * k}" ry="${12 * k}"/></g>`;
const degrade = (id, col, o0, o1, radial = false) => radial
  ? `<radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity="${o0}"/><stop offset="1" stop-color="${col}" stop-opacity="${o1}"/></radialGradient>`
  : `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="${o0}"/><stop offset="1" stop-color="${col}" stop-opacity="${o1}"/></linearGradient>`;

// Préhistoire : paroi de grotte, mammouth peint à l'ocre, mains au pochoir, chasseurs, feu de camp.
{
  const main = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-10" y="0" width="20" height="24" rx="7"/><rect x="-15" y="-16" width="5" height="22" rx="2.5" transform="rotate(-14 -12 6)"/><rect x="-8" y="-24" width="5" height="26" rx="2.5"/><rect x="-1" y="-26" width="5" height="28" rx="2.5"/><rect x="6" y="-22" width="5" height="25" rx="2.5"/><rect x="13" y="-8" width="5" height="18" rx="2.5" transform="rotate(30 15 2)"/></g>`;
  const chasseur = (x, y) => `<g transform="translate(${x} ${y})"><circle cx="0" cy="-30" r="5"/><path d="M0 -24V-4M0 -18L-9 -8M0 -18L10 -26M0 -4L-7 12M0 -4L8 12" stroke="#3b2a1e" stroke-width="3" fill="none"/><path d="M10 -26L24 -40" stroke="#3b2a1e" stroke-width="2"/></g>`;
  let c = `<defs>${degrade("s", "#f0b25a", 0.5, 0, true)}${degrade("h", "#c98a4a", 0, 0.14)}</defs>`;
  c += '<rect width="1600" height="640" fill="url(#h)"/><circle cx="330" cy="240" r="300" fill="url(#s)"/><circle cx="330" cy="240" r="58" fill="#d9892f" fill-opacity=".16"/>';
  c += `<path d="${crete(500, 70, 90)}" fill="#8a6a3a" fill-opacity=".05"/><path d="${crete(560, 40, 70)}" fill="#6b5034" fill-opacity=".05"/>`;
  c += '<g fill="#5c4531" fill-opacity=".14"><path d="M1240 470L1330 300L1400 380L1470 330L1560 470z"/></g><path d="M1330 300L1300 350L1330 340L1352 372L1378 342L1400 380" fill="#f4ead0" fill-opacity=".5"/>';
  // mammouth peint : le sujet de l'habillage
  c += '<g transform="translate(1110 440)"><g opacity=".34" fill="#7a3a1c"><g transform="translate(0 -30)"><rect x="-98" y="-6" width="30" height="36" rx="6"/><rect x="10" y="-6" width="30" height="36" rx="6"/><rect x="-44" y="-6" width="26" height="36" rx="6"/><rect x="122" y="-6" width="30" height="36" rx="6"/><path d="M-130 -14C-176 -58 -150 -146 -84 -172C-30 -196 44 -192 94 -166C152 -150 180 -98 160 -50L152 0H122L114 -44Q82 -22 42 -32L40 0H10L2 -40Q-38 -34 -66 -40L-68 0H-98L-104 -30Q-116 -22 -130 -14z"/><path d="M-150 -118C-196 -108 -206 -56 -190 -8L-174 -12C-182 -52 -170 -82 -138 -92z"/><path d="M-146 -90C-196 -84 -226 -48 -204 -22C-212 -50 -186 -72 -142 -76z" fill="#3b2a1e"/><path d="M156 -86q30 12 26 60q-14-30-30-34z"/></g></g>';
  c += '<path d="M-110 -70l8 14 8-14 8 14 8-14 8 14 8-14 8 14 8-14 8 14 8-14 8 14 8-14" stroke="#f4ead0" stroke-opacity=".45" stroke-width="2.5" fill="none"/></g>';
  c += `<g fill="#8a2f2b" fill-opacity=".26">${main(930, 250, 1.2)}${main(1000, 232, 1)}${main(1450, 250, 1.2)}</g>`;
  c += `<g fill="#3b2a1e" fill-opacity=".22">${chasseur(520, 440)}${chasseur(570, 450)}${chasseur(625, 442)}</g>`;
  // feu de camp et rochers
  c += '<g fill="#c9692b" fill-opacity=".3"><path d="M300 470q-24-30-4-60q8 18 22 14q-6-28 18-50q2 30 20 44q18 24-4 52z"/></g><g fill="#3b2a1e" fill-opacity=".2"><rect x="266" y="470" width="110" height="8" rx="4" transform="rotate(-6 320 474)"/><rect x="262" y="472" width="110" height="8" rx="4" transform="rotate(8 320 476)"/></g>';
  c += `<path d="${crete(700, 40, 80)}" fill="#5c4531" fill-opacity=".12"/>`;
  c += '<g fill="#5c4531" fill-opacity=".13">' + Array.from({ length: 10 }, (_, i) => `<ellipse cx="${100 + i * 160}" cy="${800 + (i % 3) * 20}" rx="${30 + (i % 4) * 14}" ry="${12 + (i % 3) * 5}"/>`).join("") + '</g>';
  ecrire("prehistoire-scene.svg", svg(1600, 900, monter(c)));
  let t = "";
  for (let i = 0; i < 46; i++) t += `<circle cx="${r1(alea() * 200)}" cy="${r1(alea() * 200)}" r="${r1(0.6 + alea() * 1.6)}" fill="#5c4531" fill-opacity="${r1(0.08 + alea() * 0.1)}"/>`;
  t += '<path d="M10 40q30 10 46 40t50 28M120 150q24-30 60-26M60 190q18-30 4-60" stroke="#5c4531" stroke-opacity=".1" stroke-width="1.4" fill="none"/>';
  t += '<defs>' + degrade("o", "#b5651d", 0.1, 0, true) + '</defs><circle cx="60" cy="60" r="60" fill="url(#o)"/><circle cx="150" cy="140" r="50" fill="url(#o)"/>';
  ecrire("prehistoire-fond.svg", svg(200, 200, t));
}

// Moyen Âge : parchemin enluminé, château fort sur sa colline, cathédrale au loin, soleil d'or.
{
  const creneaux = (x, y, l) => Array.from({ length: Math.floor(l / 20) }, (_, i) => `<rect x="${x + i * 20 + 2}" y="${y - 12}" width="12" height="12"/>`).join("");
  let c = `<defs>${degrade("s", "#e0b050", 0.5, 0, true)}${degrade("h", "#a89060", 0, 0.1)}</defs>`;
  c += '<rect width="1600" height="640" fill="url(#h)"/><circle cx="430" cy="230" r="270" fill="url(#s)"/><circle cx="430" cy="230" r="54" fill="#c9962f" fill-opacity=".22"/>';
  c += '<g stroke="#c9962f" stroke-opacity=".14" stroke-width="4">' + Array.from({ length: 12 }, (_, i) => `<path d="M430 230L${r1(430 + Math.cos(i * Math.PI / 6) * 190)} ${r1(230 + Math.sin(i * Math.PI / 6) * 190)}"/>`).join("") + '</g>';
  c += `<g fill="#3a2a2f" fill-opacity=".06">${nuage(700, 140, 1.4)}${nuage(1380, 200, 1.2)}${nuage(250, 380, 1)}</g>`;
  c += `<path d="${crete(520, 50, 100)}" fill="#6b6a4a" fill-opacity=".07"/>`;
  // cathédrale lointaine
  c += '<g fill="#3a2a2f" fill-opacity=".1"><rect x="150" y="360" width="46" height="120"/><path d="M146 360L173 280L200 360z"/><rect x="260" y="360" width="46" height="120"/><path d="M256 360L283 280L310 360z"/><rect x="196" y="390" width="64" height="90"/><path d="M196 390L228 340L260 390z"/></g><circle cx="228" cy="420" r="14" fill="#f4ead0" fill-opacity=".5"/>';
  // château fort : le sujet de l'habillage
  c += '<path d="M770 482C830 450 860 420 890 400H1290C1330 420 1370 452 1430 482z" fill="#6b6a4a" fill-opacity=".16"/>';
  c += '<g fill="#3a2a2f" fill-opacity=".34"><rect x="900" y="372" width="400" height="104"/>' + creneaux(900, 372, 400);
  c += '<rect x="872" y="290" width="62" height="186"/>' + creneaux(872, 290, 62) + '<path d="M866 278L903 214L940 278z"/>';
  c += '<rect x="1266" y="290" width="62" height="186"/>' + creneaux(1266, 290, 62) + '<path d="M1260 278L1297 214L1334 278z"/>';
  c += '<rect x="1020" y="250" width="160" height="226"/>' + creneaux(1020, 250, 160) + '<path d="M1012 238L1100 176L1188 238z"/></g>';
  c += '<g fill="#f4ead0" fill-opacity=".55"><rect x="1094" y="296" width="12" height="38" rx="6"/><rect x="896" y="326" width="10" height="30" rx="5"/><rect x="1290" y="326" width="10" height="30" rx="5"/><path d="M1070 476v-40a30 30 0 0 1 60 0v40z"/></g>';
  c += '<path d="M1100 176V120M1297 214V170M903 214V170" stroke="#3a2a2f" stroke-opacity=".34" stroke-width="3"/><path d="M1100 120l56 14-56 14zM1297 170l40 10-40 10zM903 170l40 10-40 10z" fill="#8a2f2b" fill-opacity=".38"/>';
  c += '<path d="M700 600q60-40 120-6M1300 640q80-50 150-8" stroke="#3a2a2f" stroke-opacity=".08" stroke-width="2" fill="none"/>';
  c += `<path d="${crete(690, 30, 70)}" fill="#6b6a4a" fill-opacity=".1"/>`;
  // bordure d'enluminure : rinceaux sur la ligne du bas et fleurons d'or
  let r = "M-10 800";
  for (let x = 0; x < 1620; x += 60) r += "q15 -26 30 0t30 0";
  c += `<path d="${r}" stroke="#c9962f" stroke-opacity=".3" stroke-width="3" fill="none"/>`;
  c += '<g fill="#8a2f2b" fill-opacity=".18">' + Array.from({ length: 14 }, (_, i) => `<path d="M${60 + i * 118} 830l10 14-10 14-10-14z"/>`).join("") + '</g>';
  c += '<rect x="-20" y="850" width="1640" height="160" fill="#2f4a8a" fill-opacity=".07"/>';
  ecrire("moyen-age-scene.svg", svg(1600, 900, monter(c)));
  let t = '<g stroke="#8a6a3a" stroke-opacity=".09" stroke-width="1" shape-rendering="crispEdges"><path d="M0 40H160M0 80H160M0 120H160"/></g>';
  for (let i = 0; i < 40; i++) t += `<circle cx="${r1(alea() * 160)}" cy="${r1(alea() * 160)}" r="${r1(0.5 + alea() * 1.2)}" fill="#8a6a3a" fill-opacity="${r1(0.06 + alea() * 0.08)}"/>`;
  t += '<path d="M80 12l5 8-5 8-5-8z" fill="#c9962f" fill-opacity=".2"/><path d="M0 12h60M100 12h60" stroke="#c9962f" stroke-opacity=".12" stroke-width="1.2"/>';
  ecrire("moyen-age-fond.svg", svg(160, 160, t));
}

// Seconde Guerre mondiale : carte d'état-major grise, bombardier quadrimoteur en formation, projecteurs, ballons de barrage.
{
  const bombardier = (x, y, s, rot) => `<g transform="translate(${x} ${y}) scale(${s}) rotate(${rot})"><path d="M-120 0C-108 -9 80 -9 126 -2L156 0L126 2C80 9 -108 9 -120 0z"/><path d="M-12 -7L-46 -156L-18 -156L28 -7zM-12 7L-46 156L-18 156L28 7z"/><path d="M-104 -3L-128 -38L-110 -38L-80 -3zM-104 3L-128 38L-110 38L-80 3z"/>${[-100, -50, 50, 100].map((y0) => `<rect x="${y0 < 0 ? -50 + (y0 + 100) * 0.1 : -46 + (100 - y0) * 0.1}" y="${y0 - 6}" width="34" height="12" rx="5"/>`).join("")}</g>`;
  let c = `<defs>${degrade("h", "#7d8a94", 0, 0.14)}${degrade("b", "#f4f4ea", 0, 0.7)}</defs>`;
  c += '<rect width="1600" height="640" fill="url(#h)"/><circle cx="360" cy="200" r="70" fill="#f4f4ea" fill-opacity=".5"/><circle cx="360" cy="200" r="190" fill="#f4f4ea" fill-opacity=".2"/>';
  c += '<path d="M300 640L170 0H320zM1300 640L1480 40H1360zM820 640L690 0H810z" fill="url(#b)" opacity=".3"/>';
  c += `<g fill="#46525a" fill-opacity=".06">${nuage(560, 150, 1.5)}${nuage(1000, 90, 1.2)}${nuage(1380, 360, 1.3)}${nuage(200, 330, 1)}</g>`;
  c += '<path d="M120 100Q500 20 880 180T1480 240" stroke="#232c33" stroke-opacity=".16" stroke-width="3" stroke-dasharray="3 14" fill="none"/>';
  c += `<g fill="#232c33" fill-opacity=".34">${bombardier(1090, 330, 1.05, -4)}</g><g fill="#232c33" fill-opacity=".2">${bombardier(780, 400, 0.5, -4)}${bombardier(1420, 430, 0.5, -4)}${bombardier(520, 300, 0.4, -4)}</g>`;
  c += '';
  c += `<g fill="#46525a" fill-opacity=".14"><ellipse cx="190" cy="470" rx="42" ry="20"/><path d="M148 470l-20 20h14zM232 470l20 20h-14z"/></g><path d="M190 490V620M170 480L150 620M210 480L230 620" stroke="#46525a" stroke-opacity=".12" stroke-width="2"/>`;
  c += `<path d="${crete(560, 26)}" fill="#46525a" fill-opacity=".08"/>`;
  c += '<g fill="#232c33" fill-opacity=".1">' + [330, 440, 780, 1160, 1420].map((x, i) => `<rect x="${x}" y="${510 - (i % 3) * 14}" width="${40 + (i % 2) * 20}" height="${80 + (i % 3) * 14}"/>`).join("") + '</g>';
  c += `<path d="${crete(690, 24, 60)}" fill="#46525a" fill-opacity=".1"/>`;
  c += '<g stroke="#232c33" stroke-opacity=".2" stroke-width="3" fill="none"><path d="M60 800L360 760M60 830L360 790M1240 770L1560 810M1240 800L1560 840"/></g>';
  c += '<g fill="#232c33" fill-opacity=".14">' + Array.from({ length: 11 }, (_, i) => `<path d="M${80 + i * 150} 860l16-34 16 34z"/>`).join("") + '</g>';
  ecrire("seconde-guerre-scene.svg", svg(1600, 900, monter(c)));
  let t = '<g stroke="#46525a" stroke-opacity=".09" stroke-width="1" shape-rendering="crispEdges"><path d="M0 40H200M0 120H200M0 200H200M40 0V200M120 0V200M200 0V200"/></g><g stroke="#46525a" stroke-opacity=".07" stroke-width="1"><path d="M0 70L70 0M0 150L150 0M30 200L200 30M110 200L200 110"/></g>';
  t += '<circle cx="150" cy="150" r="22" fill="none" stroke="#8a2f2b" stroke-opacity=".12" stroke-width="2"/><path d="M28 28h26M41 15v26" stroke="#232c33" stroke-opacity=".12" stroke-width="1.4"/>';
  ecrire("seconde-guerre-fond.svg", svg(200, 200, t));
}

// Révolution française et Empire : la Bastille et son drapeau tricolore, Arc de triomphe au loin, rubans tricolores.
{
  const creneaux = (x, y, l) => Array.from({ length: Math.floor(l / 18) }, (_, i) => `<rect x="${x + i * 18 + 2}" y="${y - 10}" width="11" height="10"/>`).join("");
  let c = `<defs>${degrade("s", "#f4d9a0", 0.5, 0, true)}${degrade("h", "#9aa3c8", 0, 0.12)}</defs>`;
  c += '<rect width="1600" height="640" fill="url(#h)"/><circle cx="360" cy="230" r="290" fill="url(#s)"/>';
  c += `<g fill="#2c2f4a" fill-opacity=".05">${nuage(620, 140, 1.4)}${nuage(1420, 210, 1.1)}${nuage(250, 400, 1)}</g>`;
  // rubans tricolores dans le ciel
  c += '<g fill="none" stroke-width="10" stroke-opacity=".13"><path d="M-20 160C260 60 520 240 800 140S1300 60 1620 170" stroke="#2f4a9a"/><path d="M-20 184C260 84 520 264 800 164S1300 84 1620 194" stroke="#f4f4ea" stroke-opacity=".5"/><path d="M-20 208C260 108 520 288 800 188S1300 108 1620 218" stroke="#b03030"/></g>';
  // Arc de triomphe lointain
  c += '<g fill="#2c2f4a" fill-opacity=".1"><rect x="230" y="360" width="190" height="130"/><rect x="220" y="346" width="210" height="16"/></g><path d="M300 490v-70a25 25 0 0 1 50 0v70z" fill="#f4ede2" fill-opacity=".6"/>';
  // Bastille : le sujet de l'habillage, et son drapeau tricolore
  c += '<path d="M770 484C830 456 870 436 900 420H1300C1340 436 1380 456 1440 484z" fill="#2c2f4a" fill-opacity=".1"/>';
  c += '<g fill="#2c2f4a" fill-opacity=".34"><rect x="900" y="360" width="400" height="116"/>' + creneaux(900, 360, 400);
  c += [892, 1010, 1130, 1248].map((x) => `<rect x="${x}" y="280" width="62" height="196" rx="3"/>${creneaux(x, 280, 62)}`).join("") + '</g>';
  c += '<g fill="#f4ede2" fill-opacity=".55"><rect x="1090" y="410" width="8" height="30"/>' + [920, 1038, 1158, 1276].map((x) => `<rect x="${x}" y="320" width="8" height="26" rx="4"/>`).join("") + '<path d="M1070 476v-34a30 30 0 0 1 60 0v34z"/></g>';
  c += '<path d="M1100 360V150" stroke="#2c2f4a" stroke-opacity=".34" stroke-width="4"/>';
  c += '<g stroke-opacity="0"><path d="M1102 152q40-14 80 0v56q-40-14-80 0z" fill="#2f4a9a" fill-opacity=".34"/><path d="M1182 152q40 14 80 0v56q-40 14-80 0z" fill="#f4f4ea" fill-opacity=".7"/><path d="M1262 152q30-12 60 0v56q-30-12-60 0z" fill="#b03030" fill-opacity=".34"/></g>';
  // barricade et pavés
  c += `<path d="${crete(670, 30, 60)}" fill="#2c2f4a" fill-opacity=".08"/>`;
  c += '<g fill="#2c2f4a" fill-opacity=".14">' + Array.from({ length: 16 }, (_, i) => `<rect x="${50 + i * 100}" y="${790 + (i % 3) * 18}" width="${50 + (i % 4) * 8}" height="22" rx="4"/>`).join("") + '</g>';
  c += '<path d="M80 760L130 690M1500 770L1450 700" stroke="#2c2f4a" stroke-opacity=".2" stroke-width="5"/><path d="M130 690l36 8-10 20zM1450 700l-36 8 10 20z" fill="#b03030" fill-opacity=".3"/>';
  c += '<rect x="-20" y="850" width="1640" height="160" fill="#2f4a9a" fill-opacity=".07"/>';
  ecrire("revolution-scene.svg", svg(1600, 900, monter(c)));
  let t = '<g stroke="#2c2f4a" stroke-opacity=".07" stroke-width="1"><path d="M0 0V160M53 0V160M107 0V160"/></g>';
  t += '<g fill="#2f4a9a" fill-opacity=".025"><rect x="0" y="0" width="53" height="160"/></g><g fill="#b03030" fill-opacity=".025"><rect x="107" y="0" width="53" height="160"/></g><circle cx="80" cy="80" r="10" fill="none" stroke="#2c2f4a" stroke-opacity=".1" stroke-width="1.4"/><path d="M80 66v28M66 80h28" stroke="#2c2f4a" stroke-opacity=".08" stroke-width="1"/>';
  ecrire("revolution-fond.svg", svg(160, 160, t));
}

// Renaissance et Temps modernes : carte marine ancienne, galion toutes voiles, rose des vents, rhumbs et vagues.
{
  const voile = (x, y, w, h) => `<path d="M${x} ${y}q${w / 2} -10 ${w} 0v${h}q-${w / 2} 14 -${w} 0z"/>`;
  let c = `<defs>${degrade("s", "#f4d9a0", 0.45, 0, true)}${degrade("m", "#4d7d8a", 0, 0.14)}${degrade("h", "#c9a86a", 0, 0.1)}</defs>`;
  c += '<rect width="1600" height="640" fill="url(#h)"/><circle cx="1400" cy="170" r="240" fill="url(#s)"/>';
  // rose des vents et rhumbs
  let rh = "";
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, l = i % 2 ? 150 : 210; rh += `M420 300L${r1(420 + Math.cos(a) * l)} ${r1(300 + Math.sin(a) * l)}`; }
  c += `<g stroke="#243a46" stroke-opacity=".12" stroke-width="2" fill="none"><circle cx="420" cy="300" r="150"/><circle cx="420" cy="300" r="190" stroke-dasharray="4 8"/><path d="${rh}"/></g>`;
  c += '<path d="M420 90L440 300L420 330L400 300z" fill="#8a2f2b" fill-opacity=".22"/><path d="M420 510L400 300L420 270L440 300z" fill="#243a46" fill-opacity=".14"/>';
  c += '<g stroke="#243a46" stroke-opacity=".07" stroke-width="2"><path d="M420 300L1600 120M420 300L1600 330M420 300L-20 120M420 300L-20 520"/></g>';
  c += `<g fill="#243a46" fill-opacity=".05">${nuage(760, 150, 1.4)}${nuage(1200, 330, 1)}</g>`;
  // mer et horizon
  c += '<rect x="-20" y="468" width="1640" height="160" fill="url(#m)"/>';
  let v = "";
  for (let y = 490; y < 620; y += 18) for (let x = (y % 36) * 2; x < 1600; x += 80) v += `M${x} ${y}q10 -7 20 0t20 0`;
  c += `<path d="${v}" stroke="#2f6070" stroke-opacity=".2" stroke-width="2" fill="none"/>`;
  // galion : le sujet de l'habillage
  c += '<g transform="translate(1190 78) scale(.84)"><g fill="#5b3a22" fill-opacity=".34"><path d="M-190 410C-140 480 150 486 200 410L228 370L190 396H-170L-212 360z"/><rect x="-186" y="396" width="372" height="12"/><path d="M130 396v-52l60 8v44z"/></g>';
  c += '<g stroke="#5b3a22" stroke-opacity=".34" stroke-width="5"><path d="M-110 396V150M10 396V110M120 396V190M-250 340L-190 396"/></g>';
  c += '<g fill="#f6eed2" fill-opacity=".8" stroke="#5b3a22" stroke-opacity=".3" stroke-width="2">' + voile(-170, 170, 120, 100) + voile(-160, 284, 100, 80) + voile(-50, 130, 120, 110) + voile(-40, 254, 100, 100) + voile(70, 200, 100, 80) + '</g>';
  c += '<path d="M10 110l50-14-50-14zM-110 150l40-10-40-10z" fill="#8a2f2b" fill-opacity=".4"/><path d="M-182 400q60 14 120 0t120 0t120 0t110 0" stroke="#f6eed2" stroke-opacity=".6" stroke-width="3" fill="none"/></g>';
  c += '<path d="M240 470l30-40 30 40zM330 470l20-28 20 28z" fill="#243a46" fill-opacity=".1"/>';
  c += '<g fill="#5b3a22" fill-opacity=".14"><path d="M300 700q40-50 80 0q30-40 70 0q-40 30-80 20q-40 20-70-20z"/></g>';
  c += '<path d="M60 790h260M1260 800h300" stroke="#243a46" stroke-opacity=".15" stroke-width="3"/><g fill="#243a46" fill-opacity=".14">' + Array.from({ length: 8 }, (_, i) => `<path d="M${120 + i * 190} 840l10-16 10 16-10 16z"/>`).join("") + '</g>';
  c += '<rect x="-20" y="850" width="1640" height="160" fill="#2f6070" fill-opacity=".07"/>';
  ecrire("renaissance-scene.svg", svg(1600, 900, monter(c)));
  let t = '<g stroke="#243a46" stroke-opacity=".08" stroke-width="1"><path d="M0 0L200 200M200 0L0 200M100 0V200M0 100H200"/></g>';
  for (let i = 0; i < 30; i++) t += `<circle cx="${r1(alea() * 200)}" cy="${r1(alea() * 200)}" r="${r1(0.5 + alea() * 1.1)}" fill="#8a6a3a" fill-opacity="${r1(0.06 + alea() * 0.08)}"/>`;
  t += '<circle cx="100" cy="100" r="40" fill="none" stroke="#243a46" stroke-opacity=".08" stroke-width="1.2"/>';
  ecrire("renaissance-fond.svg", svg(200, 200, t));
}

// Révolution industrielle : locomotive à vapeur sur son remblai, usine et cheminées, panaches de fumée, engrenage.
{
  const fumee = (x, y, n, k) => { let c = ""; for (let i = 0; i < n; i++) c += `<circle cx="${r1(x - i * 34 * k + Math.sin(i) * 8)}" cy="${y - i * 26 * k}" r="${r1((12 + i * 7) * k)}"/>`; return c; };
  const roue = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  let c = `<defs>${degrade("h", "#8a8078", 0, 0.16)}${degrade("s", "#e0b070", 0.3, 0, true)}</defs>`;
  c += '<rect width="1600" height="640" fill="url(#h)"/><circle cx="420" cy="260" r="260" fill="url(#s)"/>';
  c += `<g fill="#554d48" fill-opacity=".07">${fumee(560, 340, 6, 1.4)}${fumee(760, 330, 5, 1.2)}${nuage(1000, 120, 1.6)}${nuage(300, 120, 1.3)}</g>`;
  // usine : toit en dents de scie et trois hautes cheminées
  c += '<g fill="#2f2a28" fill-opacity=".16"><path d="M180 480V420l60 -26v26l60 -26v26l60 -26v26l60 -26v26l60 -26v106z"/><rect x="260" y="260" width="26" height="200"/><rect x="440" y="230" width="26" height="230"/><rect x="560" y="290" width="22" height="170"/><rect x="254" y="254" width="38" height="10"/><rect x="434" y="224" width="38" height="10"/><rect x="554" y="284" width="34" height="10"/></g>';
  c += '<g fill="#f4ead0" fill-opacity=".5"><rect x="230" y="440" width="18" height="22"/><rect x="290" y="440" width="18" height="22"/><rect x="350" y="440" width="18" height="22"/><rect x="410" y="440" width="18" height="22"/></g>';
  c += '<g stroke="#8a2f2b" stroke-opacity=".3" stroke-width="3"><path d="M260 330h26M440 300h26M560 360h22"/></g>';
  // engrenage
  let g = "";
  for (let i = 0; i < 14; i++) { const a = i * Math.PI * 2 / 14; g += `<rect x="-8" y="-86" width="16" height="20" transform="rotate(${r1(a * 57.3)})"/>`; }
  c += `<g transform="translate(1400 330)" fill="#2f2a28" fill-opacity=".1"><circle r="68"/>${g}</g><circle cx="1400" cy="330" r="26" fill="#e9e3d8" fill-opacity=".7"/>`;
  // locomotive : le sujet de l'habillage
  c += '<g transform="translate(1090 436)"><g fill="#2f2a28" fill-opacity=".36"><rect x="-170" y="-86" width="232" height="62" rx="26"/><rect x="-156" y="-132" width="30" height="50"/><path d="M-166 -132h50l-6 -18h-38z"/><rect x="50" y="-122" width="96" height="98"/><rect x="40" y="-132" width="116" height="12"/><ellipse cx="-62" cy="-92" rx="22" ry="16"/><path d="M-176 -24h46l-36 20z"/>' + roue(-110, -22, 24) + roue(-48, -22, 24) + roue(30, -26, 34) + roue(110, -22, 24) + '<rect x="-186" y="-6" width="350" height="8"/></g>';
  c += '<g fill="#f4ead0" fill-opacity=".55"><rect x="62" y="-104" width="30" height="34" rx="3"/><rect x="104" y="-104" width="30" height="34" rx="3"/></g><path d="M-110 -22L30 -26M-48 -22L110 -22" stroke="#e9e3d8" stroke-opacity=".6" stroke-width="5"/>';
  c += `<g fill="#554d48" fill-opacity=".1" transform="translate(-135 -158)">${fumee(0, 0, 6, 1.5)}</g></g>`;
  c += '<path d="M780 446H1620" stroke="#2f2a28" stroke-opacity=".26" stroke-width="5"/><g stroke="#2f2a28" stroke-opacity=".16" stroke-width="3">' + Array.from({ length: 22 }, (_, i) => `<path d="M${790 + i * 38} 452v14"/>`).join("") + '</g>';
  c += `<path d="${crete(560, 26)}" fill="#554d48" fill-opacity=".08"/><path d="${crete(700, 22, 60)}" fill="#2f2a28" fill-opacity=".1"/>`;
  c += '<g fill="#2f2a28" fill-opacity=".14">' + Array.from({ length: 10 }, (_, i) => `<path d="M${40 + i * 170} 880V820a30 30 0 0 1 60 0v60z"/>`).join("") + '</g><rect x="-20" y="850" width="1640" height="160" fill="#554d48" fill-opacity=".1"/>';
  ecrire("industrielle-scene.svg", svg(1600, 900, monter(c)));
  let t = '<g stroke="#554d48" stroke-opacity=".08" stroke-width="1"><path d="M0 40H160M0 120H160"/><path d="M40 0V160M120 0V160" stroke-dasharray="2 8"/></g>';
  for (let i = 0; i < 34; i++) t += `<circle cx="${r1(alea() * 160)}" cy="${r1(alea() * 160)}" r="${r1(0.5 + alea() * 1.1)}" fill="#2f2a28" fill-opacity="${r1(0.05 + alea() * 0.07)}"/>`;
  t += '<g fill="#554d48" fill-opacity=".12"><circle cx="40" cy="40" r="3"/><circle cx="120" cy="40" r="3"/><circle cx="40" cy="120" r="3"/><circle cx="120" cy="120" r="3"/></g>';
  ecrire("industrielle-fond.svg", svg(160, 160, t));
}

// Guerre froide : affiche constructiviste (disque rouge, diagonales), Spoutnik et ses orbites, mur surveillé par un mirador.
{
  let c = `<defs>${degrade("h", "#b03a2e", 0, 0.08)}</defs>`;
  c += '<rect width="1600" height="640" fill="url(#h)"/><circle cx="1130" cy="300" r="190" fill="#b03a2e" fill-opacity=".12"/>';
  c += '<path d="M-20 560L520 -20H640L-20 700zM1000 700L1620 80V220L1140 700z" fill="#1e1e22" fill-opacity=".05"/><path d="M300 640L700 240H760L360 640z" fill="#b03a2e" fill-opacity=".08"/>';
  c += '<g fill="none" stroke="#1e1e22" stroke-opacity=".2" stroke-width="2.5"><ellipse cx="1130" cy="300" rx="250" ry="70" transform="rotate(-22 1130 300)"/><ellipse cx="1130" cy="300" rx="190" ry="130" transform="rotate(28 1130 300)"/></g>';
  // Spoutnik : le sujet de l'habillage
  c += '<g transform="translate(1130 300) rotate(-22)"><circle r="54" fill="#1e1e22" fill-opacity=".34"/><circle cx="-18" cy="-18" r="16" fill="#f4efe2" fill-opacity=".5"/><g stroke="#1e1e22" stroke-opacity=".34" stroke-width="4"><path d="M30 -30L260 -86M42 -12L270 -24M42 12L270 36M30 30L260 96"/></g></g>';
  c += '<g fill="#f4efe2" fill-opacity=".7"><circle cx="1330" cy="228" r="5"/><circle cx="1360" cy="276" r="5"/></g>';
  c += `<g fill="#1e1e22" fill-opacity=".05">${nuage(430, 160, 1.5)}${nuage(900, 110, 1.2)}</g>`;
  c += '<path d="M120 90h300M120 112h200" stroke="#b03a2e" stroke-opacity=".14" stroke-width="10"/>';
  // mur et mirador
  c += '<g fill="#1e1e22" fill-opacity=".14"><rect x="170" y="430" width="640" height="46"/><rect x="560" y="340" width="70" height="136"/><rect x="540" y="320" width="110" height="26"/><path d="M530 320L595 290L660 320z"/></g><g fill="#f4efe2" fill-opacity=".55"><rect x="570" y="352" width="18" height="16"/><rect x="602" y="352" width="18" height="16"/></g>';
  c += '<path d="M170 424l640 0" stroke="#1e1e22" stroke-opacity=".2" stroke-width="3" stroke-dasharray="6 6"/><path d="M595 334L430 470M595 334L760 470" stroke="#f4efe2" stroke-opacity=".4" stroke-width="10"/>';
  c += `<path d="${crete(560, 24)}" fill="#1e1e22" fill-opacity=".06"/><path d="${crete(700, 22, 60)}" fill="#1e1e22" fill-opacity=".09"/>`;
  c += '<g fill="#b03a2e" fill-opacity=".18">' + Array.from({ length: 8 }, (_, i) => `<path d="M${120 + i * 190} 840l24-40 24 40z"/>`).join("") + '</g><rect x="-20" y="850" width="1640" height="160" fill="#1e1e22" fill-opacity=".08"/>';
  ecrire("guerre-froide-scene.svg", svg(1600, 900, monter(c)));
  let t = '<g stroke="#1e1e22" stroke-opacity=".07" stroke-width="1"><path d="M0 160L160 0M-40 160L120 0M40 200L200 40" /></g><circle cx="80" cy="80" r="18" fill="none" stroke="#b03a2e" stroke-opacity=".1" stroke-width="2"/>';
  for (let i = 0; i < 26; i++) t += `<circle cx="${r1(alea() * 160)}" cy="${r1(alea() * 160)}" r="${r1(0.5 + alea())}" fill="#1e1e22" fill-opacity="${r1(0.05 + alea() * 0.06)}"/>`;
  ecrire("guerre-froide-fond.svg", svg(160, 160, t));
}

// Sport : flamme dans sa vasque, stade et mâts d'éclairage, couloirs de piste en terre battue.
{
  let c = `<defs>${degrade("s", "#f4d36a", 0.45, 0, true)}${degrade("h", "#7fb06a", 0, 0.1)}${degrade("f", "#f08a2a", 0.55, 0, true)}</defs>`;
  c += '<rect width="1600" height="640" fill="url(#h)"/><circle cx="420" cy="220" r="260" fill="url(#s)"/><circle cx="1100" cy="250" r="220" fill="url(#f)"/>';
  c += `<g fill="#1f3a2c" fill-opacity=".05">${nuage(760, 150, 1.4)}${nuage(1400, 230, 1.1)}${nuage(200, 120, 1.2)}</g>`;
  // stade et mâts d'éclairage
  c += '<g fill="#1f3a2c" fill-opacity=".22"><path d="M160 480C160 380 700 380 700 480z"/><rect x="170" y="440" width="520" height="40"/></g>';
  c += '<g fill="#f4efe0" fill-opacity=".5"><path d="M200 470C240 410 620 410 660 470z"/></g><g stroke="#1f3a2c" stroke-opacity=".18" stroke-width="3" fill="none"><path d="M210 466C250 410 610 410 650 466M236 466C270 424 590 424 624 466"/></g>';
  c += '<g fill="#1f3a2c" fill-opacity=".16">' + [130, 730].map((x) => `<rect x="${x - 4}" y="270" width="8" height="210"/><rect x="${x - 34}" y="250" width="68" height="26" rx="3"/>`).join("") + '</g><g fill="#f4d36a" fill-opacity=".6">' + [130, 730].map((x) => [-24, -8, 8, 24].map((dx) => `<circle cx="${x + dx}" cy="263" r="4"/>`).join("")).join("") + '</g>';
  // vasque et flamme : le sujet de l'habillage
  c += '<g transform="translate(1100 440)"><g fill="#1f3a2c" fill-opacity=".34"><path d="M-70 -160h140l-30 46h-80z"/><rect x="-8" y="-114" width="16" height="104"/><path d="M-44 0h88l-10 -22h-68z"/><rect x="-56" y="-12" width="112" height="12"/></g>';
  c += '<path d="M0 -168C-44 -214 -34 -252 -8 -290C-6 -262 6 -258 14 -274C34 -250 56 -216 0 -168z" fill="#e0762a" fill-opacity=".5"/><path d="M0 -176C-20 -200 -16 -222 2 -240C14 -224 28 -206 0 -176z" fill="#f4d36a" fill-opacity=".7"/>';
  c += '<g stroke="#4f8a58" stroke-opacity=".36" stroke-width="6" fill="none"><path d="M-110 -40C-150 -120 -130 -220 -80 -270"/><path d="M110 -40C150 -120 130 -220 80 -270"/></g><g fill="#4f8a58" fill-opacity=".3">' + [-60, -100, -130, -146].map((y, i) => `<ellipse cx="${-100 - (i % 2) * 6 - i * 4}" cy="${y - 60}" rx="14" ry="6" transform="rotate(-50 ${-100 - i * 4} ${y - 60})"/>`).join("") + '</g></g>';
  c += `<path d="${crete(580, 20)}" fill="#1f3a2c" fill-opacity=".07"/>`;
  // piste : couloirs en terre battue au premier plan
  c += '<path d="M-20 700C400 640 1200 640 1620 700V780C1200 720 400 720 -20 780z" fill="#b4533a" fill-opacity=".14"/><g stroke="#f4efe0" stroke-opacity=".5" stroke-width="4" fill="none"><path d="M-20 720C400 660 1200 660 1620 720"/><path d="M-20 740C400 680 1200 680 1620 740"/><path d="M-20 760C400 700 1200 700 1620 760"/></g>';
  c += '<rect x="-20" y="850" width="1640" height="160" fill="#b4533a" fill-opacity=".1"/>';
  ecrire("sport-scene.svg", svg(1600, 900, monter(c)));
  let t = '<g stroke="#1f3a2c" stroke-opacity=".07" stroke-width="1"><path d="M0 40H160M0 80H160M0 120H160"/></g><g fill="#4f8a58" fill-opacity=".05"><rect x="0" y="0" width="160" height="40"/><rect x="0" y="80" width="160" height="40"/></g>';
  for (let i = 0; i < 24; i++) t += `<circle cx="${r1(alea() * 160)}" cy="${r1(alea() * 160)}" r="${r1(0.5 + alea())}" fill="#1f3a2c" fill-opacity="${r1(0.05 + alea() * 0.06)}"/>`;
  ecrire("sport-fond.svg", svg(160, 160, t));
}

// ---------- Douze thèmes de plus (propositions) ----------
const tuile = (nom, t, corps, n = 24, col = "#000", ofs = 0.06) => {
  let c = corps;
  for (let i = 0; i < n; i++) c += `<circle cx="${r1(alea() * t)}" cy="${r1(alea() * t)}" r="${r1(0.5 + alea() * 1.1)}" fill="${col}" fill-opacity="${r1(ofs * 0.6 + alea() * ofs)}"/>`;
  ecrire(`${nom}-fond.svg`, svg(t, t, c));
};
const ciel = (g, glow, gx, gy, gr, o = 0.4) => `<defs>${degrade("s", glow, o, 0, true)}${degrade("h", g, 0, 0.12)}</defs><rect width="1600" height="640" fill="url(#h)"/><circle cx="${gx}" cy="${gy}" r="${gr}" fill="url(#s)"/>`;
const sol = (c1, c2) => `<path d="${crete(580, 24)}" fill="${c1}" fill-opacity=".07"/><path d="${crete(700, 22, 60)}" fill="${c1}" fill-opacity=".1"/><rect x="-20" y="850" width="1640" height="160" fill="${c2}" fill-opacity=".1"/>`;

// Sciences : cabinet de curiosités, télescope de Galilée, sphère armillaire, lune, constellations.
{
  let c = ciel("#5a6a8a", "#f4e0a0", 420, 220, 260, 0.35);
  c += '<g fill="#2a3340" fill-opacity=".06">' + [[200, 140], [640, 120], [900, 360], [1450, 150], [300, 440], [1480, 330]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join("") + '</g>';
  c += '<path d="M200 140L330 170L450 110L640 120M900 360L1000 410L1090 380" stroke="#2a3340" stroke-opacity=".12" stroke-width="2" stroke-dasharray="4 8" fill="none"/>';
  // sphère armillaire
  c += '<g transform="translate(430 300)" fill="none" stroke="#8a6a2a" stroke-opacity=".34" stroke-width="5"><circle r="120"/><ellipse rx="120" ry="40"/><ellipse rx="40" ry="120"/><ellipse rx="100" ry="100" transform="rotate(30)"/><path d="M-140 0H140M0 -140V140" stroke-width="3" stroke-opacity=".2"/></g><circle cx="430" cy="300" r="22" fill="#2a5aa0" fill-opacity=".3"/>';
  // lune
  c += '<circle cx="1290" cy="150" r="46" fill="#2a3340" fill-opacity=".12"/><circle cx="1308" cy="140" r="40" fill="#efe6d2"/>';
  // télescope : le sujet de l'habillage
  c += '<g stroke="#2a3340" stroke-opacity=".36" stroke-width="12" stroke-linecap="round"><path d="M1100 372L1010 478M1100 372L1190 478M1100 372L1100 486"/></g>';
  c += '<g transform="translate(1100 372) rotate(-36)" fill="#2a3340" fill-opacity=".34"><rect x="-190" y="-24" width="380" height="48" rx="8"/><rect x="130" y="-34" width="70" height="68" rx="6"/><rect x="-216" y="-13" width="30" height="26" rx="4"/></g>';
  c += '<g transform="translate(1100 372) rotate(-36)" stroke="#c9962f" stroke-opacity=".7" stroke-width="5"><path d="M-110 -24V24M-30 -24V24M50 -24V24"/></g>';
  c += '<g fill="#c9962f" fill-opacity=".5"><path d="M1240 190l6 14 14 1-11 9 4 14-13-8-13 8 4-14-11-9 14-1z"/></g>';
  c += sol("#2a3340", "#2a5aa0");
  c += '<g fill="#2a3340" fill-opacity=".14"><path d="M130 880v-40q-30 0-30-26t30-26v-12h30v12q30 0 30 26t-30 26v40z"/><path d="M300 880v-50l14-22v-16h22v16l14 22v50z"/></g>';
  ecrire("sciences-scene.svg", svg(1600, 900, monter(c)));
  tuile("sciences", 160, '<g stroke="#2a3340" stroke-opacity=".08" stroke-width="1" fill="none"><circle cx="80" cy="80" r="50"/><path d="M0 80H160M80 0V160"/></g><path d="M30 30l5 9-5 9-5-9z" fill="#c9962f" fill-opacity=".14"/>', 22, "#2a3340");
}

// Religions : rosace de vitrail, silhouettes de cathédrale, mosquée et pagode.
{
  let c = ciel("#9a7aa0", "#f4d9a0", 1110, 300, 300, 0.35);
  c += '<g transform="translate(1110 300)"><circle r="168" fill="#3a2438" fill-opacity=".3"/>';
  const cols = ["#2f4aa0", "#b03030", "#c9962f", "#2f8a6a", "#6a3a9a", "#c9962f"];
  for (let i = 0; i < 12; i++) { const a0 = i * Math.PI / 6, a1 = (i + 1) * Math.PI / 6; c += `<path d="M0 0L${r1(Math.cos(a0) * 150)} ${r1(Math.sin(a0) * 150)}A150 150 0 0 1 ${r1(Math.cos(a1) * 150)} ${r1(Math.sin(a1) * 150)}z" fill="${cols[i % 6]}" fill-opacity=".34"/>`; }
  c += '<circle r="150" fill="none" stroke="#3a2438" stroke-opacity=".36" stroke-width="8"/><circle r="90" fill="none" stroke="#3a2438" stroke-opacity=".34" stroke-width="6"/><circle r="36" fill="#f4d9a0" fill-opacity=".7"/><path d="M0 -150V150M-150 0H150M-106 -106L106 106M-106 106L106 -106" stroke="#3a2438" stroke-opacity=".3" stroke-width="5"/></g>';
  c += `<g fill="#3a2438" fill-opacity=".06">${nuage(500, 150, 1.4)}${nuage(1450, 400, 1)}</g>`;
  // cathédrale, mosquée, pagode
  c += '<g fill="#3a2438" fill-opacity=".16"><path d="M170 480V330l24-70 24 70v150z"/><path d="M250 480V360l30-90 30 90v120z"/><rect x="194" y="400" width="56" height="80"/>';
  c += '<path d="M480 480V400q0-70 60-70t60 70v80z"/><rect x="620" y="300" width="14" height="180"/><path d="M613 300l14-34 14 34z"/><rect x="456" y="320" width="14" height="160"/><path d="M449 320l14-34 14 34z"/>';
  c += '<path d="M760 480v-30h120v30zM780 450v-30h80v30zM796 420v-30h48v30zM808 390v-34l12-30 12 30v34z"/></g>';
  c += sol("#3a2438", "#6a3a9a");
  ecrire("religions-scene.svg", svg(1600, 900, monter(c)));
  tuile("religions", 160, '<g stroke="#3a2438" stroke-opacity=".07" stroke-width="1" fill="none"><path d="M80 10l70 70-70 70-70-70z"/><circle cx="80" cy="80" r="26"/></g>', 18, "#3a2438");
}

// Droits et libertés : balance de la justice, parchemin de la Déclaration, plume, colonnes.
{
  let c = ciel("#8a9ac0", "#f4e4a8", 420, 220, 250, 0.35);
  c += '<g fill="#2a3350" fill-opacity=".1"><rect x="150" y="260" width="30" height="220"/><rect x="230" y="260" width="30" height="220"/><rect x="310" y="260" width="30" height="220"/><rect x="390" y="260" width="30" height="220"/><path d="M130 260l160-60 160 60z"/></g>';
  c += '<g fill="#f4ead0" fill-opacity=".6"><path d="M150 262l140-50 140 50z"/></g>';
  // parchemin derrière la balance
  c += '<path d="M900 230h400v230q0 14-14 14H914q-14 0-14-14z" fill="#d9c08a" fill-opacity=".34"/><g stroke="#2a3350" stroke-opacity=".2" stroke-width="3">' + Array.from({ length: 8 }, (_, i) => `<path d="M930 ${270 + i * 24}H1270"/>`).join("") + '</g>';
  // balance : le sujet
  c += '<g fill="#2a3350" fill-opacity=".36" stroke="#2a3350" stroke-opacity=".36"><rect x="1096" y="222" width="12" height="236" stroke="none"/><rect x="1060" y="450" width="84" height="16" rx="4" stroke="none"/><path d="M960 262Q1100 232 1244 262" stroke-width="10" fill="none"/><circle cx="1102" cy="222" r="14" stroke="none"/>';
  c += '<path d="M962 262L930 380M962 262L1000 380M1242 262L1210 380M1242 262L1280 380" stroke-width="3" fill="none"/><path d="M920 380Q965 420 1010 380z M1200 380Q1245 420 1290 380z" stroke="none"/></g>';
  c += '<path d="M1330 150q60 40 30 120M1360 270q-30 30-70 36" stroke="#2a3350" stroke-opacity=".3" stroke-width="5" fill="none"/>';
  c += `<g fill="#2a3350" fill-opacity=".05">${nuage(700, 140, 1.4)}${nuage(1380, 180, 1)}</g>`;
  c += sol("#2a3350", "#2f4a9a");
  ecrire("droits-scene.svg", svg(1600, 900, monter(c)));
  tuile("droits", 160, '<g stroke="#2a3350" stroke-opacity=".07" stroke-width="1"><path d="M0 40H160M0 80H160M0 120H160"/></g><path d="M80 20l4 8h8l-6 6 2 8-8-4-8 4 2-8-6-6h8z" fill="#c9962f" fill-opacity=".14"/>', 18, "#2a3350");
}

// Construction européenne : couronne de douze étoiles d'or sur disque bleu, réseau d'alliances, drapeaux.
{
  let c = ciel("#5a7ac0", "#f4e4a8", 1110, 300, 300, 0.3);
  c += '<circle cx="1110" cy="300" r="170" fill="#14285a" fill-opacity=".34"/><circle cx="1110" cy="300" r="170" fill="none" stroke="#c9962f" stroke-opacity=".5" stroke-width="5"/>';
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 - Math.PI / 2, x = r1(1110 + Math.cos(a) * 118), y = r1(300 + Math.sin(a) * 118); c += `<path d="M${x} ${y - 20}l6 15 16 1-12 11 4 16-14-9-14 9 4-16-12-11 16-1z" fill="#e8b830" fill-opacity=".75"/>`; }
  let r = "";
  const pts = [[300, 170], [520, 260], [700, 150], [560, 380], [340, 360]];
  pts.forEach(([x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; r += `M${x} ${y}L${x2} ${y2}`; });
  c += `<path d="${r}M520 260L560 380M700 150L560 380" stroke="#14285a" stroke-opacity=".16" stroke-width="3" fill="none"/>` + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#14285a" fill-opacity=".26"/>`).join("");
  c += `<g fill="#14285a" fill-opacity=".05">${nuage(900, 120, 1.3)}${nuage(1450, 420, 1)}</g>`;
  c += '<g fill="#14285a" fill-opacity=".14"><rect x="760" y="360" width="50" height="120"/><rect x="820" y="330" width="50" height="150"/><path d="M770 360l15-30 15 30z"/></g>';
  c += sol("#14285a", "#c9962f");
  ecrire("europe-scene.svg", svg(1600, 900, monter(c)));
  tuile("europe", 160, '<path d="M80 40l4 10h10l-8 7 3 11-9-6-9 6 3-11-8-7h10z" fill="#c9962f" fill-opacity=".16"/><g stroke="#14285a" stroke-opacity=".06" stroke-width="1"><path d="M0 120H160M120 0V160"/></g>', 18, "#14285a");
}

// Décolonisation : globe et Afrique, paquebot, palmiers, mouettes.
{
  let c = ciel("#8aa070", "#f4d490", 420, 230, 260, 0.35);
  c += '<g transform="translate(1230 320)"><circle r="150" fill="#2c3a2e" fill-opacity=".16"/><g fill="none" stroke="#2c3a2e" stroke-opacity=".3" stroke-width="3"><circle r="150"/><ellipse rx="150" ry="50"/><ellipse rx="150" ry="100"/><ellipse rx="50" ry="150"/><ellipse rx="100" ry="150"/></g>';
  c += '<path d="M-10 -100C30 -112 78 -86 88 -44C104 -10 76 22 64 56C52 98 20 118 -4 104C-22 82 -32 42 -54 12C-88 -22 -66 -78 -10 -100z" fill="#7a5a2a" fill-opacity=".5"/><path d="M-96 -70C-70 -96 -36 -104 -24 -94C-40 -76 -64 -60 -96 -70z" fill="#7a5a2a" fill-opacity=".28"/></g>';
  c += '<g fill="#2c3a2e" fill-opacity=".16"><path d="M300 470h260l-30-40H340z"/><rect x="390" y="396" width="90" height="34"/><rect x="420" y="360" width="20" height="36"/><rect x="450" y="372" width="14" height="24"/></g>';
  c += '<path d="M240 486q40 10 80 0t80 0t80 0t80 0" stroke="#2c3a2e" stroke-opacity=".16" stroke-width="3" fill="none"/>';
  c += '<g stroke="#2c3a2e" stroke-opacity=".28" stroke-width="4" fill="none"><path d="M760 480Q770 400 740 340M740 340q-40-10-60 10M740 340q40-20 70 0M740 340q-10-40-40-50M740 340q20-40 50-44"/></g>';
  c += '<path d="M640 160q10 -9 20 0q10 -9 20 0M900 120q8 -7 16 0q8 -7 16 0" stroke="#2c3a2e" stroke-opacity=".3" stroke-width="2.4" fill="none"/>';
  c += `<g fill="#2c3a2e" fill-opacity=".05">${nuage(560, 130, 1.3)}</g>`;
  c += sol("#2c3a2e", "#7a5a2a");
  ecrire("decolonisation-scene.svg", svg(1600, 900, monter(c)));
  tuile("decolonisation", 160, '<g stroke="#2c3a2e" stroke-opacity=".07" stroke-width="1" fill="none"><circle cx="80" cy="80" r="56"/><ellipse cx="80" cy="80" rx="56" ry="20"/><path d="M80 24V136"/></g>', 20, "#2c3a2e");
}

// Environnement : éoliennes, forêt de sapins, glacier, soleil.
{
  const sapin = (x, y, h) => `<path d="M${x} ${y - h}l${h * 0.28} ${h * 0.4}h-${h * 0.14}l${h * 0.22} ${h * 0.3}h-${h * 0.12}l${h * 0.2} ${h * 0.3}h-${h * 1.08}l${h * 0.2}-${h * 0.3}h-${h * 0.12}l${h * 0.22}-${h * 0.3}h-${h * 0.14}z"/>`;
  const eol = (x, y, h, a) => `<g transform="translate(${x} ${y})"><path d="M-6 0L-3 -${h}H3L6 0z"/><g transform="translate(0 -${h}) rotate(${a})"><circle r="9"/><path d="M-5 0L0 -${h * 0.5}L5 0zM-5 0L${h * 0.43} ${h * 0.25}L${h * 0.04} 5zM5 0L-${h * 0.43} ${h * 0.25}L-${h * 0.04} 5z"/></g></g>`;
  let c = ciel("#7aa090", "#f4e8a0", 420, 220, 260, 0.4);
  c += '<g fill="#6a8a8a" fill-opacity=".14"><path d="M200 480L330 290L400 360L470 300L600 480z"/></g><path d="M330 290L300 340L330 332L352 366L378 336L400 360z" fill="#f4f8f4" fill-opacity=".7"/>';
  c += `<g fill="#1d3a2a" fill-opacity=".34">${eol(1110, 466, 250, 20)}</g><g fill="#1d3a2a" fill-opacity=".2">${eol(930, 466, 150, 70)}${eol(1300, 466, 170, 100)}</g>`;
  c += '<g fill="#1d3a2a" fill-opacity=".16">' + [640, 690, 730, 780, 1360, 1410, 1460].map((x, i) => sapin(x, 480, 100 + (i % 3) * 30)).join("") + '</g>';
  c += `<g fill="#1d3a2a" fill-opacity=".05">${nuage(700, 140, 1.4)}${nuage(1450, 220, 1)}</g>`;
  c += sol("#1d3a2a", "#4f8a58");
  ecrire("environnement-scene.svg", svg(1600, 900, monter(c)));
  tuile("environnement", 160, '<g fill="#4f8a58" fill-opacity=".1"><path d="M40 60q20-30 40 0q-20 30-40 0zM100 110q16-26 32 0q-16 26-32 0z"/></g><path d="M0 130q40-12 80 0t80 0" stroke="#1d3a2a" stroke-opacity=".06" stroke-width="1.4" fill="none"/>', 20, "#1d3a2a");
}

// Guerres et batailles : écu aux épées croisées, bannières, lances et tentes.
{
  let c = ciel("#a07a5a", "#f0c880", 360, 230, 260, 0.35);
  c += '<g transform="translate(1110 330)"><g stroke="#3a2a22" stroke-opacity=".36" stroke-width="16" stroke-linecap="round"><path d="M-130 -140L130 120M130 -140L-130 120"/></g><g stroke="#3a2a22" stroke-opacity=".34" stroke-width="12"><path d="M-70 78L-110 40M70 78L110 40"/></g>';
  c += '<path d="M-100 -100H100V0Q100 80 0 130Q-100 80 -100 0z" fill="#3a2a22" fill-opacity=".3"/><path d="M-100 -100H100V0Q100 80 0 130Q-100 80 -100 0z" fill="none" stroke="#c9962f" stroke-opacity=".6" stroke-width="7"/><path d="M0 -100V130M-100 -10H100" stroke="#b03030" stroke-opacity=".5" stroke-width="22"/></g>';
  c += '<g stroke="#3a2a22" stroke-opacity=".26" stroke-width="4">' + [180, 250, 320, 420, 500, 590, 690].map((x, i) => `<path d="M${x} 480V${300 + (i % 3) * 30}"/>`).join("") + '</g>';
  c += '<g fill="#b03030" fill-opacity=".34">' + [180, 320, 500, 690].map((x, i) => `<path d="M${x} ${300 + (i % 3) * 30}l50 12-50 12z"/>`).join("") + '</g>';
  c += '<g fill="#3a2a22" fill-opacity=".14"><path d="M780 480l40-60 40 60zM1340 480l36-54 36 54z"/></g>';
  c += '<g fill="#3a2a22" fill-opacity=".05">' + `${nuage(620, 130, 1.5)}${nuage(1300, 140, 1.2)}` + '</g>';
  c += sol("#3a2a22", "#b03030");
  ecrire("batailles-scene.svg", svg(1600, 900, monter(c)));
  tuile("batailles", 160, '<g stroke="#3a2a22" stroke-opacity=".07" stroke-width="1.4"><path d="M30 30L80 80M80 30L30 80"/></g><path d="M120 120l8 14h-16z" fill="#b03030" fill-opacity=".1"/>', 20, "#3a2a22");
}

// France : tour Eiffel, Mont-Saint-Michel, rubans tricolores.
{
  let c = ciel("#8a9ac0", "#f4dca0", 420, 230, 260, 0.35);
  // tour Eiffel : le sujet de l'habillage
  c += '<g fill="#1f2f55" fill-opacity=".34"><path d="M1010 470L1062 340L1076 340L1092 260L1100 200L1108 260L1124 340L1138 340L1190 470L1166 470L1124 372L1098 372L1072 372L1034 470z"/><rect x="1058" y="336" width="84" height="10"/><rect x="1080" y="256" width="40" height="8"/></g>';
  c += '<g stroke="#f4ede2" stroke-opacity=".55" stroke-width="3" fill="none"><path d="M1040 470Q1100 400 1160 470"/><path d="M1076 372L1124 340M1124 372L1076 340M1092 340L1108 260M1108 340L1092 260"/></g><path d="M1100 200V150" stroke="#1f2f55" stroke-opacity=".34" stroke-width="4"/>';
  // Mont-Saint-Michel
  c += '<g fill="#1f2f55" fill-opacity=".16"><path d="M200 480Q300 400 360 360Q420 400 520 480z"/><path d="M340 372l20-80 20 80z"/><rect x="352" y="296" width="16" height="-20"/><path d="M350 292l10-50 10 50z"/><rect x="300" y="390" width="40" height="40"/><rect x="380" y="380" width="44" height="50"/></g>';
  c += '<g fill="none" stroke-width="10" stroke-opacity=".13"><path d="M-20 170C300 80 560 250 840 150" stroke="#2f4a9a"/><path d="M-20 194C300 104 560 274 840 174" stroke="#f4f4ea" stroke-opacity=".5"/><path d="M-20 218C300 128 560 298 840 198" stroke="#b03030"/></g>';
  c += `<g fill="#1f2f55" fill-opacity=".05">${nuage(700, 330, 1.2)}${nuage(1420, 180, 1.1)}</g>`;
  c += sol("#1f2f55", "#2f4a9a");
  ecrire("france-scene.svg", svg(1600, 900, monter(c)));
  tuile("france", 160, '<path d="M80 30l6 12h12l-9 8 3 12-12-7-12 7 3-12-9-8h12z" fill="#c9962f" fill-opacity=".1"/><g stroke="#1f2f55" stroke-opacity=".06" stroke-width="1"><path d="M0 130H160"/></g>', 20, "#1f2f55");
}

// Égypte antique : pyramides, disque solaire, obélisque, frise de hiéroglyphes.
{
  let c = ciel("#d9a050", "#f4c470", 1300, 200, 300, 0.45);
  c += '<circle cx="1300" cy="200" r="60" fill="#d9892f" fill-opacity=".22"/>';
  c += '<g fill="#4a2f1a" fill-opacity=".34"><path d="M900 470L1110 240L1320 470z"/></g><path d="M1110 240L1320 470H1220z" fill="#2a1a10" fill-opacity=".16"/>';
  c += '<g fill="#4a2f1a" fill-opacity=".2"><path d="M820 470L930 360L1040 470z"/><path d="M1320 470L1410 392L1500 470z"/></g>';
  c += '<g stroke="#f4e4c0" stroke-opacity=".5" stroke-width="2"><path d="M1000 420H1220M1040 380H1180M1076 340H1144M1096 300H1124"/></g>';
  c += '<g fill="#4a2f1a" fill-opacity=".18"><path d="M300 480V250l14-30 14 30v230z"/><rect x="296" y="480" width="36" height="10"/></g>';
  c += '<g fill="#4a2f1a" fill-opacity=".14"><path d="M520 480q10-60 40-60l20-20h30l8 24q30 0 30 56z"/></g>';
  c += '<g stroke="#4a2f1a" stroke-opacity=".28" stroke-width="4" fill="none"><path d="M640 480Q650 420 630 380M630 380q-30-8-44 8M630 380q30-16 54 4"/></g>';
  c += sol("#4a2f1a", "#2f6a8a");
  let k = "";
  for (let x = 40; x < 1600; x += 90) k += `M${x} 810h20v20h-20zM${x + 40} 800q12 0 12 14t-12 14q-12 0-12-14t12-14zM${x + 62} 800v30`;
  c += `<path d="${k}" stroke="#4a2f1a" stroke-opacity=".2" stroke-width="3" fill="none"/>`;
  ecrire("egypte-scene.svg", svg(1600, 900, monter(c)));
  tuile("egypte", 160, '<g stroke="#4a2f1a" stroke-opacity=".08" stroke-width="1.4" fill="none"><path d="M40 60h20v20H40zM100 50q10 0 10 12t-10 12q-10 0-10-12t10-12zM70 110v30"/></g>', 26, "#4a2f1a");
}

// Rome antique : Colisée, aqueduc, aigle légionnaire, lauriers.
{
  let c = ciel("#c08a5a", "#f4cc90", 420, 230, 260, 0.35);
  // Colisée : le sujet
  c += '<path d="M870 470V320Q1105 270 1340 320V470z" fill="#4a2418" fill-opacity=".3"/>';
  for (const [y, h] of [[330, 40], [380, 40], [430, 36]]) for (let i = 0; i < 12; i++) c += `<path d="M${884 + i * 38} ${y + h}v-${h - 14}a10 10 0 0 1 20 0v${h - 14}z" fill="#f2e4cf" fill-opacity=".5"/>`;
  c += '<path d="M870 372H1340M870 420H1340" stroke="#4a2418" stroke-opacity=".3" stroke-width="5"/>';
  // aqueduc
  c += '<g fill="#4a2418" fill-opacity=".16"><rect x="120" y="360" width="640" height="26"/>' + Array.from({ length: 7 }, (_, i) => `<path d="M${120 + i * 92} 480V420a30 30 0 0 1 60 0v60z"/>`).join("").replace(/<path/g, '<path fill-opacity="0"').replace('fill-opacity="0"', 'fill-opacity="0"') + '</g>';
  c += '<g fill="#4a2418" fill-opacity=".16"><rect x="120" y="386" width="640" height="94"/></g><g fill="#f2e4cf" fill-opacity=".6">' + Array.from({ length: 7 }, (_, i) => `<path d="M${135 + i * 92} 480V430a28 28 0 0 1 56 0v50z"/>`).join("") + '</g>';
  // aigle légionnaire
  c += '<g fill="#4a2418" fill-opacity=".26"><rect x="1420" y="260" width="8" height="220"/><path d="M1424 240l-34 18 14 4-12 14 32-8 32 8-12-14 14-4z"/></g>';
  c += `<g fill="#4a2418" fill-opacity=".05">${nuage(640, 140, 1.4)}${nuage(1250, 170, 1)}</g>`;
  c += sol("#4a2418", "#a4552f");
  ecrire("rome-scene.svg", svg(1600, 900, monter(c)));
  tuile("rome", 160, '<g stroke="#4a2418" stroke-opacity=".07" stroke-width="1.4" fill="none"><path d="M0 120h160M30 120v-30a20 20 0 0 1 40 0v30M100 120v-30a20 20 0 0 1 40 0v30"/></g>', 22, "#4a2418");
}

// Spectacle : rideau rouge, projecteurs, étoile, pellicule.
{
  let c = ciel("#a05a6a", "#f4d490", 1100, 280, 280, 0.35);
  c += '<g transform="translate(110 60)">';
  c += '<g fill="#8a1f2f" fill-opacity=".3"><path d="M840 100H1380V150Q1110 190 840 150z"/><path d="M840 150Q900 280 870 470H840zM1380 150Q1320 280 1350 470H1380z"/><path d="M870 150Q960 260 930 470H870zM1350 150Q1260 260 1290 470H1350z"/></g>';
  c += '<g stroke="#f4d490" stroke-opacity=".35" stroke-width="3" fill="none"><path d="M870 150Q910 300 900 470M1350 150Q1310 300 1320 470"/></g>';
  c += '<path d="M1110 100L980 470H1240z" fill="#f4e0a0" fill-opacity=".34"/><path d="M1110 170l22 52 56 4-43 36 14 55-49-30-49 30 14-55-43-36 56-4z" fill="#c9962f" fill-opacity=".7"/></g>';
  c += '<g fill="#3a1520" fill-opacity=".2"><circle cx="300" cy="150" r="26"/><rect x="290" y="170" width="20" height="40"/><path d="M270 150L180 290M330 150L420 290" stroke="#3a1520" stroke-opacity=".2" stroke-width="3"/></g>';
  c += '<path d="M300 176L170 480H430z" fill="#f4e0a0" fill-opacity=".2"/>';
  c += `<g fill="#3a1520" fill-opacity=".05">${nuage(640, 140, 1.4)}</g>`;
  c += sol("#3a1520", "#8a1f2f");
  let k = "";
  for (let x = -20; x < 1620; x += 60) k += `M${x} 810h40v30h-40z`;
  c += `<path d="${k}" stroke="#3a1520" stroke-opacity=".24" stroke-width="3" fill="none"/><g fill="#3a1520" fill-opacity=".1">${Array.from({ length: 27 }, (_, i) => `<rect x="${-10 + i * 60}" y="818" width="20" height="14"/>`).join("")}</g>`;
  ecrire("spectacle-scene.svg", svg(1600, 900, monter(c)));
  tuile("spectacle", 160, '<path d="M80 40l5 11h12l-10 8 4 12-11-7-11 7 4-12-10-8h12z" fill="#c9962f" fill-opacity=".12"/><g fill="#8a1f2f" fill-opacity=".06"><circle cx="30" cy="120" r="6"/><circle cx="130" cy="130" r="6"/></g>', 18, "#3a1520");
}

// Politique : parlement à coupole, urne et bulletin, drapeaux.
{
  let c = ciel("#7a8ab0", "#f4e4a8", 420, 230, 260, 0.35);
  c += '<g fill="#1f2a44" fill-opacity=".32"><rect x="860" y="360" width="500" height="110"/><path d="M850 360L1110 300L1370 360z"/><rect x="1020" y="250" width="180" height="60"/><path d="M1020 250Q1110 120 1200 250z"/></g>';
  c += '<g fill="#f4ede2" fill-opacity=".55">' + Array.from({ length: 9 }, (_, i) => `<rect x="${880 + i * 54}" y="372" width="18" height="90"/>`).join("") + '</g>';
  // urne et bulletin
  c += '<g fill="#1f2a44" fill-opacity=".24"><rect x="300" y="380" width="170" height="100" rx="6"/></g><rect x="350" y="396" width="70" height="10" rx="5" fill="#f4ede2" fill-opacity=".7"/><g transform="translate(360 300) rotate(-8)"><rect width="56" height="76" rx="3" fill="#f4ede2" fill-opacity=".8" stroke="#1f2a44" stroke-opacity=".3" stroke-width="3"/><path d="M12 24l12 12 20-26" stroke="#2f4a9a" stroke-opacity=".5" stroke-width="6" fill="none"/></g>';
  c += '<g stroke="#1f2a44" stroke-opacity=".2" stroke-width="4"><path d="M560 480V320M620 480V300"/></g><g fill-opacity=".34"><path d="M560 320l46 10-46 12z" fill="#2f4a9a"/><path d="M620 300l46 10-46 12z" fill="#b03030"/></g>';
  c += `<g fill="#1f2a44" fill-opacity=".05">${nuage(700, 130, 1.4)}${nuage(1450, 180, 1)}</g>`;
  c += sol("#1f2a44", "#2f4a9a");
  ecrire("politique-scene.svg", svg(1600, 900, monter(c)));
  tuile("politique", 160, '<g stroke="#1f2a44" stroke-opacity=".07" stroke-width="1.4" fill="none"><rect x="50" y="50" width="60" height="60" rx="4"/><path d="M62 82l12 12 24-30"/></g>', 18, "#1f2a44");
}
