import { createHash } from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { client, loginAdmin, createTestOrder } from '../helpers.js';
import { query } from '../../src/db/pool.js';
import { jwtDecrypt } from 'jose';

const JWE_KEY = createHash('sha256').update('test-jwe-secret-key-32bytes!!').digest();

async function tokenOf(vehicleNumber: string): Promise<string> {
  const { rows } = await query<{ payment_token: string }>(
    `SELECT o.payment_token FROM renewal_orders o
     JOIN vehicles v ON v.id = o.vehicle_id
     WHERE v.vehicle_number = $1 ORDER BY o.id DESC LIMIT 1`,
    [vehicleNumber],
  );
  return rows[0]?.payment_token;
}

describe('Payment page API (/api/p/:token)', () => {
  let cookie: string;
  let token: string;

  beforeAll(async () => {
    cookie = (await loginAdmin()).headers['set-cookie'];
    await createTestOrder(
      { mobile: '+919876543220', vehicle_number: 'PY01TOKEN1', policy_number: 'POL-TOKEN1' },
      cookie,
    );
    token = await tokenOf('PY01TOKEN1');
  });

  it('T024 returns order summary + branding for a valid token', async () => {
    const res = await client.get(`/api/p/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.brand.business_name).toBe('Popoye Insurance');
    expect(typeof res.body.order).toBe('string'); // JWE-encrypted payload, not plaintext
    expect(res.body.order).not.toContain('Ravi Kumar');
  });

  it('T024 returns 404 for an invalid token', async () => {
    const res = await client.get('/api/p/not-a-real-token');
    expect(res.status).toBe(404);
  });

  it('T024 returns 410 for an expired token', async () => {
    const t = await tokenOf('PY01TOKEN1');
    await query('UPDATE renewal_orders SET token_expiry = now() - interval \'1 hour\' WHERE payment_token = $1', [t]);
    const res = await client.get(`/api/p/${t}`);
    expect(res.status).toBe(410);
  });

  it('T024 returns the PAID state (200) with encrypted transaction details for a paid order', async () => {
    await createTestOrder(
      { mobile: '+919876543221', vehicle_number: 'PY01PAID1', policy_number: 'POL-PAID1' },
      cookie,
    );
    const t = await tokenOf('PY01PAID1');
    await query('UPDATE renewal_orders SET status = \'PAID\' WHERE payment_token = $1', [t]);
    const res = await client.get(`/api/p/${t}`);
    expect(res.status).toBe(200);
    const { payload } = await jwtDecrypt(res.body.order, JWE_KEY);
    expect(payload.status).toBe('PAID');
    expect(payload.order_ref).toBeTruthy();
    expect(typeof res.body.order).toBe('string'); // encrypted, not plaintext
  });

  it('T025 returns 422 for an unsupported payment method', async () => {
    await createTestOrder(
      { mobile: '+919876543223', vehicle_number: 'PY01WALLET', policy_number: 'POL-WALLET' },
      cookie,
    );
    const t = await tokenOf('PY01WALLET');
    const res = await client.post(`/api/p/${t}/pay`).send({ method: 'wallet' });
    expect(res.status).toBe(422);
  });

  it('T025 returns 502 when the gateway is not configured', async () => {
    await createTestOrder(
      { mobile: '+919876543222', vehicle_number: 'PY01GW1', policy_number: 'POL-GW1' },
      cookie,
    );
    const t = await tokenOf('PY01GW1');
    const res = await client.post(`/api/p/${t}/pay`).send({ method: 'upi' });
    expect(res.status).toBe(502);
  });

  it('T026 status endpoint reflects the order status', async () => {
    const t = await tokenOf('PY01GW1');
    const res = await client.get(`/api/p/${t}/status`);
    expect(res.status).toBe(200);
    expect(['CREATED', 'PAYMENT_PENDING']).toContain(res.body.status);
  });
});
