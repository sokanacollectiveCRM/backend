#!/usr/bin/env bash
# Run portal readiness SQL scenarios with correct psql variable passing.
#
# Usage:
#   export CLIENT_ID="1d981375-beeb-46e7-bf22-5d7a750eb391"   # jbony@icstars.org (default fixture)
#   ./scripts/test/run-portal-readiness-scenario.sh medicaid-eligible-no-card
#   ./scripts/test/run-portal-readiness-scenario.sh selfpay-missing-card
#   ./scripts/test/run-portal-readiness-scenario.sh selfpay-eligible-with-card
#   ./scripts/test/run-portal-readiness-scenario.sh unsigned-contract
#   ./scripts/test/run-portal-readiness-scenario.sh billing-path-unknown
#   ./scripts/test/run-portal-readiness-scenario.sh reset
#   ./scripts/test/run-portal-readiness-scenario.sh add-card
#   ./scripts/test/run-portal-readiness-matrix.sh   # all 5 matrix scenarios + API oracle
#
# Loads CLOUD_SQL_PASSWORD from backend .env when DB_PASSWORD is unset.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DB_PASSWORD="${DB_PASSWORD:-${CLOUD_SQL_PASSWORD:-}}"
DB_HOST="${CLOUD_SQL_HOST:-127.0.0.1}"
DB_PORT="${CLOUD_SQL_PORT:-5433}"
DB_NAME="${CLOUD_SQL_DATABASE:-sokana_private}"
DB_USER="${CLOUD_SQL_USER:-app_user}"

SCENARIO="${1:-}"
if [[ -z "$SCENARIO" ]]; then
  echo "Usage: $0 <reset|medicaid-eligible-no-card|selfpay-missing-card|selfpay-eligible-with-card|unsigned-contract|billing-path-unknown|add-card>" >&2
  exit 1
fi

case "$SCENARIO" in
  reset) SQL_FILE="scripts/test/reset-portal-readiness-fixture.sql" ;;
  selfpay-missing-card) SQL_FILE="scripts/test/scenario-selfpay-missing-card.sql" ;;
  selfpay-eligible-with-card) SQL_FILE="scripts/test/scenario-selfpay-eligible-with-card.sql" ;;
  medicaid-eligible-no-card) SQL_FILE="scripts/test/scenario-medicaid-eligible-no-card.sql" ;;
  unsigned-contract) SQL_FILE="scripts/test/scenario-unsigned-contract.sql" ;;
  billing-path-unknown) SQL_FILE="scripts/test/scenario-billing-path-unknown.sql" ;;
  add-card) SQL_FILE="scripts/test/scenario-add-card-on-file.sql" ;;
  *)
    echo "Unknown scenario: $SCENARIO" >&2
    echo "Usage: $0 <reset|medicaid-eligible-no-card|selfpay-missing-card|selfpay-eligible-with-card|unsigned-contract|billing-path-unknown|add-card>" >&2
    exit 1
    ;;
esac

if [[ -z "${CLIENT_ID:-}" ]]; then
  CLIENT_ID="1d981375-beeb-46e7-bf22-5d7a750eb391"
  echo "ℹ️  Using default fixture CLIENT_ID ($CLIENT_ID / jbony@icstars.org)"
fi

if [[ "$CLIENT_ID" == "your-uuid" || "$CLIENT_ID" == "paste-client-uuid-here" ]]; then
  echo "❌ CLIENT_ID is still a placeholder. Pick a real client from Cloud SQL." >&2
  exit 1
fi

if ! [[ "$CLIENT_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "❌ CLIENT_ID is not a valid UUID: $CLIENT_ID" >&2
  exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
  echo "❌ DB password missing. Set DB_PASSWORD or CLOUD_SQL_PASSWORD in .env" >&2
  exit 1
fi

export PGPASSWORD="$DB_PASSWORD"

echo "🔄 Running $SQL_FILE for client $CLIENT_ID"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -v client_id="$CLIENT_ID" \
  -f "$SQL_FILE"

echo "✅ Done. Re-fetch readiness:"
echo "curl -s \"\${API_BASE_URL:-http://localhost:5050}/api/clients/$CLIENT_ID\" -H \"Authorization: Bearer \$AUTH_TOKEN\" | jq '{billing_path,is_eligible,primary_portal_blocker,allowed_actions}'"
