import fs from 'node:fs';
import { pool } from './pool.js';
import { createOrder } from '../domain/orderService.js';

interface TestRecord {
  case: string;
  tag: string;
  scenario: string;
  customer_name: string;
  mobile: string;
  vehicle_number: string;
  vehicle_type: string;
  policy_number: string | null;
  premium: number;
  policy_expiry_date: string;
  product: string;
}

const dataPath = new URL(
  '../../../specs/001-insurance-renewal-payments/test-data.json',
  import.meta.url,
);

/** Seed the positive records from test-data.json (negative/edge records are asserted in tests). */
export async function seedTestData(): Promise<void> {
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const records = raw.records as TestRecord[];
  for (const r of records.filter((r) => r.tag === 'positive')) {
    try {
      await createOrder({
        customer_name: r.customer_name,
        mobile: r.mobile,
        vehicle_number: r.vehicle_number,
        vehicle_type: r.vehicle_type,
        policy_number: r.policy_number ?? null,
        premium: r.premium,
        policy_expiry_date: r.policy_expiry_date,
        product: r.product,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`seed-test-data: skipped ${r.case} (${r.scenario}):`, String(err));
    }
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  seedTestData()
    .then(() => pool.end())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}
