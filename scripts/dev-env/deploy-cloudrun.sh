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

PASSWORD="$(dev_env_read_kv "${DEV_ENV_FILE}" CLOUD_SQL_PASSWORD || true)"
[[ -n "${PASSWORD}" ]] || dev_env_die "CLOUD_SQL_PASSWORD missing in ${DEV_ENV_FILE}"
CONNECTION="$(dev_env_connection_name "${DEV_INSTANCE}")"

# Prod buildpack images break when the service template uses `command: node`.
# Default: build dev API from this repo's Dockerfile (includes latest routes).
if [[ "${DEV_USE_PROD_IMAGE:-}" == "1" ]]; then
  IMAGE="$(
    gcloud run services describe "${PROD_SERVICE}" \
      --project "${PROJECT_ID}" \
      --region "${REGION}" \
      --format='value(spec.template.spec.containers[0].image)'
  )"
  [[ -n "${IMAGE}" ]] || dev_env_die "Could not read production Cloud Run image"
else
  CLOUDBUILD_CFG="${REPO_ROOT}/.isolated-backend-cloudbuild.yaml"
  cp "${SELF}/backend-cloudbuild.yaml" "${CLOUDBUILD_CFG}"
  dev_env_log "Cloud Build: ${DEV_SERVICE} from ${REPO_ROOT} (Dockerfile)"
  BUILD_ID="$(
    gcloud builds submit "${REPO_ROOT}" \
      --project "${PROJECT_ID}" \
      --config "${CLOUDBUILD_CFG}" \
      --substitutions "_SERVICE_NAME=${DEV_SERVICE}" \
      --format='value(id)' \
      --quiet
  )"
  rm -f "${CLOUDBUILD_CFG}"
  [[ -n "${BUILD_ID}" ]] || dev_env_die "Cloud Build did not return a build id"
  IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/backend/${DEV_SERVICE}:${BUILD_ID}"
fi

HMAC="$(dev_env_read_kv "${DEV_ENV_FILE}" SIGNING_RATE_LIMIT_HMAC_SECRET || true)"
if [[ -z "${HMAC}" ]]; then
  HMAC="$(dev_env_random_secret)"
  dev_env_write_kv "${DEV_ENV_FILE}" SIGNING_RATE_LIMIT_HMAC_SECRET "${HMAC}"
fi

if ! gcloud secrets describe "${DEV_PASSWORD_SECRET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud secrets create "${DEV_PASSWORD_SECRET}" \
    --project "${PROJECT_ID}" \
    --replication-policy automatic \
    --quiet
fi
printf '%s' "${PASSWORD}" | gcloud secrets versions add "${DEV_PASSWORD_SECRET}" \
  --project "${PROJECT_ID}" \
  --data-file=- \
  --quiet

if ! gcloud secrets describe "${DEV_SIGNING_SECRET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud secrets create "${DEV_SIGNING_SECRET}" \
    --project "${PROJECT_ID}" \
    --replication-policy automatic \
    --quiet
fi
printf '%s' "${HMAC}" | gcloud secrets versions add "${DEV_SIGNING_SECRET}" \
  --project "${PROJECT_ID}" \
  --data-file=- \
  --quiet

PROD_ENV_JSON="$(
  gcloud run services describe "${PROD_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --format=json
)"

DEV_API_URL="$(dev_env_read_kv "${DEV_ENV_FILE}" DEV_CLOUD_RUN_URL || true)"
DEV_API_URL="${DEV_API_URL:-https://${DEV_SERVICE}-46lcr3n2qa-uc.a.run.app}"
DEV_FRONTEND_LIVE="$(dev_env_read_kv "${DEV_ENV_FILE}" DEV_FRONTEND_URL || true)"
DEV_FRONTEND_LIVE="${DEV_FRONTEND_LIVE:-https://${DEV_FRONTEND_SERVICE}-46lcr3n2qa-uc.a.run.app}"
ALT_FRONTEND_URL="https://${DEV_FRONTEND_SERVICE}-46lcr3n2qa-uc.a.run.app"
ALT_FRONTEND_URL_REGIONAL="https://${DEV_FRONTEND_SERVICE}-634744984887.us-central1.run.app"
ISOLATED_CORS="${DEV_FRONTEND_LIVE},${ALT_FRONTEND_URL},${ALT_FRONTEND_URL_REGIONAL},http://localhost:3001,http://localhost:5173,http://127.0.0.1:5173"
QB_REDIRECT_URI="${DEV_API_URL%/}/quickbooks/callback"

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
    "notification_tick_audience": "https://sokana-private-api-dev-46lcr3n2qa-uc.a.run.app/internal/cron/notification-tick",
    "notification_tick_email": "sokana-dev-notification-tick@sokana-private-data.iam.gserviceaccount.com",
}))
PY
)"

# Commas appear in CORS. Use ^|^ so gcloud does not split values.
ENV_VARS="$(
  printf '%s' "${PROD_ENV_JSON}" | python3 "${SELF}/isolatedCloudRunEnv.py" "${ISOLATED_JSON}"
)"

SECRET_BINDINGS="CLOUD_SQL_PASSWORD=${DEV_PASSWORD_SECRET}:latest"
SECRET_BINDINGS+=",DB_PASSWORD=${DEV_PASSWORD_SECRET}:latest"
SECRET_BINDINGS+=",SIGNING_RATE_LIMIT_HMAC_SECRET=${DEV_SIGNING_SECRET}:latest"

if gcloud secrets describe supabase-key --project "${PROJECT_ID}" >/dev/null 2>&1; then
  SECRET_BINDINGS+=",SUPABASE_SERVICE_ROLE_KEY=supabase-key:latest"
fi
if gcloud secrets describe EMAIL_PASSWORD --project "${PROJECT_ID}" >/dev/null 2>&1; then
  SECRET_BINDINGS+=",EMAIL_PASSWORD=EMAIL_PASSWORD:latest"
fi
if gcloud secrets describe "${DEV_CRON_SIGNING_SECRET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  SECRET_BINDINGS+=",CRON_SIGNING_REMINDER_SECRET=${DEV_CRON_SIGNING_SECRET}:latest"
fi

RUNTIME_SA="${DEV_RUNTIME_SA}"
if ! gcloud iam service-accounts describe "${RUNTIME_SA}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  SA_NAME="${RUNTIME_SA%%@*}"
  gcloud iam service-accounts create "${SA_NAME}" \
    --project "${PROJECT_ID}" \
    --display-name "Isolated Cloud Run API" \
    --quiet
fi

grant_project_role() {
  local role="$1"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${RUNTIME_SA}" \
    --role "${role}" \
    --quiet >/dev/null
}

grant_project_role roles/cloudsql.client
grant_project_role roles/firebaseauth.admin
grant_project_role roles/logging.logWriter
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --project "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/iam.serviceAccountTokenCreator \
  --quiet >/dev/null

grant_secret_access() {
  local secret_name="$1"
  gcloud secrets add-iam-policy-binding "${secret_name}" \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${RUNTIME_SA}" \
    --role roles/secretmanager.secretAccessor \
    --quiet >/dev/null
}

grant_secret_access "${DEV_PASSWORD_SECRET}"
grant_secret_access "${DEV_SIGNING_SECRET}"
if gcloud secrets describe EMAIL_PASSWORD --project "${PROJECT_ID}" >/dev/null 2>&1; then
  grant_secret_access EMAIL_PASSWORD
fi
if gcloud secrets describe "${DEV_CRON_SIGNING_SECRET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  grant_secret_access "${DEV_CRON_SIGNING_SECRET}"
fi
if gcloud secrets describe supabase-key --project "${PROJECT_ID}" >/dev/null 2>&1; then
  grant_secret_access supabase-key
fi

if [[ "${DEV_USE_PROD_IMAGE:-}" == "1" ]]; then
  CONFIRM_MSG="Deploy Cloud Run service ${DEV_SERVICE} with image from ${PROD_SERVICE}?"
else
  CONFIRM_MSG="Deploy Cloud Run service ${DEV_SERVICE} from current repo build?"
fi
if ! dev_env_confirm "${CONFIRM_MSG}"; then
  dev_env_die "Aborted."
fi

dev_env_log "Deploying ${DEV_SERVICE} from ${IMAGE}"
gcloud run deploy "${DEV_SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --platform managed \
  --ingress all \
  --no-invoker-iam-check \
  --service-account "${RUNTIME_SA}" \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 2 \
  --add-cloudsql-instances "${CONNECTION}" \
  --set-env-vars "${ENV_VARS}" \
  --set-secrets "${SECRET_BINDINGS}" \
  --quiet

URL="$(
  gcloud run services describe "${DEV_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --format='value(status.url)'
)"
dev_env_write_kv "${DEV_ENV_FILE}" DEV_CLOUD_RUN_URL "${URL}"
dev_env_log "Dev Cloud Run URL: ${URL}"
dev_env_log "Health: curl -sS ${URL}/health"
