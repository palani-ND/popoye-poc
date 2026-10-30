# Research: Insurance Renewal Payment Platform (POC)

**Date**: 2026-10-05
**Source**: Provider docs (Cashfree, AiSensy), project conventions, POC scope ([poc-scope.md](poc-scope.md))

## 1. Cashfree Payment Gateway (sandbox)

- **Decision**: Create the order server-side via `POST /orders` (headers `x-api-version: 2026-01-01`, `x-client-id`, `x-client-secret`), then embed Cashfree's hosted checkout **inline** on the branded payment page using the returned `payment_session_id` and the Cashfree JS SDK (`cashfree.checkout({ paymentSessionId, redirectTarget })`). Server-side confirmation comes from webhooks (`PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`), with `GET /orders/{order_id}` as a manual status check.
- **Rationale**: Keeps all card data on Cashfree (no PCI exposure for Popoye), preserves the branded Popoye experience, and matches the spec's requirement that the gateway's secure mechanisms handle payment processing.
- **Alternatives considered**:
  - Cashfree payment-link API (`POST /payment-links`, returns `link_url`) — rejected because it sends customers to a generic Cashfree page, which is exactly what the product must avoid.
  - Sending customers directly to `order.payUrl` — rejected: current `OrderEntity` does not return a payUrl; hosted checkout is driven by `payment_session_id`.

**Webhook verification (exact)**:
- Headers: `x-webhook-signature`, `x-webhook-timestamp`, `x-webhook-attempt`, `x-webhook-version`, `x-idempotency-key`.
- Signed payload = `x-webhook-timestamp` concatenated with the **raw** request body; expected signature = `Base64(HMAC-SHA256(signedPayload, clientSecret))`.
- MUST use the exact raw body — re-parsing/re-serializing breaks the signature.
- Idempotency/dedupe by `cf_payment_id` (with a unique constraint); webhook delivery is at-least-once (retries until HTTP 200).

**Sandbox test credentials**:
- Cards: Visa debit `4706131211212123`, Visa credit `4576238912771450`, MC credit `5105105105105100`, MC debit `5409162669381034`, RuPay `6074825972083818`. OTP `111000`, expiry `03/2028`, CVV `123`.
- UPI: `testsuccess@gocash` (success), `testfailure@gocash` (fail), plus `testdeclineuser@gocash`, `testexpired@gocash`, `testinsufficientfunds@gocash`, `testfraud@gocash`.
- Note: `4111 1111 1111 1111` and `test@icici`/`success@upi` are NOT Cashfree's — use the lists above.

## 2. AiSensy WhatsApp API

- **Decision**: Use the API Campaign endpoint `POST https://backend.aisensy.com/campaign/t1/api/v2` with body `apiKey` (in request body), `campaignName` (an API Campaign created in the AiSensy dashboard and bound to an **approved** template), `destination` (`+<country><number>`), `userName`, and `templateParams[]` (values in placeholder order). The PAY NOW URL button is baked into the approved template with a dynamic placeholder, e.g. `https://pay.popoyeinsurance.com/p/{{2}}`, so the secure token is passed as the next `templateParams` value.
- **Rationale**: Simplest documented AiSensy path for template messages with a URL button; template body/URL parameters are passed as ordered `templateParams`.
- **Alternatives considered**:
  - Newer AiSensy Project API — rejected for POC: endpoint/auth schema not publicly documented (⚠️ verify against AiSensy OpenAPI during implementation if needed).
  - WhatsApp Cloud API direct — rejected for POC: requires WABA setup; AiSensy is the launch provider and is already in use for renewal messages.

**Key facts / risks**:
- Templates with URL buttons require **Meta approval** (typically 1 min–24 h) and are configured in the dashboard (URL placeholder uses the next `{{N}}` after body params). **No public API to create templates** — an approved "renewal-payment" template must exist before the demo.
- Template param count MUST match placeholders exactly, or the send is rejected.
- **No sandbox/test mode**: sending requires a real, verified WABA number + approved templates. Free-form text only within the 24-h customer-service window.
- **No self-serve per-message status API documented** (status visible in dashboard; delivery webhooks are CRM-integration specific). POC records send acceptance (HTTP 200) as "sent"; delivery status is best-effort.
- POC must verify: exact auth mechanism if moving off the legacy API Campaign endpoint.

## 3. Secure payment token

- **Decision**: `crypto.randomBytes(32).toString('base64url')` per order → 256-bit unpredictable token, stored on the order and used as `/p/<token>`. Never derived from order IDs, never contains PII.
- **Rationale**: 256-bit CSPRNG tokens are unguessable and collision-safe; satisfies FR-005.
- **Alternatives considered**: hashed tokens (store digest) — deferred to production; POC stores the token for direct lookup.

## 4. Application-layer payload encryption

- **Decision**: Use `jose` JWE compact serialization (A256GCM with a symmetric secret key from env) to encrypt sensitive response payloads (customer PII, order details) returned to the frontends, so data is not readable in the browser network tab.
- **Rationale**: Matches the stakeholder security decision (FR-044b) with minimal code.
- **Alternatives considered**: per-field encryption via DB (rejected — complicates queries in a POC); TLS-only (rejected — stakeholder explicitly wants payload-level encryption).

## 5. Admin authentication (POC)

- **Decision**: Single seeded admin; password hashed with `bcrypt`; session via signed JWT (`jose`), sent as `HttpOnly` cookie; backend enforces auth on all admin routes.
- **Rationale**: Minimal but correct; keeps full RBAC out of POC while preserving the auth boundary.
- **Alternatives considered**: full RBAC (deferred to production per poc-scope.md).

## 6. Database & migrations (POC)

- **Decision**: PostgreSQL 16 with plain SQL schema + a minimal migration runner (ordered `.sql` files applied on boot/command), using the `pg` pool. No ORM.
- **Rationale**: Simple, transparent, easy to extend to the production data model.
- **Alternatives considered**: Prisma/TypeORM — rejected for POC simplicity; Sequelize — rejected.

## 7. Brand design tokens

- **Decision**: Use the provided Popoye design tokens (`design-tokens.css`: brand primary `#D1041F`, secondary `#184CB2`, neutrals, radii, shadows) as the shared design system for both the payment page and admin dashboard.
- **Rationale**: Provides the Popoye-branded experience required by the spec with zero custom design work.
- **Alternatives considered**: none — tokens provided by stakeholder.

## Open items for implementation (not blockers)

- ⚠️ AiSensy Project API auth header — verify if legacy API Campaign endpoint is insufficient.
- ⚠️ Confirm the approved AiSensy template (with URL button placeholder) exists before the demo.
- ⚠️ Cashfree dashboard: whitelist the payment-web domain for the JS SDK, and enable webhooks to the notify URL.