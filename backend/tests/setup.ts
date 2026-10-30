import { beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

beforeAll(async () => {
  await migrate();
  await seed();
  await query(
    `TRUNCATE audit_logs, whatsapp_messages, webhook_events, payment_attempts,
              renewal_orders, policies, vehicles, customers
     RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await pool.end();
});
