#!/usr/bin/env bash
# Deux transactions PostgreSQL réelles, uniquement sur la fixture locale/CI.
set -euo pipefail
case "${PGHOST:-localhost}" in localhost|127.0.0.1|/var/run/postgresql) ;; *) exit 1 ;; esac
if [[ -n ${PGSERVICE:-} || ${PGDATABASE:-postgres} == *[:=/]* ]]; then exit 1; fi
psql_q() { psql -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -q "$@"; }
logs=$(mktemp -d)
cleanup() {
  psql_q <<'SQL'
delete from histoire.admin_content_audit where pack_id='CONC120';
delete from histoire.admin_pack_additions where pack_id='CONC120';
delete from histoire.admin_event_creations where payload->>'pack_id'='CONC120';
delete from histoire.events where title='Création concurrente 120';
delete from histoire.pack_events where pack_id='CONC120';
delete from histoire.packs where id='CONC120';
delete from histoire.events where id='EVT-120999';
delete from histoire.admins where user_id in ('00000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000025');
SQL
  rm -rf -- "$logs"
}
trap cleanup EXIT
psql_q <<'SQL'
insert into histoire.players(id) values('00000000-0000-0000-0000-000000000024'),('00000000-0000-0000-0000-000000000025') on conflict do nothing;
insert into histoire.admins(user_id) values('00000000-0000-0000-0000-000000000024'),('00000000-0000-0000-0000-000000000025');
insert into histoire.packs(id,slug,title) values('CONC120','conc120','Concurrence créations');
insert into histoire.events(id,title,event_type,precision,date_status,playable,playable_mode,importance,difficulty,niveau)
  values('EVT-120999','Association concurrente','POINT','YEAR','EXACT',true,'YEAR',1,1,1);
SQL
add() {
  psql_q -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1';
    select histoire.admin_add_pack_events('CONC120',array['EVT-120999']); select pg_sleep(1); commit;"
}
add '00000000-0000-0000-0000-000000000024' >"$logs/add1" 2>&1 & first=$!
add '00000000-0000-0000-0000-000000000025' >"$logs/add2" 2>&1 & second=$!
wait "$first"; wait "$second"
[[ $(psql_q -Atc "select count(*) from histoire.admin_content_audit where pack_id='CONC120' and operation='ajouter'") == 1 ]]
create_event() {
  psql_q -c "begin; set local role authenticated; set local request.jwt.claim.sub='$1';
    select histoire.admin_create_event('$2','CONC120',
      '{\"title\":\"Création concurrente 120\",\"description\":\"Description documentaire\",\"niveau\":1,\"kind\":\"event\",\"date_status\":\"EXACT\",\"start_year\":1234,\"sources\":[\"Référence documentaire p. 42\"]}');
    select pg_sleep(1); commit;"
}
create_event '00000000-0000-0000-0000-000000000024' '12000000-0000-0000-0000-000000000001' >"$logs/create1" 2>&1 & first=$!
create_event '00000000-0000-0000-0000-000000000025' '12000000-0000-0000-0000-000000000002' >"$logs/create2" 2>&1 & second=$!
status1=0; wait "$first" || status1=$?
status2=0; wait "$second" || status2=$?
if [[ $status1 == 0 && $status2 != 0 ]]; then grep -q '23505' "$logs/create2";
elif [[ $status1 != 0 && $status2 == 0 ]]; then grep -q '23505' "$logs/create1";
else cat "$logs/create1" "$logs/create2"; exit 1; fi
[[ $(psql_q -Atc "select count(*) from histoire.events where title='Création concurrente 120'") == 1 ]]
[[ $(psql_q -Atc "select count(*) from histoire.admin_content_audit where pack_id='CONC120' and operation='creer'") == 1 ]]
echo 'OK : ajouts concurrents idempotents, création concurrente unique et audit atomique'
