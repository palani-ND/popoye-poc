import { query } from '../db/pool.js';

export interface BrandConfig {
  business_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  header_text: string;
  footer_text: string;
  support_phone: string;
  support_email: string;
  terms_url: string;
  privacy_url: string;
  success_message: string;
  failure_message: string;
  pending_message: string;
  expired_message: string;
}

const defaults: BrandConfig = {
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

export async function getBrandConfig(): Promise<BrandConfig> {
  const { rows } = await query<{ key: string; value: string }>('SELECT key, value FROM brand_config');
  const overrides: Partial<Record<string, string>> = {};
  for (const row of rows) overrides[row.key] = row.value;
  return { ...defaults, ...(overrides as Partial<BrandConfig>) };
}
