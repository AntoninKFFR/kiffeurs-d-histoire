// Régénère les SVG d'habillage de la frise (public/habillages/) : `node scripts/generer-habillages.mjs public/habillages`.
// Déterministe : même résultat à chaque lancement. Les couleurs et opacités de trame sont vérifiées par tests/habillages.test.tsx.
import { writeFileSync } from "node:fs";
const sortie = process.argv[2] ?? "public/habillages";
let graine = 7;
const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
const r1 = (n) => Math.round(n * 10) / 10;
const svg = (l, h, corps) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${h}" width="${l}" height="${h}">${corps}</svg>\n`;
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
// Tranchées : parapet de sacs de sable, barbelés, arbres brisés (silhouettes, bas aligné)
{
  let c = '<g fill="#3a2d1f">';
  // arbres brisés, loin
  c += '<g opacity=".16"><path d="M70 74V30l-5-12 8 6 3-14 3 16 9-8-6 14 2 42zM330 74V40l-8-10 9 4 2-16 4 18 8-6-5 12 1 32z"/></g>';
  // piquets et barbelés
  c += '<g opacity=".34">';
  for (const x of [40, 140, 240, 340, 440]) c += `<path d="M${x - 2} 86V50l2-4 2 4v36z"/>`;
  let fil = "M0 62";
  for (let x = 0; x < 480; x += 12) fil += `q3 -9 6 0t6 0`;
  c += `<path d="${fil}" stroke="#3a2d1f" stroke-width="1.2" fill="none"/>`;
  let fil2 = "M0 74";
  for (let x = 0; x < 480; x += 16) fil2 += `q4 8 8 0t8 0`;
  c += `<path d="${fil2}" stroke="#3a2d1f" stroke-width="1.2" fill="none"/>`;
  c += '</g>';
  // sacs de sable
  c += '<g opacity=".42">';
  for (let ligne = 0; ligne < 2; ligne++) {
    const y = 78 + ligne * 14, decal = ligne ? 12 : 0;
    for (let x = -12 + decal; x < 480; x += 24) c += `<rect x="${x}" y="${y}" width="22" height="13" rx="6"/>`;
  }
  c += '<rect x="0" y="104" width="480" height="6"/></g>';
  c += '</g>';
  ecrire("tranchees-horizon.svg", svg(480, 110, c));
}
// ---------- Antiquité : mosaïque et colonnade ----------
{
  const teintes = ["#a4552f", "#c98a3c", "#7d8f86", "#e9d8a6", "#8a6a3a", "#b86f45"];
  let c = "";
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const t = teintes[Math.floor(alea() * teintes.length)];
    c += `<rect x="${i * 12 + 1}" y="${j * 12 + 1}" width="10" height="10" fill="${t}" fill-opacity="${r1(0.05 + alea() * 0.08)}"/>`;
  }
  ecrire("mosaique-fond.svg", svg(96, 96, c));
}
{
  let c = '<g fill="#6e4328" opacity=".3">';
  // entablement
  c += '<rect x="0" y="14" width="400" height="8"/><rect x="0" y="24" width="400" height="14"/>';
  for (let x = 6; x < 400; x += 20) c += `<rect x="${x}" y="26" width="8" height="10" fill="#f4ead0" fill-opacity=".5"/>`;
  // colonnes
  for (const x of [40, 120, 200, 280, 360]) {
    c += `<rect x="${x - 15}" y="38" width="30" height="6"/><rect x="${x - 10}" y="44" width="20" height="46"/><rect x="${x - 14}" y="90" width="28" height="6"/>`;
    c += `<path d="M${x - 5} 46V90M${x} 46V90M${x + 5} 46V90" stroke="#f4ead0" stroke-opacity=".45" stroke-width="1.2" fill="none"/>`;
  }
  c += '</g>';
  // grecque : suite de crochets
  let k = "";
  for (let x = 0; x < 400; x += 20) k += `M${x} 108V100H${x + 14}V106H${x + 6}V103`;
  c += `<path d="${k}" stroke="#6e4328" stroke-opacity=".34" stroke-width="1.5" fill="none"/>`;
  ecrire("mosaique-horizon.svg", svg(400, 110, c));
}
// ---------- Conquête spatiale : ciel étoilé et horizon lunaire ----------
{
  let c = "";
  for (let i = 0; i < 70; i++) {
    const x = r1(alea() * 400), y = r1(alea() * 400), r = r1(0.5 + alea() * alea() * 1.6), o = r1(0.3 + alea() * 0.6);
    c += `<circle cx="${x}" cy="${y}" r="${r}" fill="#f2efe2" fill-opacity="${o}"/>`;
  }
  for (const [x, y] of [[90, 120], [310, 60], [220, 300], [40, 340]]) c += `<path d="M${x} ${y - 6}l1.3 4.7 4.7 1.3-4.7 1.3-1.3 4.7-1.3-4.7-4.7-1.3 4.7-1.3z" fill="#f2efe2" fill-opacity=".85"/>`;
  ecrire("espace-fond.svg", svg(400, 400, c));
}
{
  const pts = [[0, 96], [40, 90], [90, 94], [150, 82], [200, 88], [260, 80], [330, 90], [400, 84], [470, 92], [540, 86], [600, 96]];
  const crete = "M" + pts.map(([x, y]) => `${x} ${y}`).join("L") + "V110H0z";
  let c = `<circle cx="470" cy="38" r="15" fill="#2b4a7a" fill-opacity=".75"/><ellipse cx="470" cy="38" rx="26" ry="5" fill="none" stroke="#9db4d8" stroke-opacity=".5" stroke-width="1.5" transform="rotate(-18 470 38)"/>`;
  c += `<path d="${crete}" fill="#050a18" fill-opacity=".9"/>`;
  c += '<g fill="none" stroke="#9db4d8" stroke-opacity=".28" stroke-width="1"><ellipse cx="120" cy="102" rx="26" ry="3"/><ellipse cx="300" cy="104" rx="38" ry="3.5"/><ellipse cx="520" cy="103" rx="20" ry="2.5"/></g>';
  ecrire("espace-horizon.svg", svg(600, 110, c));
}

// ---------- Petits détails posés sur l'axe, aux graduations majeures (18×24) ----------
ecrire("tranchees-detail.svg", svg(18, 24,
  '<rect x="8" y="7" width="2" height="17" fill="#3a2d1f"/><path d="M1 12l2-3 2 3 2-3 2 3 2-3 2 3 2-3 1 2M1 18l2 3 2-3 2 3 2-3 2 3 2-3 2 3 1-2" stroke="#3a2d1f" stroke-width="1" fill="none"/>'
  + '<circle cx="9" cy="4" r="3" fill="#8a2f2b"/><circle cx="9" cy="4" r="1" fill="#2a1d14"/>'));
ecrire("mosaique-detail.svg", svg(18, 24,
  '<g fill="#6e4328"><rect x="2" y="2" width="14" height="3"/><rect x="3" y="5" width="12" height="2"/><rect x="5" y="7" width="8" height="13"/><rect x="2" y="20" width="14" height="3"/></g>'
  + '<path d="M7.5 8v11M10.5 8v11" stroke="#f4ead0" stroke-opacity=".6" stroke-width="1"/>'));
ecrire("espace-detail.svg", svg(18, 24,
  '<path d="M9 5l1.8 6.2L17 13l-6.2 1.8L9 21l-1.8-6.2L1 13l6.2-1.8z" fill="#f2efe2"/><circle cx="9" cy="13" r="7" fill="#f2efe2" fill-opacity=".12"/>'));
