import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../security/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import {
  createOrder,
  hasOpenOrderForVehicle,
  paymentUrlFor,
  type OrderRow,
} from '../../domain/orderService.js';
import { logAudit } from '../../domain/audit.js';
import { sendPaymentRequest, resendPaymentRequest } from '../../domain/whatsappService.js';
import { query } from '../../db/pool.js';

export const ordersRouter = Router();

const createOrderSchema = z.object({
  customer_name: z.string().min(1),
  mobile: z.string().min(8),
  vehicle_number: z.string().min(3),
  vehicle_type: z.string().min(1),
  policy_number: z.string().min(1).optional().nullable(),
  premium: z.number().positive(),
  policy_expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  product: z.string().min(1).optional(),
});

// POST /admin/orders — create a renewal order
ordersRouter.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION', 'Invalid order payload');
  }
  const input = parsed.data;
  const admin = (req as typeof req & { admin?: { email: string } }).admin;

  const open = await hasOpenOrderForVehicle(input.vehicle_number.replace(/\s+/g, '').toUpperCase());
  if (open) {
    throw new AppError(409, 'CONFLICT', 'An open renewal order already exists for this vehicle');
  }

  const order = await createOrder({
    customer_name: input.customer_name,
    mobile: input.mobile,
    vehicle_number: input.vehicle_number,
    vehicle_type: input.vehicle_type,
    policy_number: input.policy_number ?? null,
    premium: input.premium,
    policy_expiry_date: input.policy_expiry_date,
    product: input.product ?? 'TWO_WHEELER',
  });

  await logAudit({
    actor: admin?.email ?? 'admin',
    action: 'order_created',
    resource: 'renewal_order',
    resourceId: order.order_ref,
    meta: { vehicle_number: input.vehicle_number, premium: input.premium },
  });

  void sendPaymentRequest(order).catch(() => {
    /* WhatsApp failure must not fail order creation */
  });

  res.status(201).json({
    order_ref: order.order_ref,
    payment_url: paymentUrlFor(order.payment_token),
    status: order.status,
  });
}));

// GET /admin/orders — list with filters
ordersRouter.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status) {
    params.push(status);
    clauses.push(`o.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(
      `(c.name ILIKE $${params.length} OR c.mobile ILIKE $${params.length} OR v.vehicle_number ILIKE $${params.length} OR o.order_ref ILIKE $${params.length})`,
    );
  }
  if (dateFrom) {
    params.push(dateFrom);
    clauses.push(`o.created_at::date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    clauses.push(`o.created_at::date <= $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query<OrderRow>(
    `SELECT o.*, c.name AS customer_name, c.mobile, v.vehicle_number, p.status AS policy_status,
            p.premium, p.expiry_date
     FROM renewal_orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN vehicles v ON v.id = o.vehicle_id
     JOIN policies p ON p.id = o.policy_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT 200`,
    params,
  );

  const orders = await Promise.all(
    rows.map(async (o) => {
      const attempts = await query<{ status: string; method: string | null; transaction_id: string | null }>(
        `SELECT status, method, transaction_id FROM payment_attempts WHERE order_id = $1 ORDER BY id DESC LIMIT 1`,
        [o.id],
      );
      const lastAttempt = attempts.rows[0];
      const wa = await query<{ status: string }>(
        `SELECT status FROM whatsapp_messages WHERE order_id = $1 ORDER BY id DESC LIMIT 1`,
        [o.id],
      );
      return {
        id: o.id,
        order_ref: o.order_ref,
        customer_name: (o as unknown as { customer_name: string }).customer_name,
        mobile: (o as unknown as { mobile: string }).mobile,
        vehicle_number: (o as unknown as { vehicle_number: string }).vehicle_number,
        premium: Number(o.amount),
        status: o.status,
        payment_method: lastAttempt?.method ?? null,
        transaction_id: lastAttempt?.transaction_id ?? null,
        payment_date: lastAttempt?.status === 'SUCCESS' ? o.updated_at : null,
        policy_status: (o as unknown as { policy_status: string }).policy_status,
        whatsapp_status: wa.rows[0]?.status ?? 'NONE',
        payment_url: paymentUrlFor(o.payment_token),
      };
    }),
  );

  res.json({ orders, total: orders.length });
}));

// POST /admin/orders/:id/resend — resend WhatsApp payment request
ordersRouter.post('/:id/resend', requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError(400, 'VALIDATION', 'Invalid order id');
  const admin = (req as typeof req & { admin?: { email: string } }).admin;
  const record = await resendPaymentRequest(id);
  await logAudit({
    actor: admin?.email ?? 'admin',
    action: 'whatsapp_resend',
    resource: 'whatsapp_message',
    resourceId: String(record.id),
    meta: { order_id: id },
  });
  res.json({ ok: true, status: record.status });
}));
