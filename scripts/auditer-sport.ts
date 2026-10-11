// Audit reproductible du relevé en lecture seule ; aucune connexion ni écriture en base.
import { readFileSync, writeFileSync } from "node:fs";
import { lireCsv } from "./csv";

type Evenement = {
  id: string; title: string; niveau: number; precision: string; date_status: string;
  source_status: string; event_type: string; playable_mode: string; difficulty: number;
  importance: number; date_text: string; start_year: number; start_month: number | null;
  start_day: number | null; end_year: number | null; end_month: number | null; end_day: number | null;
  tags: { id: string; name: string; type: string }[]; editorial_override: unknown;
};
const dossier = "content/dataset-v18";
const csv = (nom: string) => lireCsv(`${dossier}/kiffeurs-${nom}-v18.csv`);
const audit = JSON.parse(readFileSync("content/sport/audit-base-2026-10-11.json", "utf8")) as { events: Evenement[] };
const evenements = audit.events;
const sources = new Map(csv("sources").map((s) => [s.source_id, s]));
const liens = csv("event-sources");
const dataset = new Map(csv("events").map((e) => [e.event_id, e]));
const niveaux = new Map(lireCsv("content/niveaux-evenements.csv").map((e) => [e.event_id, Number(e.niveau)]));
const categories = [
  { id: "COL-0106", slug: "sport-football", title: "Football", description: "Coupes du monde, championnats d’Europe et grandes victoires du football.", justification: "Regrouper les compétitions et leurs finales ; éviter un second sous-pack Coupe du monde redondant." },
  { id: "COL-0107", slug: "sport-tennis", title: "Tennis", description: "Les débuts du tennis et les éditions de Wimbledon présentes dans le corpus.", justification: "Le corpus est centré sur Wimbledon ; les autres tournois restent des compléments proposés." },
  { id: "COL-0108", slug: "sport-jeux-olympiques", title: "Jeux olympiques", description: "Jeux antiques, Jeux modernes d’été et d’hiver, performances et événements marquants.", justification: "Réunir été et hiver évite de fragmenter les niveaux accessibles." },
  { id: "COL-0109", slug: "sport-cyclisme", title: "Cyclisme / Tour de France", description: "Le premier départ et les éditions du Tour de France présentes dans le corpus.", justification: "Une discipline autonome, sans prétendre couvrir toutes les courses cyclistes." },
  { id: "COL-0110", slug: "sport-mecanique", title: "Sports mécaniques", description: "La saison inaugurale et les saisons de Formule 1 présentes dans le corpus.", justification: "Le corpus actuel concerne uniquement la F1 ; Le Mans et le rallye seraient des compléments." },
  { id: "COL-0111", slug: "sport-autres-exploits", title: "Autres sports et exploits", description: "Coupes du monde de rugby, Super Bowls, basket-ball, athlétisme, alpinisme et échecs.", justification: "Éviter un groupe Records de quatre questions et garder une entrée pour les disciplines moins représentées. Rugby autonome à discuter avec Max." },
];
function categorie(e: Evenement) {
  const tags = new Set(e.tags.map((t) => t.id));
  if (tags.has("TAG-0271") || tags.has("TAG-0272") || /football/i.test(e.title)) return categories[0];
  if (tags.has("TAG-0286") || /Wimbledon/.test(e.title)) return categories[1];
  if (tags.has("TAG-0269") || tags.has("TAG-0270") || /olympiques?|Fosbury/i.test(e.title)) return categories[2];
  if (tags.has("TAG-0278") || /Tour de France/.test(e.title)) return categories[3];
  if (tags.has("TAG-0277")) return categories[4];
  if (tags.has("TAG-0273") || tags.has("TAG-0285") || ["EVT-0772", "EVT-0872", "EVT-0952", "EVT-0966"].includes(e.id)) return categories[5];
  throw new Error(`Événement non classé : ${e.id}`);
}
const niveauPropose = new Map([
  ["EVT-0952", "Premier mile sous quatre minutes : jalon iconique de l’athlétisme, année 1954 mémorisable ; le jour reste difficile."],
  ["EVT-0954", "Premier titre mondial de Pelé à 17 ans : repère célèbre de 1958 ; ne pas abaisser l’édition générique parallèle."],
  ["EVT-0965", "Troisième titre brésilien et conservation du trophée Jules-Rimet en 1970 : repère majeur."],
  ["EVT-0966", "Match Fischer–Spassky en 1972, repère culturel de la guerre froide ; titre et date actuels conservés."],
  ["EVT-1303", "Naissance du championnat mondial F1 en 1950, repère fondateur ; les autres numéros de saison restent Expert."],
  ["EVT-1444", "Fosbury et sa technique aux JO de Mexico en 1968 : performance emblématique ; jour plus exigeant."],
  ["EVT-1768", "Sydney 2000 : année millénaire et ville hôte largement identifiables ; alignement proposé avec les autres ouvertures modernes."],
]);
const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
function ecrireCsv(nom: string, lignes: Record<string, unknown>[]) {
  const entetes = Object.keys(lignes[0]);
  writeFileSync(nom, [entetes.join(","), ...lignes.map((r) => entetes.map((h) => escape(r[h])).join(","))].join("\n") + "\n");
}
const inventaire = evenements.map((e) => {
  const references = liens.filter((l) => l.event_id === e.id).map((l) => ({ lien: l, source: sources.get(l.source_id) }));
  if (!references.length || references.some((r) => !r.source)) throw new Error(`Source absente : ${e.id}`);
  const d = dataset.get(e.id);
  if (!d || Number(d.start_year) !== e.start_year || niveaux.get(e.id) !== e.niveau) throw new Error(`Écart année/niveau : ${e.id}`);
  const alertes: string[] = [];
  if (e.tags.some((t) => t.type === "SERIES" && /olympiques|Coupe|Formule|Tour de France|Wimbledon|Super Bowl|Championnat d’Europe/i.test(t.name))) alertes.push("Édition/saison générique : pas une finale ni un record ; série non exhaustive");
  if (references.some((r) => r.source?.domain.includes("wikipedia"))) alertes.push("Source secondaire existante ; QA ciblée V19 à poursuivre");
  if (e.date_status !== "EXACT") alertes.push(`Date ${e.date_status} : conserver le qualificatif`);
  if (Number(d.start_month || 0) !== (e.start_month ?? 0) || Number(d.start_day || 0) !== (e.start_day ?? 0)) alertes.push("Date base différente du CSV : correction globale existante à conserver");
  if (["EVT-0872", "EVT-0966", "EVT-0902"].includes(e.id)) alertes.push("Périmètre Sport à valider : alpinisme, échecs ou tragédie olympique");
  if (e.id === "EVT-1997" || e.id === "EVT-1996") alertes.push("Nom d’édition 2020, tenu en 2021 : année jouable 2021 conservée");
  const statutTag = e.tags.filter((t) => t.type === "DATE_STATUS").map((t) => t.name);
  if (statutTag.length && !statutTag.includes(e.date_status)) alertes.push("Tag de statut différent du statut courant : métadonnée d’import à relire, réponse inchangée");
  return { event_id: e.id, titre: e.title, date: e.date_text, niveau: e.niveau,
    sport: e.tags.some((t) => t.id === "TAG-0273") ? "Rugby" : e.tags.some((t) => t.id === "TAG-0285") ? "Football américain"
      : ({ "EVT-0772":"Basket-ball", "EVT-0872":"Alpinisme", "EVT-0952":"Athlétisme", "EVT-0966":"Échecs", "EVT-1444":"Athlétisme (JO)" } as Record<string,string>)[e.id]
        ?? ({ "COL-0108":"Olympisme", "COL-0109":"Cyclisme", "COL-0110":"Formule 1" } as Record<string,string>)[categorie(e).id] ?? categorie(e).title,
    tags: e.tags.map((t) => `${t.id}:${t.name}`).join(" | "),
    sources_existantes: references.map((r) => `${r.lien.source_id}:${r.source!.url} (${r.lien.source_role}, ${r.source!.authority_tier})`).join(" | "),
    precisions_jouables: ["YEAR", ...(e.start_month ? ["MONTH"] : []), ...(e.start_month && e.start_day ? ["DAY"] : [])].join(";"),
    sous_pack: categorie(e).id, alertes: alertes.join(" | "), surcharge_editoriale: JSON.stringify(e.editorial_override) };
});
if (evenements.length !== 397 || new Set(evenements.map((e) => e.id)).size !== 397) throw new Error("Le relevé doit contenir exactement 397 événements uniques");
const comptes = (liste: Evenement[], propose = false) => ({
  total: liste.length, niveaux: [1, 2, 3].map((n) => liste.filter((e) => (propose && niveauPropose.has(e.id) ? 2 : e.niveau) === n).length),
  precisions: [liste.length, liste.filter((e) => e.start_month).length, liste.filter((e) => e.start_month && e.start_day).length],
  inverse: ["YEAR", "MONTH", "DAY"].map((p) => new Set(liste.filter((e) => p === "YEAR" || (e.start_month && (p !== "DAY" || e.start_day))).map((e) => [e.start_year, ...(p !== "YEAR" ? [e.start_month] : []), ...(p === "DAY" ? [e.start_day] : [])].join("-"))).size),
});
const packs = [{ id: "COL-0105", slug: "sport", title: "Sport", description: "397 dates du sport : football, tennis, Jeux olympiques, cyclisme, sports mécaniques et autres exploits.", parent_id: null, position: 25 },
  ...categories.map((c, i) => ({ ...c, parent_id: "COL-0105", position: 26 + i }))].map((p) => {
    const liste = evenements.filter((e) => p.id === "COL-0105" || categorie(e).id === p.id);
    return { ...p, comptes: comptes(liste), proposes: comptes(liste, true) };
  });
const manifeste = { statut: "PROVISOIRE_A_VALIDER_PAR_MAX", tag: "TAG-0145", releve: "2026-10-11", packs,
  associations: evenements.map((e, i) => ({ event_id: e.id, sous_pack: categorie(e).id, position: i + 1 })) };
ecrireCsv("content/sport/inventaire-397.csv", inventaire);
ecrireCsv("content/sport/niveaux-proposes.csv", evenements.filter((e) => niveauPropose.has(e.id)).map((e) => ({ event_id: e.id, titre: e.title, avant: e.niveau, apres: 2, justification: niveauPropose.get(e.id), statut: "PROPOSE_NON_APPLIQUE" })));
const { associations, ...metadonnees } = manifeste;
// Une association par ligne : les 397 choix éditoriaux restent faciles à relire dans le diff.
writeFileSync("content/sport/packs-proposes.json", JSON.stringify(metadonnees, null, 2).slice(0,-2)
  + `,\n  "associations": [\n${associations.map((a) => `    ${JSON.stringify(a)}`).join(",\n")}\n  ]\n}\n`);
const lignes = packs.map((p) => `| ${p.title} | ${p.comptes.total} | ${p.comptes.niveaux.join(" / ")} | ${p.comptes.precisions.join(" / ")} | ${p.comptes.inverse.join(" / ")} | ${p.proposes.niveaux.join(" / ")} |`).join("\n");
writeFileSync("content/sport/effectifs.md", `<!-- Généré par npx tsx scripts/auditer-sport.ts -->\n| Pack provisoire | Total | D / I / E actuels | Année / Mois / Jour | Inverse A / M / J | D / I / E proposés |\n| --- | ---: | --- | --- | --- | --- |\n${lignes}\n\nNiveaux exclusifs ; Intermédiaire jouable = D + I. Précisions cumulatives, non exclusives. Inverse : dates distinctes, avant filtrage par niveau. Propositions non appliquées.\n`);
console.table(packs.map((p) => ({ pack: p.title, ...p.comptes })));
