#!/bin/bash
###############################################################################
# Integration Test Script
# Tests all endpoints through the API Gateway
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

# Detect base URL — use k8s ingress or local compose
if kubectl get svc istio-ingressgateway -n istio-system &>/dev/null 2>&1; then
  INGRESS=$(kubectl get svc istio-ingressgateway -n istio-system \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
  BASE_URL="http://${INGRESS:-localhost:8080}"
else
  BASE_URL="http://localhost:3000"
fi

echo ""
echo -e "${BLUE}Microservices Integration Tests${NC}"
echo "=================================="
echo "Target: $BASE_URL"
echo ""

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAIL++)); }
section() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

###############################################################################
section "Health Checks"
###############################################################################

for svc in auth-service user-service product-service order-service notification-service; do
  PORT=$(case $svc in
    auth-service) echo 3001;;
    user-service) echo 3002;;
    product-service) echo 3003;;
    order-service) echo 3004;;
    notification-service) echo 3005;;
  esac)
  if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    pass "$svc health"
  else
    # Try through gateway
    if curl -sf "${BASE_URL}/health" > /dev/null 2>&1; then
      pass "API Gateway health"
    else
      fail "$svc health (port $PORT unreachable)"
    fi
  fi
done

###############################################################################
section "Authentication"
###############################################################################

# Login
RESPONSE=$(curl -sf -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password"}' 2>/dev/null || echo '{}')

TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  pass "Login (got JWT token)"
else
  fail "Login failed"
  echo "  Response: $RESPONSE"
fi

# Login with wrong password
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"wrongpassword"}' 2>/dev/null)
[ "$STATUS" = "401" ] && pass "Login rejects wrong password (401)" || fail "Login should return 401 for wrong password (got $STATUS)"

# Register new user
REGISTER_RESPONSE=$(curl -sf -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"testuser@example.com","password":"securepass"}' 2>/dev/null || echo '{}')
echo "$REGISTER_RESPONSE" | grep -q '"token"' && pass "User registration" || fail "User registration"

###############################################################################
section "Products (public)"
###############################################################################

PRODUCTS=$(curl -sf "${BASE_URL}/products" 2>/dev/null || echo '{}')
echo "$PRODUCTS" | grep -q '"success":true' && pass "GET /products" || fail "GET /products"

PRODUCT=$(curl -sf "${BASE_URL}/products/1" 2>/dev/null || echo '{}')
echo "$PRODUCT" | grep -q '"success":true' && pass "GET /products/1" || fail "GET /products/1"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/products/99999" 2>/dev/null)
[ "$STATUS" = "404" ] && pass "GET /products/99999 returns 404" || fail "GET /products/99999 should return 404 (got $STATUS)"

###############################################################################
section "Users (protected)"
###############################################################################

if [ -n "$TOKEN" ]; then
  USERS=$(curl -sf "${BASE_URL}/users" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo '{}')
  echo "$USERS" | grep -q '"success":true' && pass "GET /users (authenticated)" || fail "GET /users"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/users" 2>/dev/null)
  [ "$STATUS" = "401" ] && pass "GET /users rejects unauthenticated (401)" || fail "GET /users should reject without token (got $STATUS)"
else
  fail "Skipping user tests (no token)"
fi

###############################################################################
section "Orders (protected)"
###############################################################################

if [ -n "$TOKEN" ]; then
  ORDER=$(curl -sf -X POST "${BASE_URL}/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"userId":1,"productId":1,"quantity":1}' 2>/dev/null || echo '{}')
  echo "$ORDER" | grep -q '"success":true' && pass "POST /orders (create order)" || fail "POST /orders"

  ORDERS=$(curl -sf "${BASE_URL}/orders" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo '{}')
  echo "$ORDERS" | grep -q '"success":true' && pass "GET /orders" || fail "GET /orders"
else
  fail "Skipping order tests (no token)"
fi

###############################################################################
section "Summary"
###############################################################################

TOTAL=$((PASS + FAIL))
echo ""
echo "Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC} (${TOTAL} total)"

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed.${NC}"
  exit 1
fi
