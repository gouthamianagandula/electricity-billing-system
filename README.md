# PowerBill: Electricity Consumption Tracking and Billing System

A full-stack web application that digitises the complete electricity billing cycle: customer and meter management, meter reading, slab-based billing, simulated payments, role-based dashboards and reports. The project is packaged with Docker and deployed on Kubernetes.

---

## Table of contents

- [Features](#features)
- [User roles](#user-roles)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Billing logic](#billing-logic)
- [Demo accounts](#demo-accounts)
- [Getting started](#getting-started)
  - [Option 1: Kubernetes](#option-1-kubernetes-docker-desktop)
  - [Option 2: Docker Compose](#option-2-docker-compose)
  - [Option 3: Local development](#option-3-local-development)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Future enhancements](#future-enhancements)
- [Author](#author)

---

## Features

- Four user roles with role-based access control on both the server and the interface
- Customer and meter management (add, edit, search, activate or deactivate meters)
- Meter reading entry with an automatic units preview (consumption = current reading - previous reading)
- Bill generation from tariff slabs plus a fixed charge, with due dates and automatic OVERDUE status
- Simulated payments (UPI, card, net banking) that store a transaction ID
- Role-specific dashboards with summary cards and charts
- Consumption trends, due dates and payment history for customers
- Four reports with filters, CSV export and print: **Monthly Consumption**, **Customer Billing**, **Payment Status** and **High Consumption**
- Responsive layout that works on desktop and mobile widths

## User roles

| Role | What the user can do |
|---|---|
| **Admin** | Everything Utility Staff can do, plus delete customers |
| **Utility Staff** | Manage customers and meters, generate bills, view payments and reports |
| **Meter Reader** | Record meter readings, see meters still to be read this month |
| **Customer** | View own bills, pay bills, see consumption trends and payment history |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router, Recharts, Axios |
| Backend | Node.js 20, Express, JWT (jsonwebtoken), bcryptjs, node-postgres |
| Database | PostgreSQL 16 |
| Web server | nginx (serves the React build and proxies `/api` to the backend) |
| DevOps | Git and GitHub, Docker, Docker Compose, Kubernetes |

## Architecture

The browser talks only to nginx. nginx serves the React files and forwards every request that starts with `/api` to the backend, so the whole website is available through **one link**.

```
Browser
   |  one URL
   v
Frontend service    nginx + React build          (2 pods, NodePort)
   |  /api/*
   v
Backend service     Node.js + Express REST API   (2 pods, ClusterIP)
   |  SQL
   v
Database service    PostgreSQL 16                (1 pod + persistent volume)
```

## Project structure

```
electricity-billing-system/
|-- backend/
|   |-- db/                 schema.sql and seed.js
|   |-- src/
|   |   |-- routes/         auth, customers, meters, readings, bills,
|   |   |                   payments, reports, dashboard
|   |   |-- middleware/     JWT authentication and role authorization
|   |   |-- services/       slab-based billing calculation
|   |   |-- db.js           PostgreSQL connection pool
|   |   `-- server.js       Express application
|   |-- Dockerfile
|   `-- .env.example
|-- frontend/
|   |-- src/
|   |   |-- pages/          Login, Dashboard, Customers, Readings, Bills,
|   |   |                   Payments, Trends, Reports
|   |   |-- components/     Layout with a role-based menu
|   |   |-- api.js          Axios client
|   |   `-- AuthContext.jsx login state
|   |-- nginx.conf
|   `-- Dockerfile
|-- k8s/                    Kubernetes manifests
|-- docs/                   documentation and screenshots
|-- docker-compose.yml
`-- README.md
```

## Billing logic

The energy charge is calculated slab by slab, so only the units that fall inside each slab are charged at that slab's rate.

| Slab | Units | Rate per unit |
|---|---|---|
| 1 | 0 to 100 | Rs 3.50 |
| 2 | 101 to 200 | Rs 5.00 |
| 3 | 201 to 300 | Rs 7.00 |
| 4 | Above 300 | Rs 9.00 |

- **Total bill** = energy charge + fixed charge (Rs 50)
- **Due date** = reading date + 15 days; an unpaid bill after its due date becomes `OVERDUE`
- **High consumption** = a month whose units exceed 1.5 times the average of the meter's other months (the factor can be changed in the report)
- **Example:** 140 units = 100 x 3.50 + 40 x 5.00 = Rs 550; adding the fixed charge gives **Rs 600**

## Demo accounts

The seed script creates these accounts. The password for every account is **`password123`**.

| Role | Email |
|---|---|
| Admin | `admin@demo.com` |
| Utility Staff | `staff@demo.com` |
| Meter Reader | `reader@demo.com` |
| Customer | `customer1@demo.com` to `customer5@demo.com` |

The login page also has demo buttons that fill in these details.

## Getting started

**Requirements:** Docker Desktop, Git, and Node.js 20 (only for local development).

```bash
git clone https://github.com/gouthamianagandula/electricity-billing-system.git
cd electricity-billing-system
```

### Option 1: Kubernetes (Docker Desktop)

1. In Docker Desktop open **Settings, then Kubernetes, then Enable Kubernetes**, and wait until it shows as running.
2. Build the images:

   ```bash
   docker compose build
   ```

3. Deploy into a separate namespace:

   ```bash
   kubectl create namespace electricity
   kubectl create configmap db-schema -n electricity --from-file=schema.sql=backend/db/schema.sql
   kubectl apply -n electricity -f k8s/
   kubectl get pods -n electricity
   ```

   Wait until all 5 pods are `Running` and `1/1` (1 database, 2 backend, 2 frontend).

4. Load the demo data (once):

   ```bash
   kubectl exec -n electricity deploy/backend -- npm run seed
   ```

5. Open the application: **http://localhost:30090** (the NodePort set in `k8s/03-frontend.yaml`).

   If the NodePort is not reachable, use a port-forward and open **http://localhost:8082**:

   ```bash
   kubectl port-forward -n electricity svc/frontend 8082:80
   ```

Useful commands:

```bash
kubectl get pods -n electricity
kubectl get svc -n electricity
kubectl get deployments -n electricity
kubectl logs -n electricity deploy/backend
```

### Option 2: Docker Compose

```bash
docker compose up --build -d
docker compose exec backend npm run seed
docker compose ps
```

Open the frontend port shown by `docker compose ps` (**http://localhost:8080** by default). Stop everything with `docker compose down`.

> If port 8080 or 5000 is already used by another project, change the host port in `docker-compose.yml` (for example `"8085:80"`).

### Option 3: Local development

1. Start PostgreSQL, for example in Docker:

   ```bash
   docker run --name billing-db -e POSTGRES_PASSWORD=admin123 -e POSTGRES_DB=billing -p 5434:5432 -d postgres:16
   ```

2. Create the tables from `backend/db/schema.sql` (for example with `psql`, or in PowerShell: `Get-Content backend\db\schema.sql | docker exec -i billing-db psql -U postgres -d billing`).
3. Start the backend (API on port 5000):

   ```bash
   cd backend
   cp .env.example .env        # then edit DB_PASSWORD and the other values
   npm install
   npm run seed
   npm run dev
   ```

4. Start the frontend (app on port 5173):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open **http://localhost:5173**.

## Environment variables

Set in `backend/.env` for local development (see `backend/.env.example`). In Docker Compose and Kubernetes they are supplied by `docker-compose.yml` and by the ConfigMap and Secret in `k8s/00-config.yaml`.

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | API port | `5000` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5434` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `your_password_here` |
| `DB_NAME` | Database name | `billing` |
| `JWT_SECRET` | Secret used to sign login tokens | `change_this_secret` |
| `FIXED_CHARGE` | Fixed charge added to every bill (Rs) | `50` |

> Never commit your real `.env` file. It is excluded by `.gitignore`.

## API overview

All endpoints start with `/api`. Except register, login and health, every request needs the header `Authorization: Bearer <token>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Customers | `GET/POST /customers`, `PUT/DELETE /customers/:id`, `GET /customers/me` |
| Meters | `GET/POST /meters`, `PATCH /meters/:id/status` |
| Readings | `GET/POST /readings` |
| Bills | `GET /bills`, `GET /bills/ungenerated`, `POST /bills/generate`, `GET /bills/:id` |
| Payments | `GET/POST /payments` |
| Reports | `GET /reports/monthly-consumption`, `customer-billing`, `payment-status`, `high-consumption` (add `?format=csv` to export) |
| Dashboard | `GET /dashboard` |
| Health | `GET /health` |

Example login request:

```json
POST /api/auth/login
{ "email": "admin@demo.com", "password": "password123" }
```

Errors return clear JSON messages: `400` invalid input, `401` not logged in, `403` role not allowed, `404` not found, `409` duplicate (for example paying a bill twice).

## Testing

The application was tested with scripted API requests for every role, manual walk-throughs of all screens, and deployment checks in Docker and Kubernetes. The main scenarios:

- Login with valid and invalid credentials
- A customer is refused access to staff APIs (`403`) and staff pages (redirect)
- A reading lower than the previous reading is rejected
- Bill generation: 140 units give Rs 550 energy charge + Rs 50 fixed = **Rs 600**
- A second bill for the same meter and month is blocked
- A bill can be paid only once; the bill becomes `PAID` with a transaction ID
- Unpaid bills past their due date show as `OVERDUE`
- High Consumption report flags months above 1.5 times the average
- CSV export of reports
- `docker compose` starts all containers, and `kubectl get pods` shows every pod `Running`

## Troubleshooting

| Problem | What to do |
|---|---|
| `failed to connect to the docker API` | Start Docker Desktop and wait for "Engine running" |
| `You must be logged in to the server` | Enable Kubernetes in Docker Desktop and wait until it is running |
| Login fails or the lists are empty | Run the seed command (`npm run seed`, or the `kubectl exec ... npm run seed` command above) |
| Port 5000 or 8080 already in use | Stop the other process or container, or change the host port |
| Website shows another project | Use the link for this project (`http://localhost:30090`) and the `electricity` namespace (`-n electricity`) |
| `password authentication failed` (local development) | Check `DB_PORT` and `DB_PASSWORD` in `backend/.env` |

## Future enhancements

- Integration with a real payment gateway
- SMS and email reminders for bills and due dates
- Automatic meter data from smart meters
- Separate tariffs for domestic and commercial connections
- A GitHub Actions pipeline for automatic build, test and deployment
- An Ingress with HTTPS, plus monitoring with Prometheus and Grafana

## Author

**Anagandula Gouthami**
