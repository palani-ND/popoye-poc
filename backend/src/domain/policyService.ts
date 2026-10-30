import type pg from 'pg';
import { runner } from '../db/pool.js';
import { AppError } from '../api/middleware/errorHandler.js';

export interface PolicyRow {
  id: number;
  vehicle_id: number;
  policy_number: string | null;
  premium: string;
  currency: string;
  expiry_date: string;
  status: string;
}

export function validatePolicyInput(premium: number, expiryDate: string): void {
  if (typeof premium !== 'number' || !Number.isFinite(premium) || premium < 1) {
    throw new AppError(400, 'VALIDATION', 'Premium must be a number >= 1.00');
  }
  if (!expiryDate) {
    throw new AppError(400, 'VALIDATION', 'Policy expiry date is required');
  }
  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  if (Number.isNaN(expiry.getTime())) {
    throw new AppError(400, 'VALIDATION', 'Policy expiry date must be a valid date');
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (expiry < today) {
    throw new AppError(400, 'VALIDATION', 'Policy expiry date is in the past');
  }
}

export async function upsertPolicy(
  vehicleId: number,
  policyNumber: string | null,
  premium: number,
  currency: string,
  expiryDate: string,
  client?: pg.PoolClient,
): Promise<PolicyRow> {
  validatePolicyInput(premium, expiryDate);
  const run = runner(client);
  const { rows } = await run.query<PolicyRow>(
    `INSERT INTO policies (vehicle_id, policy_number, premium, currency, expiry_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, vehicle_id, policy_number, premium, currency, expiry_date, status`,
    [vehicleId, policyNumber ?? null, premium, currency, expiryDate],
  );
  return rows[0];
}
