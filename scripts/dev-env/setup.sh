#!/usr/bin/env bash
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/dev-env/config.sh
source "${SELF}/config.sh"
# shellcheck source=scripts/dev-env/lib.sh
source "${SELF}/lib.sh"

SKIP_CREATE=0
SKIP_CLONE=0
SKIP_SEED=0
SKIP_DEPLOY=0
SKIP_FRONTEND=0
RESET_SEED=0

usage() {
  cat <<'EOF'
Usage: bash scripts/dev-env/setup.sh [options]

Creates an isolated Cloud SQL instance, copies schema only (no PHI),
loads synthetic rows, and optionally deploys sokana-private-api-dev.

  --skip-create    Reuse an existing sokana-phi-postgres-dev instance
  --skip-clone     Do not dump/restore schema
  --skip-seed      Do not insert synthetic rows
  --skip-deploy    Do not deploy Cloud Run API
  --skip-frontend  Do not deploy the tester frontend
  --local-only     Skip API and frontend Cloud Run
  --reset-seed     Replace previous @sokana-dev.example rows
  --yes            Skip confirmation prompts
  -h, --help       Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-create) SKIP_CREATE=1 ;;
    --skip-clone) SKIP_CLONE=1 ;;
    --skip-seed) SKIP_SEED=1 ;;
    --skip-deploy) SKIP_DEPLOY=1 ;;
    --skip-frontend) SKIP_FRONTEND=1 ;;
    --local-only) SKIP_DEPLOY=1; SKIP_FRONTEND=1 ;;
    --reset-seed) RESET_SEED=1 ;;
    --yes) DEV_ENV_YES=1 ;;
    -h|--help) usage; exit 0 ;;
    *) dev_env_die "Unknown argument: $1" ;;
  esac
  shift
done

export DEV_ENV_YES="${DEV_ENV_YES:-0}"
dev_env_assert_isolated_target

if [[ "${SKIP_CLONE}" -eq 0 || "${SKIP_SEED}" -eq 0 ]]; then
  export DEV_ENV_KEEP_PROXIES=1
fi

dev_env_log "Sokana isolated test stack"
dev_env_log "  project:  ${PROJECT_ID}"
dev_env_log "  instance: ${DEV_INSTANCE}"
dev_env_log "  database: ${DEV_DATABASE}"
dev_env_log "  service:  ${DEV_SERVICE}"

if [[ "${SKIP_CREATE}" -eq 0 ]]; then
  bash "${SELF}/create-instance.sh"
else
  [[ -f "${DEV_ENV_FILE}" ]] || \
    dev_env_die "--skip-create requires ${DEV_ENV_FILE}"
fi

if [[ "${SKIP_CLONE}" -eq 0 ]]; then
  bash "${SELF}/clone-schema.sh"
fi

if [[ "${SKIP_SEED}" -eq 0 ]]; then
  SEED_ARGS=(--env-file "${DEV_ENV_FILE}")
  if [[ "${RESET_SEED}" -eq 1 ]]; then
    SEED_ARGS+=(--reset)
  fi
  npx tsx "${SELF}/seed-synthetic.ts" "${SEED_ARGS[@]}"
  npx tsx "${SELF}/provision-admin-login.ts" --env-file "${DEV_ENV_FILE}"
fi

if [[ "${SKIP_DEPLOY}" -eq 0 ]]; then
  bash "${SELF}/deploy-cloudrun.sh"
fi

if [[ "${SKIP_FRONTEND}" -eq 0 ]]; then
  bash "${SELF}/deploy-frontend.sh"
fi

dev_env_log ""
dev_env_log "Done. Local API against the isolated database:"
dev_env_log "  cloud-sql-proxy \"${PROJECT_ID}:${REGION}:${DEV_INSTANCE}\" --address ${PROXY_ADDRESS} --port ${DEV_PROXY_PORT}"
dev_env_log "  set -a && source ${DEV_ENV_FILE} && set +a"
dev_env_log "  npm run dev"
