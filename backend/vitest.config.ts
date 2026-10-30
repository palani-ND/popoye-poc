import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? 'postgres://localhost:5432/popoye_test',
      CASHFREE_ENV: 'sandbox',
      CASHFREE_APP_ID: '',
      CASHFREE_SECRET_KEY: 'test-cashfree-secret-key',
      AISENSY_API_KEY: '',
      JWE_SECRET_KEY: 'test-jwe-secret-key-32bytes!!',
      ADMIN_SESSION_SECRET: 'test-session-secret-32bytes!!',
      ADMIN_EMAIL: 'admin@test.com',
      ADMIN_PASSWORD: 'test-password',
      NODE_ENV: 'test',
    },
  },
});
