import type pg from 'pg';
import { runner } from '../db/pool.js';
import { normalizeVehicleNumber } from '../security/token.js';

export interface VehicleRow {
  id: number;
  customer_id: number;
  vehicle_number: string;
  vehicle_type: string;
}

export async function upsertVehicle(
  customerId: number,
  vehicleNumber: string,
  vehicleType: string,
  client?: pg.PoolClient,
): Promise<VehicleRow> {
  const normalized = normalizeVehicleNumber(vehicleNumber);
  const run = runner(client);
  const { rows } = await run.query<VehicleRow>(
    `INSERT INTO vehicles (customer_id, vehicle_number, vehicle_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (vehicle_number) DO UPDATE SET customer_id = EXCLUDED.customer_id
     RETURNING id, customer_id, vehicle_number, vehicle_type`,
    [customerId, normalized, vehicleType],
  );
  return rows[0];
}
