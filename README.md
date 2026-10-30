# Popoye Payments — Insurance Renewal Payment Platform (POC)

A configurable insurance renewal payment platform for Popoye Insurance. Customers receive a WhatsApp payment request with a PAY NOW link, pay through a Popoye-branded mobile-responsive page (Cashfree sandbox in the POC), and the backend verifies the webhook, updates order state, and sends a WhatsApp confirmation. An admin dashboard shows who paid and who is still pending.

**POC scope**: `specs/001-insurance-renewal-payments/poc-scope.md`
**Full spec**: `specs/001-insurance-renewal-payments/spec.md`
**Plan / tasks / tests**: `specs/001-insurance-renewal-payments/` (`plan.md`, `tasks.md`, `test-cases.md`, `test-data.json`, `contracts/api.md`)

## Structure

```text
backend/       Node.js + TypeScript + Express + PostgreSQL
payment-web/   Vite + React customer payment page (mobile-responsive, branded)
admin-web/     Vite + React admin dashboard (mobile-responsive)
```

## Quick start

```bash
npm install
cp backend/.env.example backend/.env   # fill in secrets
createdb popoye
npm run db:migrate
npm run db:seed
npm run dev
```

- Backend API: http://localhost:4000
- Customer payment page: http://localhost:5173
- Admin dashboard: http://localhost:5174

See `specs/001-insurance-renewal-payments/quickstart.md` for the full validation walkthrough (S1–S7).

## Security

- All sensitive data encrypted at rest (DB/disk encryption) and in transit (TLS).
- Application-layer payloads (customer PII) encrypted with `jose` JWE (A256GCM) so data is not readable in the browser network tab.
- Webhook signature verification (HMAC-SHA256 over timestamp + raw body) with idempotency.
- Admin auth via bcrypt + HttpOnly JWT cookie; backend-enforced authorization.
