import { Router, type Request, type Response } from 'express';
import { CashfreeAdapter } from '../providers/payment/CashfreeAdapter.js';
import type { CashfreeWebhookEvent } from '../domain/webhookService.js';
import { processWebhook } from '../domain/webhookService.js';
import { recordWebhookEvent } from '../domain/webhookService.js';
import { logAudit } from '../domain/audit.js';
import { sendPaymentConfirmation } from '../domain/whatsappService.js';
import { asyncHandler } from './middleware/errorHandler.js';

export const webhookRouter = Router();

/**
 * POST /webhooks/cashfree
 * Always responds 200 so the gateway stops retrying. Invalid signatures never change state.
 */
webhookRouter.post('/cashfree', asyncHandler(async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? '';
  const signature = (req.headers['x-webhook-signature'] as string) ?? '';
  const timestamp = (req.headers['x-webhook-timestamp'] as string) ?? '';

  const adapter = new CashfreeAdapter();
  const valid = adapter.verifyWebhookSignature(rawBody, signature, timestamp);

  const event = (req.body ?? {}) as CashfreeWebhookEvent;
  const cfPaymentId = event.data?.payment?.cf_payment_id ?? 'unknown';
  const eventType = event.type ?? 'UNKNOWN';

  if (!valid) {
    await recordWebhookEvent(eventType, cfPaymentId, false, event);
    await logAudit({
      actor: 'system',
      action: 'webhook_rejected',
      resource: 'webhook_event',
      resourceId: cfPaymentId,
      meta: { reason: 'invalid_signature' },
    });
    res.status(200).json({ status: 'rejected' });
    return;
  }

  const gatewayOrderId = event.data?.order?.order_id ?? null;
  const result = await processWebhook(event, gatewayOrderId);

  if (result.outcome === 'PROCESSED' && result.order?.status === 'PAID') {
    void sendPaymentConfirmation(result.order).catch(() => {
      /* confirmation failure must never change payment state */
    });
  }

  res.status(200).json({ status: 'ok', outcome: result.outcome });
}));
