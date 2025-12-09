#!/bin/bash

# Simple bash script to test doula endpoints using curl
# Usage: ./scripts/test-doula-endpoints-simple.sh

BASE_URL="${BACKEND_URL:-http://localhost:5050}"
API_BASE="${BASE_URL}/api"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 Doula Endpoints Test Script${NC}"
echo -e "${YELLOW}Base URL: ${BASE_URL}${NC}\n"

# Test credentials - UPDATE THESE
ADMIN_EMAIL="${TEST_ADMIN_EMAIL:-admin@test.com}"
ADMIN_PASSWORD="${TEST_ADMIN_PASSWORD:-admin123}"
DOULA_EMAIL="${TEST_DOULA_EMAIL:-doula@test.com}"
DOULA_PASSWORD="${TEST_DOULA_PASSWORD:-doula123}"

# Login and get tokens
echo -e "${CYAN}1. Admin Login${NC}"
ADMIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Admin login failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Admin logged in${NC}\n"

echo -e "${CYAN}2. Doula Login${NC}"
DOULA_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${DOULA_EMAIL}\",\"password\":\"${DOULA_PASSWORD}\"}")

DOULA_TOKEN=$(echo $DOULA_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$DOULA_TOKEN" ]; then
  echo -e "${RED}❌ Doula login failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Doula logged in${NC}\n"

# Test endpoints
echo -e "${CYAN}3. Admin: Invite Doula${NC}"
curl -s -X POST "${API_BASE}/admin/doulas/invite" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-doula-$(date +%s)@test.com\",\"firstname\":\"Test\",\"lastname\":\"Doula\"}" | jq .
echo ""

echo -e "${CYAN}4. Doula: Get My Documents${NC}"
curl -s -X GET "${API_BASE}/doulas/documents" \
  -H "Authorization: Bearer ${DOULA_TOKEN}" | jq .
echo ""

echo -e "${CYAN}5. Doula: Get My Clients${NC}"
curl -s -X GET "${API_BASE}/doulas/clients" \
  -H "Authorization: Bearer ${DOULA_TOKEN}" | jq .
echo ""

echo -e "${CYAN}6. Doula: Get My Hours${NC}"
curl -s -X GET "${API_BASE}/doulas/hours" \
  -H "Authorization: Bearer ${DOULA_TOKEN}" | jq .
echo ""

echo -e "${CYAN}7. Doula: Get My Profile${NC}"
curl -s -X GET "${API_BASE}/doulas/profile" \
  -H "Authorization: Bearer ${DOULA_TOKEN}" | jq .
echo ""

echo -e "${GREEN}✅ Basic endpoint tests completed${NC}"
echo -e "${YELLOW}Note: For file upload tests, use the TypeScript test script${NC}"
