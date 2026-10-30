import { describe, it, expect, beforeAll } from 'vitest';
import { client, loginAdmin, createTestOrder } from '../helpers.js';

describe('Admin API', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = (await loginAdmin()).headers['set-cookie'];
    await createTestOrder(
      { mobile: '+919876543230', vehicle_number: 'AD01ORDER1', premium: 699 },
      cookie,
    );
  });

  it('T036 rejects admin endpoints without a session', async () => {
    const res = await client.get('/api/admin/orders');
    expect(res.status).toBe(401);
  });

  it('T036 rejects login with a wrong password', async () => {
    const res = await client.post('/api/admin/auth/login').send({
      email: 'admin@test.com',
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
  });

  it('T036 accepts login with correct credentials and returns session', async () => {
    const res = await loginAdmin();
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.com');
  });

  it('T037 lists orders with payment_url', async () => {
    const res = await client.get('/api/admin/orders').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThan(0);
    expect(res.body.orders[0]).toHaveProperty('payment_url');
    expect(res.body.orders[0]).toHaveProperty('whatsapp_status');
  });

  it('T037 filters orders by status', async () => {
    const res = await client.get('/api/admin/orders?status=CREATED').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.orders.every((o: { status: string }) => o.status === 'CREATED')).toBe(true);
  });

  it('T038 returns dashboard stats', async () => {
    const res = await client.get('/api/admin/dashboard').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_requests');
    expect(res.body).toHaveProperty('expected_amount');
    expect(res.body).toHaveProperty('collected_amount');
    expect(res.body.counts).toHaveProperty('paid');
  });

  it('T039 resends the WhatsApp request (recorded even if provider unconfigured)', async () => {
    const list = await client.get('/api/admin/orders').set('Cookie', cookie);
    const orderId = list.body.orders[0].order_ref;
    const { rows } = await import('../../src/db/pool.js').then((m) =>
      m.query('SELECT id FROM renewal_orders WHERE order_ref = $1', [orderId]),
    );
    const res = await client.post(`/api/admin/orders/${rows[0].id}/resend`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});
