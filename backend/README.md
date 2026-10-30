# Popoye Payments — Backend

Node.js + TypeScript + Express + PostgreSQL API for the insurance renewal payment POC.

## Scripts

```bash
npm run dev            # dev server (tsx watch)
npm run db:migrate     # apply backend/src/db/migrations/*.sql
npm run db:seed        # seed admin user + brand config
npm run db:seed:test   # seed the 10 synthetic records from test-data.json
npm run test           # vitest suite (uses popoye_test DB)
```

## Configuration

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL`, `CASHFREE_*` (sandbox keys), `AISENSY_*`, `JWE_SECRET_KEY`, `ADMIN_SESSION_SECRET`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `WEBHOOK_URL`.

## Security (per spec FR-044a/044b)

- **At rest**: run PostgreSQL on an encrypted disk / RDS with encryption enabled; object storage (S3) must be encrypted at rest; database backups must be encrypted. These are enablement notes for the POC — the code does not manage disk-level encryption.
- **In transit**: all traffic over TLS in deployment.
- **Application-layer payload encryption**: sensitive response payloads (customer PII, order details) are JWE-encrypted with `jose` (A256GCM) using `JWE_SECRET_KEY`; the customer frontend decrypts them in memory so PII is not readable as plaintext in the browser network tab.
- Webhook signatures use `Base64(HMAC-SHA256(x-webhook-timestamp + rawBody, CASHFREE_SECRET_KEY))` over the exact raw body; invalid/duplicate webhooks never change payment state.
- Admin sessions are `HttpOnly` JWTs (bcrypt-hashed passwords).

## Testing

Tests run against a dedicated `popoye_test` database (`DATABASE_URL_TEST` overrides). Run:

```bash
createdb popoye_test
npm run test
```
