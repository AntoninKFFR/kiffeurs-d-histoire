// Génère uniquement des fichiers relisibles. Aucune connexion à Supabase.
import { readFileSync, writeFileSync } from "node:fs";
import manifeste from "../content/sport/packs-proposes.json";

const migration = process.argv[2];
if (!/^supabase\/migrations\/\d{14}_pack_sport\.sql$/.test(migration ?? "")) throw new Error("Indiquer le fichier créé par npm run db:new -- pack_sport");
const version = migration.match(/\d{14}/)![0];
const sql = (v: unknown): string => v == null ? "null" : typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`;
const packs = manifeste.packs.map((p) => `    (${[p.id, p.slug, p.title, p.description, p.comptes.total, p.parent_id, p.position].map(sql).join(",")})`).join(",\n");
const associations = manifeste.associations.map((a) => `    (${[a.event_id, a.sous_pack, a.position].map(sql).join(",")})`).join(",\n");
writeFileSync(migration, `-- #90 : données PROVISOIRES, NON APPLIQUÉES. GO SQL séparé après revue et CI.
-- Généré par scripts/preparer-sport.ts depuis le manifeste audité du 11/10/2026.
-- Aucune modification d’événement, réponse, niveau, retrait ou ancien pack.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- Empêcher un import concurrent de faire varier le prérequis pendant l’insertion.
lock table histoire.events, histoire.event_answers, histoire.pack_events in share row exclusive mode;
do $$
declare
  contenu jsonb := (
    select jsonb_agg(jsonb_build_object('event_id',event_id,'sous_pack',sous_pack,'position',position))
    from (values
${associations}
    ) v(event_id,sous_pack,position)
  );
  presents integer;
begin
  select count(*) into presents from jsonb_to_recordset(contenu) as v(event_id text)
    join histoire.events e on e.id=v.event_id;
  -- Une pile locale vide applique les migrations AVANT l’import : rien à installer.
  -- Après l’import, e2e/preparer.ts rejoue ce fichier. Un corpus partiel est refusé.
  if presents not in (0,397) then
    raise exception 'Pack Sport : % événements présents sur 397. Vérifier le corpus avant application.', presents;
  end if;
  if presents=0 then
    raise notice 'Sport sans données : importer le dataset local puis rejouer la migration de données';
    return;
  end if;
  if exists (select 1 from jsonb_to_recordset(contenu) as v(event_id text)
    join histoire.events e on e.id=v.event_id
    left join histoire.event_answers a on a.event_id=e.id
    where not e.playable or e.playable_mode not in ('YEAR','MONTH','DAY','RANGE') or a.start_year is null) then
    raise exception 'Pack Sport : un événement du manifeste n’est plus jouable. Relire le périmètre avant application.';
  end if;
  if exists (select 1 from histoire.packs where id between 'COL-0105' and 'COL-0111'
    and slug not in ('sport','sport-football','sport-tennis','sport-jeux-olympiques','sport-cyclisme','sport-mecanique','sport-autres-exploits')) then
    raise exception 'Identifiants Sport déjà occupés : arrêter et choisir de nouveaux identifiants';
  end if;
  insert into histoire.packs(id,slug,title,description,target_size,parent_id,position) values
${packs}
  on conflict (id) do nothing;
  insert into histoire.pack_events(pack_id,event_id,position)
    select p.pack_id,v.event_id,v.position
    from jsonb_to_recordset(contenu) as v(event_id text,sous_pack text,position integer)
    join histoire.events e on e.id=v.event_id
    cross join lateral (values ('COL-0105'),(v.sous_pack)) p(pack_id)
    on conflict (pack_id,event_id) do nothing;
  insert into histoire.migrations_appliquees(version,nom) values (${sql(version)},'pack_sport')
    on conflict (version) do nothing;
end $$;
notify pgrst, 'reload schema';
commit;
`);

// Fixture de vrais événements existants pour le simulateur SQL vide ; jamais KFFR.
type Evenement = Record<string, unknown>;
const evenements = (JSON.parse(readFileSync("content/sport/audit-base-2026-10-11.json", "utf8")) as { events: Evenement[] }).events;
const colonnes = ["id", "title", "event_type", "precision", "date_status", "playable_mode", "importance", "difficulty", "niveau", "source_status"];
const reponses = ["id", "start_year", "start_month", "start_day", "end_year", "end_month", "end_day", "date_text"];
writeFileSync("supabase/fixtures/sport_397.sql", `-- #90 : vrais événements du relevé ; simulateur SQL LOCAL vide uniquement.
-- Pas dans le seed et jamais exécuté sur KFFR. Niveaux et réponses actuels, pas les propositions.
insert into histoire.events(${colonnes.join(",")},playable) values
${evenements.map((e) => `  (${colonnes.map((c) => sql(e[c])).join(",")},true)`).join(",\n")}
on conflict (id) do nothing;
insert into histoire.event_answers(event_id,${reponses.slice(1).join(",")}) values
${evenements.map((e) => `  (${reponses.map((c) => sql(e[c])).join(",")})`).join(",\n")}
on conflict (event_id) do nothing;
`);
console.log(`${migration} et fixture locale générés : 7 packs, 794 associations, aucun événement nouveau.`);
