import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { client, loginAdmin, createTestOrder } from '../helpers.js';
import { query } from '../../src/db/pool.js';

const SECRET = 'test-cashfree-secret-key';

function sign(rawBody: string, timestamp = '1730000000000'): string {
  return createHmac('sha256', SECRET).update(timestamp + rawBody).digest('base64');
}

function webhookPayload(orderRef: string, cfPaymentId: string, amount: number, status: string) {
  return {
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: orderRef, order_amount: amount, order_currency: 'INR' },
      payment: {
        cf_payment_id: cfPaymentId,
        payment_status: status,
        payment_amount: amount,
        payment_currency: 'INR',
        payment_message: 'Payment successful',
        payment_group: 'upi',
        bank_reference: 'BANK123',
      },
    },
  };
}

async function pendingOrder(cookie: string, vehicleNumber: string, premium = 699): Promise<{ order_ref: string; token: string }> {
  mobileCounter += 1;
  const mobile = `+919876543${String(240 + mobileCounter).padStart(2, '0')}`;
  const { order } = await createTestOrder({ mobile, vehicle_number: vehicleNumber, premium }, cookie);
  const { rows } = await query<{ payment_token: string }>(
    'SELECT payment_token FROM renewal_orders WHERE order_ref = $1',
    [order.order_ref],
  );
  await query(
    `UPDATE renewal_orders SET status = 'PAYMENT_PENDING', gateway_order_id = $1 WHERE order_ref = $2`,
    [order.order_ref, order.order_ref],
  );
  return { order_ref: order.order_ref, token: rows[0].payment_token };
}

let mobileCounter = 0;

describe('POST /webhooks/cashfree', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = (await loginAdmin()).headers['set-cookie'];
  });

  it('T032/T033 processes a valid signed success webhook → PAID', async () => {
    const { order_ref, token } = await pendingOrder(cookie, 'WB01SUCCESS', 699);
    const rawBody = JSON.stringify(webhookPayload(order_ref, 'cf_1001', 699, 'SUCCESS'));
    const res = await client
      .post('/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(rawBody))
      .set('x-webhook-timestamp', '1730000000000')
      .send(rawBody);

    expect(res.status).toBe(200);
    const { rows } = await query('SELECT status FROM renewal_orders WHERE order_ref = $1', [order_ref]);
    expect(rows[0].status).toBe('PAID');
    const attempts = await query('SELECT * FROM payment_attempts WHERE cf_payment_id = $1', ['cf_1001']);
    expect(attempts.rows[0].status).toBe('SUCCESS');
    const wa = await query('SELECT * FROM whatsapp_messages WHERE order_id = (SELECT id FROM renewal_orders WHERE order_ref = $1)', [order_ref]);
    expect(wa.rows.some((r) => r.kind === 'CONFIRMATION')).toBe(true);
  });

  it('T033 ignores a duplicate webhook (idempotent)', async () => {
    const { order_ref } = await pendingOrder(cookie, 'WB02DUP', 699);
    const rawBody = JSON.stringify(webhookPayload(order_ref, 'cf_1002', 699, 'SUCCESS'));
    const sig = sign(rawBody);
    for (let i = 0; i < 2; i++) {
      await client
        .post('/webhooks/cashfree')
        .set('Content-Type', 'application/json')
        .set('x-webhook-signature', sig)
        .set('x-webhook-timestamp', '1730000000000')
        .send(rawBody);
    }
    const attempts = await query('SELECT * FROM payment_attempts WHERE cf_payment_id = $1', ['cf_1002']);
    expect(attempts.rows.length).toBe(1);
    const events = await query('SELECT * FROM webhook_events WHERE cf_payment_id = $1', ['cf_1002']);
    expect(events.rows.length).toBe(1);
  });

  it('T032 rejects an invalid signature without changing state', async () => {
    const { order_ref, token } = await pendingOrder(cookie, 'WB03BAD', 699);
    const rawBody = JSON.stringify(webhookPayload(order_ref, 'cf_1003', 699, 'SUCCESS'));
    const res = await client
      .post('/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 'tampered-signature')
      .set('x-webhook-timestamp', '1730000000000')
      .send(rawBody);
    expect(res.status).toBe(200);
    const { rows } = await query('SELECT status FROM renewal_orders WHERE order_ref = $1', [order_ref]);
    expect(rows[0].status).toBe('PAYMENT_PENDING');
    const events = await query('SELECT signature_valid FROM webhook_events WHERE cf_payment_id = $1', ['cf_1003']);
    expect(events.rows[0].signature_valid).toBe(false);
  });

  it('T033 rejects an amount mismatch and never marks PAID', async () => {
    const { order_ref } = await pendingOrder(cookie, 'WB04AMT', 699);
    const rawBody = JSON.stringify(webhookPayload(order_ref, 'cf_1004', 100, 'SUCCESS'));
    const res = await client
      .post('/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(rawBody))
      .set('x-webhook-timestamp', '1730000000000')
      .send(rawBody);
    expect(res.status).toBe(200);
    const { rows } = await query('SELECT status FROM renewal_orders WHERE order_ref = $1', [order_ref]);
    expect(rows[0].status).toBe('PAYMENT_PENDING');
  });

  it('T033 records USER_DROPPED and transitions to PAYMENT_FAILED', async () => {
    const { order_ref } = await pendingOrder(cookie, 'WB05DROP', 699);
    const rawBody = JSON.stringify(webhookPayload(order_ref, 'cf_1005', 699, 'USER_DROPPED'));
    await client
      .post('/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', sign(rawBody))
      .set('x-webhook-timestamp', '1730000000000')
      .send(rawBody);
    const { rows } = await query('SELECT status FROM renewal_orders WHERE order_ref = $1', [order_ref]);
    expect(rows[0].status).toBe('PAYMENT_FAILED');
  });
});
