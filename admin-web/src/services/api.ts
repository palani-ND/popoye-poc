import axios from 'axios';

export interface DashboardStats {
  total_requests: number;
  expected_amount: number;
  collected_amount: number;
  counts: { paid: number; unpaid: number; pending: number; failed: number };
}

export interface AdminOrder {
  id: number;
  order_ref: string;
  customer_name: string;
  mobile: string;
  vehicle_number: string;
  premium: number;
  status: string;
  payment_method: string | null;
  transaction_id: string | null;
  payment_date: string | null;
  policy_status: string;
  whatsapp_status: string;
  payment_url: string;
}

export async function fetchMe(): Promise<{ email: string; role: string }> {
  const res = await axios.get('/api/admin/auth/me');
  return res.data;
}

export async function login(email: string, password: string): Promise<{ email: string; role: string }> {
  const res = await axios.post('/api/admin/auth/login', { email, password });
  return res.data;
}

export async function logout(): Promise<void> {
  await axios.post('/api/admin/auth/logout');
}

export async function fetchDashboard(): Promise<DashboardStats> {
  const res = await axios.get('/api/admin/dashboard');
  return res.data;
}

export async function fetchOrders(params?: Record<string, string>): Promise<AdminOrder[]> {
  const res = await axios.get('/api/admin/orders', { params });
  return res.data.orders;
}

export async function createOrder(payload: Record<string, unknown>): Promise<{
  order_ref: string;
  payment_url: string;
  status: string;
}> {
  const res = await axios.post('/api/admin/orders', payload);
  return res.data;
}

export async function resendOrder(id: number): Promise<{ ok: boolean; status: string }> {
  const res = await axios.post(`/api/admin/orders/${id}/resend`);
  return res.data;
}
