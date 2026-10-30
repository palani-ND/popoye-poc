import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';

export const app: Express = createApp();
export const client = request(app);

export async function loginAdmin(): Promise<request.Response> {
  return client.post('/api/admin/auth/login').send({
    email: 'admin@test.com',
    password: 'test-password',
  });
}

export interface CreatedOrder {
  order_ref: string;
  payment_url: string;
  status: string;
}

export async function createTestOrder(
  overrides: Record<string, unknown> = {},
  cookie?: string,
): Promise<{ res: request.Response; order: CreatedOrder }> {
  const adminCookie = cookie ?? (await loginAdmin()).headers['set-cookie'];
  const payload = {
    customer_name: 'Ravi Kumar',
    mobile: '+919876543210',
    vehicle_number: 'TN38AB1234',
    vehicle_type: 'TWO_WHEELER',
    policy_number: 'POL-0001',
    premium: 699,
    policy_expiry_date: '2026-10-15',
    product: 'TWO_WHEELER',
    ...overrides,
  };
  const res = await client.post('/api/admin/orders').set('Cookie', adminCookie).send(payload);
  return { res, order: res.body as CreatedOrder };
}
