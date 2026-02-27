# Canopy Quotes — Project Configuration

## Technology Stack (LOCKED — Do Not Change)
- Language: TypeScript 5.x (strict mode, ES Modules only)
- Frontend: React 18 + Vite 5 (NOT Next.js)
- UI Components: Shadcn/ui + Tailwind CSS 3.x
- State: Zustand (global) + React Query (server state)
- Backend: Node.js 20 LTS + Express 4
- Database: PostgreSQL 16 via Prisma ORM
- Auth: JWT HS256 + httpOnly refresh cookie (15min access / 30day refresh)
- Validation: Zod (both frontend and backend)
- Forms: React Hook Form + Zod
- HTTP Client: Axios
- Dates: date-fns
- Icons: Lucide React
- Charts: Recharts
- Logging: Winston (structured JSON)
- Caching: Redis
- Scheduling: node-cron (background jobs)
- Containers: Docker + Docker Compose

## Architecture Rules
- UUID primary keys on all tables (gen_random_uuid())
- No soft deletes — records use status ENUMs (active/inactive) instead
- CommonJS (require) is PROHIBITED — ES Modules (import/export) only
- Every API endpoint validates with Zod schemas before processing
- Prisma for all database access (no raw SQL unless absolutely necessary)
- Tenant isolation: every query filters by tenant_id from JWT
- Role-based access enforced server-side — frontend role state is never trusted

## Specification Documents
All specs live in: `C:\Users\Goran\Documents\02 Goran - Business\Claude AI Agents Dev\Canopy Quotes\New Systm Docs. Canopy Quotes\`
- **A-5**: Security & Access Control (auth, RBAC, error codes)
- **B-1**: Core Database Schema (tenants, users, customers, properties, quotes, line items, proposals)
- **B-2**: Service Catalog & Pricing Rules Schema (service_catalog, pricing_rules, JSONB formulas)
- **E-1**: Quotes & Customer API Endpoints (full endpoint contract)
- **E-2**: Service Catalog & Pricing API Endpoints

---

## Build Progress

### Phase 1 — Foundation & Infrastructure (COMPLETE)

#### Database Schema (10 models, 9 enums)
| Model | Table | Source |
|-------|-------|--------|
| Tenant | tenants | B-1 §5 |
| User | users | B-1 §6 |
| Customer | customers | B-1 §7 |
| Property | properties | B-1 §8 |
| Quote | quotes | B-1 §9 |
| QuoteLineItem | quote_line_items | B-1 §10 |
| Proposal | proposals | B-1 §11 |
| ServiceCatalog | service_catalog | B-2 §4 |
| PricingRule | pricing_rules | B-2 §7 |
| RefreshToken | refresh_tokens | Auth system |

Enums: UserRole, CustomerType, CustomerStatus, PropertyType, ServiceType, QuoteStatus, BillingType, ServiceCategory

#### Authentication System (A-5 spec)
| Endpoint | Auth | Description |
|----------|------|-------------|
| POST /v1/auth/login | None | Email/password → JWT access token + httpOnly refresh cookie |
| POST /v1/auth/refresh | Cookie | Rotate refresh token, issue new access token |
| POST /v1/auth/logout | Cookie | Delete refresh token from DB, clear cookie |

- bcrypt password hashing (12 rounds)
- JWT access tokens (15min expiry, HS256)
- Refresh tokens stored in DB (30-day expiry, rotated on each use)
- `authenticate` middleware — validates Bearer token, attaches `req.user`
- `requireRole(...roles)` middleware — checks against UserRole enum, returns 403

#### Customer CRUD (E-1 spec)
| Endpoint | Auth | Description |
|----------|------|-------------|
| GET /v1/customers | User JWT | List with search, type/status filter, pagination (10/page) |
| POST /v1/customers | User JWT | Create customer (created_by = caller) |
| GET /v1/customers/:id | User JWT | Detail with properties + quote_summary |
| PUT /v1/customers/:id | User JWT | Partial update (role-scoped) |

#### Property CRUD (E-1 spec)
| Endpoint | Auth | Description |
|----------|------|-------------|
| GET /v1/customers/:customerId/properties | User JWT | List all properties for a customer |
| POST /v1/customers/:customerId/properties | User JWT | Add property with measurements |
| PUT /v1/properties/:id | User JWT | Update property (role-scoped) |

#### Role-Based Data Scoping
| Role | Customers | Properties | Quotes |
|------|-----------|------------|--------|
| n37_super_admin | All | All | All |
| owner | All | All | All |
| division_manager | All | All | All |
| salesperson | Own only | Own customer's | Own only |
| coordinator | Own (read-only) | Own customer's (read-only) | Own (read-only) |

---

## File Map

### Root
```
CLAUDE.md                    # This file
README.md                    # Getting started guide
docker-compose.yml           # PostgreSQL 16 + Redis 7
.gitignore
```

### API (`api/`)
```
api/prisma/schema.prisma     # 10 models, 9 enums, 34+ indexes
api/prisma/seed.ts           # Seed script placeholder

api/src/server.ts            # Entry point — starts Express on PORT
api/src/app.ts               # Express app — middleware + route mounting

api/src/config/
  database.ts                # PrismaClient singleton
  env.ts                     # Zod-validated environment variables
  logger.ts                  # Winston structured JSON logger

api/src/middleware/
  authenticate.ts            # JWT Bearer token validation → req.user
  require-role.ts            # requireRole(...UserRole[]) guard → 403
  error-handler.ts           # Global Express error handler
  validate.ts                # Generic Zod body validation middleware

api/src/modules/auth/
  auth.schema.ts             # LoginSchema (Zod)
  auth.service.ts            # login(), refresh(), logout(), hashPassword()
  auth.controller.ts         # loginHandler, refreshHandler, logoutHandler
  auth.routes.ts             # POST /login, /refresh, /logout

api/src/modules/customers/
  customer.schema.ts         # Create/Update/ListQuery schemas (Zod)
  customer.service.ts        # listCustomers, getById, create, update
  customer.controller.ts     # Express handlers with validation + error codes
  customer.routes.ts         # GET/POST /, GET/PUT /:id

api/src/modules/properties/
  property.schema.ts         # Create/Update schemas (Zod)
  property.service.ts        # listProperties, create, update
  property.controller.ts     # Express handlers
  property.routes.ts         # Nested (under customers) + flat (PUT /:id)
```

### Frontend (`frontend/`)
```
frontend/src/main.tsx        # React 18 entry point
frontend/src/App.tsx         # Root component (placeholder)
frontend/src/index.css       # Tailwind directives + Shadcn CSS variables
frontend/src/lib/utils.ts    # cn() utility for Shadcn/ui

frontend/components.json     # Shadcn/ui configuration
frontend/tailwind.config.ts  # Tailwind CSS 3 with Shadcn theme
frontend/vite.config.ts      # Vite 5 + path aliases + API proxy
frontend/tsconfig.app.json   # TypeScript strict + path aliases
```

---

## What Needs To Be Built Next

### Phase 2 — Core Operations
- [ ] **D-3: Service Catalog & Pricing Engine** — CRUD for service_catalog, pricing_rules. Pricing engine that evaluates flat_rate_sqft, tiered_sqft, per_visit, project_fixed formulas against property measurements. Endpoints from E-2.
- [ ] **D-2: Quote Builder Module** — Full quote CRUD (POST/GET/PUT/DELETE /v1/quotes), line item management, quote number generation (QT-YYYY-NNNN), status state machine (draft→sent→approved→converted), discount calculation. Endpoints from E-1 §4.

### Phase 3 — Financial & Delivery
- [ ] **D-4: PDF Proposal Generation** — Puppeteer-based PDF generation, R2 storage, signed URL retrieval, proposal versioning. Endpoints: POST /v1/quotes/:id/generate-pdf, GET /v1/quotes/:id/pdf-status/:jobId, GET /v1/quotes/:id/pdf-url.
- [ ] **D-5: Email Delivery Module** — Resend SDK integration, proposal email sending with PDF attachment, recipient override. Endpoint: POST /v1/quotes/:id/send.
- [ ] **D-6: Quote Dashboard & Management** — GET /v1/quotes/stats (pipeline counts), quote list with filters, quote duplication, quote deletion.

### Phase 4 — Frontend
- [ ] **G-1: Quote Dashboard UI** — Main dashboard with pipeline stats, quote list, filters
- [ ] **G-2: Quote Builder UI** — Multi-step quote creation wizard
- [ ] **G-3: Service Catalog Management UI** — Owner-only catalog admin
- [ ] **G-4: Proposal Preview / PDF Viewer UI** — PDF preview and download
- [ ] **Login page** — Email/password form, token storage, refresh interceptor
- [ ] **Axios API client** — Base instance with auth interceptor + refresh logic
- [ ] **Zustand stores** — Auth store, quote store, customer store

### Phase 5 — Integration & Reports
- [ ] **CRM Integration** — Convert approved quote to Canopy CRM job (B-3, E-3)
- [ ] **H-1: Sales Pipeline Report** — Pipeline analytics
- [ ] **H-2: Salesperson Performance Report** — Individual performance metrics
