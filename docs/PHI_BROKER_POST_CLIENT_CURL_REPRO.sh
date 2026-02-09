#!/usr/bin/env bash
# PHI Broker POST /v1/phi/client — curl repro for status codes
# Run from repo root. Set BROKER_URL and SHARED_SECRET (for 200 case).
# Usage: BROKER_URL=http://localhost:8080 SHARED_SECRET=your-secret ./docs/PHI_BROKER_POST_CLIENT_CURL_REPRO.sh

set -e
BROKER_URL="${BROKER_URL:-http://localhost:8080}"
SHARED_SECRET="${PHI_BROKER_SHARED_SECRET:-$SHARED_SECRET}"

echo "=== PHI Broker POST /v1/phi/client repro (BROKER_URL=$BROKER_URL) ==="

# 1) Missing auth headers => 401
echo ""
echo "1) No auth headers (expect 401)"
CODE=$(curl -s -o /tmp/phi_401.json -w "%{http_code}" -X POST "$BROKER_URL/v1/phi/client" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"a1b2c3d4-e5f6-4789-a012-345678901234","requester":{"role":"admin","user_id":"u1"}}')
echo "   HTTP $CODE"
if [ "$CODE" = "401" ]; then echo "   OK"; else echo "   FAIL (expected 401)"; cat /tmp/phi_401.json; fi

# 2) Missing client_id => 400
BODY_NO_CLIENT='{"requester":{"role":"admin","user_id":"u1"}}'
TS=$(date +%s)000
SIG=""
if [ -n "$SHARED_SECRET" ]; then
  SIG=$(echo -n "${TS}.${BODY_NO_CLIENT}" | openssl dgst -sha256 -hmac "$SHARED_SECRET" 2>/dev/null | awk '{print $2}')
fi
echo ""
echo "2) Missing client_id (expect 400)"
CODE=$(curl -s -o /tmp/phi_400.json -w "%{http_code}" -X POST "$BROKER_URL/v1/phi/client" \
  -H "Content-Type: application/json" \
  -H "X-Sokana-Timestamp: $TS" \
  -H "X-Sokana-Signature: ${SIG:-0000000000000000000000000000000000000000000000000000000000000000}" \
  -d "$BODY_NO_CLIENT")
echo "   HTTP $CODE"
if [ "$CODE" = "400" ]; then echo "   OK"; else echo "   FAIL (expected 400)"; cat /tmp/phi_400.json; fi

# 3) Invalid client_id (not UUID) => 400
BODY_BAD_UUID='{"client_id":"not-a-uuid","requester":{"role":"admin","user_id":"u1"}}'
TS3=$(date +%s)000
SIG3=""
if [ -n "$SHARED_SECRET" ]; then
  SIG3=$(echo -n "${TS3}.${BODY_BAD_UUID}" | openssl dgst -sha256 -hmac "$SHARED_SECRET" 2>/dev/null | awk '{print $2}')
fi
echo ""
echo "3) Invalid client_id format (expect 400)"
CODE=$(curl -s -o /tmp/phi_400b.json -w "%{http_code}" -X POST "$BROKER_URL/v1/phi/client" \
  -H "Content-Type: application/json" \
  -H "X-Sokana-Timestamp: $TS3" \
  -H "X-Sokana-Signature: ${SIG3:-0000000000000000000000000000000000000000000000000000000000000000}" \
  -d "$BODY_BAD_UUID")
echo "   HTTP $CODE"
if [ "$CODE" = "400" ]; then echo "   OK"; else echo "   FAIL (expected 400)"; cat /tmp/phi_400b.json; fi

# 4) Unknown client_id (valid UUID, no row in DB) => 404
UNKNOWN_UUID="a1b2c3d4-e5f6-4789-a012-345678901234"
BODY_404='{"client_id":"'$UNKNOWN_UUID'","requester":{"role":"admin","user_id":"u1"}}'
TS4=$(date +%s)000
SIG4=""
if [ -n "$SHARED_SECRET" ]; then
  SIG4=$(echo -n "${TS4}.${BODY_404}" | openssl dgst -sha256 -hmac "$SHARED_SECRET" 2>/dev/null | awk '{print $2}')
fi
echo ""
echo "4) Unknown client_id (valid UUID, no row) (expect 404)"
CODE=$(curl -s -o /tmp/phi_404.json -w "%{http_code}" -X POST "$BROKER_URL/v1/phi/client" \
  -H "Content-Type: application/json" \
  -H "X-Sokana-Timestamp: $TS4" \
  -H "X-Sokana-Signature: ${SIG4:-0000000000000000000000000000000000000000000000000000000000000000}" \
  -d "$BODY_404")
echo "   HTTP $CODE"
if [ "$CODE" = "404" ]; then echo "   OK"; else echo "   FAIL (expected 404)"; cat /tmp/phi_404.json; fi

# 5) Valid request (real client_id in DB + correct signature) => 200
if [ -z "$SHARED_SECRET" ]; then
  echo ""
  echo "5) Skipped (set SHARED_SECRET or PHI_BROKER_SHARED_SECRET and CLIENT_ID for 200 test)"
else
  CLIENT_ID="${CLIENT_ID:-a1b2c3d4-e5f6-4789-a012-345678901234}"
  BODY_200='{"client_id":"'$CLIENT_ID'","requester":{"role":"admin","user_id":"u1"}}'
  TS5=$(date +%s)000
  SIG5=$(echo -n "${TS5}.${BODY_200}" | openssl dgst -sha256 -hmac "$SHARED_SECRET" 2>/dev/null | awk '{print $2}')
  echo ""
  echo "5) Valid request (expect 200)"
  CODE=$(curl -s -o /tmp/phi_200.json -w "%{http_code}" -X POST "$BROKER_URL/v1/phi/client" \
    -H "Content-Type: application/json" \
    -H "X-Sokana-Timestamp: $TS5" \
    -H "X-Sokana-Signature: $SIG5" \
    -d "$BODY_200")
  echo "   HTTP $CODE"
  if [ "$CODE" = "200" ]; then echo "   OK"; else echo "   Body:"; cat /tmp/phi_200.json; fi
fi

echo ""
echo "=== Done ==="
