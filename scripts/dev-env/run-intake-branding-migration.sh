#!/usr/bin/env bash
# Apply tenancy + Sokana360 intake branding migrations on isolated dev Cloud SQL.
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/dev-env/config.sh
source "${SELF}/config.sh"
# shellcheck source=scripts/dev-env/lib.sh
source "${SELF}/lib.sh"

dev_env_require_cmd cloud-sql-proxy
dev_env_require_cmd psql
dev_env_load_env_file "${DEV_ENV_FILE}" || \
  dev_env_die "Missing ${DEV_ENV_FILE}"

POSTGRES_PASSWORD="$(dev_env_read_kv "${DEV_ENV_FILE}" DEV_POSTGRES_PASSWORD || true)"
[[ -n "${POSTGRES_PASSWORD}" ]] || dev_env_die "DEV_POSTGRES_PASSWORD missing in ${DEV_ENV_FILE}"

CONNECTION="$(dev_env_connection_name "${DEV_INSTANCE}")"
PROXY_PID=""

cleanup() {
  if [[ -n "${PROXY_PID}" ]] && kill -0 "${PROXY_PID}" 2>/dev/null; then
    kill "${PROXY_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

dev_env_log "Starting Cloud SQL proxy on ${PROXY_ADDRESS}:${DEV_PROXY_PORT}"
cloud-sql-proxy "${CONNECTION}" --address "${PROXY_ADDRESS}" --port "${DEV_PROXY_PORT}" &
PROXY_PID=$!
sleep 2

run_sql() {
  local file="$1"
  dev_env_log "Applying $(basename "${file}")"
  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${PROXY_ADDRESS}" \
    -p "${DEV_PROXY_PORT}" \
    -U postgres \
    -d "${DEV_DATABASE}" \
    -v ON_ERROR_STOP=1 \
    -f "${file}"
}

MIG_DIR="${REPO_ROOT}/src/db/migrations"
if [[ ! -d "${MIG_DIR}" ]]; then
  dev_env_die "Migration directory not found: ${MIG_DIR}"
fi

if ! PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${PROXY_ADDRESS}" \
  -p "${DEV_PROXY_PORT}" \
  -U postgres \
  -d "${DEV_DATABASE}" \
  -tAc "SELECT 1 FROM public.tenants LIMIT 1" 2>/dev/null | grep -q 1; then
  run_sql "${MIG_DIR}/20261005_tenancy_foundation.sql"
fi

if [[ -f "${MIG_DIR}/20261006_tenant_staff_email_domain.sql" ]]; then
  run_sql "${MIG_DIR}/20261006_tenant_staff_email_domain.sql"
fi

run_sql "${MIG_DIR}/20261007_tenant_slug_sokana360_and_intake_branding.sql"

dev_env_log "Verifying Sokana360 intake branding row"
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${PROXY_ADDRESS}" \
  -p "${DEV_PROXY_PORT}" \
  -U postgres \
  -d "${DEV_DATABASE}" \
  -P pager=off \
  -c "SELECT slug, name FROM public.tenants WHERE slug = 'sokana360';" \
  -c "SELECT brand_display_name, logo_path, brand_primary_color, brand_accent_color FROM public.tenant_settings ts JOIN public.tenants t ON t.id = ts.tenant_id WHERE t.slug = 'sokana360';"

dev_env_log "Migration complete."
