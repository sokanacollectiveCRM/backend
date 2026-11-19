# Shared names for the isolated Sokana test stack.
# Destinations must never equal production names.

PROJECT_ID="${PROJECT_ID:-sokana-private-data}"
REGION="${REGION:-us-central1}"

PROD_INSTANCE="${PROD_INSTANCE:-sokana-phi-postgres}"
PROD_DATABASE="${PROD_DATABASE:-sokana_private}"
PROD_SERVICE="${PROD_SERVICE:-sokana-private-api}"
PROD_DB_USER="${PROD_DB_USER:-app_user}"

DEV_INSTANCE="${DEV_INSTANCE:-sokana-phi-postgres-dev}"
DEV_DATABASE="${DEV_DATABASE:-sokana_private_dev}"
DEV_SERVICE="${DEV_SERVICE:-sokana-private-api-dev}"
DEV_FRONTEND_SERVICE="${DEV_FRONTEND_SERVICE:-sokana-front-end-dev}"
PROD_FRONTEND_SERVICE="${PROD_FRONTEND_SERVICE:-sokana-front-end}"
DEV_DB_USER="${DEV_DB_USER:-app_user}"
DEV_TIER="${DEV_TIER:-db-custom-1-3840}"
DEV_STORAGE_GB="${DEV_STORAGE_GB:-20}"

PROD_PROXY_PORT="${PROD_PROXY_PORT:-5433}"
DEV_PROXY_PORT="${DEV_PROXY_PORT:-5434}"
PROXY_ADDRESS="${PROXY_ADDRESS:-127.0.0.1}"

ARTIFACT_REPO="${ARTIFACT_REPO:-cloud-run-source-deploy}"
DEV_PASSWORD_SECRET="${DEV_PASSWORD_SECRET:-sokana-dev-cloudsql-password}"
DEV_SIGNING_SECRET="${DEV_SIGNING_SECRET:-sokana-dev-signing-hmac}"
DEV_CRON_SIGNING_SECRET="${DEV_CRON_SIGNING_SECRET:-sokana-dev-cron-signing-reminder}"
DEV_RUNTIME_SA="${DEV_RUNTIME_SA:-sokana-private-api-dev-sa@${PROJECT_ID}.iam.gserviceaccount.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${DEV_REPO_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
LOCAL_DIR="${SCRIPT_DIR}/.local"
DEV_ENV_FILE="${DEV_ENV_FILE:-${LOCAL_DIR}/dev.env}"
SCHEMA_DUMP_FILE="${SCHEMA_DUMP_FILE:-${LOCAL_DIR}/schema.sql}"
SOURCE_ENV_FILE="${SOURCE_ENV_FILE:-${REPO_ROOT}/.env}"
