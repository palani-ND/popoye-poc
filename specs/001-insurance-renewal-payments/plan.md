# Implementation Plan: Insurance Renewal Payment Platform (POC)

**Branch**: `001-insurance-renewal-payments` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-insurance-renewal-payments/spec.md`, targeted at the POC scope defined in [poc-scope.md](poc-scope.md)

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build a minimal, demoable proof-of-concept for Popoye Insurance's renewal payment platform. An admin creates a renewal order and a secure Popoye payment URL is generated; the platform sends a WhatsApp message (AiSensy) with a PAY NOW button; the customer opens a Popoye-branded, mobile-responsive payment page on their phone and pays a test amount through the Cashfree sandbox; the backend verifies the webhook and marks the order PAID; a WhatsApp confirmation is sent; and the admin dashboard shows who paid and who is still pending. Providers are isolated behind thin interfaces (only Cashfree + AiSensy implemented) so the production build extends the POC rather than replacing it.

## Technical Context

**Language/Version**: Backend and both web apps in Node.js 20+ / TypeScript 5.x

**Primary Dependencies**:
- Backend: **Express** (the technical design lists NestJS as a production option — Express satisfies the POC; see Decisions), `pg` (PostgreSQL), `zod` (validation), `jose` (JWE payload encryption + JWT admin session), `node:crypto` (secure tokens, HMAC), `axios` (Cashfree + AiSensy calls), `bcrypt` (admin password hashing)
- Frontends: React 18+, Vite, React Router, `axios`
- Monorepo tooling: npm workspaces
- Production additions (deferred, see Phase 8 tasks): Redis + BullMQ queues, object-storage SDK, metrics client

**Storage**: PostgreSQL 16 (local for POC); object storage deferred

**Testing**: `vitest` (unit), `supertest` (API integration), Playwright (E2E); contract tests and k6 load tests deferred to production

**Target Platform**: Web — mobile-responsive (customer payment page + admin dashboard), deployed for demo or run locally

**Project Type**: Web service (backend API) + two web applications (customer payment page, admin dashboard)

**Performance Goals**: POC — no load targets; page must render responsively on a phone

**Constraints**: Sandbox/test payments only (no real money); single admin; WhatsApp template with PAY NOW button must be approved in AiSensy before demo

**Scale/Scope**: POC — single admin, small seeded data, end-to-end demo flow

## Decisions & Production Alignment

Reconciles the product documents (`01_..._PRD.docx`, `02_..._Technical_Design.docx`, `03_..._Workflow.docx`) with this plan and the implemented POC. Full matrix lives in `spec.md` (§ Alignment with Product Documents).

| Topic | POC decision | Production alignment (Phase 8) |
|-------|--------------|--------------------------------|
| Backend framework | Express | NestJS optional; not required |
| API surface | `/api/p/:token`, `/api/admin/*`, `/webhooks/cashfree` | `/api/v1/...` versioning (T050) |
| Gateway order creation | Lazy at first payment attempt | Align to creation-time if required (T051) |
| Token storage | Raw 256-bit token | SHA-256 hash at rest (T052) |
| Queues | Direct/async calls | Redis + BullMQ (T053) |
| WhatsApp delivery | QUEUED/SENT/FAILED | DELIVERED/READ + provider message ID (T054) |
| Status enums | Implemented enums authoritative | Map workflow-doc names (T055) |
| Async export | Client-side CSV | Async workbook → object storage (T056) |
| Reconciliation | Automated detection + admin review (FR-050) | Scheduled jobs (T057) |
| RBAC | Single admin | Full role set + permission matrix (T058) |
| Load testing | None | k6 (T059) |
| Observability | Request IDs + structured logs | Metrics/alerts/health dashboards (T060) |
| Deployment | Local | Docker/Nginx/managed PG/Redis/S3 (T061) |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from the repository constitution (`constitution.md`):

1. **Think Before Coding** — assumptions and provider capabilities must be explicit (Cashfree sandbox flow, AiSensy template requirements) before implementation. State: **PASS** (research.md documents both provider flows, exact webhook signature algorithm, sandbox credentials, and the AiSensy template-approval dependency).
2. **Simplicity First** — no features beyond the POC demo flow; no abstractions beyond the thin provider interfaces needed for extension. State: **PASS** (POC scope explicitly trims the full spec; ORM, queues, object storage intentionally omitted).
3. **Surgical Changes** — new empty repository, no pre-existing code to disturb. State: **PASS** (N/A for new code).
4. **Goal-Driven Execution** — POC success criteria are defined in poc-scope.md and verified through the quickstart validation scenarios S1–S7. State: **PASS** (each scenario maps to a demonstrable outcome).

## Project Structure

### Documentation (this feature)

```text
specs/001-insurance-renewal-payments/
├── plan.md              # This file (/speckit-plan command output)
├── poc-scope.md         # POC scope and demo flow
├── spec.md              # Full feature specification
├── design-tokens.css    # Popoye brand design tokens (stakeholder-provided)
├── ui-payment-page.md   # Customer payment page UI specification (approved)
├── ui-admin-dashboard.md # Admin dashboard UI specification (approved)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── api.md           # Phase 1 output (/speckit-plan command)
├── test-data.json       # 10 synthetic records (positive/negative/edge)
├── test-cases.md        # Positive, negative, and edge test suite
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/                        # Node.js + TypeScript + Express + PostgreSQL
├── src/
│   ├── config/                 # env + brand config loading, secrets
│   ├── db/                     # schema + migrations, connection pool
│   ├── domain/                 # orders, payments, customers, whatsapp services (business logic)
│   ├── providers/              # payment/cashfree.adapter.ts, whatsapp/aisensy.adapter.ts (thin interfaces)
│   ├── security/               # token generation, jose payload encryption, admin auth
│   ├── api/                    # routes: public payment, webhook, admin
│   └── server.ts
└── tests/                      # vitest + supertest (unit + API)
    ├── unit/
    └── api/

payment-web/                    # Vite + React customer payment page (mobile-responsive, branded)
└── src/
    ├── pages/                  # PayNow, Status, Expired, Done
    ├── components/             # BrandHeader, AmountSummary, MethodPicker, PayButton
    └── services/               # payment-api client (jose-encrypted payloads)

admin-web/                      # Vite + React admin dashboard (mobile-responsive)
└── src/
    ├── pages/                  # Login, Dashboard, Orders, CreateOrder
    ├── components/             # StatCards, OrdersTable, Filters, OrderDetail
    └── services/               # admin-api client
```

**Structure Decision**: Monorepo with three npm workspaces — `backend/`, `payment-web/`, `admin-web/`. This keeps the two frontends (customer + admin) separate, matches the two-app requirement, and lets the provider/domain boundaries in the backend carry over to the production build. Object storage and worker queues are intentionally omitted for the POC.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — the POC deliberately avoids speculative complexity. Thin provider interfaces (`providers/`) are included only because the spec's core requirement (provider replaceability) must survive into the production build.