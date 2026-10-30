# POC Scope: Insurance Renewal Payment Platform

**Purpose**: A minimal, demoable proof-of-concept showing the customer the end-to-end renewal payment journey. The goal is a live demo, not production readiness.
**Created**: 2026-10-05
**Feature**: [spec.md](spec.md)

## Demo Flow (what the customer sees)

1. Admin creates a test renewal order (customer, vehicle, premium, expiry) and generates a secure Popoye payment URL.
2. Platform sends a WhatsApp message with a PAY NOW button (AiSensy).
3. Customer taps PAY NOW on their phone → Popoye-branded, mobile-responsive payment page.
4. Customer selects a payment method and pays a **test amount** via **Cashfree sandbox** (UPI/card).
5. Cashfree webhook → signature verified → order marked PAID.
6. WhatsApp payment confirmation is sent.
7. Admin opens the dashboard and sees who paid and who is still pending.

## POC Scope (build this)

- **Backend**: Node.js + PostgreSQL.
  - Entities: Customer, Vehicle, Policy, Renewal Order, Payment Attempt (minimal), WhatsApp Message (minimal), Admin User.
  - Secure payment token generation (cryptographically random, no PII, no DB IDs).
  - Order status transitions: CREATED → PAYMENT_PENDING → PAID / PAYMENT_FAILED / EXPIRED (only the statuses the demo touches; full state machine in the real spec).
  - Webhook endpoint with Cashfree signature verification, amount/currency check, idempotency (unique webhook event ID).
  - WhatsApp send + confirmation via AiSensy (thin provider interface; only AiSensy implemented).
  - Configurable branding values (business name, logo, colors, messages) read from config.
- **Customer payment page**: Vite + React, fully mobile-responsive, Popoye-branded, reads order by secure token, amount always from backend, no gateway secrets in the browser.
- **Admin app**: Vite + React, single admin login, dashboard lists showing paid / pending / failed with basic filters; create-order screen for the demo.
- **Security (POC level)**: HTTPS/TLS, admin login, backend authorization checks, input validation, at-rest encryption enabled (DB-level), no secrets logged or in frontend. Full DPDP program is out of POC scope.
- **Storage**: local/S3-compatible bucket for nothing critical yet (can be deferred to full build).

## Explicitly OUT of POC scope

- Bulk import/export (CSV/XLSX)
- Full RBAC (single admin only)
- Refunds, cancellations, reconciliation engine
- Policy-processing workflow and policy status machine (beyond a display field)
- Audit logs (beyond basic admin-login/order-creation logging)
- Multi-provider adapters (provider interface only; implement Cashfree + AiSensy)
- DPDP consent/retention/erasure workflows (apply basic data-minimization and masking)
- DR/backup runbooks, load testing, concurrency targets
- Email/SMS channels
- Receipts, partial payments, multi-currency

## POC Success Criteria

- The demo flow above can be completed end to end on a phone in under 5 minutes.
- Payment page renders branded and mobile-responsive without zoom/scroll issues.
- A test payment in Cashfree sandbox results in PAID status after the webhook.
- Duplicate/invalid webhooks do not change state.
- Dashboard correctly shows who paid and who is pending.
- Provider and gateway secrets never appear in the frontend or logs.

## Handoff

The POC code structure must keep the full-spec requirements in mind (provider interfaces, order status model, entity boundaries) so the production build extends the POC rather than replacing it. `/speckit-plan` should target this POC scope first.