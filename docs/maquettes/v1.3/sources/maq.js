// Petite frise de maquette : x(année) en pixels, sur la largeur de l'élément .frise
function x(an, f) { const w = f.clientWidth, g = 40, d = w - 2 * g; return g + (an - f.dataset.min) / (f.dataset.max - f.dataset.min) * d; }
function dessinerFrise(f, pas) {
  const min = +f.dataset.min, max = +f.dataset.max, yAxe = +f.dataset.axe;
  const coupe = 1789;
  f.insertAdjacentHTML("beforeend",
    `<div class="bande" style="top:${yAxe - 30}px"><div style="width:${x(coupe, f)}px;background:var(--e-mod)">TEMPS MODERNES</div><div style="flex:1;background:var(--e-cont)">ÉPOQUE CONTEMPORAINE</div></div>` +
    `<div class="axe" style="top:${yAxe}px"></div>`);
  for (let a = Math.ceil(min / pas) * pas; a <= max; a += pas)
    f.insertAdjacentHTML("beforeend", `<span class="grad date" style="left:${x(a, f)}px;top:${yAxe + 18}px">${a}</span>`);
}
