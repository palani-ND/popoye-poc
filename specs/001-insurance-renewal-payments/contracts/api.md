# API Contracts: Insurance Renewal Payment Platform (POC)

**Date**: 2026-10-05
**Base**: Backend serves three areas — public payment API, Cashfree webhook, admin API.

## Conventions

- JSON request/response. Errors: `{ "error": { "code": string, "message": string } }`.
- Public payment routes are authenticated by the order `payment_token` (URL path), not by login.
- Admin routes require a JWT in an `HttpOnly` cookie (`Authorization` cookie), verified by the backend.
- Sensitive response fields (customer PII, order details) are encrypted at the application layer as JWE compact strings (`jose`, A256GCM) — the frontend decrypts with the shared secret key.
- Timestamps are ISO 8601 UTC.

## Public Payment API

### GET /p/:token
Returns the order summary for the branded payment page (values always from the backend order).

Response 200:
```json
{
  "order": "<JWE-encrypted string>",
  "brand": {
    "business_name": "Popoye Insurance",
    "logo_url": "https://cdn.popoyeinsurance.com/logo.png",
    "primary_color": "#D1041F",
    "secondary_color": "#184CB2",
    "header_text": "Secure your renewal",
    "footer_text": "Powered by Popoye Insurance",
    "support_phone": "+91 00000 00000",
    "terms_url": "...",
    "privacy_url": "..."
  }
}
```

The JWE payload decrypts to one of two shapes:
- **Not yet paid**: `{ order_ref, customer_name, mobile, vehicle_number, vehicle_type, vehicle_label, premium, currency, policy_expiry, policy_number, status }`
- **Already paid/refunded** (HTTP 200, not 409): `{ status: "PAID", order_ref, customer_name, vehicle_number, amount, currency, transaction_id, method, payment_time }`

Errors: 404 invalid/unknown token, 410 expired (with configured expired message + brand). The browser never receives plaintext PII — sensitive fields are JWE-encrypted.

### POST /p/:token/pay
Creates a Cashfree order server-side and returns a payment session for the embedded checkout. The Scan & Pay (UPI QR) flow is handled client-side via `GET /p/:token/upi-qr` and does not call this endpoint.

Request: `{ "method": "upi" | "card" | "netbanking" }` (optional — method pre-selection; `scan`/QR is handled by the upi-qr endpoint).

Response 200:
```json
{
  "order_ref": "POP202610050001",
  "payment_session_id": "<cashfree payment_session_id>",
  "amount": 699.00,
  "currency": "INR"
}
```
Errors: 410 expired, 409 already paid, 422 unsupported method, 502 gateway unavailable.

### GET /p/:token/status
Current order status (used by the payment page to refresh after gateway return).

Response 200:
```json
{ "order_ref": "POP202610050001", "status": "PAID", "payment_method": "upi" }
```
Statuses: CREATED, PAYMENT_PENDING, PAID, PAYMENT_FAILED, EXPIRED, CANCELLED.

### GET /p/:token/upi-qr
Returns a trusted UPI QR payload for the Scan & Pay view. The QR is built server-side from the backend order (amount and order ref are never taken from the browser).

Response 200:
```json
{
  "upi_payload": "upi://pay?pa=popoyeins@ybl&pn=Popoye%20Insurance&am=699&cu=INR&tr=POP202610050001&tn=...",
  "amount": 699,
  "currency": "INR",
  "order_ref": "POP202610050001"
}
```
Errors: 404 invalid token, 410 expired, 409 already paid.

## Cashfree Webhook

### POST /webhooks/cashfree
Receives Cashfree payment events. Verifies signature (`Base64(HMAC-SHA256(timestamp + rawBody, clientSecret))`); dedupes by `(event_type, cf_payment_id)`; validates amount/currency against the order; updates order + records payment attempt inside a DB transaction.

Events handled (POC): `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`.

Response: always HTTP 200 after processing (retries until 200). Invalid signature → HTTP 200 with no state change (so the gateway stops retrying), logged + audited.

## Admin API

### POST /admin/auth/login
Request: `{ "email": string, "password": string }`
Response 200: sets `HttpOnly` JWT cookie; `{ "email": "...", "role": "ADMIN" }`.
Errors: 401 invalid credentials.

### POST /admin/orders
Create a renewal order (also used for the demo "create test customer" flow). Upserts customer (by mobile) + vehicle (by number) + policy, then creates the order + payment token.

Request:
```json
{
  "customer_name": "Ravi Kumar",
  "mobile": "+919876543210",
  "vehicle_number": "TN38AB1234",
  "vehicle_type": "TWO_WHEELER",
  "policy_number": "POL-0001",
  "premium": 699.00,
  "policy_expiry_date": "2026-10-15",
  "product": "TWO_WHEELER"
}
```
Response 201:
```json
{
  "order_ref": "POP202610050001",
  "payment_url": "https://pay.popoyeinsurance.com/p/<secure-token>",
  "status": "CREATED"
}
```
Errors: 400 validation, 409 existing open renewal order for the vehicle.

### GET /admin/orders
List orders (newest first) with filters: `status`, `q` (vehicle/mobile/order_ref), `dateFrom`, `dateTo`.

Response 200:
```json
{
  "orders": [
    {
      "order_ref": "...", "customer_name": "...", "mobile": "...",
      "vehicle_number": "...", "premium": 699.00, "status": "PAID",
      "payment_method": "upi", "transaction_id": "...",
      "payment_date": "2026-10-05T10:00:00Z", "policy_status": "PAYMENT_COMPLETED",
      "whatsapp_status": "SENT", "payment_url": "https://pay.popoyeinsurance.com/p/..."
    }
  ],
  "total": 12
}
```

### GET /admin/dashboard
Stats for the demo.
```json
{
  "total_requests": 12,
  "expected_amount": 8388.00,
  "collected_amount": 4194.00,
  "counts": { "paid": 6, "unpaid": 3, "pending": 2, "failed": 1 }
}
```

### POST /admin/orders/:id/resend
Resend the WhatsApp payment request for an order. Response 200: `{ "ok": true }`.

### POST /admin/orders/:id/paylink
Regenerate/re-fetch the payment URL for an order. Response 200: `{ "payment_url": "..." }`.

### POST /admin/auth/logout
Clears the session cookie.