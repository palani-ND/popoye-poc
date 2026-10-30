import type pg from 'pg';
import { runner } from '../db/pool.js';
import { AppError } from '../api/middleware/errorHandler.js';
import type { QueryFn } from '../db/pool.js';

export interface CustomerRow {
  id: number;
  name: string;
  mobile: string;
}

export function validateMobile(mobile: string): void {
  if (!/^\+?[1-9][0-9]{7,14}$/.test(mobile)) {
    throw new AppError(400, 'VALIDATION', 'Invalid mobile number format');
  }
}

/** Upsert a customer by mobile. Returns existing or newly created customer id. */
export async function upsertCustomer(
  name: string,
  mobile: string,
  client?: pg.PoolClient,
): Promise<CustomerRow> {
  validateMobile(mobile);
  const run = runner(client);
  const { rows } = await run.query<CustomerRow>(
    `INSERT INTO customers (name, mobile) VALUES ($1, $2)
     ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, mobile`,
    [name, mobile],
  );
  return rows[0];
}
