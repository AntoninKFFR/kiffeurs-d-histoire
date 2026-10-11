#!/usr/bin/env bash
# Tests SQL sur un Postgres vide (CI, ou en local sans Docker) : imite le strict nécessaire de Supabase
# (rôles anon/authenticated/service_role, schémas extensions et auth), applique les migrations et
# supabase/seed.sql, puis lance les tests de supabase/tests/.
# Usage : PGHOST=… PGPORT=… PGUSER=postgres PGDATABASE=… scripts/tests-sql.sh
# Ne jamais lancer contre une base Supabase réelle : le script crée des rôles et des schémas.
set -euo pipefail
case "${PGHOST:-localhost}" in localhost|127.0.0.1|/var/run/postgresql) ;; *) echo 'Tests réservés à un Postgres local vide' >&2; exit 1 ;; esac
if [[ -n ${PGSERVICE:-} || ${PGDATABASE:-postgres} == *[:=/]* ]]; then
  echo 'Connexion distante ou service interdits pour les fixtures' >&2; exit 1
fi
cd "$(dirname "$0")/.."

psql_q() { psql -v ON_ERROR_STOP=1 -q "$@"; }

psql_q <<'SQL'
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'histoire') then
    raise exception 'Base déjà initialisée : ce script attend un Postgres vide';
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists extensions;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
-- Simulation locale des claims JWT, sans insérer de comptes dans auth.users.
create or replace function auth.uid() returns uuid language sql as
  'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
SQL

# Contrat externe existant de Contrée : fixture hors migrations, jamais distante.
psql_q -f supabase/fixtures/kffr_profiles.sql

for f in supabase/migrations/*.sql supabase/seed.sql; do
  echo "→ $f"
  # Vérifier une vraie partie antérieure au backfill #104, dans ce simulateur vide uniquement.
  if [[ $f == supabase/migrations/20261010232237_corrections_editoriales.sql ]]; then
    psql_q -f supabase/fixtures/corrections_avant_migration.sql
  fi
  psql_q -f "$f"
  if [[ $f == supabase/migrations/20261010232237_corrections_editoriales.sql ]]; then
    psql_q -f supabase/fixtures/corrections_apres_migration.sql
  fi
done

# Les migrations de données précèdent le seed sur une pile vide ; vrais événements locaux
# puis installation et répétition pour vérifier l’idempotence, sans toucher une base distante.
psql_q -f supabase/fixtures/sport_397.sql
psql_q -f supabase/migrations/20261011111510_pack_sport.sql
psql_q -f supabase/migrations/20261011111510_pack_sport.sql

for f in supabase/tests/*.sql; do
  echo "→ $f"
  psql_q -f "$f"
done

bash scripts/tests-solo-concurrence.sh
bash scripts/tests-admin-packs-concurrence.sh
bash scripts/tests-corrections-concurrence.sh
bash scripts/tests-sous-packs-concurrence.sh
