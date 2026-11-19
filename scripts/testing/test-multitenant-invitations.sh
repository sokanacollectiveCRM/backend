#!/usr/bin/env bash
# Disposable local database only; no cloud credentials, mail, or live identities.
set -euo pipefail
cd "$(dirname "$0")/../.."
for executable in initdb pg_ctl; do
  command -v "$executable" >/dev/null || { echo "Install PostgreSQL to run this test." >&2; exit 1; }
done
p07_tmp="$(mktemp -d /tmp/sokana-p07.XXXXXX)"
p07_started=false
cleanup() {
  if [ "$p07_started" = true ]; then
    pg_ctl -D "$p07_tmp/data" -m immediate stop >/dev/null
  fi
  rm -rf "$p07_tmp"
}
trap cleanup EXIT
mkdir "$p07_tmp/socket"
initdb -D "$p07_tmp/data" -A trust --no-locale >"$p07_tmp/initdb.log" 2>&1
# Unix socket only; never expose the synthetic trust-authenticated server on TCP.
pg_ctl -D "$p07_tmp/data" -l "$p07_tmp/postgres.log" -o "-k $p07_tmp/socket -p 55427 -h ''" start >/dev/null
p07_started=true
P07_TEST_PG_SOCKET="$p07_tmp/socket" ./node_modules/.bin/jest --runInBand \
  src/features/team/__tests__/staffInvitationService.integration.test.ts
