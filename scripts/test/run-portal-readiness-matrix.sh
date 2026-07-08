#!/usr/bin/env bash
# Run the 5 core portal readiness matrix scenarios plus insurance parity coverage:
# SQL fixture + GET /api/clients/:id oracle.
#
# Usage:
#   ./scripts/test/run-portal-readiness-matrix.sh
#   CLIENT_ID=... ./scripts/test/run-portal-readiness-matrix.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

CLIENT_ID="${CLIENT_ID:-1d981375-beeb-46e7-bf22-5d7a750eb391}"
API_BASE_URL="${API_BASE_URL:-http://localhost:5050}"
ADMIN_EMAIL="${TEST_ADMIN_EMAIL:-info@techluminateacademy.com}"
ADMIN_PASSWORD="${TEST_ADMIN_PASSWORD:-}"

if [[ -z "$ADMIN_PASSWORD" ]]; then
  echo "❌ TEST_ADMIN_PASSWORD missing in .env" >&2
  exit 1
fi

export CLIENT_ID

SCENARIO_SCRIPT="$ROOT_DIR/scripts/test/run-portal-readiness-scenario.sh"
chmod +x "$SCENARIO_SCRIPT"

login_and_fetch() {
  node -r dotenv/config - "$CLIENT_ID" "$API_BASE_URL" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" <<'NODE'
const clientId = process.argv[2];
const base = process.argv[3];
const email = process.argv[4];
const password = process.argv[5];

async function main() {
  const loginRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${loginBody.error_description || loginBody.error || loginBody.msg}`);
  }
  const token = loginBody.access_token;
  const res = await fetch(`${base}/api/clients/${clientId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`GET client failed (${res.status}): ${JSON.stringify(body)}`);
  }
  const data = body.data || body;
  console.log(JSON.stringify({
    billing_path: data.billing_path,
    is_eligible: data.is_eligible,
    portal_blockers: data.portal_blockers,
    primary_portal_blocker: data.primary_portal_blocker,
    payment_authorization_required: data.payment_authorization_required,
    payment_authorization_satisfied: data.payment_authorization_satisfied,
    card_on_file: data.card_on_file,
    contract_signed: data.contract_signed,
    deposit_paid: data.deposit_paid,
    allowed_actions: data.allowed_actions,
  }));
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
NODE
}

assert_json() {
  local label="$1"
  local scenario="$2"
  local expected="$3"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ $label"
  echo "  scenario: $scenario"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "$SCENARIO_SCRIPT" "$scenario"
  local actual
  actual="$(login_and_fetch)"
  echo "$actual"
  node -e "
    const actual = JSON.parse(process.argv[1]);
    const expected = JSON.parse(process.argv[2]);
    const failures = [];
    for (const [key, value] of Object.entries(expected)) {
      const a = actual[key];
      const same = JSON.stringify(a) === JSON.stringify(value);
      if (!same) failures.push(\`\${key}: expected \${JSON.stringify(value)}, got \${JSON.stringify(a)}\`);
    }
    if (failures.length) {
      console.error('❌ FAIL:', failures.join('; '));
      process.exit(1);
    }
    console.log('✅ PASS');
  " "$actual" "$expected"
}

PASS=0
FAIL=0

run_case() {
  local label="$1"
  local scenario="$2"
  local expected="$3"
  if assert_json "$label" "$scenario" "$expected"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
}

echo "Portal readiness matrix — CLIENT_ID=$CLIENT_ID admin=$ADMIN_EMAIL"

run_case \
  "1/5 Self-Pay + signed + paid deposit + no card" \
  "selfpay-missing-card" \
  '{"billing_path":"self_pay","is_eligible":false,"primary_portal_blocker":"missing_card_on_file","card_on_file":false,"allowed_actions":{"can_invite_to_portal":false,"can_send_verification_invoice":true,"can_mark_contract_signed":false,"can_mark_deposit_paid":false}}'

run_case \
  "2/5 Self-Pay + signed + paid deposit + card" \
  "selfpay-eligible-with-card" \
  '{"billing_path":"self_pay","is_eligible":true,"primary_portal_blocker":null,"card_on_file":true,"allowed_actions":{"can_invite_to_portal":true,"can_send_verification_invoice":false,"can_mark_contract_signed":false,"can_mark_deposit_paid":false}}'

run_case \
  "3/5 Medicaid + signed + paid deposit + no card" \
  "medicaid-eligible-no-card" \
  '{"billing_path":"medicaid","is_eligible":true,"primary_portal_blocker":null,"card_on_file":false,"allowed_actions":{"can_invite_to_portal":true,"can_send_verification_invoice":false,"can_mark_contract_signed":false,"can_mark_deposit_paid":false}}'

run_case \
  "4/5 Self-Pay + unsigned + unpaid + no card" \
  "unsigned-contract" \
  '{"billing_path":"self_pay","is_eligible":false,"primary_portal_blocker":"contract_unsigned","card_on_file":false,"allowed_actions":{"can_invite_to_portal":false,"can_send_verification_invoice":false,"can_mark_contract_signed":true,"can_mark_deposit_paid":false}}'

run_case \
  "5/5 Unknown payment method + signed + paid + card" \
  "billing-path-unknown" \
  '{"billing_path":"unknown","is_eligible":false,"primary_portal_blocker":"billing_path_unknown","card_on_file":true,"allowed_actions":{"can_invite_to_portal":false,"can_send_verification_invoice":false,"can_mark_contract_signed":false,"can_mark_deposit_paid":false}}'

run_case \
  "Insurance parity Insurance + signed + paid deposit + no card" \
  "insurance-missing-card" \
  '{"billing_path":"insurance","is_eligible":false,"portal_blockers":["missing_card_on_file"],"primary_portal_blocker":"missing_card_on_file","payment_authorization_required":true,"payment_authorization_satisfied":false,"card_on_file":false,"allowed_actions":{"can_invite_to_portal":false,"can_send_verification_invoice":true,"can_mark_contract_signed":false,"can_mark_deposit_paid":false}}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Matrix summary: $PASS passed, $FAIL failed (5 core scenarios + insurance parity)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
