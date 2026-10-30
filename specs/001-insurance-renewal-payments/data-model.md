# Data Model: Insurance Renewal Payment Platform (POC)

**Date**: 2026-10-05
**Source**: [spec.md](spec.md) (Key Entities) scoped to [poc-scope.md](poc-scope.md)
**Storage**: PostgreSQL 16

## Conventions

- `id` is a `BIGSERIAL` primary key (internal only, never exposed in payment URLs).
- Timestamps are `TIMESTAMPTZ`.
- Monetary values are `NUMERIC(12,2)`.
- All sensitive columns encrypted at rest at the database level; application-layer payloads encrypted via JWE (`jose`) in API responses.

## Entities

### admin_users
Single seeded admin for the POC (RBAC deferred).

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| email | VARCHAR(255) NOT NULL UNIQUE | |
| password_hash | TEXT NOT NULL | bcrypt |
| role | VARCHAR(50) NOT NULL DEFAULT 'ADMIN' | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### customers

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| name | VARCHAR(150) NOT NULL | |
| mobile | VARCHAR(20) NOT NULL UNIQUE | with country code |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### vehicles

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| customer_id | BIGINT NOT NULL FK → customers.id | |
| vehicle_number | VARCHAR(20) NOT NULL UNIQUE | normalized (uppercase, no spaces) |
| vehicle_type | VARCHAR(50) NOT NULL DEFAULT 'TWO_WHEELER' | |

### policies

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| vehicle_id | BIGINT NOT NULL FK → vehicles.id | |
| policy_number | VARCHAR(50) | nullable |
| premium | NUMERIC(12,2) NOT NULL | |
| currency | VARCHAR(3) NOT NULL DEFAULT 'INR' | |
| expiry_date | DATE NOT NULL | |
| status | VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' | ACTIVE / RENEWAL_PENDING / PAYMENT_COMPLETED / PROCESSING / RENEWED / EXPIRED |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### renewal_orders

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| order_ref | VARCHAR(40) NOT NULL UNIQUE | e.g. POP202610050001 |
| customer_id | BIGINT NOT NULL FK → customers.id | |
| vehicle_id | BIGINT NOT NULL FK → vehicles.id | |
| policy_id | BIGINT NOT NULL FK → policies.id | |
| amount | NUMERIC(12,2) NOT NULL | trusted amount from backend |
| currency | VARCHAR(3) NOT NULL DEFAULT 'INR' | |
| status | VARCHAR(30) NOT NULL DEFAULT 'CREATED' | CREATED / PAYMENT_PENDING / PAID / PAYMENT_FAILED / EXPIRED / CANCELLED / REFUNDED |
| payment_token | VARCHAR(64) NOT NULL UNIQUE | 256-bit base64url, no PII, not derived from id |
| token_expiry | TIMESTAMPTZ NOT NULL | configured expiry (default 48 h) |
| gateway_order_id | VARCHAR(64) | Cashfree `order_id` |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

**Order state transitions (POC)**: CREATED → PAYMENT_PENDING → PAID / PAYMENT_FAILED / EXPIRED; CREATED/PAYMENT_PENDING → CANCELLED; PAYMENT_FAILED → PAYMENT_PENDING (retry, up to configurable max). Invalid transitions rejected in the orders service.

### payment_attempts

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| order_id | BIGINT NOT NULL FK → renewal_orders.id | |
| cf_payment_id | VARCHAR(64) | Cashfree payment id (dedupe key) |
| transaction_id | VARCHAR(64) | gateway reference |
| method | VARCHAR(30) | upi / card / netbanking |
| amount | NUMERIC(12,2) NOT NULL | |
| currency | VARCHAR(3) NOT NULL DEFAULT 'INR' | |
| status | VARCHAR(30) NOT NULL | SUCCESS / FAILED / USER_DROPPED / PENDING |
| failure_reason | TEXT | |
| gateway_ref | TEXT | raw gateway response reference |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

Indexes: `(order_id)`, unique partial index on `cf_payment_id WHERE cf_payment_id IS NOT NULL`.

### webhook_events
Raw Cashfree webhook events for verification and dedupe.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| event_type | VARCHAR(60) NOT NULL | e.g. PAYMENT_SUCCESS_WEBHOOK |
| cf_payment_id | VARCHAR(64) NOT NULL | dedupe key |
| order_id | BIGINT FK → renewal_orders.id | |
| signature_valid | BOOLEAN NOT NULL | |
| status | VARCHAR(20) NOT NULL DEFAULT 'PROCESSED' | |
| payload | JSONB NOT NULL | raw body |
| received_at | TIMESTAMPTZ DEFAULT now() | |

Unique constraint: `(event_type, cf_payment_id)` — duplicate webhooks are rejected/ignored.

### whatsapp_messages

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| order_id | BIGINT NOT NULL FK → renewal_orders.id | |
| kind | VARCHAR(20) NOT NULL | REQUEST / CONFIRMATION |
| recipient_mobile | VARCHAR(20) NOT NULL | |
| template_key | VARCHAR(80) | AiSensy campaign/template name |
| status | VARCHAR(20) NOT NULL DEFAULT 'PENDING' | PENDING / SENT / FAILED |
| error | TEXT | |
| sent_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### brand_config
Single-row branding configuration consumed by the payment page.

| Column | Type | Notes |
|--------|------|-------|
| key | VARCHAR(50) PK | e.g. business_name, logo_url, primary_color, header_text, success_message |
| value | TEXT | |

### audit_logs (minimal)

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| actor | VARCHAR(100) | admin email or system |
| action | VARCHAR(60) NOT NULL | e.g. order_created, order_status_changed, webhook_received, whatsapp_sent |
| resource | VARCHAR(40) | |
| resource_id | VARCHAR(64) | |
| meta | JSONB | before/after values where relevant |
| created_at | TIMESTAMPTZ DEFAULT now() | |

## Relationships

```text
customers 1───n vehicles 1───n policies 1───n renewal_orders 1───n payment_attempts
                                                    │
                                                    ├─── n whatsapp_messages
                                                    └─── n webhook_events
admin_users (standalone)
brand_config (key-value, single row set)
audit_logs (append-only)
```

## Not in POC model

- Refunds, roles/permissions, bulk imports/exports, notification templates table, provider config table, object-storage files — deferred to the production build.