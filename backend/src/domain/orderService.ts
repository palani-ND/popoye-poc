import { randomInt } from 'node:crypto';
import type pg from 'pg';
import { withTransaction, query, runner } from '../db/pool.js';
import { AppError } from '../api/middleware/errorHandler.js';
import { generatePaymentToken } from '../security/token.js';
import { config } from '../config/index.js';
import { upsertCustomer } from './customerService.js';
import { upsertVehicle } from './vehicleService.js';
import { upsertPolicy } from './policyService.js';

export type OrderStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['PAYMENT_PENDING', 'CANCELLED', 'EXPIRED'],
  PAYMENT_PENDING: ['PAID', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED'],
  PAYMENT_FAILED: ['PAYMENT_PENDING', 'EXPIRED', 'CANCELLED'],
  PAID: ['REFUNDED'],
  EXPIRED: ['PAID'],
  CANCELLED: ['PAID'],
  REFUNDED: [],
};

export interface OrderRow {
  id: number;
  order_ref: string;
  customer_id: number;
  vehicle_id: number;
  policy_id: number;
  amount: string;
  currency: string;
  status: OrderStatus;
  payment_token: string;
  token_expiry: string;
  gateway_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  customer_name: string;
  mobile: string;
  vehicle_number: string;
  vehicle_type: string;
  policy_number: string | null;
  premium: number;
  policy_expiry_date: string;
  product: string;
}

function generateOrderRef(): string {
  const d = new Date();
  const ymd = [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('');
  return `POP${ymd}${String(randomInt(0, 10000)).padStart(4, '0')}`;
}

export function paymentUrlFor(token: string): string {
  return `${config.CASHFREE_PAYMENT_URL_BASE}/${token}`;
}

export async function getOrderByToken(token: string): Promise<OrderRow | null> {
  const { rows } = await query<OrderRow>(
    'SELECT * FROM renewal_orders WHERE payment_token = $1',
    [token],
  );
  return rows[0] ?? null;
}

export async function getOrderById(id: number): Promise<OrderRow | null> {
  const { rows } = await query<OrderRow>('SELECT * FROM renewal_orders WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/** Create customer + vehicle + policy + renewal order atomically. */
export async function createOrder(input: CreateOrderInput): Promise<OrderRow> {
  return withTransaction(async (client) => {
    const customer = await upsertCustomer(input.customer_name, input.mobile, client);
    const vehicle = await upsertVehicle(customer.id, input.vehicle_number, input.vehicle_type, client);
    const policy = await upsertPolicy(
      vehicle.id,
      input.policy_number,
      input.premium,
      'INR',
      input.policy_expiry_date,
      client,
    );

    const token = generatePaymentToken();    const expiresAt = new Date(Date.now() + config.PAYMENT_LINK_TTL_HOURS * 60 * 60 * 1000);
    const { rows } = await client.query<OrderRow>(
      `INSERT INTO renewal_orders
         (order_ref, customer_id, vehicle_id, policy_id, amount, currency, status, payment_token, token_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, 'CREATED', $7, $8)
       RETURNING *`,
      [generateOrderRef(), customer.id, vehicle.id, policy.id, input.premium, 'INR', token, expiresAt],
    );
    return rows[0];
  });
}

/** Check whether a vehicle already has an open renewal order. */
export async function hasOpenOrderForVehicle(vehicleNumber: string): Promise<boolean> {
  const { rows } = await query<{ id: number }>(
    `SELECT o.id FROM renewal_orders o
     JOIN vehicles v ON v.id = o.vehicle_id
     WHERE v.vehicle_number = $1
       AND o.status IN ('CREATED', 'PAYMENT_PENDING', 'PAYMENT_FAILED')
     LIMIT 1`,
    [vehicleNumber],
  );
  return rows.length > 0;
}

export function isOpenStatus(status: OrderStatus): boolean {
  return status === 'CREATED' || status === 'PAYMENT_PENDING' || status === 'PAYMENT_FAILED';
}

/** Transition an order to a new status, enforcing the state machine. */
export async function transitionOrder(
  orderId: number,
  toStatus: OrderStatus,
  opts?: { client?: pg.PoolClient; allowFrom?: OrderStatus[] },
): Promise<OrderRow> {
  const run = runner(opts?.client);
  const { rows } = await run.query<OrderRow>(
    'SELECT * FROM renewal_orders WHERE id = $1 FOR UPDATE',
    [orderId],
  );
  const order = rows[0];
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

  const fromStatus = order.status as OrderStatus;
  const allowedFrom = opts?.allowFrom;
  if (allowedFrom && !allowedFrom.includes(fromStatus)) {
    throw new AppError(409, 'CONFLICT', `Order ${order.order_ref} is not in an allowed state`);
  }
  if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
    throw new AppError(
      409,
      'CONFLICT',
      `Invalid order state transition: ${fromStatus} -> ${toStatus}`,
    );
  }

  const updated = await run.query<OrderRow>(
    `UPDATE renewal_orders SET status = $2, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [orderId, toStatus],
  );
  return updated.rows[0];
}
