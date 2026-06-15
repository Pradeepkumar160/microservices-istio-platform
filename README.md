<p align="center">
  <h1 align="center">🔷 Microservices + Istio Platform</h1>
  <p align="center">
    Production-grade cloud-native microservices platform with Kubernetes, Istio Service Mesh, JWT authentication, canary deployments, circuit breaking, and a live frontend dashboard.
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white"/>
    <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white"/>
    <img src="https://img.shields.io/badge/Kubernetes-k3d-326CE5?style=flat-square&logo=kubernetes&logoColor=white"/>
    <img src="https://img.shields.io/badge/Istio-1.22-466BB0?style=flat-square&logo=istio&logoColor=white"/>
    <img src="https://img.shields.io/badge/JWT-Auth-000000?style=flat-square&logo=jsonwebtokens&logoColor=white"/>
    <img src="https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white"/>
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square"/>
  </p>
</p>

---

## 📋 Table of Contents 

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start — Docker Compose](#-quick-start--docker-compose)
- [Quick Start — Kubernetes + Istio](#-quick-start--kubernetes--istio)
- [Frontend Dashboard](#-frontend-dashboard)
- [API Reference](#-api-reference)
- [Istio Features](#-istio-features)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Makefile Commands](#-makefile-commands)
- [Monitoring](#-monitoring)
- [Default Credentials](#-default-credentials)
- [Production Checklist](#-production-checklist)

---

## 🌐 Overview

This platform demonstrates a real-world microservices architecture running 6 independent Node.js services behind an API Gateway, with Istio handling all service mesh concerns — mTLS encryption, traffic shaping, circuit breaking, and retries.

**What's working (verified):**
- ✅ All 6 services build and start via `docker compose up --build`
- ✅ Health checks pass on every container
- ✅ JWT login → protected route access → order creation end-to-end
- ✅ Stock deduction and notification dispatch on order creation
- ✅ GitHub Actions CI/CD pipeline
- ✅ Kubernetes manifests with Istio traffic policies
- ✅ Live browser dashboard (`dashboard.html`)

---

## 🏗 Architecture 

```
                    ┌─────────────────────────────────────────┐
                    │         Istio Ingress Gateway            │
                    │              :8080 / :8443               │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────▼────────────────────────┐
                    │            API Gateway :3000             │
                    │  • Rate limiting (express-rate-limit)    │
                    │  • JWT verification (jsonwebtoken)       │
                    │  • Request routing + Helmet headers      │
                    └──┬──────┬──────┬──────┬─────────────────┘
                       │      │      │      │
          ┌────────────┘  ┌───┘  ┌───┘  ┌──┘
          ▼               ▼      ▼      ▼
   ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │Auth Service │ │  Users   │ │ Products │ │   Orders     │
   │   :3001     │ │  :3002   │ │  :3003   │ │   :3004      │
   │ bcrypt hash │ │ User CRUD│ │ Catalog  │ │ Stock check  │
   │ JWT sign    │ │          │ │ Stock mgmt│ │ Order flow   │
   └─────────────┘ └──────────┘ └──────────┘ └──────┬───────┘
                                                      │
                                           ┌──────────▼───────┐
                                           │  Notifications   │
                                           │     :3005        │
                                           │  Event logging   │
                                           └──────────────────┘

   ── All inter-service traffic encrypted via Istio mTLS STRICT ──
```

**Order creation flow (verified live):**
```
POST /orders → Gateway (JWT check) → Order Service
                                        ├── GET /products/:id   (validate)
                                        ├── PATCH /stock        (deduct)
                                        └── POST /notify        (dispatch)
                                                 → [ORDER_CREATED] logged
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 20 + Express.js | All 6 microservices |
| Security | bcrypt + jsonwebtoken + Helmet | Password hashing, JWT auth, HTTP headers |
| HTTP Client | axios | Inter-service communication |
| Containers | Docker + Docker Compose | Local development |
| Orchestration | Kubernetes (k3d for local) | Production deployment |
| Service Mesh | Istio 1.22 | mTLS, traffic management, observability |
| Tracing | Jaeger + OpenTelemetry | Distributed traces |
| Monitoring | Prometheus + Grafana | Metrics + dashboards |
| Visualization | Kiali | Service graph |
| CI/CD | GitHub Actions | Build → test → push → deploy |

---

## 📁 Project Structure

```
microservices-istio-platform/
│
├── services/
│   ├── api-gateway/          # :3000 — routing, JWT validation, rate limiting
│   ├── auth-service/         # :3001 — login, register, bcrypt, JWT sign
│   ├── user-service/         # :3002 — user CRUD (protected)
│   ├── product-service/      # :3003 — product catalog + stock management
│   ├── order-service/        # :3004 — orders, stock validation, notifications
│   └── notification-service/ # :3005 — event log + notification dispatch
│
├── k8s/
│   ├── namespaces/           # production namespace definition
│   ├── services/             # Deployments, Services, Secrets, resource limits
│   └── istio/                # Gateway, VirtualServices, DestinationRules, mTLS
│
├── scripts/
│   ├── setup.sh              # One-command full K8s + Istio bootstrap
│   ├── test.sh               # Integration test suite (login, auth, orders)
│   └── cleanup.sh            # Tear down everything
│
├── .github/workflows/
│   └── deploy.yml            # CI/CD: build → test → push GHCR → k8s deploy
│
├── dashboard.html            # Frontend dashboard (connects to localhost:3000)
├── docker-compose.yml        # Local dev — all 6 services with healthchecks
├── Makefile                  # 15 convenience commands
└── README.md
```

---

## 🚀 Quick Start — Docker Compose

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
# Clone the repo
git clone https://github.com/Pradeepkumar160/microservices-istio-platform.git
cd microservices-istio-platform

# Start all 6 services (first run ~2-3 min)
docker compose up --build
```

Watch for these 6 lines — all services are ready when you see them:
```
auth-service         | [Auth Service] Running on port 3001
user-service         | [User Service] Running on port 3002
product-service      | [Product Service] Running on port 3003
order-service        | [Order Service] Running on port 3004
notification-service | [Notification Service] Running on port 3005
api-gateway          | [API Gateway] Running on port 3000
```

**Verify everything works (PowerShell):**

```powershell
# 1. Health check
Invoke-RestMethod http://localhost:3000/health

# 2. Get products (public)
Invoke-RestMethod http://localhost:3000/products

# 3. Login and capture JWT
$body = @{ email = "admin@test.com"; password = "password" } | ConvertTo-Json
$resp = Invoke-RestMethod -Method POST http://localhost:3000/auth/login `
        -ContentType "application/json" -Body $body
$token = $resp.token

# 4. Protected route
Invoke-RestMethod http://localhost:3000/users `
  -Headers @{ Authorization = "Bearer $token" }

# 5. Create an order (triggers stock deduction + notification)
$order = @{ userId=1; productId=2; quantity=1 } | ConvertTo-Json
Invoke-RestMethod -Method POST http://localhost:3000/orders `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $order
```

**Or use bash:**
```bash
bash scripts/test.sh
```

---

## ☸️ Quick Start — Kubernetes + Istio

**Prerequisites:** Docker, kubectl, k3d, istioctl

```bash
# One-command full setup (cluster → istio → build → deploy → addons)
bash scripts/setup.sh

# OR step-by-step:
make cluster          # Create k3d cluster
make install-istio    # Install Istio
make k8s-import       # Build + import images into cluster
make k8s-deploy       # Apply all K8s manifests
make install-addons   # Jaeger, Prometheus, Grafana, Kiali
make status           # Verify all pods are Running
```

---

## 🖥 Frontend Dashboard

Open `dashboard.html` in your browser while Docker is running.

**No install needed** — it's a single HTML file that connects to `localhost:3000`.

Features:
- Live service health monitoring for all 6 containers
- Products catalogue fetched from the real API
- Login form with JWT token storage
- Protected routes (Users) using stored token
- Order creation form with real-time response
- Live log stream showing service activity
- All service endpoints documented

---

## 📡 API Reference

All protected routes require:
```
Authorization: Bearer <token>
```

### Auth (public)

```http
POST /auth/login
Content-Type: application/json

{ "email": "admin@test.com", "password": "password" }
→ { "token": "eyJ...", "user": {...}, "expiresIn": "24h" }
```

```http
POST /auth/register
{ "name": "Jane", "email": "jane@example.com", "password": "pass123" }
```

### Products (public GET, protected write)

```http
GET    /products              # List all (?category=Electronics&search=laptop)
GET    /products/:id          # Single product
POST   /products              # Create  [auth]
PUT    /products/:id          # Update  [auth]
PATCH  /products/:id/stock    # Adjust stock  [auth]
```

### Users (protected)

```http
GET    /users                 # List all
GET    /users/:id             # Single user
PUT    /users/:id             # Update
DELETE /users/:id             # Delete
```

### Orders (protected)

```http
POST   /orders                # Create → validates stock → notifies
GET    /orders                # List (?userId=1&status=created)
GET    /orders/:id            # Single order
PATCH  /orders/:id/status     # Update status
```

### Health

```http
GET /health   # Gateway status + all service URLs + uptime
```

---

## 🕸 Istio Features

### mTLS — Mutual TLS
All service-to-service traffic is encrypted in `STRICT` mode.  
Config: `k8s/istio/mtls.yaml`

### Canary Deployment
Product service routes 90% traffic to `v1`, 10% to `v2`.  
Config: `k8s/istio/virtual-services.yaml`

```yaml
# Adjust split in k8s/istio/virtual-services.yaml:
- destination:
    host: product-service
    subset: v1
  weight: 70        # ← decrease to shift more to canary
- destination:
    host: product-service
    subset: v2
  weight: 30        # ← increase canary traffic
```
Apply: `kubectl apply -f k8s/istio/virtual-services.yaml`

### Circuit Breaker
Order service ejects after 3 consecutive 5xx errors, 30s base ejection time.  
Config: `k8s/istio/destination-rules.yaml`

### Retries
Order service: 3 retries, 3s per-try timeout, 15s total timeout.

### Authorization Policy
mTLS peer authentication + JWT request authentication enforced at the mesh level.

---

## ⚙️ CI/CD Pipeline

`.github/workflows/deploy.yml` runs on every push to `main` / `develop`:

```
push to main
    │
    ├─ Build all 6 Docker images
    ├─ Start services via docker compose
    ├─ Run health checks
    ├─ Run integration tests (login, 401, products, orders)
    ├─ Push images to GHCR
    └─ kubectl set image (rolling deploy)
```

---

## 🛠 Makefile Commands

```bash
make help           # Show all commands

# Local development
make build          # Build all Docker images
make run            # docker compose up --build
make stop           # docker compose down
make logs           # Streaming logs from all services
make test           # Run integration test suite

# Kubernetes
make cluster        # Create k3d cluster
make install-istio  # Install Istio control plane
make k8s-import     # Build + import images into k3d
make k8s-deploy     # Apply all K8s manifests
make k8s-delete     # Remove K8s manifests
make status         # Show pods and services
make install-addons # Jaeger, Prometheus, Grafana, Kiali
make dashboards     # Open all monitoring dashboards

# Full lifecycle
make setup          # One-shot: cluster → istio → build → deploy → addons
make clean          # Remove compose containers + images
make destroy        # Delete k3d cluster entirely
```

---

## 📊 Monitoring

After `make install-addons`:

```bash
make dashboards

# Or individually:
istioctl dashboard kiali       # http://localhost:20001 — service mesh graph
istioctl dashboard jaeger      # http://localhost:16686 — distributed traces
istioctl dashboard grafana     # http://localhost:3000  — metrics dashboards
istioctl dashboard prometheus  # http://localhost:9090  — raw metrics
```

---

## 🔑 Default Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@test.com | password |
| User | john@test.com | password |

> ⚠️ For production: use a secrets manager (HashiCorp Vault, AWS Secrets Manager). Never commit real credentials.

---

## ✅ Production Checklist

- [ ] Replace in-memory stores with PostgreSQL / MongoDB
- [ ] Add Redis caching layer
- [ ] Use a secrets manager for JWT secret and credentials
- [ ] Enable Horizontal Pod Autoscaler (HPA)
- [ ] Configure Loki for log aggregation
- [ ] Add network policies (Calico / Cilium)
- [ ] Set up ArgoCD for GitOps
- [ ] Enable cert rotation for mTLS
- [ ] Configure OPA/Gatekeeper for policy enforcement
- [ ] Push images to a private registry (GHCR / ECR / GCR)

---

## 📄 License

MIT — free to use, modify, and distribute.

---

<p align="center">Built with Node.js · Docker · Kubernetes · Istio</p>
