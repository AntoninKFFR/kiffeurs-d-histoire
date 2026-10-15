// Charge (ou recharge) un dataset d'Antonin dans le schéma `histoire`.
// Usage : npm run content:import -- --dossier content/dataset-v18
// Connexion : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, lus dans l'environnement ou dans .env.local.
// Idempotent : relancer l'import met à jour les lignes existantes sans créer de doublon.

import { readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { lireCsv } from "./csv";
import { estUrlLocale, FICHIER_CARTES, importerCartesLocales, validerCartes } from "./import-cartes";
import { fusionnerDescriptions } from "./import-descriptions";
import { verifierCollectionsSport } from "./import-sport";
import { verifierReservationsFun } from "./import-fun";
import { chargerStructure } from "./structure-pedagogique";

type Ligne = Record<string, string>;

// ---------------------------------------------------------------------------
// Lecture des CSV (UTF-8 avec BOM, guillemets doubles, retours à la ligne possibles dans une cellule)
// ---------------------------------------------------------------------------

function trouverFichier(dossier: string, nom: string): string {
  // kiffeurs-events-v18.csv, kiffeurs-events-v19.csv… : on accepte n'importe quelle version.
  const motif = new RegExp(`^kiffeurs-${nom}-v\\d+\\.csv$`);
  const fichier = readdirSync(dossier).find((f) => motif.test(f));
  if (!fichier) throw new Error(`Fichier kiffeurs-${nom}-vXX.csv introuvable dans ${dossier}`);
  return path.join(dossier, fichier);
}

const FICHIER_NIVEAUX = "content/niveaux-evenements.csv";

const texteOuNull = (v: string | undefined) => (v ? v : null);
const entierOuNull = (v: string | undefined) => (v ? Number.parseInt(v, 10) : null);
const liste = (v: string | undefined) =>
  [...new Set((v ?? "").split(";").map((s) => s.trim()).filter(Boolean))];

// ---------------------------------------------------------------------------
// Accès à la base
// ---------------------------------------------------------------------------

function lireArguments() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--dossier");
  const dossier = i >= 0 ? args[i + 1] : undefined;
  if (!dossier) {
    throw new Error("Préciser le dossier du dataset : npm run content:import -- --dossier content/dataset-v18");
  }
  return { dossier };
}

function connecter() {
  const url = process.env.SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    throw new Error(
      "Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquantes (à mettre dans .env.local, jamais dans Git).",
    );
  }
  return createClient(url, cle, { db: { schema: "histoire" }, auth: { persistSession: false } });
}

type Client = ReturnType<typeof connecter>;

const TAILLE_LOT = 500;

async function toutLire(db: Client, table: string, colonnes: string, tri: string[]): Promise<Ligne[]> {
  const resultat: Ligne[] = [];
  for (let debut = 0; ; debut += 1000) {
    let requete = db.from(table).select(colonnes);
    for (const t of tri) requete = requete.order(t);
    const { data, error } = await requete.range(debut, debut + 999);
    if (error) throw new Error(`Lecture de ${table} : ${error.message}`);
    const page = (data ?? []) as unknown as Ligne[];
    resultat.push(...page);
    if (page.length < 1000) return resultat;
  }
}

async function upsert(db: Client, table: string, lignes: object[], conflit: string) {
  for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
    const { error } = await db.from(table).upsert(lignes.slice(i, i + TAILLE_LOT), { onConflict: conflit });
    if (error) throw new Error(`Écriture dans ${table} : ${error.message}`);
  }
}

// Remplace les liens d'un ensemble de « propriétaires » (événements ou packs) par ceux du dataset :
// ajoute les nouveaux, met à jour les existants, retire ceux qui ont disparu du dataset.
// Les propriétaires absents du dataset (un autre pack ajouté plus tard, par exemple) ne sont pas touchés.
async function synchroniserLiens(
  db: Client,
  table: string,
  cleProprietaire: string,
  cleLien: string,
  proprietaires: Set<string>,
  lignes: Ligne[] | object[],
  colonnesLues: string,
) {
  const existants = await toutLire(db, table, colonnesLues, [cleProprietaire, cleLien]);
  const cle = (l: Record<string, unknown>) => `${l[cleProprietaire]}\u0000${l[cleLien]}`;
  const nouvelles = new Set((lignes as Record<string, unknown>[]).map(cle));
  const deja = new Set(existants.map(cle));
  const aRetirer = existants.filter((l) => proprietaires.has(l[cleProprietaire]) && !nouvelles.has(cle(l)));

  await upsert(db, table, lignes as object[], `${cleProprietaire},${cleLien}`);

  const parProprietaire = new Map<string, string[]>();
  for (const l of aRetirer) {
    parProprietaire.set(l[cleProprietaire], [...(parProprietaire.get(l[cleProprietaire]) ?? []), l[cleLien]]);
  }
  for (const [proprietaire, liens] of parProprietaire) {
    const { error } = await db.from(table).delete().eq(cleProprietaire, proprietaire).in(cleLien, liens);
    if (error) throw new Error(`Nettoyage de ${table} : ${error.message}`);
  }

  const crees = (lignes as Record<string, unknown>[]).filter((l) => !deja.has(cle(l))).length;
  return { crees, misAJour: lignes.length - crees, retires: aRetirer.length };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

type Bilan = { element: string; crees: number; misAJour: number; retires?: number; ignores?: number; note?: string };

async function importer() {
  const { dossier } = lireArguments();
  const db = connecter();
  const structure = chargerStructure();
  // Préflight avant le premier upsert : la migration préparée doit être installée.
  // Cette phase n'exécute ce chemin que sur ses fixtures locales.
  const { data: unitesExistantes,error: erreurStructure } = await db.from("pedagogical_units").select("chapter_id").limit(1);
  if (erreurStructure) throw new Error("Migration de préparation pédagogique absente : import arrêté avant écriture");
  if (!unitesExistantes?.length) {
    const {count,error} = await db.from("chapter_cards").select("card_id",{count:"exact",head:true});
    if (error) throw new Error("Préflight des cartes historiques indisponible");
    if (count) {
      // Une base déjà remplie est figée AVANT le premier upsert. L'amorçage
      // vide en fixture ne l'est qu'après import complet des 41 chapitres.
      const {error: erreurGel} = await db.rpc("register_pedagogical_structure",{
        p_units:[...structure.chapitres_historiques,...structure.sous_chapitres],
      });
      if (erreurGel) throw new Error("Historique existant incompatible : import arrêté avant écriture");
    }
  }
  const bilan: Bilan[] = [];
  const csv = (nom: string) => lireCsv(trouverFichier(dossier, nom));

  let evenements = csv("events");
  const themes = csv("themes");
  const liensProgramme = csv("curriculum-links");
  const packs = csv("ready-collections");
  verifierReservationsFun(packs.map(p => ({ collection_id: p.collection_id, slug: p.slug })),
    evenements.map(e => ({ event_id: e.event_id })));
  verifierCollectionsSport(packs.map((p) => ({ collection_id: p.collection_id, slug: p.slug })));
  const packEvenements = csv("ready-collection-events");
  const tags = csv("tags");
  const evenementTags = csv("event-tags");
  // Niveau (1 Débutant, 2 Intermédiaire, 3 Expert) et titre affiché pendant la question, tenus à part du dataset.
  const reglagesEv = new Map(lireCsv(FICHIER_NIVEAUX).map((r) => [r.event_id, r]));
  // Pilote en attente de relecture : jamais envoyé à une base distante.
  // Tout valider avant le premier upsert du dataset.
  const cartes = estUrlLocale(process.env.SUPABASE_URL!) && path.basename(path.resolve(dossier)) === "dataset-v18"
    ? validerCartes(lireCsv(FICHIER_CARTES), evenements, themes, liensProgramme,structure) : null;
  // Fichier facultatif : les brouillons sont testables uniquement en local.
  const fichierDescriptions = readdirSync(dossier).find((f) => /^kiffeurs-description-additions-v\d+\.csv$/.test(f));
  const propositionsDescriptions = fichierDescriptions ? lireCsv(path.join(dossier, fichierDescriptions)) : [];
  const reponsesExistantes = await toutLire(db, "event_answers", "event_id, description", ["event_id"]);
  const fusion = fusionnerDescriptions(evenements, propositionsDescriptions,
    new Map(reponsesExistantes.map((r) => [r.event_id, r.description])), process.env.SUPABASE_URL!);
  evenements = fusion.evenements;
  console.log("Descriptions :", fusion.bilan,
    fusion.local ? "Propositions non validées autorisées sur la pile locale." : "Seules les propositions VALIDE sont autorisées à distance.");
  let redirections: Ligne[] = [];
  try {
    redirections = csv("event-redirects");
  } catch {
    // Fichier facultatif.
  }

  // Variantes de titres ajoutées en plus des alias d'Antonin (issue 1.3), sans toucher à ses fichiers.
  let ajoutsAlias: Ligne[] = [];
  try {
    ajoutsAlias = csv("alias-additions");
  } catch {
    // Fichier facultatif.
  }
  const aliasAjoutes = new Map(ajoutsAlias.map((l) => [l.event_id, liste(l.aliases_added)]));
  for (const e of evenements) {
    const complement = aliasAjoutes.get(e.event_id);
    if (complement) e.aliases = liste(`${e.aliases};${complement.join(";")}`).join(";");
  }

  // Anciens identifiants fusionnés par Antonin (doublons) → identifiant canonique.
  const redirection = new Map(redirections.map((r) => [r.old_event_id, r.canonical_event_id]));
  const idsEvenements = new Set(evenements.map((e) => e.event_id));
  const canonique = (id: string) => {
    const cible = redirection.get(id) ?? id;
    return idsEvenements.has(cible) ? cible : null;
  };

  // Niveaux : liste fixe créée par la migration, on retrouve leur identifiant par leur libellé.
  const niveaux = await toutLire(db, "levels", "id, name", ["id"]);
  const niveauParNom = new Map(niveaux.map((n) => [n.name, n.id]));
  const niveauxInconnus = new Set<string>();
  const idNiveau = (nom: string) => {
    const id = niveauParNom.get(nom);
    if (!id && nom) niveauxInconnus.add(nom);
    return id ?? null;
  };

  // 1. Événements (partie publique) et réponses (partie fermée).
  const existantsEv = new Set((await toutLire(db, "events", "id", ["id"])).map((e) => e.id));
  await upsert(
    db,
    "events",
    evenements.map((e) => ({
      id: e.event_id,
      title: e.title_canonical,
      event_type: e.event_type,
      precision: e.precision,
      date_status: e.date_status,
      playable: e.playable === "TRUE",
      playable_mode: e.playable_mode,
      importance: entierOuNull(e.importance),
      difficulty: entierOuNull(e.difficulty),
      source_status: texteOuNull(e.source_status),
      niveau: entierOuNull(reglagesEv.get(e.event_id)?.niveau) ?? 3,
      titre_question: texteOuNull(reglagesEv.get(e.event_id)?.titre_question),
      updated_at: new Date().toISOString(),
    })),
    "id",
  );
  await upsert(
    db,
    "event_answers",
    evenements.map((e) => ({
      event_id: e.event_id,
      start_year: entierOuNull(e.start_year),
      start_month: entierOuNull(e.start_month),
      start_day: entierOuNull(e.start_day),
      end_year: entierOuNull(e.end_year),
      end_month: entierOuNull(e.end_month),
      end_day: entierOuNull(e.end_day),
      date_text: texteOuNull(e.date_text),
      secondary_dates: texteOuNull(e.secondary_dates),
      calendar_system: texteOuNull(e.calendar_system),
      description: texteOuNull(e.description_short),
      notes: texteOuNull(e.notes),
    })),
    "event_id",
  );
  const nonJouables = evenements.filter((e) => e.playable !== "TRUE").length;
  const evCrees = evenements.filter((e) => !existantsEv.has(e.event_id)).length;
  bilan.push({
    element: "Événements",
    crees: evCrees,
    misAJour: evenements.length - evCrees,
    note: `dont ${nonJouables} non jouables : gardés pour la frise, jamais posés en question`,
  });

  // 2. Alias (mode inversé).
  const alias = evenements.flatMap((e) => liste(e.aliases).map((a) => ({ event_id: e.event_id, alias: a })));
  bilan.push({
    element: "Alias",
    ...(await synchroniserLiens(db, "event_aliases", "event_id", "alias", idsEvenements, alias, "event_id, alias")),
  });

  // 3. Chapitres du programme.
  const existantsCh = new Set((await toutLire(db, "chapters", "id", ["id"])).map((c) => c.id));
  const chapitres = themes
    .map((t) => ({
      id: t.theme_id,
      level_id: idNiveau(t.level),
      school_year: t.school_year,
      program_scope: t.program_scope,
      title: t.theme_title,
    }))
    .filter((c) => c.level_id);
  await upsert(db, "chapters", chapitres, "id");
  const chCrees = chapitres.filter((c) => !existantsCh.has(c.id)).length;
  bilan.push({
    element: "Chapitres",
    crees: chCrees,
    misAJour: chapitres.length - chCrees,
    ignores: themes.length - chapitres.length,
  });
  const idsChapitres = new Set(chapitres.map((c) => c.id));

  // 4. Niveaux des événements (colonne levels_seen + liens du programme) et liens événement ↔ chapitre.
  const niveauxEv = new Map<string, { event_id: string; level_id: string }>();
  const ajouterNiveau = (eventId: string, nom: string) => {
    const levelId = idNiveau(nom);
    if (levelId) niveauxEv.set(`${eventId}|${levelId}`, { event_id: eventId, level_id: levelId });
  };
  for (const e of evenements) for (const n of liste(e.levels_seen)) ajouterNiveau(e.event_id, n);

  const liensChapitres = new Map<string, { event_id: string; chapter_id: string; curriculum_status: string | null }>();
  let liensIgnores = 0;
  for (const l of liensProgramme) {
    const eventId = canonique(l.event_id);
    if (!eventId) {
      liensIgnores++; // lien du programme sans événement rattaché
      continue;
    }
    if (l.level) ajouterNiveau(eventId, l.level);
    if (!l.theme_id || !idsChapitres.has(l.theme_id)) continue; // rattaché au niveau seulement
    const cle = `${eventId}|${l.theme_id}`;
    const statut = texteOuNull(l.curriculum_status);
    const deja = liensChapitres.get(cle);
    if (!deja || (!deja.curriculum_status && statut)) {
      liensChapitres.set(cle, { event_id: eventId, chapter_id: l.theme_id, curriculum_status: statut });
    }
  }
  bilan.push({
    element: "Niveaux des événements",
    ...(await synchroniserLiens(
      db, "event_levels", "event_id", "level_id", idsEvenements, [...niveauxEv.values()], "event_id, level_id",
    )),
  });
  bilan.push({
    element: "Événements ↔ chapitres",
    ...(await (async () => {
      const { error } = await db.rpc("sync_pedagogical_links", { p_links: [...liensChapitres.values()], p_event_ids: [...idsEvenements] });
      if (error) throw new Error(`Import des liens pédagogiques : ${error.message}`);
      return { crees: 0, misAJour: liensChapitres.size, retires: 0 };
    })()),
    ignores: liensIgnores,
    note: liensIgnores ? `${liensIgnores} lignes du programme sans événement` : undefined,
  });

  // 5. Packs prêts à jouer.
  const existantsPk = new Set((await toutLire(db, "packs", "id", ["id"])).map((p) => p.id));
  // parent_id est volontairement absent de cet upsert : préserver la hiérarchie
  // éditoriale en base. Les associations des packs absents du CSV restent intactes.
  await upsert(
    db,
    "packs",
    packs.map((p, i) => ({
      id: p.collection_id,
      slug: p.slug,
      title: p.title,
      description: texteOuNull(p.description),
      target_size: entierOuNull(p.target_size),
      active: p.active !== "FALSE" && p.ready_to_play !== "FALSE",
      position: i + 1,
    })),
    "id",
  );
  const pkCrees = packs.filter((p) => !existantsPk.has(p.collection_id)).length;
  bilan.push({ element: "Packs", crees: pkCrees, misAJour: packs.length - pkCrees });

  const idsPacks = new Set(packs.map((p) => p.collection_id));
  const contenuPacks = new Map<string, { pack_id: string; event_id: string; position: number }>();
  let packIgnores = 0;
  for (const r of packEvenements) {
    const eventId = canonique(r.event_id);
    if (!eventId || !idsPacks.has(r.collection_id)) {
      packIgnores++;
      continue;
    }
    const cle = `${r.collection_id}|${eventId}`;
    if (!contenuPacks.has(cle)) {
      contenuPacks.set(cle, { pack_id: r.collection_id, event_id: eventId, position: Number(r.position) });
    }
  }
  bilan.push({
    element: "Événements des packs",
    ...(await synchroniserLiens(
      db, "pack_events", "pack_id", "event_id", idsPacks, [...contenuPacks.values()], "pack_id, event_id",
    )),
    ignores: packIgnores,
  });

  // 6. Tags.
  const existantsTg = new Set((await toutLire(db, "tags", "id", ["id"])).map((t) => t.id));
  await upsert(
    db,
    "tags",
    tags.map((t) => ({
      id: t.tag_id,
      slug: t.slug,
      name: t.name,
      tag_type: t.tag_type,
      description: texteOuNull(t.description),
      active: t.active !== "FALSE",
    })),
    "id",
  );
  const tgCrees = tags.filter((t) => !existantsTg.has(t.tag_id)).length;
  bilan.push({ element: "Tags", crees: tgCrees, misAJour: tags.length - tgCrees });

  const idsTags = new Set(tags.map((t) => t.tag_id));
  const tagsEv = new Map<string, { event_id: string; tag_id: string; confidence: string }>();
  let tagIgnores = 0;
  for (const r of evenementTags) {
    const eventId = canonique(r.event_id);
    if (!eventId || !idsTags.has(r.tag_id)) {
      tagIgnores++;
      continue;
    }
    const cle = `${eventId}|${r.tag_id}`;
    if (!tagsEv.has(cle)) tagsEv.set(cle, { event_id: eventId, tag_id: r.tag_id, confidence: r.confidence || "HIGH" });
  }
  bilan.push({
    element: "Tags des événements",
    ...(await synchroniserLiens(
      db, "event_tags", "event_id", "tag_id", idsEvenements, [...tagsEv.values()], "event_id, tag_id",
    )),
    ignores: tagIgnores,
  });

  if (cartes) await importerCartesLocales(cartes, process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  else console.log("Cartes pilotes ignorées : import automatique uniquement pour le v18 en LOCAL.");
  // Enregistrer après l'import canonique complet ; aucun enfant n'est activé ni rempli.
  const { error: erreurManifeste } = await db.rpc("register_pedagogical_structure", {
    p_units: [...structure.chapitres_historiques, ...structure.sous_chapitres],
  });
  if (erreurManifeste) throw new Error(`Enregistrement de la structure pédagogique : ${erreurManifeste.message}`);

  // Résumé.
  console.log(`\nImport de ${dossier} terminé.\n`);
  console.table(
    bilan.map((b) => ({
      "Élément": b.element,
      "Créés": b.crees,
      "Mis à jour": b.misAJour,
      "Retirés": b.retires ?? 0,
      "Ignorés": b.ignores ?? 0,
    })),
  );
  for (const b of bilan) if (b.note) console.log(`- ${b.element} : ${b.note}`);
  if (niveauxInconnus.size) {
    console.log(`- Niveaux inconnus ignorés (à ajouter par une migration) : ${[...niveauxInconnus].join(", ")}`);
  }
}

importer().catch((erreur: unknown) => {
  console.error(`\nÉchec de l'import : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exit(1);
});
