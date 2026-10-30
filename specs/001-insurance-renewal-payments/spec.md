# Feature Specification: Insurance Renewal Payment Platform

**Feature Branch**: `001-insurance-renewal-payments`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Build a configurable insurance renewal payment platform for Popoye Insurance — WhatsApp payment requests, Popoye-branded payment page, configurable payment gateway, webhook verification, WhatsApp confirmations, and an admin dashboard, with provider abstractions that keep Cashfree/AiSensy replaceable."

## Clarifications

### Session 2026-10-05

- Q: What channel should the customer payment link be delivered through? → A: WhatsApp only (initial provider AiSensy); SMS deferred to a later phase.
- Q: What implementation stack should the web applications use? → A: Vite + React for both the customer payment page and the admin dashboard (implementation preference for planning; spec remains technology-agnostic).
- Q: What should the backend be built with? → A: Node.js (implementation preference for planning; spec remains technology-agnostic).
- Q: What database should be used? → A: PostgreSQL (implementation preference for planning; spec remains technology-agnostic).
- Q: How should data be protected? → A: Encrypt all data at rest; encrypt in transit (TLS) and encrypt application-layer payloads (incl. user payloads visible in the network tab) using the `jose` library with a managed secret key; comply with the Indian DPDP Act.

## User Scenarios & Testing

### User Story 1 - Admin creates a renewal request and sends it on WhatsApp (Priority: P1)

An operations user creates or bulk-imports customer renewal data for an upcoming two-wheeler policy expiry. The platform creates a renewal order, generates a unique secure Popoye payment URL, and sends a WhatsApp payment request containing the customer details and a PAY NOW button that opens that URL.

**Why this priority**: Without this flow no customer can be asked to pay, so it is the entry point of the entire platform and of every subsequent story.

**Independent Test**: Can be fully tested by importing a single customer, confirming an order with a unique secure payment URL is created, and confirming a WhatsApp message with a PAY NOW link to that URL is queued for the configured provider.

**Acceptance Scenarios**:

1. **Given** an operations user with permission to create renewal requests, **When** they create an order for a customer with name, mobile, vehicle number, premium, and policy expiry, **Then** a renewal order is created with status CREATED and a unique secure payment URL is generated.
2. **Given** a created renewal order, **When** the platform sends the WhatsApp payment request, **Then** the message is delivered through the configured WhatsApp provider and contains the customer name, vehicle number, premium, expiry date, order reference, and a PAY NOW button linked to the unique secure payment URL.
3. **Given** two different customers, **When** orders are created for each, **Then** each customer receives a distinct, unpredictable payment URL that grants access only to their own order.

---

### User Story 2 - Customer pays through a Popoye-branded payment page (Priority: P1)

A customer taps PAY NOW in the WhatsApp message and opens a Popoye-branded payment page showing their policy details and the premium. They select a payment method, confirm, and complete the payment on the gateway's secure mechanisms. The page never exposes gateway secrets and never trusts the browser to supply the amount.

**Why this priority**: This is the core customer-facing value — a branded, trusted payment experience that replaces the generic gateway page the current customers are uncomfortable with.

**Independent Test**: Can be fully tested by opening a freshly generated payment URL on a phone, confirming the Popoye-branded page renders and displays the correct customer/vehicle/premium/expiry, selecting a payment method offered by the configured gateway, and completing a payment through the gateway's secure flow.

**Acceptance Scenarios**:

1. **Given** a valid, unexpired payment URL, **When** the customer opens it on their phone, **Then** a Popoye-branded, fully mobile-responsive payment page displays the customer name, vehicle number, premium, policy expiry date, order reference, payment status, and available payment methods without zooming or horizontal scrolling.
2. **Given** a payment page for an order, **When** the amount is modified in the browser, **Then** the platform still uses the trusted amount stored on the order.
3. **Given** a payment page, **When** the customer selects a payment method and confirms, **Then** the payment is initiated through the configured gateway using the gateway's secure payment mechanisms without Popoye storing raw card data.
4. **Given** a customer returning to the URL after the payment succeeded, **When** they open the page, **Then** the page indicates the payment is already completed and does not permit another normal payment for the same order.

---

### User Story 3 - Payment is verified and confirmed reliably (Priority: P1)

After the customer pays, the gateway sends a webhook. The platform verifies the signature, validates the event against the stored order, and updates payment state in a way that is safe against duplicates, retries, and out-of-order or delayed events. A successful, verified payment triggers a WhatsApp confirmation, and a WhatsApp failure never changes the payment state.

**Why this priority**: Reliable, authoritative confirmation is the trust backbone — customers, finance, and the policy-processing team all depend on correct payment state.

**Independent Test**: Can be fully tested by sending a correctly signed webhook for a pending order and confirming the order becomes PAID, a WhatsApp confirmation is queued, duplicate webhooks do not change state, and an invalidly signed webhook leaves state unchanged.

**Acceptance Scenarios**:

1. **Given** an order in PAYMENT_PENDING, **When** a valid, correctly signed webhook for the full amount and currency is received, **Then** the order is updated to PAID and a WhatsApp payment confirmation is queued.
2. **Given** the same valid webhook is received twice, **When** the second copy arrives, **Then** it is processed idempotently and payment state is not duplicated or altered.
3. **Given** a webhook with an invalid signature, **When** it arrives, **Then** it is rejected and payment state is never changed.
4. **Given** a verified successful payment, **When** the WhatsApp confirmation fails to deliver, **Then** the payment remains PAID, the delivery failure is recorded, and an admin can resend the confirmation later.

---

### User Story 4 - Admin monitors, filters, and reconciles payments (Priority: P2)

An admin opens the dashboard to see totals and lists of renewal requests and payments, filters by status/date/vehicle/mobile/order/transaction, drills into payment attempts, resends WhatsApp messages, and exports records.

**Why this priority**: Visibility into collections and the ability to resend messages and trace attempts is required for day-to-day operations, reconciliation, and finance once payments begin flowing.

**Independent Test**: Can be fully tested by logging in with an admin role, viewing dashboard totals for a known set of orders, applying each filter, opening a payment attempt record, resending a WhatsApp message, and exporting the filtered list.

**Acceptance Scenarios**:

1. **Given** a logged-in admin with appropriate permissions, **When** they open the dashboard, **Then** they see total renewal requests, expected amount, collected amount, and counts by paid/unpaid/pending/failed status.
2. **Given** a payment list, **When** the admin filters by date range, status, vehicle number, mobile number, order ID, transaction ID, or policy status, **Then** the list is restricted to matching payments.
3. **Given** a payment record, **When** the admin views it, **Then** they see the order, all payment attempts, transaction details, WhatsApp status, and can copy the payment URL or resend the payment request/confirmation.
4. **Given** an admin without financial-action permission, **When** they attempt a refund or cancellation, **Then** the action is denied and audited.

---

### User Story 5 - Bulk customer import and export (Priority: P2)

An operations user uploads a CSV/XLSX of renewal customers. The platform validates the file, shows a preview, processes it asynchronously, creates customers/orders, generates secure payment URLs, and queues WhatsApp messages. The user sees success/failure/duplicate counts and can download an error report. Admins can also export payment data asynchronously.

**Why this priority**: Renewals arrive in bulk (10,000+ customers/month), so import/export at scale is a core operational requirement, though less critical than the payment journey itself.

**Independent Test**: Can be fully tested by uploading a small file with valid, invalid, and duplicate rows, confirming the preview and result counts, confirming orders/messages are created only for valid rows, and downloading the error report.

**Acceptance Scenarios**:

1. **Given** an uploaded CSV/XLSX file, **When** the admin uploads and confirms it, **Then** the file is validated, previewed, processed asynchronously, and the result shows total, successful, failed, and duplicate record counts.
2. **Given** a file containing a duplicate existing open renewal order, **When** it is processed, **Then** the duplicate row is reported without creating a second order.
3. **Given** a completed import, **When** the admin downloads the error report, **Then** it lists the rejected rows with validation errors.
4. **Given** an admin with export permission, **When** they export payment data, **Then** the export is generated asynchronously with the required fields and is available for download.

---

### User Story 6 - Business configures branding and providers (Priority: P3)

A super admin adjusts branding (business name, logo, colors, messages), chooses payment/WhatsApp/notification providers via configuration, sets payment-link expiry, enabled payment methods, products, and notification templates — without changing business logic. Provider differences are handled through provider capabilities, not hard-coding.

**Why this priority**: Required for launch flexibility and provider replaceability, but only relevant once the core flows exist.

**Independent Test**: Can be fully tested by changing the branding values and confirming the payment page reflects them, and by switching the configured payment/WhatsApp provider and confirming the same core flows still operate end to end.

**Acceptance Scenarios**:

1. **Given** a super admin, **When** they change the branding configuration, **Then** the customer payment page reflects the new business name, logo, colors, and messages without code changes.
2. **Given** the platform configured for Cashfree and AiSensy, **When** the providers are switched to another capable provider via configuration, **Then** the core payment and WhatsApp flows continue to work without rewriting business logic.
3. **Given** a configured payment-link expiry, **When** the URL is opened after expiry, **Then** the customer sees the configured expired-payment experience and cannot pay unless business rules explicitly allow it.

### Edge Cases

- What happens when a customer opens an invalid, expired, or already-used payment URL?
- How does the system handle duplicate clicks, page refreshes, multiple devices, and near-simultaneous attempts on the same order?
- How are duplicate, delayed, retried, out-of-order, and unknown webhook events handled, including invalid signatures?
- How does the system behave when the gateway, WhatsApp provider, or storage provider is unavailable or times out?
- What happens when a bulk import has invalid, duplicate, or mixed rows, or when an export is very large?
- How are provider-specific limitations (e.g., a payment method the gateway does not support) handled?
- What happens when a webhook arrives for an order that is already PAID, EXPIRED, or CANCELLED?

## Requirements

### Functional Requirements

**Customers, Vehicles & Policies**

- **FR-001**: The system MUST capture and store customer name, mobile number, vehicle number, vehicle type, premium amount, policy expiry date, policy number (where available), insurance product, and renewal/order reference for each renewal request.
- **FR-002**: The system MUST uniquely identify a customer, a vehicle, and a policy, and MUST prevent accidental duplicates (e.g., duplicate mobile or duplicate vehicle with an existing open renewal order).
- **FR-003**: The system MUST support the two-wheeler insurance product at launch and MUST allow additional insurance products (private car, commercial vehicle, future products) to be added by configuration without separate payment/order workflows.
- **FR-003a**: Each policy MUST track a policy status through a defined state machine: ACTIVE, RENEWAL_PENDING, PAYMENT_COMPLETED, PROCESSING, RENEWED, and EXPIRED. Valid transitions: ACTIVE → RENEWAL_PENDING (a renewal order is created); RENEWAL_PENDING → PAYMENT_COMPLETED (the order becomes PAID); PAYMENT_COMPLETED → PROCESSING (a policy processor claims/opens the renewal); PROCESSING → RENEWED (renewal confirmed and new term recorded); RENEWAL_PENDING → EXPIRED (renewal not completed by term end). Invalid transitions MUST be rejected.
- **FR-003b**: The POLICY_PROCESSOR role MUST have a workflow to list renewals in PAYMENT_COMPLETED/PROCESSING status, claim/process a renewal, and confirm it as RENEWED; every policy-status change MUST be audited with actor and before/after values.

**Renewal Orders & Secure Payment Links**

- **FR-004**: The system MUST create a unique renewal order for each payment request and assign a human-readable order reference (e.g., POP202610050001).
- **FR-005**: The system MUST generate a unique, cryptographically secure, unpredictable public payment token per order that does not contain customer PII, does not expose database IDs, is not derived from sequential order IDs, does not expose gateway credentials, and does not allow one customer to access another customer's order. Per the technical design, the stored form of the public token SHOULD be a cryptographic hash (e.g., SHA-256) in production so a database leak does not expose usable tokens; the POC stores the raw token for direct lookup and this is a tracked production-alignment task (T052).
- **FR-006**: The system MUST expose a Popoye-owned payment URL (e.g., https://pay.popoyeinsurance.com/p/<secure-token>) that resolves to the branded payment page.
- **FR-007**: The system MUST support a configurable payment-link expiry and MUST prevent payment against an expired order unless business rules explicitly allow it.
- **FR-008**: The order MUST track internal order ID, public reference, customer, vehicle, policy, product, amount, currency, payment status, payment URL token, payment URL expiry, created date, and updated date.
- **FR-009**: Order statuses MUST support at minimum CREATED, PAYMENT_PENDING, PAID, PAYMENT_FAILED, EXPIRED, CANCELLED, and REFUNDED. Valid transitions are: CREATED → PAYMENT_PENDING (payment initiated); CREATED/PAYMENT_PENDING → CANCELLED (authorized admin cancellation); PAYMENT_PENDING → PAYMENT_FAILED (attempt failed); PAYMENT_FAILED → PAYMENT_PENDING (next attempt, up to the configured maximum); PAYMENT_PENDING → EXPIRED (expiry without success); PAYMENT_PENDING → PAID (verified webhook); PAID → REFUNDED (verified full refund). EXPIRED, CANCELLED, and REFUNDED are terminal for normal payments; in-flight payments on terminal orders are handled per FR-021a. Invalid transitions MUST be rejected.

**Branded Payment Page**

- **FR-010**: The payment page MUST display Popoye branding (logo, name), customer name, vehicle number, premium, policy expiry, order reference, payment status, available payment methods, and a PAY button.
- **FR-010b**: The customer payment page MUST follow the approved UI specification in `ui-payment-page.md` (header + red security banner, customer details card, dominant amount card, stacked payment-method cards with UPI recommended, full-width red PAY button, trust footer, dedicated states for processing/paid/failed/expired/already-paid/invalid, and a UPI QR "Scan & Pay" screen generated from trusted backend data).
- **FR-010a**: After the customer returns from the payment gateway, the payment page MUST refresh the order status from the trusted backend (e.g., polling the status endpoint by token) and render the appropriate configured state (processing/success/failure); the browser signal alone MUST NEVER be treated as authoritative.
- **FR-011**: The payment amount MUST come from the trusted backend order and MUST NOT be accepted from the browser as authoritative input.
- **FR-012**: The payment page MUST NOT expose payment gateway secrets or raw card data, and MUST use the gateway's secure payment mechanisms for payment processing.
- **FR-013**: Available payment methods (UPI, UPI QR, GPay, PhonePe, Paytm, cards, net banking) MUST be determined by the configured provider's capabilities and configuration, not assumed.
- **FR-014**: The payment page MUST support configurable branding (business name, logo, favicon, primary/secondary colors, header/footer text, support phone/email, terms/privacy URLs, and success/failure/pending/expired messages) that can change without rewriting payment logic.
- **FR-014a**: The customer payment page MUST be fully mobile-responsive: a customer who opens the payment link on their phone must be able to view all order details, select a payment method, complete the payment, and see the outcome without zooming, horizontal scrolling, or desktop orientation.

**Payment Processing & Provider Abstraction**

- **FR-015**: The system MUST use a payment provider abstraction supporting at least: create payment order, create payment session, initiate payment, retrieve payment status, retrieve transaction details, verify webhook, process payment events, refund (where supported), and cancel (where supported).
- **FR-016**: Provider-specific behavior MUST be isolated in provider adapters; core business/domain logic MUST NOT depend on any specific provider.
- **FR-017**: Switching payment providers MUST NOT require rewriting customer, policy, order, payment domain, payment page, admin dashboard, WhatsApp integration, reporting, or audit functionality.
- **FR-018**: The system MUST record payment attempts (attempt ID, order ID, gateway order ID, gateway payment ID, transaction ID, method, amount, currency, status, failure reason, gateway reference, timestamps), MUST preserve all historical attempts, and MUST never overwrite them.
- **FR-018a**: The system MUST enforce a configurable maximum number of payment attempts per order; when the maximum is reached without success, the order MUST transition to PAYMENT_FAILED (terminal) and the payment page MUST block further attempts; an admin MAY reset the attempt limit with full audit.

**Webhooks, Verification & Duplicate Prevention**

- **FR-019**: The system MUST verify webhook signatures, validate events against the stored order (order lookup, amount, currency, status), and update payment state only through a database transaction.
- **FR-019a**: If a webhook's amount or currency does not match the order, the system MUST reject the state change, record the discrepancy for reconciliation, and audit the event; a mismatched webhook MUST NEVER mark an order PAID.
- **FR-020**: The system MUST safely handle duplicate, delayed, retried, and out-of-order webhook events using idempotency, unique constraints, concurrency controls, and replay protection (e.g., event identifiers and timestamp/nonce checks); invalid webhook requests MUST NEVER change payment state.
- **FR-021**: The system MUST prevent duplicate payments through unique constraints, idempotency keys, gateway transaction/order IDs, webhook event identifiers, and database transactions, including for double-clicks, refreshes, multi-device access, multiple attempts, gateway retries, duplicate webhooks, and client timeouts.
- **FR-022**: The authoritative payment confirmation MUST be the verified gateway webhook; browser/frontend signals MUST NOT be treated as authoritative.
- **FR-023**: If an order is already PAID, the payment page MUST NOT allow another normal payment and MUST display the already-completed state when the original URL is reopened.
- **FR-021a**: If a verified payment webhook arrives for an order in EXPIRED or CANCELLED state (the payment session was created before the state change), the system MUST NOT lose the payment: it MUST record the payment attempt, transition the order to PAID (flagging the discrepancy for admin reconciliation), and send the WhatsApp confirmation. Terminal states MUST never silently discard a captured payment.

**WhatsApp & Notifications**

- **FR-024**: The system MUST use a WhatsApp provider abstraction; business logic MUST NOT depend on any specific provider (e.g., AiSensy).
- **FR-025**: The system MUST send a WhatsApp renewal request containing customer name, vehicle number, premium, expiry date, payment URL, and order reference, with a PAY NOW button linking to the customer's unique payment URL.
- **FR-026**: WhatsApp message templates MUST be configurable, not hard-coded into business logic.
- **FR-027**: The system MUST send a WhatsApp confirmation after verified successful payment; confirmation SHOULD be processed asynchronously so provider failures do not fail payment processing.
- **FR-028**: If WhatsApp delivery fails, the payment MUST remain PAID, the failure MUST be recorded, delivery MUST be retryable, and an admin MUST be able to resend the message. The system SHOULD track delivery progress (QUEUED/SENT/DELIVERED/READ/FAILED) and provider message IDs per the workflow document; where the provider has no self-serve delivery-status API (e.g., AiSensy), SENT/FAILED is recorded and DELIVERED/READ tracking is a production-alignment task (T054).
- **FR-029**: The system MUST support provider abstractions for WhatsApp, email, and SMS communications without coupling domain logic to any provider. At launch, only the WhatsApp channel is used to deliver payment requests and confirmations; email and SMS channels are deferred to later phases and require no new payment logic.

**Admin Application**

- **FR-030**: The system MUST provide a secure admin application covering Dashboard, Customers, Vehicles, Policies, Renewal Orders, Payments, Payment Attempts, WhatsApp Messages, Bulk Imports, Exports, Configuration, and Audit Logs, and MUST be part of the initial release alongside the customer payment flow.
- **FR-030a**: The admin application MUST be delivered as a mobile-responsive web application. (Note: this supersedes the original "React Native" requirement, per stakeholder decision.)
- **FR-030b**: The admin application MUST follow the approved UI specification in `ui-admin-dashboard.md` (dark navy sidebar with branded nav, white top header with admin user chip, summary cards, a data-dense payments transactions table with semantic status badges, search/filters/export, pagination, row kebab actions, and an order-detail drawer with a vertical payment timeline).
- **FR-031**: The system MUST enforce role-based access control with configurable roles/permissions (at least SUPER_ADMIN, ADMIN, OPERATIONS, FINANCE, POLICY_PROCESSOR, VIEWER) and MUST enforce authorization on the backend regardless of frontend visibility. The workflow document's role set (Super Admin, Operations Admin, Finance/Reporting, Support, Auditor) maps onto these roles; the exact permission matrix is defined during detailed specification, and the POC ships a single admin user (production-alignment task T058).
- **FR-032**: The dashboard MUST show total renewal requests, expected amount, collected amount, and paid/unpaid/pending/failed counts.
- **FR-033**: The payment list MUST display customer name, mobile, vehicle number, premium, order ID, payment status, payment method, transaction ID, payment date, policy status, and WhatsApp status, and MUST support filtering by date range, status, vehicle, mobile, order ID, transaction ID, and policy status.
- **FR-034**: Admin actions MUST include view order, view payment attempts, view payment details, copy payment URL, resend WhatsApp payment request, resend payment confirmation, and export records; sensitive/financial actions (refund, cancellation) MUST require appropriate permissions and audit logging.
- **FR-034a**: Refunds — an admin with FINANCE permission MUST be able to initiate a refund against a PAID order; a full refund transitions PAID → REFUNDED, while a partial refund keeps the order PAID and records a refund transaction; refund status MUST be verified against the gateway (webhook or status query) before the order is marked REFUNDED; all refund actions, amounts, and outcomes MUST be audited.
- **FR-034b**: Cancellations — a CREATED or PAYMENT_PENDING order MUST be cancellable by an authorized admin; cancellation MUST be audited and MUST invalidate the payment URL; an in-flight or completed payment on a cancelled order is handled per FR-021a.

**Bulk Import & Export**

- **FR-035**: The system MUST support bulk customer/renewal import from CSV and XLSX with a flow of upload, validate, preview, confirm, process asynchronously, create/update customer, create renewal order, generate secure URL, and queue WhatsApp notification.
- **FR-036**: Import validation MUST cover required fields, mobile format, vehicle number, premium, expiry date, duplicate customer, duplicate vehicle/order, existing open renewal order, and invalid values.
- **FR-037**: Import results MUST show total, successful, failed, and duplicate counts, with a downloadable error report; large imports MUST NOT depend on a single long-running synchronous request.
- **FR-038**: Admins with permission MUST be able to export payment/order data (customer, mobile, vehicle, premium, order ID, payment status, method, transaction ID, payment date, policy status, created/updated date), processed asynchronously for large exports.

**Configuration & Multi-Provider**

- **FR-039**: The system MUST make configurable: business name, logo, currency, order prefix, payment URL domain, payment-link expiry, maximum payment attempts, enabled payment methods, insurance products, notification templates, payment provider, WhatsApp provider, email provider, SMS provider, storage provider, retry behavior, and notification behavior. The platform serves a single business (Popoye Insurance) with configurable branding, not a multi-tenant SaaS.
- **FR-040**: Provider selection MUST happen through configuration (e.g., PAYMENT_PROVIDER = CASHFREE or RAZORPAY; WHATSAPP_PROVIDER = AISENSY or META) and MUST NOT require business-logic changes to switch.
- **FR-041**: Provider capabilities (e.g., supported payment methods) MUST be determined through capability definitions; the system MUST NOT assume all providers support all methods.
- **FR-042**: Secrets and credentials MUST NOT be stored as normal business configuration.

**Storage**

- **FR-043**: Storage MUST be provider-agnostic, initially S3-compatible object storage (with future AWS S3, GCS, Azure Blob, or other S3-compatible options), used for import files, export files, reports, and receipts where required.

**Security, Audit & Observability**

- **FR-044**: The system MUST implement security controls covering authentication (including multi-factor authentication for admin accounts with financial or sensitive permissions), authorization, RBAC, HTTPS, secure session/token handling, rate limiting, CORS, CSP, secure HTTP headers, input validation, output encoding, SQL-injection/XSS/CSRF protection, webhook signature verification, secret management, audit logging, sensitive-data masking, secure payment token generation, and no gateway secrets in frontend code.
- **FR-044a**: All sensitive data MUST be encrypted at rest (database, object storage, backups).
- **FR-044b**: All data MUST be encrypted in transit (TLS), and application-layer payloads exchanged with the frontend (e.g., user/customer payloads visible in the browser network tab) MUST be encrypted as well so that sensitive fields are not readable as plaintext even when a request/response is inspected (implementation preference for planning: JWE-style payload encryption via the `jose` library with a managed secret key).
- **FR-044c**: The system MUST comply with the Indian DPDP Act (Digital Personal Data Protection Act), including but not limited to data minimization, purpose limitation, notice and consent handling, storage limitation with defined retention, data-subject rights (access, correction, erasure), data-breach notification, grievance redressal, and secure handling of personal data across collection, storage, processing, and deletion.
- **FR-044d**: Consent — the system MUST capture and store consent records for processing personal data and for sending commercial WhatsApp communications (with timestamp, medium, and content), MUST honor consent withdrawal, and MUST NOT send renewal messages to customers without the required consent and DND (Do Not Disturb) compliance.
- **FR-044e**: Retention — the system MUST define configurable data-retention periods per data category (customer PII, payment records, audit logs, imports/exports) and MUST automate deletion or anonymization at the end of each period.
- **FR-044f**: Erasure — the system MUST provide an admin workflow to process data-subject erasure requests that anonymizes or deletes personal data while preserving payment and audit records that must be retained for legal or financial reasons; erasure actions MUST be audited.
- **FR-045**: The system MUST NOT store raw card data and MUST rely on the gateway's secure payment mechanisms for card handling.
- **FR-046**: The system MUST record audit events for admin login, order creation/changes, payment status changes, webhook received/rejected, WhatsApp sent/failure, bulk import, bulk export, configuration changes, refund, cancellation, and policy status changes, identifying actor, action, resource, resource ID, timestamp, source, and relevant before/after values.
- **FR-047**: The system MUST provide structured logging with traceable identifiers (request ID, order ID, payment attempt ID, gateway order ID, transaction ID, webhook event ID, notification ID) and MUST NOT log secrets, tokens, card data, or unnecessary PII. Per the technical design, production MUST also expose metrics and alerts (payment success/failure rates, webhook errors, notification errors, queue depth, API latency) and health endpoints; this is a production-alignment task (T060).

**Reliability, Retries & Reconciliation**

- **FR-048**: The system MUST define behavior for invalid/expired URL, order not found, already-paid order, payment failure/pending, gateway unavailable/timeout, webhook failure, invalid/duplicate webhook, WhatsApp provider unavailable/failure, bulk import failure, database failure, and configuration error; external provider failures MUST NOT corrupt internal business state.
- **FR-049**: Retry behavior MUST be configurable for WhatsApp delivery, webhook processing, background jobs, and provider API calls, using safe idempotency mechanisms, and MUST NOT blindly retry financial operations.
- **FR-050**: The system MUST support reconciliation between internal orders, payment attempts, gateway transactions, and webhook events, identifying discrepancies such as order PAID with unknown gateway status, gateway PAID with missed webhook, duplicate transactions, amount mismatches, and unknown gateway payments.

**Reliability, Backup & Performance**

- **FR-051**: The system MUST perform automated, encrypted backups of databases and object storage, MUST define and verify a restore procedure, and MUST meet a recovery-point objective (RPO) of ≤ 24 hours and a recovery-time objective (RTO) of ≤ 4 hours; backup/restore capability MUST be covered by a documented disaster-recovery runbook and tested at least quarterly.
- **FR-052**: The system MUST support defined concurrency targets without degrading the payment flow: at least 50 concurrent payment-page sessions, 20 concurrent webhook requests/second, and 20 concurrent admin dashboard users.
- **FR-053**: The system MUST include load/performance tests (e.g., k6 or JMeter per project conventions) covering payment page access, order lookup, payment session creation, webhook processing, admin payment search, bulk import, and WhatsApp queue processing, executed before release.

### Key Entities

- **Customer**: Personal and contact details (name, mobile, etc.); uniquely identified; may own multiple vehicles/policies.
- **Vehicle**: Vehicle number, vehicle type; associated with a customer and policies.
- **Policy**: Policy number, expiry date, premium, policy status (ACTIVE/RENEWAL_PENDING/PAYMENT_COMPLETED/PROCESSING/RENEWED/EXPIRED); linked to a vehicle, customer, and insurance product.
- **Insurance Product**: Two-wheeler, private car, commercial vehicle, future products; configuration-defined.
- **Renewal Order**: Order ID, public reference, customer/vehicle/policy/product, amount, currency, payment status, URL token/expiry, timestamps.
- **Payment Attempt**: Attempt ID, order ID, gateway order ID/payment ID, transaction ID, method, amount, currency, status, failure reason, gateway reference, timestamps.
- **Payment Transaction**: Verified/recorded transaction details for reconciliation.
- **Refund**: Refund records (full/partial) linked to an order and payment attempts, with amount, gateway reference, verification status, and audit trail.
- **Webhook Event**: Raw event, signature/validation result, processing outcome, event identifier for idempotency.
- **WhatsApp Message**: Notification record, template, recipient, status, delivery attempts, failure reason.
- **Notification Template**: Configurable message templates for WhatsApp (and email/SMS) channels.
- **Bulk Import / Bulk Import Row**: Import batch metadata, per-row validation status, errors, result counts.
- **Admin User / Role / Permission**: Admin identities, roles, and permissions for RBAC.
- **Audit Log**: Actor, action, resource, resource ID, timestamp, before/after values, source.
- **System Configuration**: Business/branding/settings configuration (no secrets).
- **Provider Configuration**: Selected providers and provider-specific settings (secrets managed separately).

## Success Criteria

### Measurable Outcomes

- **SC-001**: An authorized admin can create or bulk-import a renewal customer and have a unique secure Popoye payment URL generated and sent via the configured WhatsApp provider within 5 minutes of confirmation.
- **SC-002**: A customer can open a payment URL and complete a supported payment through the Popoye-branded page without needing assistance; the page loads in under 3 seconds on a typical mobile connection.
- **SC-003**: 100% of verified, correctly signed payment webhooks result in correct payment-state updates; duplicate, invalid, and out-of-order webhooks never change payment state incorrectly.
- **SC-004**: No customer can access another customer's order through a payment URL; invalid/expired/already-paid URLs always show the correct configured experience.
- **SC-005**: The platform reliably processes at least 1,000 payment requests/day at launch and scales to 50,000+ customers/month without code changes to core payment logic.
- **SC-006**: Switching the payment or WhatsApp provider via configuration requires no changes to customer, order, payment-domain, payment-page, admin, reporting, or audit logic, and all flows pass end-to-end with the new provider.
- **SC-007**: WhatsApp delivery failures never change payment state, are recorded, retryable, and resendable by an admin.
- **SC-008**: 100% of sensitive/financial actions (refund, cancellation, configuration changes) are permission-controlled and recorded in audit logs with actor, action, and before/after values.
- **SC-009**: All core behaviors (order creation, secure token generation, payment success/failure/pending, duplicate prevention, webhook handling, WhatsApp success/failure/retry, bulk import/export, RBAC, provider switching, security controls, and load) are covered by automated tests defined in the development plan.
- **SC-010**: The system meets the defined concurrency targets (50 concurrent payment-page sessions, 20 concurrent webhooks/sec, 20 concurrent admin users) under load testing, and a restore drill completes within the RTO (≤ 4 hours) and RPO (≤ 24 hours) targets.

## Assumptions

- Currency is Indian Rupees (INR) given the example premium (₹699); the amount is expressed with a configurable currency.
- The payment URL domain is `https://pay.popoyeinsurance.com` with token-based paths (`/p/<secure-token>`).
- Default payment-link expiry is 48 hours; the value is configurable (24/48/72 hours or any configured duration).
- The launch scope is the two-wheeler renewal product; other products are added via configuration without new payment/order workflows.
- The initial release targets a single business (Popoye Insurance) with configurable branding and business settings.
- The admin application is delivered as a mobile-responsive web application (per stakeholder decision, superseding the original React Native requirement). The customer payment page is also fully mobile-responsive since customers pay from their phones.
- Sensitive provider credentials (gateway keys, WhatsApp API keys) are managed through a secret-management mechanism, not business configuration.
- Security posture: all sensitive data is encrypted at rest; TLS for transport plus application-layer payload encryption (JWE via `jose`, managed secret key); DPDP Act (India) compliance is a launch requirement, with data-minimization, consent, retention, and erasure controls.
- Payment requests and confirmations are delivered via WhatsApp only at launch (initial provider AiSensy); SMS is deferred to a later phase and does not affect core payment flows.
- The gateway (Cashfree) and WhatsApp provider (AiSensy) capabilities assumed at launch — including exact supported payment methods, webhook event types, and template limitations — are provider dependencies to be validated during planning, not invented here.
- Reconciliation is performed via automated discrepancy detection with admin review; fully automated resolution is not assumed.
- Data is stored using a relational data model with unique constraints, indexes, and relationships appropriate to the entities listed; storage of files (imports/exports/reports) uses S3-compatible object storage.
- Refund and cancel capabilities are modeled as provider capabilities; their availability at launch depends on the configured provider's support.

## Open Questions

- Exact role/permission matrix per role to be defined during detailed specification.

## Alignment with Product Documents

The repository root contains the authoritative product documents — `01_..._PRD.docx`, `02_..._Technical_Design.docx`, `03_..._Workflow.docx`. This spec is the working PRD; the following decisions reconcile the product documents with this spec and the POC implementation:

| Topic | Decision |
|-------|----------|
| Backend framework | POC implements Node.js + TypeScript + **Express**. The technical design lists NestJS as the production option; Express is acceptable and NestJS adoption is not required to satisfy any FR. |
| API surface | POC routes are `/api/p/:token`, `/api/admin/*`, `/webhooks/cashfree`. Production versioning (`/api/v1/...`, `/api/v1/webhooks/payment/:provider`) is a production-alignment task (T050). |
| Public token storage | POC stores the raw 256-bit token. Production stores a SHA-256 hash (FR-005; T052). |
| Gateway order creation | POC creates the gateway order lazily on the first payment attempt. The workflow document creates it at renewal creation; lazy creation is retained for the POC (avoids orphan gateway orders) and re-aligned in production if required (T051). |
| WhatsApp delivery status | POC records QUEUED/SENT/FAILED. DELIVERED/READ + provider message IDs require a provider callback and are a production-alignment task (T054). |
| Status enums | Order statuses match the workflow document. Attempt statuses are SUCCESS/FAILED/USER_DROPPED (workflow lists INITIATED/PENDING/CANCELLED/UNKNOWN) and policy statuses are ACTIVE/RENEWAL_PENDING/PAYMENT_COMPLETED/PROCESSING/RENEWED/EXPIRED (workflow lists PENDING_RENEWAL/RENEWAL_IN_PROGRESS/RENEWED/EXCEPTION) — the implemented enums are authoritative and the workflow document's names map onto them (T055). |
| RBAC | POC ships a single admin; the full role set is a production-alignment task (FR-031; T058). |
| Queues | POC uses direct/async calls. Redis + BullMQ queues (renewal-message, payment-confirmation, bulk-import, export-generation, reconciliation) are production-alignment (T053). |
| Reconciliation | Automated discrepancy detection with admin review is specified (FR-050); scheduled reconciliation jobs are production-alignment (T057). |
| Async export | POC exports client-side CSV. Async workbook export to object storage is production-alignment (T056). |
| Observability | Request IDs + structured logs in POC; metrics/alerts/health dashboards are production-alignment (FR-047; T060). |
| Load testing | k6 load tests are production-alignment (T059). |
| Deployment | Docker/Nginx/load balancer, managed PostgreSQL, Redis, S3-compatible storage are production-alignment (T061). |

The exception matrix in the workflow document (§16) is fully implemented in this POC and enforced by FR-048/FR-019/FR-020.

## Out of Scope

- Receipt and invoice generation (storage may hold receipts where required, but generating printable receipts/invoices is not in scope for this feature).
- Partial payments and installment plans.
- Multi-currency at launch (INR only).
- Customer-initiated payment retry beyond the configured maximum payment attempts.
- Failed-payment WhatsApp notification to the customer (admin-visible only at launch).
- Automated refund processing (refunds are admin-initiated and gateway-verified).
- Self-serve customer account portal (customers do not log in; they pay via the secure token URL).
- Email and SMS delivery channels (deferred to later phases; provider abstractions exist).
- Third-party policy-issuance integration (policy processing is manual via the admin workflow).
- Cross-border payments and international mobile numbers.