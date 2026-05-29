#!/bin/bash
###############################################################################
# FULL SETUP SCRIPT — run once to bootstrap everything
# Usage: bash scripts/setup.sh
###############################################################################

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

need() {
  command -v "$1" &>/dev/null || error "$1 is not installed. Install it first."
}

###############################################################################
info "Checking prerequisites..."
###############################################################################
need docker
need kubectl
need k3d
need istioctl
success "All tools present"

###############################################################################
info "Creating k3d cluster..."
###############################################################################
if k3d cluster list 2>/dev/null | grep -q mesh-demo; then
  warn "Cluster 'mesh-demo' already exists, skipping."
else
  k3d cluster create mesh-demo \
    --agents 2 \
    -p "8080:80@loadbalancer" \
    -p "8443:443@loadbalancer" \
    --wait
  success "k3d cluster created"
fi

###############################################################################
info "Installing Istio..."
###############################################################################
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -
istioctl install --set profile=demo -y
kubectl label namespace production istio-injection=enabled --overwrite
success "Istio installed"

###############################################################################
info "Building Docker images..."
###############################################################################
SERVICES=(api-gateway auth-service user-service product-service order-service notification-service)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

for svc in "${SERVICES[@]}"; do
  info "  Building $svc..."
  docker build -t "$svc:latest" "./services/$svc"
done
success "All images built"

###############################################################################
info "Importing images into k3d..."
###############################################################################
for svc in "${SERVICES[@]}"; do
  k3d image import "$svc:latest" -c mesh-demo
done
success "Images imported"

###############################################################################
info "Deploying to Kubernetes..."
###############################################################################
kubectl apply -f k8s/namespaces/
kubectl apply -f k8s/services/
kubectl apply -f k8s/istio/
success "Resources deployed"

###############################################################################
info "Waiting for pods to be ready..."
###############################################################################
for svc in "${SERVICES[@]}"; do
  kubectl rollout status deployment/"$svc" -n production --timeout=3m
done
success "All pods ready"

###############################################################################
info "Installing monitoring addons (Jaeger, Prometheus, Grafana, Kiali)..."
###############################################################################
ISTIO_BASE="https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons"
kubectl apply -f "$ISTIO_BASE/jaeger.yaml"
kubectl apply -f "$ISTIO_BASE/prometheus.yaml"
kubectl apply -f "$ISTIO_BASE/grafana.yaml"
kubectl apply -f "$ISTIO_BASE/kiali.yaml"
success "Monitoring addons installed (may take 2–3 min to start)"

###############################################################################
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}   Setup complete! Platform is ready.  ${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  Test:       bash scripts/test.sh"
echo "  Status:     make status"
echo "  Dashboards: make dashboards"
echo ""
echo "  API base:   http://localhost:8080"
echo "  Login:      POST /auth/login"
echo "              { \"email\": \"admin@test.com\", \"password\": \"password\" }"
echo ""
