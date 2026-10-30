import { pool, query } from './pool.js';
import { config } from '../config/index.js';
import { hashPassword } from '../security/auth.js';

const brandDefaults: Record<string, string> = {
  business_name: 'Popoye Insurance',
  logo_url: '',
  primary_color: '#D1041F',
  secondary_color: '#184CB2',
  header_text: 'Secure your renewal',
  footer_text: 'Powered by Popoye Insurance',
  support_phone: '',
  support_email: '',
  terms_url: '',
  privacy_url: '',
  success_message: 'Payment received. Your insurance renewal is being processed.',
  failure_message: 'Payment could not be completed. Please try again.',
  pending_message: 'Your payment is being processed. This may take a few moments.',
  expired_message: 'This payment link has expired. Please contact support for a new link.',
};

export async function seed(): Promise<void> {
  const passwordHash = await hashPassword(config.ADMIN_PASSWORD);
  await query(
    `INSERT INTO admin_users (email, password_hash, role)
     VALUES ($1, $2, 'ADMIN')
     ON CONFLICT (email) DO NOTHING`,
    [config.ADMIN_EMAIL, passwordHash],
  );

  for (const [key, value] of Object.entries(brandDefaults)) {
    await query(
      `INSERT INTO brand_config (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, value],
    );
  }
  // eslint-disable-next-line no-console
  console.log('Seeded admin user and brand config.');
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}
