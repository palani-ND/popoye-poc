# Test Cases: Insurance Renewal Payment Platform (POC)

**Date**: 2026-10-05
**Synthetic dataset**: [test-data.json](test-data.json) (10 records: 5 positive, 4 negative, 1 edge)
**References**: [contracts/api.md](contracts/api.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md)

These cases exercise the POC end to end. Positive and negative cases target order creation via `POST /admin/orders`; edge cases target the payment page, webhook, and reconciliation flows.

## Positive Test Cases

| ID | Case | Steps | Expected Result |
|----|------|-------|-----------------|
| TC-P01 | Standard two-wheeler renewal (data P1) | Create order via `POST /admin/orders` | 201; order status CREATED; unique secure payment URL returned (`/p/<token>`); `renewal_orders` + `whatsapp_messages`(PENDING) rows created |
| TC-P02 | Private car product (data P2) | Create order with product=PRIVATE_CAR | 201; same workflow, no separate implementation; product recorded |
| TC-P03 | Minimum premium (data P3) | Create order with premium=1.00 | 201; order created; URL generated |
| TC-P04 | Duplicate mobile, new vehicle (data P4) | Create order reusing P1 mobile | 201; no duplicate customer (same customer_id reused); new vehicle/order created |
| TC-P05 | Commercial vehicle product (data P5) | Create order with product=COMMERCIAL_VEHICLE | 201; created via same workflow (note: POC seeds two-wheeler; this validates the configurable-product path once COMMERCIAL_VEHICLE is configured — FR-003) |
| TC-P06 | Payment success full flow | data P1 → pay via Cashfree sandbox card 4706131211212123 (OTP 111000) | Webhook verified → order PAID; `payment_attempts` SUCCESS row; WhatsApp confirmation queued |
| TC-P07 | Retry after failed attempt | data P2 → pay with UPI `testfailure@gocash` then card success | Attempt 1 FAILED recorded; order stays PAYMENT_PENDING; attempt 2 SUCCESS → order PAID; both attempts preserved |
| TC-P08 | Webhook idempotency | Send the same PAYMENT_SUCCESS webhook twice | Second copy ignored (unique `(event_type, cf_payment_id)`); state unchanged; no duplicate attempt row |
| TC-P09 | Dashboard reflects paid vs pending | After TC-P06/07 | Dashboard shows paid count + collected amount for paid orders and pending list for unpaid |
| TC-P10 | Resend WhatsApp request | data P3 → POST `/admin/orders/:id/resend` | New `whatsapp_messages` row; AiSensy send attempted; send failure does not change payment state |

## Negative Test Cases

| ID | Case | Steps | Expected Result |
|----|------|-------|-----------------|
| TC-N01 | Duplicate vehicle with open renewal (data N1) | Create order for vehicle TN38AB1234 while P1 order is open | 409; no second order; error identifies existing open renewal order |
| TC-N02 | Zero premium (data N2) | Create order with premium=0.00 | 400; validation error; no rows persisted |
| TC-N03 | Invalid mobile (data N3) | Create order with mobile=12345 | 400; validation error; no rows persisted |
| TC-N04 | Missing required field (data N4) | Create order without policy_expiry_date | 400; validation error; no rows persisted |
| TC-N05 | Unauthorized admin API access | Call `POST /admin/orders` without valid JWT cookie | 401; action denied and rejected before any processing |
| TC-N06 | Invalid webhook signature | Send webhook with tampered body / wrong secret | Signature fails; no state change; webhook_events recorded with signature_valid=false; audited |
| TC-N07 | Webhook amount mismatch | Send PAYMENT_SUCCESS for 100.00 against a 699.00 order | State change rejected; discrepancy flagged for reconciliation; audited |
| TC-N08 | Unsupported payment method | `POST /p/:token/pay` with method=wallet (not in the configured provider's capabilities) | 422; no Cashfree order created (note: method=gpay is not in the contract enum — that would be a 400 invalid-input, not 422) |
| TC-N09 | Wrong password on admin login | `POST /admin/auth/login` with bad password | 401; no session cookie set |

## Edge Cases

| ID | Case | Steps | Expected Result |
|----|------|-------|-----------------|
| TC-E01 | Policy expiry in the past (data E1) | Create order with expiry 2025-01-01 | 400; rejected (lapsed policy); rule confirmed with business |
| TC-E02 | Invalid payment token | `GET /p/<random-garbage>` | 404; configured invalid-token experience |
| TC-E03 | Expired payment link | Open a URL after `token_expiry` | 410; expired experience; payment blocked (no new session) |
| TC-E04 | Already-paid URL reopened | Reopen P1 URL after TC-P06 | 409/paid state; page shows "already completed"; PAY blocked |
| TC-E05 | Amount tampering in browser | Modify amount in devtools before submitting pay | Backend ignores browser amount; Cashfree order uses trusted order amount (699.00) |
| TC-E06 | Double-click / refresh during pay | Rapid double submit of `POST /p/:token/pay` | Only one Cashfree order/session created for the same order (idempotent, single active PAYMENT_PENDING); no duplicate sessions |
| TC-E07 | Payment completing after link expiry | Initiate payment pre-expiry; webhook arrives post-expiry | Order transitions to PAID (FR-021a), flagged for reconciliation; payment not lost |
| TC-E08 | Payment completing on cancelled order | Admin cancels order; webhook for in-flight payment arrives | **Production scope** — cancellation is out of POC scope (poc-scope.md); POC only asserts the webhook must never lose a captured payment (FR-021a) |
| TC-E09 | Max payment attempts reached | Configure max=3; make 3 failing attempts (UPI testfailure@gocash) | **Production scope** — max-attempts enforcement (FR-018a) is not in the minimal POC; POC asserts attempts are preserved and retries allowed |
| TC-E10 | Gateway unavailable | `POST /p/:token/pay` when Cashfree returns 5xx/timeout | 502 to the page; order state unchanged; error surfaced to admin; no corruption of internal state |
| TC-E11 | WhatsApp provider unavailable | AiSensy send fails for a confirmed payment | Payment remains PAID; `whatsapp_messages` FAILED; resend possible from admin |

## Mapping to Quickstart Scenarios

- S1 (create order) → TC-P01–P05, TC-N01–N04, TC-E01
- S3 (branded page) → TC-E02, TC-E03, TC-E04, TC-E05
- S4 (sandbox pay) → TC-P06, TC-P07, TC-N08, TC-E06, TC-E10
- S5 (webhook) → TC-P08, TC-N06, TC-N07, TC-E07, TC-E08
- S6 (dashboard) → TC-P09, TC-N05
- S7 (resend) → TC-P10, TC-E11

## Success Gate

All positive cases pass end to end, all negative cases are rejected without corrupting state, and all edge cases produce the specified safe behavior, as defined in the POC success criteria (poc-scope.md).

## Traceability (spec → tests)

| Requirement | Covered by |
|-------------|------------|
| FR-001/002 customer/vehicle/policy capture + uniqueness | TC-P01, TC-P04, TC-N01 |
| FR-003 configurable products, no separate workflows | TC-P02, TC-P05 |
| FR-005 secure token (unpredictable, no PII) | TC-P01, TC-E02 |
| FR-007 link expiry | TC-E03 |
| FR-009 order state transitions | TC-P06, TC-P07, TC-E03, TC-E08, TC-E09 |
| FR-010/011/014 branded page, trusted amount | TC-E04, TC-E05 |
| FR-013 provider capabilities for methods | TC-N08 |
| FR-018 preserve all attempts | TC-P07, TC-E09 |
| FR-018a max attempts | TC-E09 (production) |
| FR-019/019a/020 webhook verify, amount match, idempotency, replay | TC-P08, TC-N06, TC-N07 |
| FR-021a in-flight payment on terminal order | TC-E07, TC-E08 (production) |
| FR-021/023 duplicate payment prevention, already-paid | TC-E04, TC-E06 |
| FR-022 webhook authoritative | TC-P06 (vs browser only) |
| FR-027/028 WhatsApp async, failure keeps PAID | TC-P06, TC-E11, TC-P10 |
| FR-030/031/032/034 admin app, RBAC, dashboard, actions | TC-P09, TC-N05, TC-P10 |
| FR-035/036/037/038 bulk import/export | Not in POC (out of scope) |
| FR-044 security controls (authN/Z, masking) | TC-N05, TC-N09 |
| FR-044a/044b at-rest + payload encryption | TC-E05 (payload not plaintext in network tab) |
| FR-048/049 gateway failure, retries | TC-E10, TC-E11 |