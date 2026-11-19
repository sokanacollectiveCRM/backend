#!/usr/bin/env bash
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/dev-env/config.sh
source "${SELF}/config.sh"
# shellcheck source=scripts/dev-env/lib.sh
source "${SELF}/lib.sh"

dev_env_assert_isolated_target
dev_env_require_cmd gcloud

FRONTEND_DIR="${FRONTEND_DIR:-/Users/jerrybony/Documents/GitHub/sokana-crm-frontend/frontend-crm}"
[[ -d "${FRONTEND_DIR}" ]] || \
  dev_env_die "Frontend repo not found at ${FRONTEND_DIR}"

API_URL="${DEV_API_URL:-https://sokana-private-api-dev-46lcr3n2qa-uc.a.run.app}"
FRONTEND_URL="${DEV_FRONTEND_URL:-https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app}"

if ! dev_env_confirm "Build and deploy public tester frontend ${DEV_FRONTEND_SERVICE}?"; then
  dev_env_die "Aborted."
fi

cp "${SELF}/frontend-cloudbuild.yaml" "${FRONTEND_DIR}/.isolated-frontend-cloudbuild.yaml"

dev_env_log "Building ${DEV_FRONTEND_SERVICE} against ${API_URL}"
gcloud builds submit "${FRONTEND_DIR}" \
  --project "${PROJECT_ID}" \
  --config "${FRONTEND_DIR}/.isolated-frontend-cloudbuild.yaml" \
  --substitutions "_SERVICE_NAME=${DEV_FRONTEND_SERVICE},_VITE_APP_BACKEND_URL=${API_URL},_VITE_APP_FRONTEND_URL=${FRONTEND_URL}" \
  --quiet

rm -f "${FRONTEND_DIR}/.isolated-frontend-cloudbuild.yaml"

LIVE_FRONTEND_URL="$(
  gcloud run services describe "${DEV_FRONTEND_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --format='value(status.url)'
)"
ALT_FRONTEND_URL="https://${DEV_FRONTEND_SERVICE}-46lcr3n2qa-uc.a.run.app"
ALT_FRONTEND_URL_REGIONAL="https://${DEV_FRONTEND_SERVICE}-634744984887.us-central1.run.app"

# Failed --env-vars-file updates wipe Cloud SQL env. Rebuild from the latest
# ready revision, then overlay CORS. Use ^|^ so commas stay inside one value.
CORS_ORIGINS="${LIVE_FRONTEND_URL},${ALT_FRONTEND_URL},${ALT_FRONTEND_URL_REGIONAL},http://localhost:3001,http://localhost:5173,http://127.0.0.1:5173"
READY_REV="$(
  gcloud run services describe "${DEV_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --format='value(status.latestReadyRevisionName)'
)"
[[ -n "${READY_REV}" ]] || dev_env_die "No ready revision for ${DEV_SERVICE}"

ENV_FLAGS="$(
  python3 - "${PROJECT_ID}" "${REGION}" "${READY_REV}" "${CORS_ORIGINS}" \
    "${LIVE_FRONTEND_URL}" "${LIVE_FRONTEND_URL}/signing" <<'PY'
import json, subprocess, sys

project, region, revision, cors_origins, frontend_url, signing_url = sys.argv[1:]
raw = subprocess.check_output([
    "gcloud", "run", "revisions", "describe", revision,
    "--project", project, "--region", region, "--format=json",
], text=True)
env = json.loads(raw)["spec"]["containers"][0].get("env") or []
plain = []
secrets = []
overrides = {
    "FRONTEND_ORIGIN": cors_origins,
    "FRONTEND_URL": frontend_url,
    "CONTRACT_SIGNING_BASE_URL": signing_url,
}
for item in env:
    name = item["name"]
    secret = (item.get("valueFrom") or {}).get("secretKeyRef")
    if secret:
        secrets.append(f"{name}={secret['name']}:{secret.get('key') or 'latest'}")
        continue
    value = overrides.get(name, item.get("value", ""))
    if value == "":
        continue
    plain.append(f"{name}={value}")
for name, value in overrides.items():
    if not any(p.startswith(name + "=") for p in plain):
        plain.append(f"{name}={value}")
print("^|^" + "|".join(plain))
print(",".join(secrets))
PY
)"
PLAIN_ENV="$(printf '%s\n' "${ENV_FLAGS}" | sed -n '1p')"
SECRET_ENV="$(printf '%s\n' "${ENV_FLAGS}" | sed -n '2p')"
[[ -n "${PLAIN_ENV}" ]] || dev_env_die "Could not rebuild env from ${READY_REV}"

dev_env_log "Restoring ${DEV_SERVICE} from ${READY_REV} with tester CORS origins"
UPDATE_ARGS=(
  --project "${PROJECT_ID}"
  --region "${REGION}"
  --set-env-vars "${PLAIN_ENV}"
  --no-invoker-iam-check
  --quiet
)
if [[ -n "${SECRET_ENV}" ]]; then
  UPDATE_ARGS+=(--set-secrets "${SECRET_ENV}")
fi
gcloud run services update "${DEV_SERVICE}" "${UPDATE_ARGS[@]}"

if [[ -f "${DEV_ENV_FILE}" ]]; then
  dev_env_write_kv "${DEV_ENV_FILE}" DEV_FRONTEND_URL "${LIVE_FRONTEND_URL}"
fi

dev_env_log "Allowing Identity Platform login from tester frontend hosts"
GOOGLE_CLOUD_QUOTA_PROJECT="${PROJECT_ID}" python3 - "${PROJECT_ID}" \
  "${LIVE_FRONTEND_URL}" "${ALT_FRONTEND_URL}" "${ALT_FRONTEND_URL_REGIONAL}" <<'PY'
import os, sys
os.environ["GOOGLE_CLOUD_QUOTA_PROJECT"] = sys.argv[1]
import google.auth
from google.auth.transport.requests import AuthorizedSession

hosts = []
for raw in sys.argv[2:]:
    host = raw.replace("https://", "").replace("http://", "").split("/")[0]
    if host:
        hosts.append(host)

creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
session = AuthorizedSession(creds)
url = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{sys.argv[1]}/config"
current = session.get(url)
current.raise_for_status()
existing = list(current.json().get("authorizedDomains") or [])
merged = list(dict.fromkeys([*existing, *hosts]))
if merged == existing:
    print("Identity Platform authorized domains already include tester hosts")
    raise SystemExit(0)
patch = session.patch(
    url + "?updateMask=authorizedDomains",
    json={"authorizedDomains": merged},
)
patch.raise_for_status()
print("Identity Platform authorized domains updated")
PY

dev_env_log "Tester CRM: ${LIVE_FRONTEND_URL}"
dev_env_log "Tester API:  ${API_URL}"
