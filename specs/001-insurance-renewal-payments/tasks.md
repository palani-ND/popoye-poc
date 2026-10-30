---

description: "Task list template for feature implementation"
---

# Tasks: Insurance Renewal Payment Platform (POC)

**Input**: Design documents from `/specs/001-insurance-renewal-payments/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), poc-scope.md, research.md, data-model.md, contracts/api.md, test-cases.md, test-data.json

**Tests**: The spec includes a full test suite (test-cases.md + test-data.json) — tests ARE included per the feature specification. Write tests before implementation (fail → implement → pass).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Scoped to the POC (poc-scope.md) — bulk import/export, full RBAC, refunds/cancellations, reconciliation, DR, load testing are NOT POC tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1..US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (monorepo)**: `backend/src/`, `payment-web/src/`, `admin-web/src/`
- Tests: `backend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create monorepo root: `package.json` with npm workspaces (`backend`, `payment-web`, `admin-web`), root `.gitignore` (node_modules, .env, dist), root `README.md`
- [x] T002 [P] Initialize backend TypeScript project in `backend/` (`package.json`, `tsconfig.json`, `src/server.ts`, dev script with tsx/nodemon)
- [x] T003 [P] Initialize payment-web Vite + React + TypeScript app in `payment-web/` (vite template, react-router, axios)
- [x] T004 [P] Initialize admin-web Vite + React + TypeScript app in `admin-web/` (vite template, react-router, axios)
- [x] T005 [P] Configure ESLint + Prettier at root (`.eslintrc.cjs`, `.prettierrc`, shared scripts) and add `jose`, `zod`, `pg`, `express`, `bcrypt`, `axios` to `backend/` deps; add vitest + supertest dev deps

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Set up DB connection pool + minimal migration runner in `backend/src/db/` (`pool.ts`, `migrate.ts` applying ordered `.sql` files from `backend/src/db/migrations/`)
- [x] T007 [P] Implement config + secret loading in `backend/src/config/` reading `.env` (DATABASE_URL, CASHFREE_*, AISENSY_*, JWE_SECRET_KEY, ADMIN_SESSION_SECRET, PAYMENT_URL_BASE) with zod validation; fail fast on missing vars
- [x] T008 [P] Implement error handling + structured logging middleware in `backend/src/api/middleware/` (`errorHandler.ts`, `requestLogger.ts` with request IDs; never log secrets/tokens/PII)
- [x] T009 [P] Implement payload encryption util with `jose` (JWE compact, A256GCM) in `backend/src/security/encryption.ts` using JWE_SECRET_KEY
- [x] T010 [P] Implement secure payment token generation in `backend/src/security/token.ts`: `crypto.randomBytes(32).toString('base64url')` (256-bit, no PII, not derived from IDs)
- [x] T011 [P] Implement admin auth in `backend/src/security/auth.ts`: bcrypt password hash, JWT (jose) signed session, `HttpOnly` cookie, auth middleware for admin routes
- [x] T012 Create migration SQL in `backend/src/db/migrations/` for ALL tables per data-model.md: `admin_users` (email VARCHAR(255) UNIQUE NOT NULL, password_hash TEXT NOT NULL), `customers` (mobile VARCHAR(20) UNIQUE NOT NULL), `vehicles` (vehicle_number VARCHAR(20) UNIQUE NOT NULL normalized uppercase), `policies` (status VARCHAR(30) DEFAULT 'ACTIVE'), `renewal_orders` (order_ref VARCHAR(40) UNIQUE NOT NULL, payment_token VARCHAR(64) UNIQUE NOT NULL, token_expiry TIMESTAMPTZ NOT NULL), `payment_attempts` (unique partial index on cf_payment_id), `webhook_events` (UNIQUE (event_type, cf_payment_id)), `whatsapp_messages`, `brand_config` (key VARCHAR(50) PK), `audit_logs`
- [x] T013 [P] Implement seed script in `backend/src/db/seed.ts`: create admin user (ADMIN_EMAIL/ADMIN_PASSWORD), load `brand_config` rows from design tokens (business_name, primary_color #D1041F, secondary_color #184CB2, header/footer/support text)
- [x] T014 [P] Implement audit helper in `backend/src/domain/audit.ts` recording actor, action, resource, resource_id, meta JSONB into `audit_logs`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Admin creates renewal request + WhatsApp send (Priority: P1) 🎯 MVP

**Goal**: An admin creates/imports a renewal customer; an order with a unique secure Popoye payment URL is created and a WhatsApp payment request is sent.

**Independent Test**: Create an order via `POST /admin/orders` (data P1), confirm order status CREATED, a unique `/p/<token>` URL is returned, and a `whatsapp_messages` PENDING/SENT row is created.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T015 [P] [US1] API tests for `POST /admin/orders` in `backend/tests/api/orders.test.ts`: positive (P1 standard, P2 private car, P3 min premium, P4 duplicate mobile upsert, P5 commercial vehicle) + negative (N1 duplicate vehicle open renewal → 409, N2 zero premium → 400, N3 invalid mobile → 400, N4 missing expiry → 400, E1 past expiry → 400) per test-data.json

### Implementation for User Story 1

- [x] T016 [P] [US1] Create domain services in `backend/src/domain/` (`customerService.ts`, `vehicleService.ts`, `policyService.ts`, `orderService.ts`) with validation per data-model.md constraints (mobile format, vehicle_number normalized, premium >= 1.00, policy expiry required)
- [x] T017 [P] [US1] Create WhatsApp provider interface + AiSensy adapter in `backend/src/providers/whatsapp/` (`WhatsAppProvider.ts` interface, `AiSensyAdapter.ts` calling POST `https://backend.aisensy.com/campaign/t1/api/v2` with body apiKey/campaignName/destination/userName/templateParams; token passed as URL placeholder value)
- [x] T018 [US1] Implement order creation service in `backend/src/domain/orderService.ts`: generate `order_ref` (POP+timestamp+seq), secure token (T010), token_expiry (default 48h configurable), status CREATED, reject if an open renewal order exists for the vehicle
- [x] T019 [US1] Implement `POST /admin/orders` in `backend/src/api/admin/orders.ts` per contracts/api.md (auth required, upsert customer by mobile + vehicle by number + policy, return order_ref + payment_url; errors 400/409/401)
- [x] T020 [US1] Send WhatsApp payment request on order creation in `backend/src/domain/whatsappService.ts`: insert `whatsapp_messages` row (kind REQUEST, status PENDING), call AiSensy, update status SENT/FAILED with error; send failure MUST NOT fail order creation
- [x] T021 [US1] Add audit logging for order_created + whatsapp_sent/failed in `backend/src/api/admin/orders.ts`

**Checkpoint**: US1 fully functional — an order + secure URL + WhatsApp request can be created and tested independently.

---

## Phase 4: User Story 2 - Customer pays on Popoye-branded page (Priority: P1)

**Goal**: The customer opens the secure URL on their phone, sees the Popoye-branded mobile-responsive page, and completes a sandbox payment via Cashfree inline checkout.

**Independent Test**: Open a fresh URL on a phone → branded page shows correct order details; tap PAY NOW → Cashfree sandbox checkout opens inline; pay with test card → returns to Popoye success state.

### Tests for User Story 2 ⚠️

- [x] T022 [P] [US2] API tests in `backend/tests/api/payment-page.test.ts`: GET /p/:token (valid, invalid token → 404, expired → 410, already-paid → 409), POST /p/:token/pay (unsupported method → 422, gateway unavailable → 502), amount tamper ignored

### Implementation for User Story 2

- [x] T023 [P] [US2] Create payment provider interface + Cashfree adapter in `backend/src/providers/payment/` (`PaymentProvider.ts`: createOrder/createSession/getOrderStatus; `CashfreeAdapter.ts` using `x-api-version: 2026-01-01`, `x-client-id`, `x-client-secret`, sandbox base `https://sandbox.cashfree.com/pg`, POST /orders returning payment_session_id)
- [x] T024 [P] [US2] Implement `GET /p/:token` in `backend/src/api/public/payment.ts`: return order summary + brand_config (from backend, never browser amount), sensitive fields encrypted via JWE (T009); errors 404/410/409 per contracts
- [x] T025 [P] [US2] Implement `POST /p/:token/pay` in `backend/src/api/public/payment.ts`: validate token + status (CREATED/PAYMENT_PENDING only), create Cashfree order, transition CREATED → PAYMENT_PENDING, return `payment_session_id` + amount + currency
- [x] T026 [P] [US2] Implement `GET /p/:token/status` in `backend/src/api/public/payment.ts` for post-return status refresh (statuses: CREATED/PAYMENT_PENDING/PAID/PAYMENT_FAILED/EXPIRED/CANCELLED)
- [x] T027 [P] [US2] Scaffold payment-web in `payment-web/src/`: router `/p/:token`, API client with JWE decrypt, Cashfree JS SDK (sandbox) inline checkout
- [x] T028 [US2] Integrate brand design tokens into `payment-web/src/styles/` (copy `specs/001-insurance-renewal-payments/design-tokens.css` into `payment-web/src/styles/tokens.css`)
- [x] T029 [US2] Build mobile-responsive branded payment page in `payment-web/src/pages/PayNow.tsx`: logo, customer name, vehicle number, premium, policy expiry, order ref, status, payment methods, PAY button (per FR-010/014/014a, no zoom/scroll on phone)
- [x] T030 [US2] Build expired/already-paid/invalid states in `payment-web/src/pages/` (410 expired message, 409 already-completed, 404 invalid) per FR-007/023

**Checkpoint**: Customer can pay end-to-end on a phone through the branded page.

---

## Phase 5: User Story 3 - Payment verified & confirmed reliably (Priority: P1)

**Goal**: The Cashfree webhook is verified, order state is updated safely (idempotent, duplicate-safe), and a WhatsApp confirmation is sent asynchronously.

**Independent Test**: Send a valid signed webhook for a PAYMENT_PENDING order → order becomes PAID, payment_attempt + webhook_event rows recorded, WhatsApp confirmation queued; duplicate webhook ignored; tampered webhook leaves state unchanged.

### Tests for User Story 3 ⚠️

- [x] T031 [P] [US3] Webhook tests in `backend/tests/api/webhook.test.ts`: valid success → PAID, duplicate → no change, invalid signature → no change, amount mismatch → rejected + flagged, user-dropped → PAYMENT_FAILED

### Implementation for User Story 3

- [x] T032 [P] [US3] Implement `POST /webhooks/cashfree` in `backend/src/api/webhook.ts`: capture raw body, verify signature = `Base64(HMAC-SHA256(x-webhook-timestamp + rawBody, CASHFREE_SECRET_KEY))`, always respond HTTP 200; invalid signature recorded with signature_valid=false + audited, no state change
- [x] T033 [P] [US3] Implement webhook processing service in `backend/src/domain/webhookService.ts`: idempotency via unique (event_type, cf_payment_id), validate amount/currency vs order (mismatch → reject + flag), update order within a DB transaction, insert payment_attempt (SUCCESS/FAILED/USER_DROPPED) with all fields per data-model.md, handle PAYMENT_SUCCESS/FAILED/USER_DROPPED_WEBHOOK
- [x] T034 [US3] Implement WhatsApp confirmation in `backend/src/domain/whatsappService.ts`: on verified success, insert whatsapp_messages (kind CONFIRMATION) and send via AiSensy asynchronously; send failure MUST keep order PAID and be resendable (FR-028)
- [x] T035 [US3] Audit webhook_received/rejected + payment_status_changed in `backend/src/domain/webhookService.ts`

**Checkpoint**: Webhook flow reliable and safe against duplicates/tampering.

---

## Phase 6: User Story 4 - Admin dashboard (Priority: P2, POC-minimal)

**Goal**: A single admin logs in and sees who paid, what they paid, and who is still pending, with basic filters and resend.

**Independent Test**: Log in → dashboard shows totals + paid/unpaid/pending/failed; orders list filters; resend WhatsApp from a row.

### Tests for User Story 4 ⚠️

- [x] T036 [P] [US4] Admin API tests in `backend/tests/api/admin.test.ts`: login success/failure (401 wrong password), unauthorized access → 401, list + filters, dashboard stats, resend

### Implementation for User Story 4

- [x] T037 [P] [US4] Implement `GET /admin/orders` in `backend/src/api/admin/orders.ts` per contracts (filters: status, q, dateFrom, dateTo; fields incl. payment_method, transaction_id, payment_date, policy_status, whatsapp_status, payment_url)
- [x] T038 [P] [US4] Implement `GET /admin/dashboard` in `backend/src/api/admin/dashboard.ts`: total_requests, expected_amount, collected_amount, counts paid/unpaid/pending/failed
- [x] T039 [P] [US4] Implement `POST /admin/orders/:id/resend` in `backend/src/api/admin/orders.ts`: new whatsapp_messages REQUEST row + send (per T020/T034)
- [x] T040 [P] [US4] Scaffold admin-web in `admin-web/src/`: login page, auth client (JWT HttpOnly cookie), router with protected routes
- [x] T041 [US4] Build dashboard UI in `admin-web/src/pages/Dashboard.tsx` + `Orders.tsx` with brand tokens: stat cards, orders table (customer, mobile, vehicle, premium, order ref, status, method, transaction id, policy status, whatsapp status), filters, resend + copy-payment-url actions
- [x] T042 [US4] Add admin logout + session expiry handling in `admin-web/src/services/`

**Checkpoint**: Admin can monitor and act on payments independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security wiring, seed data, and full-suite validation

- [x] T043 [P] Wire payload encryption end-to-end: backend encrypts sensitive response fields (order/customer PII) via JWE; both frontends decrypt (verify via network tab that PII is not plaintext)
- [x] T044 [P] Add at-rest encryption enablement notes + DB config in `backend/README.md` / `.env.example` (disk/RDS encryption, backups encrypted) per FR-044a/044b
- [x] T045 Seed the 10 synthetic records from `specs/001-insurance-renewal-payments/test-data.json` into `backend/src/db/seed.ts` (or a separate `seed:test-data` script)
- [x] T046 Run the full test suite from `specs/001-insurance-renewal-payments/test-cases.md` (positive, negative, edge) against the running app and fix failures
- [x] T047 Run quickstart.md validation S1–S7 end to end (create → WhatsApp → branded page → sandbox pay → webhook → dashboard → resend)
- [x] T048 Update root `README.md` with run instructions, `.env.example` for backend, and demo checklist

---

## Phase 8: Production Alignment (deferred from POC — matches the product documents)

**Purpose**: Close the documented gaps between the POC and the PRD/Technical Design/Workflow (.docx) documents. These are NOT part of the POC demo.

- [ ] T049 [P] Create the production-readiness checklist per `03_..._Workflow.docx` §23 (HTTPS, credentials, webhooks, templates, backups, queue monitoring, RBAC, audit, rate limiting, load tests, reconciliation, runbook) and track remaining gaps from this phase
- [ ] T050 [P] Add API versioning: mount routes under `/api/v1/...` and webhooks under `/api/v1/webhooks/payment/:provider` per `02_..._Technical_Design.docx` §10 (contracts/api.md)
- [ ] T051 [P] Re-align gateway order creation: decide whether to create the Cashfree order at renewal creation (workflow §2) or keep lazy creation; implement chosen behavior in `backend/src/domain/orderService.ts`
- [ ] T052 [P] Store public payment tokens as SHA-256 hashes at rest (`backend/src/security/token.ts`, migration on `renewal_orders.payment_token`) so a DB leak does not expose usable tokens (FR-005)
- [ ] T053 [P] Introduce Redis + BullMQ queues (`renewal-message`, `payment-confirmation`, `bulk-import`, `export-generation`, `reconciliation`) in `backend/src/workers/` with controlled retries and failed-job visibility (TDD §11)
- [ ] T054 [P] Track WhatsApp DELIVERED/READ status + provider message IDs via a provider callback/webhook, extending `whatsapp_messages` (workflow §3, FR-028)
- [ ] T055 [P] Normalize status enums: map workflow-document attempt statuses (INITIATED/PENDING/CANCELLED/UNKNOWN) and policy statuses (PENDING_RENEWAL/RENEWAL_IN_PROGRESS/EXCEPTION) to the implemented enums via labels/migrations (workflow §17)
- [ ] T056 [P] Implement async Excel export: export job → S3-compatible object storage → controlled download link (workflow §14)
- [ ] T057 [P] Implement scheduled reconciliation jobs comparing internal orders vs gateway transactions, classifying mismatches, and alerting operations (FR-050, workflow §15)
- [ ] T058 [P] Implement full RBAC: roles (Super Admin, Operations, Finance/Reporting, Support, Auditor) with a configurable permission matrix, enforced on the backend (FR-031, workflow §18)
- [ ] T059 [P] Add k6 load tests for payment page access, order lookup, payment session creation, webhook processing, admin search, bulk import, and WhatsApp queue processing (TDD §15)
- [ ] T060 [P] Add metrics/alerts/health dashboards (payment success/failure rates, webhook errors, notification errors, queue depth, API latency) with correlation IDs (TDD §13, FR-047)
- [ ] T061 [P] Production deployment: Docker containers, Nginx/load balancer, managed PostgreSQL, Redis, S3-compatible storage, CI/CD (GitHub Actions) per TDD §16

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion; then proceed in priority order (P1: US1 → US2 → US3, then US4)
- **Polish (Final Phase)**: Depends on all user stories being complete
- **Production Alignment (Phase 8)**: Depends on the POC phases (1–7); all items are `[P]` parallel and outside the POC demo scope

### User Story Dependencies

- **US1 (P1)**: After Foundational; sends WhatsApp on order creation
- **US2 (P1)**: After Foundational; depends on US1's orders/tokens existing, uses Cashfree adapter
- **US3 (P1)**: After Foundational; depends on US1 orders + US2's Cashfree order creation
- **US4 (P2)**: After Foundational; depends on US1/US3 data to display; independent UI

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/services before endpoints; core implementation before integration

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- US1 tests + US1 services (T015 vs T016-T020) overlap only where files differ; T016/T017 are parallel
- Within US2: T022-T027 marked [P] run in parallel; within US3: T031-T033 parallel; within US4: T036-T040 parallel
- Frontend tasks (payment-web T027-T030, admin-web T040-T042) parallel with backend tasks in the same story

---

## Parallel Example: User Story 2

```bash
# Launch tests + independent pieces together:
Task: "API tests for payment page in backend/tests/api/payment-page.test.ts"
Task: "Cashfree adapter in backend/src/providers/payment/CashfreeAdapter.ts"
Task: "GET /p/:token endpoint in backend/src/api/public/payment.ts"
Task: "payment-web scaffold in payment-web/src/"

# Then integrate:
Task: "Mobile-responsive payment page in payment-web/src/pages/PayNow.tsx"
Task: "Expired/already-paid states in payment-web/src/pages/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (order + URL + WhatsApp request)
4. **STOP and VALIDATE**: Create a test order, confirm URL + WhatsApp request
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (create order + WhatsApp) → test independently → demo
3. US2 (branded payment page + sandbox pay) → test independently → demo
4. US3 (webhook + confirmation) → test independently → full demo loop
5. US4 (admin dashboard) → test independently → demo "who paid / who's pending"

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 → US3 (backend payment core)
   - Developer B: US2 (payment-web) 
   - Developer C: US4 (admin-web)
3. Stories integrate via the contracts in `contracts/api.md`

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Out of POC scope (NOT tasks here): bulk import/export, full RBAC, refunds/cancellations, reconciliation engine, DR/load testing, email/SMS channels, policy-status processor workflow
- Production-alignment tasks (T049–T061) close the gaps to the PRD/Technical Design/Workflow .docx documents; see `spec.md` § Alignment with Product Documents
- Test data + expected results: `specs/001-insurance-renewal-payments/test-data.json` + `test-cases.md`