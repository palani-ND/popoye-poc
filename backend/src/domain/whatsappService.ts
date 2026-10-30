import { config } from '../config/index.js';
import { query } from '../db/pool.js';
import { AiSensyAdapter } from '../providers/whatsapp/AiSensyAdapter.js';
import type { WhatsAppProvider } from '../providers/whatsapp/WhatsAppProvider.js';
import type { OrderRow } from './orderService.js';
import { paymentUrlFor } from './orderService.js';
import { logAudit } from './audit.js';

const provider: WhatsAppProvider = new AiSensyAdapter();

export interface WhatsAppMessageRow {
  id: number;
  order_id: number;
  kind: string;
  recipient_mobile: string;
  template_key: string | null;
  status: string;
  error: string | null;
  sent_at: string | null;
}

export async function recordMessage(
  orderId: number,
  kind: 'REQUEST' | 'CONFIRMATION',
  recipientMobile: string,
  templateKey: string,
  status = 'PENDING',
): Promise<WhatsAppMessageRow> {
  const { rows } = await query<WhatsAppMessageRow>(
    `INSERT INTO whatsapp_messages (order_id, kind, recipient_mobile, template_key, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [orderId, kind, recipientMobile, templateKey, status],
  );
  return rows[0];
}

async function sendAndRecord(
  orderId: number,
  kind: 'REQUEST' | 'CONFIRMATION',
  recipientMobile: string,
  campaignName: string,
  templateParams: string[],
  userName: string,
): Promise<WhatsAppMessageRow> {
  const record = await recordMessage(orderId, kind, recipientMobile, campaignName);
  const result = await provider.sendMessage({
    recipientMobile,
    campaignName,
    userName,
    templateParams,
  });
  const status = result.ok ? 'SENT' : 'FAILED';
  await query(
    `UPDATE whatsapp_messages SET status = $1, error = $2, sent_at = now() WHERE id = $3`,
    [status, result.error ?? null, record.id],
  );
  await logAudit({
    actor: 'system',
    action: result.ok ? 'whatsapp_sent' : 'whatsapp_failure',
    resource: 'whatsapp_message',
    resourceId: String(record.id),
    meta: { order_id: orderId, kind, error: result.error },
  });
  return { ...record, status, error: result.error ?? null, sent_at: new Date().toISOString() };
}

/** Send the renewal payment request (WhatsApp) for an order. Never fails the caller. */
export async function sendPaymentRequest(order: OrderRow): Promise<WhatsAppMessageRow> {
  const { rows } = await query<{ name: string; mobile: string; vehicle_number: string; premium: string; expiry_date: string }>(
    `SELECT c.name, c.mobile, v.vehicle_number, p.premium, p.expiry_date
     FROM renewal_orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN vehicles v ON v.id = o.vehicle_id
     JOIN policies p ON p.id = o.policy_id
     WHERE o.id = $1`,
    [order.id],
  );
  const d = rows[0];
  const expiry = new Date(`${d.expiry_date}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return sendAndRecord(
    order.id,
    'REQUEST',
    d.mobile ?? '',
    config.AISENSY_CAMPAIGN_NAME,
    [d.name, d.vehicle_number, `₹${d.premium}`, expiry, order.order_ref, paymentUrlFor(order.payment_token)],
    d.name,
  );
}

/** Send the WhatsApp payment confirmation after verified success. Async-safe. */
export async function sendPaymentConfirmation(order: OrderRow): Promise<WhatsAppMessageRow> {
  const { rows } = await query<{ name: string; mobile: string; vehicle_number: string }>(
    `SELECT c.name, c.mobile, v.vehicle_number
     FROM renewal_orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN vehicles v ON v.id = o.vehicle_id
     WHERE o.id = $1`,
    [order.id],
  );
  const d = rows[0];
  return sendAndRecord(
    order.id,
    'CONFIRMATION',
    d.mobile ?? '',
    config.AISENSY_CONFIRMATION_CAMPAIGN_NAME,
    [d.name, `₹${order.amount}`, d.vehicle_number, order.order_ref],
    d.name,
  );
}

/** Resend the WhatsApp payment request (admin action). */
export async function resendPaymentRequest(orderId: number): Promise<WhatsAppMessageRow> {
  const { rows } = await query<OrderRow>('SELECT * FROM renewal_orders WHERE id = $1', [orderId]);
  if (rows.length === 0) throw new Error('Order not found');
  return sendPaymentRequest(rows[0]);
}
