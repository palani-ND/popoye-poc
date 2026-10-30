import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminOrder } from '../services/api.ts';
import { fetchOrders, resendOrder } from '../services/api.ts';

export default function Orders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (q) params.q = q;
    fetchOrders(params).then(setOrders).catch(() => setOrders([]));
  };

  useEffect(load, [status, q]);

  const resend = async (id: number) => {
    setBusyId(id);
    await resendOrder(id).catch(() => undefined);
    setBusyId(null);
    load();
  };

  const statusClass = (s: string) => `badge badge-${s.toLowerCase().replace(/_/g, '-')}`;

  return (
    <div className="page-shell">
      <header className="topbar">
        <Link to="/" className="back">← Dashboard</Link>
        <span className="brand-name">Payments</span>
        <Link to="/orders/new" className="primary-link">+ New</Link>
      </header>

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="CREATED">Created</option>
          <option value="PAYMENT_PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="PAYMENT_FAILED">Failed</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <input placeholder="Search vehicle / mobile / order" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="order-list">
        {orders.map((o) => (
          <div className="order-row" key={o.order_ref}>
            <div className="order-head">
              <span className="customer">{o.customer_name}</span>
              <span className={statusClass(o.status)}>{o.status}</span>
            </div>
            <div className="order-line">{o.vehicle_number} · {o.mobile}</div>
            <div className="order-line">
              ₹{o.premium.toFixed(2)} · {o.order_ref}
            </div>
            <div className="order-line muted">
              {o.payment_method ?? '—'} · {o.transaction_id ?? '—'} · WA: {o.whatsapp_status}
            </div>
            <div className="order-actions">
              <button className="ghost" onClick={() => navigator.clipboard.writeText(o.payment_url)}>
                Copy URL
              </button>
              <button className="ghost" disabled={busyId === o.id} onClick={() => resend(o.id)}>
                Resend
              </button>
            </div>
          </div>
        ))}
        {orders.length === 0 ? <p className="empty">No payments found.</p> : null}
      </div>
    </div>
  );
}
