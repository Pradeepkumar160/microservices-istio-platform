#!/bin/bash
###############################################################################
# CLEANUP SCRIPT
###############################################################################
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }

echo "Cleaning up Microservices Platform..."

# Delete k3d cluster
if k3d cluster list 2>/dev/null | grep -q mesh-demo; then
  k3d cluster delete mesh-demo
  ok "k3d cluster deleted"
else
  warn "No cluster found"
fi

# Stop Docker Compose
docker compose down --volumes --remove-orphans 2>/dev/null || true
ok "Docker Compose stopped"

# Remove images
SERVICES=(api-gateway auth-service user-service product-service order-service notification-service)
for svc in "${SERVICES[@]}"; do
  docker rmi "$svc:latest" 2>/dev/null && ok "Removed $svc:latest" || warn "$svc image not found"
done

echo ""
echo -e "${GREEN}Cleanup complete!${NC}"
