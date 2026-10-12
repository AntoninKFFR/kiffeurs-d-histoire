// Régression de la migration sur le vrai import LOCAL complet. Toutes les
// variantes sont transactionnelles et annulées ; aucune connexion distante.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FICHIER = "supabase/migrations/20261007143355_corrige_somme_day_range.sql";
let cible={container:"supabase_db_kiffeurs-histoire",database:"postgres"};
const sql = (requete: string) => execFileSync("docker", ["exec", "-i", cible.container,
  "psql", "-X", "-U", "postgres", "-d",cible.database,"-v", "ON_ERROR_STOP=1", "-q", "-A", "-t"],
  { input: requete, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const EMPREINTE = `select md5(jsonb_build_object(
  'events', (select jsonb_agg(to_jsonb(e) order by id) from histoire.events e),
  'answers', (select jsonb_agg(to_jsonb(a) order by event_id) from histoire.event_answers a),
  'cards', (select jsonb_agg(to_jsonb(c) order by card_id) from histoire.chapter_cards c),
  'tags', (select jsonb_agg(to_jsonb(t) order by event_id, tag_id) from histoire.event_tags t),
  'aliases', (select jsonb_agg(to_jsonb(a) order by event_id, alias) from histoire.event_aliases a)
)::text);`;
const AVANT = `
  -- Reconstituer la fixture d'octobre antérieure à #92, dans la transaction
  -- annulée seulement. Les protections et les 18 brouillons sont restaurés par ROLLBACK.
  drop trigger if exists protected_card on histoire.chapter_cards;
  drop trigger if exists protected_chapter on histoire.chapters;
  drop trigger if exists protected_curriculum on histoire.event_chapters;
  drop table if exists histoire.learning_progress_editions;
  drop table if exists histoire.pedagogical_editions cascade;
  drop table if exists histoire.pedagogical_units;
  delete from histoire.event_chapters where chapter_id between 'THM-047' and 'THM-064';
  delete from histoire.chapters where id between 'THM-047' and 'THM-064';
  -- Reconstituer le registre à la date de cette migration, même si de nouvelles
  -- migrations existent. Ces suppressions restent dans la transaction annulée.
  delete from histoire.migrations_appliquees where version > '20261007143355';
  delete from histoire.migrations_appliquees where version='20261007143355';
  update histoire.events set event_type='POINT', precision='DAY', playable_mode='DAY' where id='EVT-0210';
  update histoire.event_answers set start_month=11, start_day=18, end_year=null, end_month=null, end_day=null where event_id='EVT-0210';
  update histoire.chapter_cards set start_month=11, start_day=18, end_year=null, end_month=null, end_day=null, date_precision='DAY' where card_id='CARD-027-somme-guerre-usure';
  update histoire.event_tags set tag_id=case tag_id when 'TAG-0067' then 'TAG-0064' when 'TAG-0069' then 'TAG-0071' end where event_id='EVT-0210' and tag_id in ('TAG-0067','TAG-0069');
`;

export function testerMigrationSommeLocale(fixture?:{container:string;database:string}) {
  if(fixture){
    assert(/^kffr-issue92-phase2(?:-[a-z0-9]+)?$/.test(fixture.container)&&/^kffr_api_[a-f0-9]+$/.test(fixture.database),"Cible de fixture inconnue");
    cible=fixture;
  }
  const migration = readFileSync(FICHIER, "utf8");
  assert.match(migration, /\nbegin;\s/);
  assert.match(migration, /\ncommit;\s*$/);
  // Même corps SQL et même transaction que le fichier revu ; seul le COMMIT
  // final est remplacé par les assertions puis ROLLBACK pour isoler les fixtures.
  const corps = migration.replace(/\nbegin;\s/, "\n").replace(/\ncommit;\s*$/, "\n");
  const empreinte = sql(EMPREINTE);
  const registre = sql("select jsonb_agg(to_jsonb(m) order by version) from histoire.migrations_appliquees m;");
  const apres = sql(`begin; ${AVANT} ${corps}
    do $$ begin
      if (select count(*) from histoire.migrations_appliquees) <> 10
        or (select count(*) from histoire.migrations_appliquees where version='20261007143355' and nom='corrige_somme_day_range') <> 1 then
        raise exception 'Registre après correction incorrect';
      end if;
    end $$;
    ${EMPREINTE} rollback;`);
  // Vérifie toutes les lignes et tous les champs des cinq tables, pas seulement
  // les nombres : la migration doit reproduire exactement l'import corrigé.
  assert.equal(apres, empreinte, "Mutation hors correction ou copie incohérente");
  assert.equal(sql(EMPREINTE), empreinte);
  assert.equal(sql("select jsonb_agg(to_jsonb(m) order by version) from histoire.migrations_appliquees m;"), registre);

  const erreurs = [
    { preparation: "", raison: /migration déjà enregistrée/ },
    { preparation: AVANT + "update histoire.event_answers set start_day=17 where event_id='EVT-0210';", raison: /réponse canonique antérieure inattendue/ },
    { preparation: AVANT + "update histoire.chapter_cards set start_day=17 where card_id='CARD-027-somme-guerre-usure';", raison: /carte dérivée antérieure inattendue/ },
    { preparation: AVANT + "delete from histoire.chapter_cards where card_id='CARD-005-rome';", raison: /attendu 2001 événements/ },
    { preparation: AVANT + "delete from histoire.migrations_appliquees where version='20261007102922';", raison: /registre Histoire antérieur inattendu/ },
    { preparation: AVANT + "update histoire.events set precision='YEAR' where id='EVT-0210';", raison: /métadonnées canoniques antérieures inattendues/ },
    { preparation: AVANT + "delete from histoire.event_tags where event_id='EVT-0210' and tag_id='TAG-0064';", raison: /tags de mode\/type antérieurs inattendus/ },
  ];
  for (const cas of erreurs) {
    assert.throws(() => sql(`begin; ${cas.preparation} ${corps} rollback;`), (erreur: unknown) =>
      erreur instanceof Error && cas.raison.test(String((erreur as Error & { stderr?: string }).stderr)), "Précondition non bloquante");
    assert.equal(sql(EMPREINTE), empreinte, "Mutation persistante après échec");
    assert.equal(sql("select jsonb_agg(to_jsonb(m) order by version) from histoire.migrations_appliquees m;"), registre);
  }
  console.log("OK : migration Somme sur 2001 événements/325 cartes/41 chapitres, copie exacte, aucun autre champ modifié, registre unique, réapplication/états inattendus refusés et rollback intégral (LOCAL).");
}
