#!/usr/bin/env bash
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/dev-env/config.sh
source "${SELF}/config.sh"
# shellcheck source=scripts/dev-env/lib.sh
source "${SELF}/lib.sh"

dev_env_assert_isolated_target
dev_env_require_cmd gcloud
dev_env_require_cmd openssl
dev_env_require_cmd python3
dev_env_mkdir_local

gcloud config set project "${PROJECT_ID}" >/dev/null

if ! gcloud sql instances describe "${PROD_INSTANCE}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  dev_env_die "Cannot describe production instance ${PROD_INSTANCE}. Check gcloud auth."
fi

DB_VERSION="$(
  gcloud sql instances describe "${PROD_INSTANCE}" \
    --project "${PROJECT_ID}" \
    --format='value(databaseVersion)'
)"
if [[ -z "${DB_VERSION}" ]]; then
  INSTALLED_VERSION="$(
    gcloud sql instances describe "${PROD_INSTANCE}" \
      --project "${PROJECT_ID}" \
      --format='value(databaseInstalledVersion)'
  )"
  DB_VERSION="$(printf '%s' "${INSTALLED_VERSION}" | sed -E 's/_[0-9]+$//')"
fi
[[ -n "${DB_VERSION}" ]] || DB_VERSION="POSTGRES_18"
dev_env_log "Matching production Postgres version: ${DB_VERSION}"

PASSWORD="$(dev_env_read_kv "${DEV_ENV_FILE}" CLOUD_SQL_PASSWORD || true)"
ROOT_PASSWORD="$(dev_env_read_kv "${DEV_ENV_FILE}" DEV_POSTGRES_PASSWORD || true)"
if [[ -z "${PASSWORD}" ]]; then
  PASSWORD="$(dev_env_random_secret)"
fi
if [[ -z "${ROOT_PASSWORD}" ]]; then
  ROOT_PASSWORD="$(dev_env_random_secret)"
fi

wait_until_runnable() {
  local state=""
  local i
  for ((i = 1; i <= 80; i++)); do
    state="$(
      gcloud sql instances describe "${DEV_INSTANCE}" \
        --project "${PROJECT_ID}" \
        --format='value(state)' 2>/dev/null || true
    )"
    if [[ "${state}" == "RUNNABLE" ]]; then
      return 0
    fi
    dev_env_log "Waiting for ${DEV_INSTANCE} to become RUNNABLE (state=${state:-pending})..."
    sleep 15
  done
  dev_env_die "Timed out waiting for ${DEV_INSTANCE} to become RUNNABLE"
}

create_instance_via_api() {
  local token
  token="$(gcloud auth print-access-token)"
  TOKEN="${token}" \
  PROJECT_ID="${PROJECT_ID}" \
  DEV_INSTANCE="${DEV_INSTANCE}" \
  REGION="${REGION}" \
  DB_VERSION="${DB_VERSION}" \
  DEV_TIER="${DEV_TIER}" \
  DEV_STORAGE_GB="${DEV_STORAGE_GB}" \
  ROOT_PASSWORD="${ROOT_PASSWORD}" \
  python3 <<'PY'
import json, os, sys, time, urllib.error, urllib.request

def request(method, url, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {os.environ['TOKEN']}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Cloud SQL API {method} {url} failed ({error.code}): {detail}") from error

project = os.environ["PROJECT_ID"]
name = os.environ["DEV_INSTANCE"]
payload = {
    "name": name,
    "region": os.environ["REGION"],
    "databaseVersion": os.environ["DB_VERSION"],
    "rootPassword": os.environ["ROOT_PASSWORD"],
    "settings": {
        "tier": os.environ["DEV_TIER"],
        "edition": "ENTERPRISE",
        "dataDiskSizeGb": os.environ["DEV_STORAGE_GB"],
        "availabilityType": "ZONAL",
        "storageAutoResize": True,
        "ipConfiguration": {"ipv4Enabled": True},
    },
}
operation = request(
    "POST",
    f"https://sqladmin.googleapis.com/v1/projects/{project}/instances",
    payload,
)
op_name = operation.get("name")
if not op_name:
    raise SystemExit("Cloud SQL API did not return an operation name")
print(f"Cloud SQL create operation: {op_name}", flush=True)
for _ in range(80):
    current = request(
        "GET",
        f"https://sqladmin.googleapis.com/v1/projects/{project}/operations/{op_name}",
    )
    status = current.get("status")
    if status == "DONE":
        error = (current.get("error") or {}).get("errors") or []
        if error:
            raise SystemExit(f"Cloud SQL create failed: {error}")
        sys.exit(0)
    time.sleep(15)
raise SystemExit("Timed out waiting for Cloud SQL create operation")
PY
}

if gcloud sql instances describe "${DEV_INSTANCE}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  dev_env_log "Instance ${DEV_INSTANCE} already exists; skipping create."
else
  if ! dev_env_confirm "Create billed Cloud SQL instance ${DEV_INSTANCE} in ${PROJECT_ID}?"; then
    dev_env_die "Aborted."
  fi
  dev_env_log "Creating ${DEV_INSTANCE} (${DEV_TIER}, ${DB_VERSION}). This often takes 10+ minutes."
  if gcloud sql instances create --help 2>/dev/null | grep -q "${DB_VERSION}"; then
    gcloud sql instances create "${DEV_INSTANCE}" \
      --project "${PROJECT_ID}" \
      --database-version "${DB_VERSION}" \
      --tier "${DEV_TIER}" \
      --region "${REGION}" \
      --storage-size "${DEV_STORAGE_GB}" \
      --storage-auto-increase \
      --availability-type ZONAL \
      --root-password "${ROOT_PASSWORD}" \
      --quiet
  else
    dev_env_log "Creating via Cloud SQL Admin API (CLI in this environment does not accept ${DB_VERSION})."
    create_instance_via_api
  fi
  wait_until_runnable
fi

if gcloud sql databases describe "${DEV_DATABASE}" \
  --instance "${DEV_INSTANCE}" \
  --project "${PROJECT_ID}" >/dev/null 2>&1; then
  dev_env_log "Database ${DEV_DATABASE} already exists."
else
  gcloud sql databases create "${DEV_DATABASE}" \
    --instance "${DEV_INSTANCE}" \
    --project "${PROJECT_ID}" \
    --quiet
fi

if gcloud sql users list --instance "${DEV_INSTANCE}" --project "${PROJECT_ID}" \
  --format='value(name)' | grep -qx "${DEV_DB_USER}"; then
  gcloud sql users set-password "${DEV_DB_USER}" \
    --instance "${DEV_INSTANCE}" \
    --project "${PROJECT_ID}" \
    --password "${PASSWORD}" \
    --quiet
  dev_env_log "Updated password for ${DEV_DB_USER}."
else
  gcloud sql users create "${DEV_DB_USER}" \
    --instance "${DEV_INSTANCE}" \
    --project "${PROJECT_ID}" \
    --password "${PASSWORD}" \
    --quiet
fi

CONNECTION="$(dev_env_connection_name "${DEV_INSTANCE}")"
dev_env_write_kv "${DEV_ENV_FILE}" PROJECT_ID "${PROJECT_ID}"
dev_env_write_kv "${DEV_ENV_FILE}" REGION "${REGION}"
dev_env_write_kv "${DEV_ENV_FILE}" DEV_INSTANCE "${DEV_INSTANCE}"
dev_env_write_kv "${DEV_ENV_FILE}" DEV_SERVICE "${DEV_SERVICE}"
dev_env_write_kv "${DEV_ENV_FILE}" CLOUD_SQL_HOST "${PROXY_ADDRESS}"
dev_env_write_kv "${DEV_ENV_FILE}" CLOUD_SQL_PORT "${DEV_PROXY_PORT}"
dev_env_write_kv "${DEV_ENV_FILE}" CLOUD_SQL_DATABASE "${DEV_DATABASE}"
dev_env_write_kv "${DEV_ENV_FILE}" CLOUD_SQL_USER "${DEV_DB_USER}"
dev_env_write_kv "${DEV_ENV_FILE}" CLOUD_SQL_PASSWORD "${PASSWORD}"
dev_env_write_kv "${DEV_ENV_FILE}" CLOUD_SQL_SSLMODE disable
dev_env_write_kv "${DEV_ENV_FILE}" DEV_POSTGRES_PASSWORD "${ROOT_PASSWORD}"
dev_env_write_kv "${DEV_ENV_FILE}" DB_INSTANCE_CONNECTION_NAME "${CONNECTION}"
dev_env_write_kv "${DEV_ENV_FILE}" DB_NAME "${DEV_DATABASE}"
dev_env_write_kv "${DEV_ENV_FILE}" DB_USER "${DEV_DB_USER}"
dev_env_write_kv "${DEV_ENV_FILE}" DB_PASSWORD "${PASSWORD}"
dev_env_write_kv "${DEV_ENV_FILE}" GCS_LOCAL_STORAGE_DIR "${LOCAL_DIR}/gcs-documents"
dev_env_write_kv "${DEV_ENV_FILE}" GCS_LOCAL_BASE_URL "http://localhost:8080"

dev_env_log "Wrote ${DEV_ENV_FILE} (gitignored). Instance connection: ${CONNECTION}"
