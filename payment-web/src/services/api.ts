import axios from 'axios';
import { jwtDecrypt } from 'jose';

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

export interface OrderSummary {
  order_ref: string;
  customer_name: string;
  mobile: string;
  vehicle_number: string;
  vehicle_type: string;
  vehicle_label: string;
  premium: number;
  currency: string;
  policy_expiry: string;
  policy_number: string | null;
  status: string;
}

export interface PaidSummary {
  status: 'PAID';
  order_ref: string;
  customer_name: string;
  vehicle_number: string;
  amount: number;
  currency: string;
  transaction_id: string | null;
  method: string | null;
  payment_time: string | null;
}

export type OrderPayload = OrderSummary | PaidSummary;

export interface PaymentPageData {
  order: OrderPayload;
  brand: BrandConfig;
}

const jweSecret = import.meta.env.VITE_JWE_SECRET_KEY || '';

async function jweKey(): Promise<Uint8Array> {
  const data = new TextEncoder().encode(jweSecret);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

async function decrypt<T>(jwe: string): Promise<T> {
  const { payload } = await jwtDecrypt(jwe, await jweKey());
  return payload as T;
}

export async function fetchPaymentPage(token: string): Promise<PaymentPageData> {
  const res = await axios.get(`/api/p/${token}`);
  const data = res.data as { order: string; brand: BrandConfig };
  const order = await decrypt<OrderPayload>(data.order);
  return { order, brand: data.brand };
}

export async function fetchStatus(token: string): Promise<{ order_ref: string; status: string }> {
  const res = await axios.get(`/api/p/${token}/status`);
  return res.data;
}

export async function createPaymentSession(
  token: string,
  method?: string,
): Promise<{ order_ref: string; payment_session_id: string; amount: number; currency: string }> {
  const res = await axios.post(`/api/p/${token}/pay`, { method });
  return res.data;
}

export async function fetchUpiQr(
  token: string,
): Promise<{ upi_payload: string; amount: number; currency: string; order_ref: string }> {
  const res = await axios.get(`/api/p/${token}/upi-qr`);
  return res.data;
}