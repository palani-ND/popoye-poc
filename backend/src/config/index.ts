import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CASHFREE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  CASHFREE_APP_ID: z.string().default(''),
  CASHFREE_SECRET_KEY: z.string().default(''),
  CASHFREE_API_VERSION: z.string().default('2026-01-01'),
  CASHFREE_PAYMENT_URL_BASE: z.string().default('https://pay.popoyeinsurance.com/p'),
  AISENSY_API_KEY: z.string().default(''),
  AISENSY_CAMPAIGN_NAME: z.string().default('renewal_payment_request'),
  AISENSY_CONFIRMATION_CAMPAIGN_NAME: z.string().default('renewal_payment_confirmation'),
  JWE_SECRET_KEY: z.string().min(16),
  ADMIN_SESSION_SECRET: z.string().min(16),
  ADMIN_EMAIL: z.string().default('admin@popoye.com'),
  ADMIN_PASSWORD: z.string().default('change-me'),
  PAYMENT_LINK_TTL_HOURS: z.coerce.number().default(48),
  MAX_PAYMENT_ATTEMPTS: z.coerce.number().default(3),
  UPI_PAYEE_ADDRESS: z.string().default('popoyeins@ybl'),
  WEBHOOK_URL: z.string().default('http://localhost:4000/webhooks/cashfree'),
  PORT: z.coerce.number().default(4000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
