#!/usr/bin/env bash
# Test: login with staff credentials, then GET /auth/me and GET /clients.
# Uses TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, BACKEND_URL from environment.
# Usage: ./scripts/test-cloudsql-auth.sh   (or: source .env && ./scripts/test-cloudsql-auth.sh)

set -e

BASE_URL="${BACKEND_URL:-http://localhost:5050}"
EMAIL="${TEST_ADMIN_EMAIL:-}"
PASSWORD="${TEST_ADMIN_PASSWORD:-}"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD (e.g. in .env), then run again."
  exit 1
fi

COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

echo "1) Login (POST $BASE_URL/auth/login)"
LOGIN=$(curl -s -w "\n%{http_code}" -c "$COOKIE_JAR" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
HTTP=$(echo "$LOGIN" | tail -n1)
BODY=$(echo "$LOGIN" | sed '$d')
if [ "$HTTP" != "200" ]; then
  echo "   Login failed (HTTP $HTTP). Body: $BODY"
  exit 1
fi
echo "   OK (HTTP 200)"

echo ""
echo "2) GET /auth/me"
ME=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" "$BASE_URL/auth/me")
HTTP=$(echo "$ME" | tail -n1)
BODY=$(echo "$ME" | sed '$d')
if [ "$HTTP" != "200" ]; then
  echo "   Failed (HTTP $HTTP). Body: $BODY"
  exit 1
fi
echo "   OK (HTTP 200). Response: $BODY"

echo ""
echo "3) GET /clients (protected)"
CLIENTS=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" "$BASE_URL/clients?limit=5")
HTTP=$(echo "$CLIENTS" | tail -n1)
BODY=$(echo "$CLIENTS" | sed '$d')
if [ "$HTTP" != "200" ]; then
  echo "   Failed (HTTP $HTTP). Body: $BODY"
  exit 1
fi
echo "   OK (HTTP 200). Response (preview): $(echo "$BODY" | head -c 200)..."

echo ""
echo "Done. Authenticated user can access /clients."
