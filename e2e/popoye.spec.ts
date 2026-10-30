import { test, expect, type Page } from '@playwright/test';

const ADMIN_URL = 'http://localhost:5174';
const PAYMENT_URL = 'http://localhost:5173';
const ADMIN_EMAIL = 'admin@popoye.com';
const ADMIN_PASSWORD = 'popoye123';

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function login(page: Page) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(ADMIN_URL + '/');
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Total Payments', { exact: true })).toBeVisible();
}

test('admin can log in and see the dashboard', async ({ page }) => {
  await login(page);
  await expect(page.getByText('Popoye Payments · POC')).toBeVisible();
  await expect(page.getByText('Payment Status Distribution')).toBeVisible();
});

test('admin creates a renewal order via the UI and it appears in payments', async ({ page }) => {
  await login(page);
  const vehicle = `PW${Date.now().toString().slice(-6)}`;

  await page.goto(`${ADMIN_URL}/payments`);
  await page.getByRole('button', { name: '+ New Renewal' }).click();
  await page.getByLabel('Customer name').fill('Playwright User');
  await page.getByLabel('Mobile').fill('+919876541234');
  await page.getByLabel('Vehicle number').fill(vehicle);
  await page.getByLabel('Premium (₹)').fill('699');
  await page.getByLabel('Policy expiry').fill(futureDate(30));
  await page.getByRole('button', { name: 'Create order' }).click();

  await expect(page.getByText('Order Details')).toBeVisible();
  await expect(page.getByText(vehicle).first()).toBeVisible();

  await page.getByLabel('Close').click();
  await page.getByRole('button', { name: /Export to Excel/ }).waitFor();
});

test('customer sees the branded payment page and the payload is encrypted', async ({ page }) => {
  // Create an order via the API using the browser's admin session
  const vehicle = `PV${Date.now().toString().slice(-6)}`;
  await login(page);
  const api = page.context().request;
  const res = await api.post(`${ADMIN_URL}/api/admin/orders`, {
    data: {
      customer_name: 'Confidential Customer',
      mobile: '+919876540099',
      vehicle_number: vehicle,
      vehicle_type: 'TWO_WHEELER',
      policy_number: 'POL-PW',
      premium: 699,
      policy_expiry_date: futureDate(45),
      product: 'TWO_WHEELER',
    },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { payment_url: string };
  const token = body.payment_url.split('/p/')[1];

  // Watch the payment-page API response to assert PII is not sent in plaintext
  const apiResponses: string[] = [];
  page.on('response', async (r) => {
    if (r.url().includes('/api/p/') && r.url().endsWith(token)) {
      apiResponses.push(await r.text());
    }
  });

  await page.goto(`${PAYMENT_URL}/p/${token}`);
  await expect(page.getByText('Confidential Customer')).toBeVisible();
  await expect(page.getByText('₹699', { exact: true })).toBeVisible();
  await expect(page.getByText(vehicle)).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay ₹699/ })).toBeVisible();
  await expect(page.getByText('Secure Insurance Renewal')).toBeVisible();
  await expect(page.getByText('Choose Payment Method')).toBeVisible();
  await expect(page.getByText('GPay · PhonePe · Paytm')).toBeVisible();

  // The encrypted payload must not contain the customer name in plaintext
  const raw = apiResponses.join('');
  expect(raw).toContain('eyJ'); // JWE header
  expect(raw).not.toContain('Confidential Customer');
});

test('invalid payment token shows the invalid-link page', async ({ page }) => {
  await page.goto(`${PAYMENT_URL}/p/not-a-real-token-12345`);
  await expect(page.getByRole('heading', { name: 'Invalid Payment Request' })).toBeVisible();
});

test('payment page root (no token) shows invalid-link page instead of an error', async ({ page }) => {
  await page.goto(`${PAYMENT_URL}/`);
  await expect(page.getByRole('heading', { name: 'Invalid Payment Request' })).toBeVisible();
});
