import { withTransaction, query } from '../db/pool.js';
import type { OrderRow } from './orderService.js';
import { transitionOrder } from './orderService.js';
import { logAudit } from './audit.js';

export interface CashfreeWebhookEvent {
  type: string;
  event_time?: string;
  data?: {
    order?: {
      order_id?: string;
      order_amount?: number | string;
      order_currency?: string;
    };
    payment?: {
      cf_payment_id?: string;
      payment_status?: string;
      payment_amount?: number | string;
      payment_currency?: string;
      payment_message?: string;
      payment_method?: string;
      payment_group?: string;
      bank_reference?: string;
    };
    customer_details?: { customer_phone?: string };
  };
}

export type WebhookOutcome = 'PROCESSED' | 'IGNORED_DUPLICATE' | 'REJECTED_SIGNATURE' | 'REJECTED_MISMATCH';

export async function recordWebhookEvent(
  eventType: string,
  cfPaymentId: string,
  signatureValid: boolean,
  payload: unknown,
): Promise<boolean> {
  const { rowCount } = await query(
    `INSERT INTO webhook_events (event_type, cf_payment_id, signature_valid, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_type, cf_payment_id) DO NOTHING`,
    [eventType, cfPaymentId, signatureValid, JSON.stringify(payload)],
  );
  return (rowCount ?? 0) > 0;
}

export async function markWebhookProcessed(eventType: string, cfPaymentId: string, orderId: number | null): Promise<void> {
  await query(
    `UPDATE webhook_events SET status = 'PROCESSED', order_id = COALESCE($3, order_id) WHERE event_type = $1 AND cf_payment_id = $2`,
    [eventType, cfPaymentId, orderId],
  );
}

/**
 * Process a verified Cashfree payment webhook.
 * - Duplicate (event_type, cf_payment_id) → ignored.
 * - Amount/currency mismatch vs order → rejected + flagged for reconciliation.
 * - Success → order PAID + payment_attempt SUCCESS.
 * - Failed/user-dropped → order PAYMENT_FAILED (attempt recorded) if currently pending.
 */
export async function processWebhook(
  event: CashfreeWebhookEvent,
  gatewayOrderId: string | null,
): Promise<{ outcome: WebhookOutcome; order?: OrderRow }> {
  const eventType = event.type ?? '';
  const cfPaymentId = event.data?.payment?.cf_payment_id;
  const orderIdFromGateway = event.data?.order?.order_id;

  if (!eventType || !cfPaymentId) {
    return { outcome: 'REJECTED_MISMATCH' };
  }

  const inserted = await recordWebhookEvent(eventType, cfPaymentId, true, event);
  if (!inserted) {
    return { outcome: 'IGNORED_DUPLICATE' };
  }

  const paymentAmount = Number(event.data?.payment?.payment_amount ?? event.data?.order?.order_amount);
  const paymentCurrency = event.data?.payment?.payment_currency ?? event.data?.order?.order_currency ?? 'INR';

  const matchedOrder = await findOrderByGatewayOrEvent(gatewayOrderId, orderIdFromGateway ?? null);
  if (!matchedOrder) {
    return { outcome: 'REJECTED_MISMATCH' };
  }

  if (Number(matchedOrder.amount) !== paymentAmount || matchedOrder.currency !== paymentCurrency) {
    await logAudit({
      actor: 'system',
      action: 'webhook_rejected',
      resource: 'webhook_event',
      resourceId: cfPaymentId,
      meta: { reason: 'amount_mismatch', expected: matchedOrder.amount, received: paymentAmount, order_ref: matchedOrder.order_ref },
    });
    return { outcome: 'REJECTED_MISMATCH', order: matchedOrder };
  }

  const attemptStatus = mapPaymentStatus(event.data?.payment?.payment_status);
  const order = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO payment_attempts
         (order_id, cf_payment_id, transaction_id, method, amount, currency, status, failure_reason, gateway_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (cf_payment_id) WHERE (cf_payment_id IS NOT NULL) DO NOTHING`,
      [
        matchedOrder.id,
        cfPaymentId,
        event.data?.payment?.bank_reference ?? null,
        event.data?.payment?.payment_group ?? null,
        paymentAmount,
        paymentCurrency,
        attemptStatus,
        event.data?.payment?.payment_message ?? null,
        JSON.stringify(event),
      ],    );

    const toStatus =
      attemptStatus === 'SUCCESS'
        ? 'PAID'
        : matchedOrder.status === 'PAYMENT_PENDING' || matchedOrder.status === 'CREATED'
          ? 'PAYMENT_FAILED'
          : matchedOrder.status;

    if (toStatus !== matchedOrder.status) {
      const updated = await transitionOrder(matchedOrder.id, toStatus as OrderRow['status'], {
        client,
        allowFrom: [matchedOrder.status as OrderRow['status']],
      });
      await client.query(
        `UPDATE webhook_events SET status = 'PROCESSED', order_id = $1 WHERE event_type = $2 AND cf_payment_id = $3`,
        [matchedOrder.id, eventType, cfPaymentId],
      );
      await logAudit({
        actor: 'system',
        action: 'payment_status_changed',
        resource: 'renewal_order',
        resourceId: String(matchedOrder.id),
        meta: { from: matchedOrder.status, to: toStatus, cf_payment_id: cfPaymentId },
      });
      return updated;
    }
    return matchedOrder;
  });

  return { outcome: 'PROCESSED', order };
}

async function findOrderByGatewayOrEvent(
  gatewayOrderId: string | null,
  orderIdFromGateway: string | null,
): Promise<OrderRow | null> {
  if (gatewayOrderId) {
    const { rows } = await query<OrderRow>('SELECT * FROM renewal_orders WHERE gateway_order_id = $1', [
      gatewayOrderId,
    ]);
    if (rows.length > 0) return rows[0];
  }
  if (orderIdFromGateway) {
    const { rows } = await query<OrderRow>('SELECT * FROM renewal_orders WHERE order_ref = $1', [
      orderIdFromGateway,
    ]);
    if (rows.length > 0) return rows[0];
  }
  return null;
}

function mapPaymentStatus(status?: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'SUCCESS';
    case 'USER_DROPPED':
      return 'USER_DROPPED';
    default:
      return 'FAILED';
  }
}
