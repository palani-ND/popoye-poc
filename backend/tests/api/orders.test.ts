import { describe, it, expect } from 'vitest';
import { client, loginAdmin, createTestOrder } from '../helpers.js';

describe('POST /api/admin/orders', () => {
  it('T015-P1 creates a standard two-wheeler renewal order with a secure URL', async () => {
    const { res, order } = await createTestOrder();
    expect(res.status).toBe(201);
    expect(order.status).toBe('CREATED');
    expect(order.order_ref).toMatch(/^POP\d{12,}$/);
    expect(order.payment_url).toMatch(/\/p\/[A-Za-z0-9_-]{32,}$/);
  });

  it('T015-P2 creates an order for a private car product (same workflow)', async () => {
    const { res } = await createTestOrder({
      customer_name: 'Meena Krishnan',
      mobile: '+919876543211',
      vehicle_number: 'KA03MN2045',
      vehicle_type: 'PRIVATE_CAR',
      product: 'PRIVATE_CAR',
      premium: 1249,
    });
    expect(res.status).toBe(201);
  });

  it('T015-P3 accepts a minimum premium of 1.00', async () => {
    const { res } = await createTestOrder({
      customer_name: 'Abdul Rahman',
      mobile: '+919876543212',
      vehicle_number: 'MH12DE9021',
      premium: 1,
    });
    expect(res.status).toBe(201);
  });

  it('T015-P4 upserts the same customer for a duplicate mobile with a new vehicle', async () => {
    await createTestOrder();
    const { res } = await createTestOrder({
      mobile: '+919876543210',
      vehicle_number: 'TN38CD5678',
      premium: 750,
    });
    expect(res.status).toBe(201);
  });

  it('T015-P5 creates an order for a commercial vehicle product', async () => {
    const { res } = await createTestOrder({
      customer_name: 'Lakshmi Narayanan',
      mobile: '+919876543213',
      vehicle_number: 'TN21CV3456',
      vehicle_type: 'COMMERCIAL_VEHICLE',
      product: 'COMMERCIAL_VEHICLE',
      premium: 4250,
    });
    expect(res.status).toBe(201);
  });

  it('T015-N1 rejects a duplicate vehicle with an existing open renewal order', async () => {
    await createTestOrder(); // TN38AB1234
    const { res } = await createTestOrder({
      mobile: '+919876543214',
      vehicle_number: 'TN38AB1234',
    });
    expect(res.status).toBe(409);
  });

  it('T015-N2 rejects a zero premium', async () => {
    const { res } = await createTestOrder({
      mobile: '+919876543215',
      vehicle_number: 'AP09XYZ321',
      premium: 0,
    });
    expect(res.status).toBe(400);
  });

  it('T015-N3 rejects an invalid mobile number', async () => {
    const { res } = await createTestOrder({
      mobile: '12345',
      vehicle_number: 'KL07AB8899',
    });
    expect(res.status).toBe(400);
  });

  it('T015-N4 rejects a missing policy expiry date', async () => {
    const { res } = await createTestOrder({
      mobile: '+919876543217',
      vehicle_number: 'TN09IJ1023',
      policy_expiry_date: undefined,
    });
    expect(res.status).toBe(400);
  });

  it('T015-E1 rejects a policy expiry date in the past', async () => {
    const { res } = await createTestOrder({
      mobile: '+919876543218',
      vehicle_number: 'KA51EF4455',
      policy_expiry_date: '2025-01-01',
    });
    expect(res.status).toBe(400);
  });

  it('T019 rejects unauthenticated order creation', async () => {
    const res = await client.post('/api/admin/orders').send({
      customer_name: 'X',
      mobile: '+919876543299',
      vehicle_number: 'XX11AA2222',
      premium: 100,
      policy_expiry_date: '2026-12-01',
    });
    expect(res.status).toBe(401);
  });
});
