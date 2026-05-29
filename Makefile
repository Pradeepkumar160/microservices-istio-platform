.PHONY: help build run stop k8s-deploy k8s-delete clean test logs status dashboards

# ─── Variables ────────────────────────────────────────────────────────────────
CLUSTER_NAME  := mesh-demo
NAMESPACE     := production
SERVICES      := api-gateway auth-service user-service product-service order-service notification-service
INGRESS_PORT  := 8080

# ─── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Microservices + Istio Platform — Makefile"
	@echo "  ==========================================="
	@echo ""
	@echo "  LOCAL DEVELOPMENT"
	@echo "  ─────────────────"
	@echo "  make build          Build all Docker images"
	@echo "  make run            Start all services with Docker Compose"
	@echo "  make stop           Stop Docker Compose services"
	@echo "  make logs           Stream logs from all services"
	@echo "  make test           Run integration tests against localhost:3000"
	@echo ""
	@echo "  KUBERNETES"
	@echo "  ──────────"
	@echo "  make cluster        Create k3d cluster"
	@echo "  make install-istio  Install Istio into cluster"
	@echo "  make k8s-import     Import Docker images into k3d"
	@echo "  make k8s-deploy     Deploy all resources to Kubernetes"
	@echo "  make k8s-delete     Delete all Kubernetes resources"
	@echo "  make status         Show pod and service status"
	@echo "  make dashboards     Open all monitoring dashboards"
	@echo ""
	@echo "  CLEANUP"
	@echo "  ───────"
	@echo "  make clean          Remove Docker Compose + images"
	@echo "  make destroy        Destroy k3d cluster"
	@echo ""

# ─── Docker ───────────────────────────────────────────────────────────────────
build:
	@echo "Building Docker images..."
	@for svc in $(SERVICES); do \
		echo "  Building $$svc..."; \
		docker build -t $$svc:latest ./services/$$svc; \
	done
	@echo "All images built!"

run:
	@echo "Starting services with Docker Compose..."
	docker compose up --build

stop:
	docker compose down

logs:
	docker compose logs -f

clean:
	docker compose down --volumes --remove-orphans
	@for svc in $(SERVICES); do \
		docker rmi $$svc:latest 2>/dev/null || true; \
	done
	@echo "Cleaned up!"

# ─── Kubernetes + Istio ───────────────────────────────────────────────────────
cluster:
	@echo "Creating k3d cluster '$(CLUSTER_NAME)'..."
	k3d cluster create $(CLUSTER_NAME) \
		--agents 2 \
		-p "$(INGRESS_PORT):80@loadbalancer" \
		-p "8443:443@loadbalancer" \
		--wait
	@echo "Cluster ready!"
	kubectl cluster-info

install-istio:
	@echo "Installing Istio..."
	istioctl install --set profile=demo -y
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl label namespace $(NAMESPACE) istio-injection=enabled --overwrite
	@echo "Waiting for Istio pods..."
	kubectl wait --for=condition=ready pod -l app=istiod -n istio-system --timeout=120s
	@echo "Istio installed!"
	kubectl get pods -n istio-system

install-addons:
	@echo "Installing monitoring addons..."
	kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons/jaeger.yaml
	kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons/prometheus.yaml
	kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons/grafana.yaml
	kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons/kiali.yaml
	@echo "Addons installed! Wait ~2 minutes for them to start."

k8s-import: build
	@echo "Importing images into k3d..."
	@for svc in $(SERVICES); do \
		echo "  Importing $$svc..."; \
		k3d image import $$svc:latest -c $(CLUSTER_NAME); \
	done
	@echo "All images imported!"

k8s-deploy:
	@echo "Deploying to Kubernetes..."
	kubectl apply -f k8s/namespaces/
	kubectl apply -f k8s/services/
	kubectl apply -f k8s/istio/
	@echo "Waiting for deployments..."
	@for svc in $(SERVICES); do \
		kubectl rollout status deployment/$$svc -n $(NAMESPACE) --timeout=2m; \
	done
	@echo "All services deployed!"
	kubectl get pods -n $(NAMESPACE)

k8s-delete:
	kubectl delete -f k8s/istio/ --ignore-not-found
	kubectl delete -f k8s/services/ --ignore-not-found

destroy:
	k3d cluster delete $(CLUSTER_NAME) 2>/dev/null || true
	@echo "Cluster deleted!"

# ─── Testing ──────────────────────────────────────────────────────────────────
test:
	@bash scripts/test.sh

status:
	@echo "=== Pods ==="
	kubectl get pods -n $(NAMESPACE)
	@echo ""
	@echo "=== Services ==="
	kubectl get svc -n $(NAMESPACE)
	@echo ""
	@echo "=== Ingress Gateway ==="
	kubectl get svc istio-ingressgateway -n istio-system

# ─── Dashboards ───────────────────────────────────────────────────────────────
dashboards:
	@echo "Opening dashboards in separate terminals..."
	@echo "  Kiali:      http://localhost:20001"
	@echo "  Jaeger:     http://localhost:16686"
	@echo "  Grafana:    http://localhost:3000"
	@echo "  Prometheus: http://localhost:9090"
	istioctl dashboard kiali &
	istioctl dashboard jaeger &
	istioctl dashboard grafana &
	istioctl dashboard prometheus &

# ─── Quick-start (does everything) ───────────────────────────────────────────
setup: cluster install-istio k8s-import k8s-deploy install-addons
	@echo ""
	@echo "Setup complete! Run 'make test' to verify."
