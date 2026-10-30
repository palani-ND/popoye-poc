# Quickstart: Insurance Renewal Payment Platform (POC)

**Date**: 2026-10-05
**Goal**: Stand up the POC locally and validate the end-to-end demo flow.

## Prerequisites

- Node.js 20+, npm
- PostgreSQL 16 running locally (or Docker)
- Cashfree sandbox credentials (App ID + Secret Key from Cashfree merchant dashboard, test mode)
- AiSensy API Campaign key + an **approved** WhatsApp template with a dynamic URL button
  - Template body placeholders `{{1}}…{{n}}`, then URL placeholder `{{n+1}}` for the payment token, e.g. body `Pay {{1}} for vehicle {{2}}` + CTA URL `https://localhost:5173/p/{{3}}` (or your public demo domain)
- Popoye brand design tokens: `specs/001-insurance-renewal-payments/design-tokens.css`

## Setup

```bash
npm install                       # install all three workspaces
cp backend/.env.example backend/.env   # then fill in secrets (see below)
npm run db:migrate                # apply backend/db/migrations/*.sql
npm run db:seed                   # seed admin user + brand_config
```

`.env` (backend):
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/popoye
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=...
CASHFREE_SECRET_KEY=...
CASHFREE_WEBHOOK_SECRET=...
CASHFREE_API_VERSION=2026-01-01
AISENSY_API_KEY=...
AISENSY_CAMPAIGN_NAME=renewal_payment_request
PAYMENT_URL_BASE=https://localhost:5173/p
JWE_SECRET_KEY=<32+ byte secret for jose payload encryption>
ADMIN_SESSION_SECRET=...
ADMIN_EMAIL=admin@popoye.com
ADMIN_PASSWORD=<choose one; used at seed time>
```

## Run

```bash
npm run dev              # backend (port 4000) + payment-web (5173) + admin-web (5174)
```

Use a tunnel (e.g. `ngrok http 5173`) for the public payment URL so the demo works on a real phone, and set `PAYMENT_URL_BASE` + the AiSensy template URL domain accordingly. Cashfree sandbox must whitelist the payment-web domain for the JS SDK.

## Validation Scenarios

Reference: [contracts/api.md](contracts/api.md), [data-model.md](data-model.md).

### S1 — Admin creates an order
1. Open `http://localhost:5174`, log in with the seeded admin.
2. Go to **Payments** → **+ New Renewal** → fill the form (customer, mobile, vehicle, premium, expiry).
3. Expect: order appears in the list with status CREATED and a `https://…/p/<token>` URL (copy via the row kebab → Copy Payment URL).

### S2 — WhatsApp payment request
1. Trigger "Send WhatsApp request" (sent automatically on creation; resendable via the row kebab → Resend WhatsApp).
2. Expect: `whatsapp_messages` row created; AiSensy returns HTTP 200; message with a PAY NOW button arrives on the test number (requires approved template).
3. If no template approved yet, the request is recorded as FAILED with the error, and the payment URL is still usable — the demo can proceed manually.

### S3 — Branded payment page (mobile)
1. Open the payment URL on a phone (via the WhatsApp message or manually).
2. Expect: Popoye-branded page (header, red security banner, customer details card, amount card, payment-method cards with UPI recommended, red **Pay ₹699** button, trust footer) renders without zoom/scroll issues.
3. Expect: `GET /p/:token` returns an encrypted payload that the page decrypts; amount in the network tab is not readable plaintext.

### S3a — Scan & Pay (QR)
1. Select **Scan & Pay** → tap **Pay ₹699**.
2. Expect: dedicated UPI QR screen — QR rendered from the backend `GET /p/:token/upi-qr` payload (amount/order ref server-side), GPay/PhonePe/Paytm badges, and an **Open UPI Apps** button.

### S4 — Pay in Cashfree sandbox
1. Select a method (UPI/card/net banking) → tap **Pay ₹699** → Cashfree inline checkout opens on the branded page.
2. Use test card `4706131211212123` / OTP `111000`, expiry `03/2028`, CVV `123` (or UPI `testsuccess@gocash`).
3. Expect: payment completes; the page shows the **Payment Processing** state, then the **Payment Successful!** page with transaction details (receipt download + WhatsApp share actions).

### S5 — Webhook verification & state update
1. After the sandbox payment, a webhook hits `POST /webhooks/cashfree`.
2. Expect: signature verified (raw-body HMAC), order transitions to PAID, `payment_attempts` + `webhook_events` rows recorded, WhatsApp confirmation queued/sent.
3. Re-send the same webhook → no duplicate processing (unique `(event_type, cf_payment_id)`).
4. Send a tampered webhook → rejected; order state unchanged.

### S6 — Dashboard reflects who paid / who's pending
1. Open the admin dashboard.
2. Expect: stats (total, expected, collected, paid/unpaid/pending/failed) and order rows showing PAID customers (with transaction ID + method) and the pending ones.
3. Reopen the paid order's payment URL → shows "already completed" and does not allow another payment.

### S7 — Resend
1. From an order row, "Resend WhatsApp request".
2. Expect: new `whatsapp_messages` row and a fresh send attempt.

## Expected Demo Outcome

Complete the journey in under 5 minutes: create order → WhatsApp → open on phone → branded page → sandbox payment → PAID in dashboard → WhatsApp confirmation. Duplicate/tampered webhooks never change state, and no secrets appear in the frontend or logs.