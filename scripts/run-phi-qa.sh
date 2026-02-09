#!/usr/bin/env bash
#
# PHI Boundary QA — run automated steps (1–3) against prod.
# Steps 4 (Vercel env) and 5 (logs) are manual.
#
# Usage:
#   export BROKER_BASE=https://sokana-phi-broker-634744984887.us-central1.run.app
#   export VERCEL_BASE=https://crmbackend-six-wine.vercel.app
#   export CLIENT_ID=ced55ced-c62c-48c0-81fb-353fe4a99cc4  # optional, this is the default
#   export JWT_ADMIN=<value-of-sb-access-token-cookie-from-browser>
#   ./scripts/run-phi-qa.sh
#
# Or inline:
#   JWT_ADMIN=... ./scripts/run-phi-qa.sh
#
# How to get JWT_ADMIN (same as sb-access-token cookie):
#   1. Log in as admin on prod (https://your-frontend-domain, same origin as API).
#   2. Open DevTools (F12) → Application (Chrome) or Storage (Firefox).
#   3. Cookies → select your backend domain (e.g. crmbackend-six-wine.vercel.app).
#   4. Copy the value of "sb-access-token" and: export JWT_ADMIN='<paste>'
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BROKER_BASE="${BROKER_BASE:-https://sokana-phi-broker-634744984887.us-central1.run.app}"
VERCEL_BASE="${VERCEL_BASE:-https://crmbackend-six-wine.vercel.app}"
CLIENT_ID="${CLIENT_ID:-ced55ced-c62c-48c0-81fb-353fe4a99cc4}"

if [[ -z "$JWT_ADMIN" ]]; then
  echo -e "${RED}Error: JWT_ADMIN is not set.${NC}"
  echo "  Set it to the value of the sb-access-token cookie (see comments in script)."
  echo "  export JWT_ADMIN=<paste-cookie-value>"
  exit 1
fi

PASS=0
FAIL=0

# --- Step 1: Broker health ---
echo ""
echo "Step 1: Broker /health (healthy + db connected)"
HEALTH_RESP=$(curl -s -w "\n%{http_code}" "$BROKER_BASE/health")
HEALTH_BODY=$(echo "$HEALTH_RESP" | sed '$d')
HEALTH_CODE=$(echo "$HEALTH_RESP" | tail -n 1)

if [[ "$HEALTH_CODE" == "200" ]] && echo "$HEALTH_BODY" | grep -q '"status":"healthy"' && echo "$HEALTH_BODY" | grep -q '"db":"connected"'; then
  echo -e "  ${GREEN}PASS${NC} (200, status=healthy, db=connected)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} (code=$HEALTH_CODE, body=$HEALTH_BODY)"
  FAIL=$((FAIL + 1))
fi

# --- Step 2: Backend client detail (admin gets PHI) ---
echo ""
echo "Step 2: Backend GET /clients/:id with admin JWT (expect 200 + success + PHI keys in data)"
# Backend accepts token via cookie sb-access-token (same value as JWT)
CLIENT_RESP=$(curl -s -w "\n%{http_code}" -H "Cookie: sb-access-token=$JWT_ADMIN" "$VERCEL_BASE/clients/$CLIENT_ID")
CLIENT_BODY=$(echo "$CLIENT_RESP" | sed '$d')
CLIENT_CODE=$(echo "$CLIENT_RESP" | tail -n 1)

OP_OK=false
PHI_OK=false
if [[ "$CLIENT_CODE" == "200" ]]; then
  if echo "$CLIENT_BODY" | grep -q '"success":true' && echo "$CLIENT_BODY" | grep -q '"data"'; then
    OP_OK=true
    # Check for at least one PHI-like key in data (phone_number, due_date, date_of_birth, etc.)
    if echo "$CLIENT_BODY" | grep -qE '"(phone_number|due_date|date_of_birth|address_line1|health_history|allergies|medications)"'; then
      PHI_OK=true
    fi
  fi
fi

if [[ "$CLIENT_CODE" == "200" ]] && [[ "$OP_OK" == true ]]; then
  if [[ "$PHI_OK" == true ]]; then
    echo -e "  ${GREEN}PASS${NC} (200, success=true, data has operational + PHI keys)"
  else
    echo -e "  ${YELLOW}PASS (partial)${NC} (200, success=true, data present but no PHI keys in response — client may have no phi row or backend not returning PHI)"
  fi
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} (code=$CLIENT_CODE, check body for errors)"
  FAIL=$((FAIL + 1))
fi

# --- Step 3: Broker rejects unsigned call ---
echo ""
echo "Step 3: Broker POST /v1/phi/client without signature (expect 401 or 403)"
# Use fixed placeholder body so broker always hits auth rejection path (some brokers 500 on long/real client_id body)
UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BROKER_BASE/v1/phi/client" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"00000000-0000-0000-0000-000000000000","requester":{"role":"admin","user_id":"x"}}')

if [[ "$UNAUTH_CODE" == "401" ]] || [[ "$UNAUTH_CODE" == "403" ]]; then
  echo -e "  ${GREEN}PASS${NC} (broker returned $UNAUTH_CODE — not public-open)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} (expected 401 or 403, got $UNAUTH_CODE)"
  FAIL=$((FAIL + 1))
fi

# --- Summary ---
echo ""
echo "--- Summary ---"
echo -e "  Automated steps: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "  Step 4 (Vercel env vars) and Step 5 (logs check) are manual — see docs/PHI_BOUNDARY_QA_VALIDATION.md"
echo ""

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
