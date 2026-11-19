#!/usr/bin/env bash
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/dev-env/config.sh
source "${SELF}/config.sh"
# shellcheck source=scripts/dev-env/lib.sh
source "${SELF}/lib.sh"

dev_env_assert_isolated_target
dev_env_mkdir_local

dev_env_load_env_file "${SOURCE_ENV_FILE}" || \
  dev_env_die "Missing ${SOURCE_ENV_FILE} with production CLOUD_SQL_PASSWORD"
dev_env_load_env_file "${DEV_ENV_FILE}" || \
  dev_env_die "Missing ${DEV_ENV_FILE}. Run scripts/dev-env/create-instance.sh first."

SOURCE_PASSWORD="$(dev_env_read_kv "${SOURCE_ENV_FILE}" CLOUD_SQL_PASSWORD || true)"
DEST_PASSWORD="$(dev_env_read_kv "${DEV_ENV_FILE}" CLOUD_SQL_PASSWORD || true)"
DEST_ROOT_PASSWORD="$(dev_env_read_kv "${DEV_ENV_FILE}" DEV_POSTGRES_PASSWORD || true)"

[[ -n "${SOURCE_PASSWORD}" ]] || dev_env_die "CLOUD_SQL_PASSWORD missing in ${SOURCE_ENV_FILE}"
[[ -n "${DEST_PASSWORD}" ]] || dev_env_die "CLOUD_SQL_PASSWORD missing in ${DEV_ENV_FILE}"
[[ -n "${DEST_ROOT_PASSWORD}" ]] || \
  dev_env_die "DEV_POSTGRES_PASSWORD missing in ${DEV_ENV_FILE}"

dev_env_start_proxy "${PROD_INSTANCE}" "${PROD_PROXY_PORT}"
dev_env_start_proxy "${DEV_INSTANCE}" "${DEV_PROXY_PORT}"

PG_IMAGE="${PG_IMAGE:-postgres:18}"
USE_DOCKER_PG=0
resolve_pg_bin() {
  local name="$1"
  local candidate
  for candidate in \
    "$(command -v "${name}" || true)" \
    "/opt/homebrew/opt/postgresql@18/bin/${name}" \
    "/usr/local/opt/postgresql@18/bin/${name}"
  do
    if [[ -n "${candidate}" && -x "${candidate}" ]]; then
      local major
      major="$("${candidate}" --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
      if [[ -n "${major}" && "${major}" -ge 18 ]]; then
        printf '%s' "${candidate}"
        return 0
      fi
    fi
  done
  return 1
}

PG_DUMP_BIN="$(resolve_pg_bin pg_dump || true)"
PSQL_BIN="$(resolve_pg_bin psql || true)"
if [[ -z "${PG_DUMP_BIN}" || -z "${PSQL_BIN}" ]]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    USE_DOCKER_PG=1
    dev_env_log "No Postgres 18 client on PATH; using ${PG_IMAGE} for dump/restore."
  else
    dev_env_die "Need pg_dump/psql 18+ (brew install postgresql@18) or a running Docker daemon."
  fi
else
  dev_env_log "Using ${PG_DUMP_BIN}"
fi

pg_host_for_client() {
  if [[ "${USE_DOCKER_PG}" -eq 1 ]]; then
    printf 'host.docker.internal'
  else
    printf '%s' "${PROXY_ADDRESS}"
  fi
}

run_pg_dump() {
  local password="$1"
  shift
  if [[ "${USE_DOCKER_PG}" -eq 1 ]]; then
    PGPASSWORD="${password}" docker run --rm \
      --add-host=host.docker.internal:host-gateway \
      -e PGPASSWORD \
      -v "${LOCAL_DIR}:/dump" \
      "${PG_IMAGE}" \
      pg_dump "$@"
  else
    PGPASSWORD="${password}" "${PG_DUMP_BIN}" "$@"
  fi
}

run_psql() {
  local password="$1"
  shift
  if [[ "${USE_DOCKER_PG}" -eq 1 ]]; then
    PGPASSWORD="${password}" docker run --rm -i \
      --add-host=host.docker.internal:host-gateway \
      -e PGPASSWORD \
      -v "${LOCAL_DIR}:/dump" \
      "${PG_IMAGE}" \
      psql "$@"
  else
    PGPASSWORD="${password}" "${PSQL_BIN}" "$@"
  fi
}

DUMP_PATH="${SCHEMA_DUMP_FILE}"
DUMP_ARG="${SCHEMA_DUMP_FILE}"
if [[ "${USE_DOCKER_PG}" -eq 1 ]]; then
  DUMP_ARG="/dump/$(basename "${SCHEMA_DUMP_FILE}")"
fi

PGHOST="$(pg_host_for_client)"
dev_env_log "Dumping schema only from ${PROD_INSTANCE}/${PROD_DATABASE}"
run_pg_dump "${SOURCE_PASSWORD}" \
  --host "${PGHOST}" \
  --port "${PROD_PROXY_PORT}" \
  --username "${PROD_DB_USER}" \
  --dbname "${PROD_DATABASE}" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  --file "${DUMP_ARG}"

dev_env_assert_schema_only_dump "${DUMP_PATH}"
dev_env_log "Schema dump: ${DUMP_PATH}"

RESTORE_LOG="${LOCAL_DIR}/schema-restore.log"
dev_env_log "Restoring schema into ${DEV_INSTANCE}/${DEV_DATABASE} as postgres"
run_psql "${DEST_ROOT_PASSWORD}" \
  --host "${PGHOST}" \
  --port "${DEV_PROXY_PORT}" \
  --username postgres \
  --dbname "${DEV_DATABASE}" \
  --set ON_ERROR_STOP=0 \
  --file "${DUMP_ARG}" \
  > "${RESTORE_LOG}" 2>&1

run_psql "${DEST_ROOT_PASSWORD}" \
  --host "${PGHOST}" \
  --port "${DEV_PROXY_PORT}" \
  --username postgres \
  --dbname "${DEV_DATABASE}" \
  --set ON_ERROR_STOP=1 <<SQL
GRANT USAGE, CREATE ON SCHEMA public TO ${DEV_DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DEV_DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DEV_DB_USER};
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${DEV_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DEV_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DEV_DB_USER};
SQL

dev_env_log "Verifying dest is empty of application rows (schema clone must not copy PHI)"
CLIENT_COUNT="$(
  run_psql "${DEST_PASSWORD}" \
    --host "${PGHOST}" \
    --port "${DEV_PROXY_PORT}" \
    --username "${DEV_DB_USER}" \
    --dbname "${DEV_DATABASE}" \
    -Atqc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='phi_clients'"
)"
if [[ "${CLIENT_COUNT}" == "1" ]]; then
  ROW_COUNT="$(
    run_psql "${DEST_PASSWORD}" \
      --host "${PGHOST}" \
      --port "${DEV_PROXY_PORT}" \
      --username "${DEV_DB_USER}" \
      --dbname "${DEV_DATABASE}" \
      -Atqc \
      "SELECT COUNT(*) FROM public.phi_clients"
  )"
  if [[ "${ROW_COUNT}" != "0" ]]; then
    dev_env_die "phi_clients has ${ROW_COUNT} rows after schema clone. Aborting."
  fi
fi

dev_env_log "Schema clone complete. Restore log: ${RESTORE_LOG}"
