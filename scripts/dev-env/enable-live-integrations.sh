#!/usr/bin/env bash
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/dev-env/config.sh
source "${SELF}/config.sh"
# shellcheck source=scripts/dev-env/lib.sh
source "${SELF}/lib.sh"

dev_env_assert_isolated_target
dev_env_require_cmd gcloud
dev_env_load_env_file "${DEV_ENV_FILE}" || \
  dev_env_die "Missing ${DEV_ENV_FILE}. Run scripts/dev-env/create-instance.sh first."

CONNECTION="$(dev_env_connection_name "${DEV_INSTANCE}")"
DEV_API_URL="$(dev_env_read_kv "${DEV_ENV_FILE}" DEV_CLOUD_RUN_URL || true)"
DEV_API_URL="${DEV_API_URL:-https://${DEV_SERVICE}-46lcr3n2qa-uc.a.run.app}"
DEV_FRONTEND_LIVE="$(dev_env_read_kv "${DEV_ENV_FILE}" DEV_FRONTEND_URL || true)"
DEV_FRONTEND_LIVE="${DEV_FRONTEND_LIVE:-https://${DEV_FRONTEND_SERVICE}-46lcr3n2qa-uc.a.run.app}"
ALT_FRONTEND_URL="https://${DEV_FRONTEND_SERVICE}-46lcr3n2qa-uc.a.run.app"
ALT_FRONTEND_URL_REGIONAL="https://${DEV_FRONTEND_SERVICE}-634744984887.us-central1.run.app"
ISOLATED_CORS="${DEV_FRONTEND_LIVE},${ALT_FRONTEND_URL},${ALT_FRONTEND_URL_REGIONAL},http://localhost:3001,http://localhost:5173,http://127.0.0.1:5173"
QB_REDIRECT_URI="${DEV_API_URL%/}/quickbooks/callback"

PROD_ENV_JSON="$(
  gcloud run services describe "${PROD_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --format=json
)"

ISOLATED_JSON="$(python3 - <<PY
import json
print(json.dumps({
    "cloud_sql_host": "/cloudsql/${CONNECTION}",
    "database": "${DEV_DATABASE}",
    "db_user": "${DEV_DB_USER}",
    "connection": "${CONNECTION}",
    "project_id": "${PROJECT_ID}",
    "cors": """${ISOLATED_CORS}""",
    "frontend_url": """${DEV_FRONTEND_LIVE}""",
    "signing_url": """${DEV_FRONTEND_LIVE}/signing""",
    "qb_redirect_uri": """${QB_REDIRECT_URI}""",
}))
PY
)"

ENV_VARS="$(
  printf '%s' "${PROD_ENV_JSON}" | python3 "${SELF}/isolatedCloudRunEnv.py" "${ISOLATED_JSON}"
)"

RUNTIME_SA="${DEV_RUNTIME_SA}"
if gcloud secrets describe EMAIL_PASSWORD --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud secrets add-iam-policy-binding EMAIL_PASSWORD \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${RUNTIME_SA}" \
    --role roles/secretmanager.secretAccessor \
    --quiet >/dev/null
fi

if ! dev_env_confirm "Enable live email, QuickBooks, and payments on ${DEV_SERVICE}?"; then
  dev_env_die "Aborted."
fi

dev_env_log "Updating ${DEV_SERVICE} env (keys only; secret values not printed)"
SECRET_UPDATES=()
if gcloud secrets describe EMAIL_PASSWORD --project "${PROJECT_ID}" >/dev/null 2>&1; then
  SECRET_UPDATES+=("EMAIL_PASSWORD=EMAIL_PASSWORD:latest")
fi
if gcloud secrets describe supabase-key --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud secrets add-iam-policy-binding supabase-key \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${RUNTIME_SA}" \
    --role roles/secretmanager.secretAccessor \
    --quiet >/dev/null || true
  SECRET_UPDATES+=("SUPABASE_SERVICE_ROLE_KEY=supabase-key:latest")
fi
UPDATE_ARGS=(
  --project "${PROJECT_ID}"
  --region "${REGION}"
  --update-env-vars "${ENV_VARS}"
)
if [[ ${#SECRET_UPDATES[@]} -gt 0 ]]; then
  UPDATE_ARGS+=(--update-secrets "$(IFS=,; echo "${SECRET_UPDATES[*]}")")
fi

gcloud run services update "${DEV_SERVICE}" "${UPDATE_ARGS[@]}" --quiet

dev_env_log "Playground SMTP from hello@sokanacollective.com"
dev_env_log "QuickBooks callback: ${QB_REDIRECT_URI}"
dev_env_log "Add that exact callback URL in the Intuit app Redirect URIs before connecting."
dev_env_log "Connecting QuickBooks here uses the real company. It can disconnect production until you reconnect the live CRM."
