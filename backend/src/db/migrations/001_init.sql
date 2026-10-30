-- 001_init.sql — POC schema per data-model.md

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  vehicle_number VARCHAR(20) NOT NULL UNIQUE,
  vehicle_type VARCHAR(50) NOT NULL DEFAULT 'TWO_WHEELER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policies (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  policy_number VARCHAR(50),
  premium NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  expiry_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS renewal_orders (
  id BIGSERIAL PRIMARY KEY,
  order_ref VARCHAR(40) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  policy_id BIGINT NOT NULL REFERENCES policies(id),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
  payment_token VARCHAR(64) NOT NULL UNIQUE,
  token_expiry TIMESTAMPTZ NOT NULL,
  gateway_order_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON renewal_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_vehicle ON renewal_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON renewal_orders(customer_id);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES renewal_orders(id),
  cf_payment_id VARCHAR(64),
  transaction_id VARCHAR(64),
  method VARCHAR(30),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL,
  failure_reason TEXT,
  gateway_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_order ON payment_attempts(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempts_cf_payment ON payment_attempts(cf_payment_id)
  WHERE cf_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(60) NOT NULL,
  cf_payment_id VARCHAR(64) NOT NULL,
  order_id BIGINT REFERENCES renewal_orders(id),
  signature_valid BOOLEAN NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PROCESSED',
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_type, cf_payment_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES renewal_orders(id),
  kind VARCHAR(20) NOT NULL,
  recipient_mobile VARCHAR(20) NOT NULL,
  template_key VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_order ON whatsapp_messages(order_id);

CREATE TABLE IF NOT EXISTS brand_config (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor VARCHAR(100),
  action VARCHAR(60) NOT NULL,
  resource VARCHAR(40),
  resource_id VARCHAR(64),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource, resource_id);
