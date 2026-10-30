import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getOrderByToken, transitionOrder, type OrderRow } from '../../domain/orderService.js';
import { getBrandConfig } from '../../domain/brandService.js';
import { encryptPayload } from '../../security/encryption.js';
import { CashfreeAdapter } from '../../providers/payment/CashfreeAdapter.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { config } from '../../config/index.js';
import { query } from '../../db/pool.js';

export const paymentRouter = Router();

const PAYMENT_METHODS = ['upi', 'card', 'netbanking'] as const;

const paySchema = z.object({
  method: z.string().min(1).optional(),
});

const VEHICLE_LABELS: Record<string, string> = {
  TWO_WHEELER: 'Two Wheeler',
  PRIVATE_CAR: 'Private Car',
  COMMERCIAL_VEHICLE: 'Commercial Vehicle',
};

function vehicleLabel(type: string): string {
  return VEHICLE_LABELS[type] ?? type;
}

interface OrderDetailRow {
  customer_name: string;
  mobile: string;
  vehicle_number: string;
  vehicle_type: string;
  premium: string;
  currency: string;
  expiry_date: string;
  policy_number: string | null;
}

interface PaidAttemptRow {
  transaction_id: string | null;
  method: string | null;
  created_at: string;
}

async function loadOrderContext(req: Request, res: Response) {
  const token = req.params.token as string;
  const order = await getOrderByToken(token);
  if (!order) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invalid payment request' } });
    return null;
  }
  if (new Date(order.token_expiry) < new Date()) {
    const brand = await getBrandConfig();
    res.status(410).json({
      error: { code: 'EXPIRED', message: 'Payment link has expired' },
      brand,
    });
    return null;
  }
  return order;
}

async function fetchOrderDetail(orderId: number): Promise<OrderDetailRow> {
  const { rows } = await query<OrderDetailRow>(
    `SELECT c.name AS customer_name, c.mobile, v.vehicle_number, v.vehicle_type,
            p.premium, p.currency, p.expiry_date, p.policy_number
     FROM renewal_orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN vehicles v ON v.id = o.vehicle_id
     JOIN policies p ON p.id = o.policy_id
     WHERE o.id = $1`,
    [orderId],
  );
  return rows[0];
}

async function fetchPaidAttempt(orderId: number): Promise<PaidAttemptRow | null> {
  const { rows } = await query<PaidAttemptRow>(
    `SELECT transaction_id, method, created_at FROM payment_attempts
     WHERE order_id = $1 AND status = 'SUCCESS' ORDER BY id DESC LIMIT 1`,
    [orderId],
  );
  return rows[0] ?? null;
}

// GET /api/p/:token — order summary + branding for the payment page
paymentRouter.get(
  '/p/:token',
  asyncHandler(async (req, res) => {
    const order = await loadOrderContext(req, res);
    if (!order) return;

    const detail = await fetchOrderDetail(order.id);
    const brand = await getBrandConfig();

    if (order.status === 'PAID' || order.status === 'REFUNDED') {
      const attempt = await fetchPaidAttempt(order.id);
      const payload = await encryptPayload({
        status: 'PAID',
        order_ref: order.order_ref,
        customer_name: detail.customer_name,
        vehicle_number: detail.vehicle_number,
        amount: Number(order.amount),
        currency: order.currency,
        transaction_id: attempt?.transaction_id ?? null,
        method: attempt?.method ?? null,
        payment_time: attempt?.created_at ?? null,
      });
      res.json({ order: payload, brand });
      return;
    }

    const payload = await encryptPayload({
      order_ref: order.order_ref,
      customer_name: detail.customer_name,
      mobile: detail.mobile,
      vehicle_number: detail.vehicle_number,
      vehicle_type: detail.vehicle_type,
      vehicle_label: vehicleLabel(detail.vehicle_type),
      premium: Number(detail.premium),
      currency: detail.currency,
      policy_expiry: detail.expiry_date,
      policy_number: detail.policy_number,
      status: order.status,
    });

    res.json({ order: payload, brand });
  }),
);

// POST /api/p/:token/pay — create a Cashfree session server-side
paymentRouter.post(
  '/p/:token/pay',
  asyncHandler(async (req, res) => {
    const order = await loadOrderContext(req, res);
    if (!order) return;

    if (order.status === 'PAID' || order.status === 'REFUNDED') {
      throw new AppError(409, 'ALREADY_PAID', 'This payment has already been completed');
    }
    if (order.status !== 'CREATED' && order.status !== 'PAYMENT_PENDING') {
      throw new AppError(409, 'CONFLICT', `Order is in state ${order.status} and cannot be paid`);
    }

    const parsed = paySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION', 'Invalid payment method');
    }
    const method = parsed.data.method;
    if (method && !PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
      throw new AppError(
        422,
        'UNSUPPORTED_METHOD',
        `Payment method '${method}' is not supported by the configured gateway`,
      );
    }

    if (!config.CASHFREE_APP_ID || !config.CASHFREE_SECRET_KEY) {
      throw new AppError(502, 'GATEWAY_UNAVAILABLE', 'Payment gateway is not configured');
    }

    const { rows } = await query<{ customer_id: string; mobile: string; name: string }>(
      `SELECT c.id AS customer_id, c.mobile, c.name FROM renewal_orders o
       JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
      [order.id],
    );
    const customer = rows[0];

    const adapter = new CashfreeAdapter();
    let session;
    try {
      session = await adapter.createOrder({
        orderId: order.order_ref,
        amount: Number(order.amount),
        currency: order.currency,
        customerId: String(customer.customer_id),
        customerPhone: customer.mobile.replace(/\D/g, '').slice(-10),
        customerName: customer.name,
        notifyUrl: config.WEBHOOK_URL,
        returnUrl: `${config.CASHFREE_PAYMENT_URL_BASE}/${order.payment_token}`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ level: 'error', message: 'Cashfree create order failed', error: String(err) }));
      throw new AppError(502, 'GATEWAY_UNAVAILABLE', 'Payment gateway could not be reached');
    }

    if (order.status === 'CREATED') {
      await transitionOrder(order.id, 'PAYMENT_PENDING');
    }
    await query('UPDATE renewal_orders SET gateway_order_id = $1, updated_at = now() WHERE id = $2', [
      session.gatewayOrderId,
      order.id,
    ]);

    res.json({
      order_ref: order.order_ref,
      payment_session_id: session.paymentSessionId,
      amount: Number(order.amount),
      currency: order.currency,
      method,
    });
  }),
);

// GET /api/p/:token/status — status refresh after gateway return
paymentRouter.get(
  '/p/:token/status',
  asyncHandler(async (req, res) => {
    const order = await loadOrderContext(req, res);
    if (!order) return;
    res.json({ order_ref: order.order_ref, status: order.status });
  }),
);

// GET /api/p/:token/upi-qr — trusted UPI payload for the Scan & Pay QR (amount from backend only)
paymentRouter.get(
  '/p/:token/upi-qr',
  asyncHandler(async (req, res) => {
    const order = await loadOrderContext(req, res);
    if (!order) return;

    const detail = await fetchOrderDetail(order.id);
    const upiPayload =
      `upi://pay?pa=${encodeURIComponent(config.UPI_PAYEE_ADDRESS)}` +
      `&pn=${encodeURIComponent('Popoye Insurance')}` +
      `&am=${order.amount}` +
      `&cu=${order.currency}` +
      `&tr=${order.order_ref}` +
      `&tn=${encodeURIComponent(`Insurance renewal ${detail.vehicle_number}`)}`;

    res.json({
      upi_payload: upiPayload,
      amount: Number(order.amount),
      currency: order.currency,
      order_ref: order.order_ref,
    });
  }),
);

export { paymentUrlFor };