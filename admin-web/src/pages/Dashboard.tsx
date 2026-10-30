import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminOrder, DashboardStats } from '../services/api.ts';
import { fetchDashboard, fetchOrders } from '../services/api.ts';
import {
  fmtDate,
  fmtMoney,
  fmtRupee,
  paymentBadgeClass,
  paymentStatusLabel,
} from '../lib/ui.tsx';
import { CreditCardIcon, EyeIcon } from '../components/icons.tsx';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<AdminOrder[]>([]);

  useEffect(() => {
    fetchDashboard().then(setStats).catch(() => undefined);
    fetchOrders().then((o) => setRecent(o.slice(0, 6))).catch(() => undefined);
  }, []);

  const cards = stats
    ? [
        { label: 'Total Payments', value: fmtMoney(stats.total_requests), sub: fmtRupee(stats.expected_amount), cls: '' },
        { label: 'Paid', value: fmtMoney(stats.counts.paid), sub: fmtRupee(stats.collected_amount), cls: 'accent-success' },
        { label: 'Unpaid', value: fmtMoney(stats.counts.unpaid), sub: 'Awaiting payment', cls: 'accent-warning' },
        { label: 'Failed', value: fmtMoney(stats.counts.failed), sub: 'Needs attention', cls: 'accent-danger' },
      ]
    : [];

  const dist = stats
    ? [
        { label: 'Paid', value: stats.counts.paid, color: '#096D4B' },
        { label: 'Pending', value: stats.counts.pending, color: '#184CB2' },
        { label: 'Unpaid', value: Math.max(stats.counts.unpaid - stats.counts.pending, 0), color: '#D97706' },
        { label: 'Failed', value: stats.counts.failed, color: '#D1041F' },
      ]
    : [];
  const distTotal = dist.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="page">
      <div className="summary-grid">
        {cards.map((c) => (
          <div className={`summary-card ${c.cls}`} key={c.label}>
            <div className="summary-label">{c.label}</div>
            <div className="summary-value">{c.value}</div>
            <div className="summary-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card chart-card">
          <div className="card-head">
            <h2>Payment Status Distribution</h2>
          </div>
          <div className="dist-bars">
            {dist.map((d) => (
              <div className="dist-item" key={d.label}>
                <div className="dist-meta"><span>{d.label}</span><span>{d.value}</span></div>
                <div className="dist-track">
                  <div className="dist-fill" style={{ width: `${(d.value / distTotal) * 100}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-head">
            <h2>Recent Payments</h2>
            <Link to="/payments" className="link-button">View all</Link>
          </div>
          <div className="mini-list">
            {recent.map((o) => (
              <div className="mini-row" key={o.id}>
                <div className="mini-avatar">{o.customer_name.charAt(0)}</div>
                <div className="mini-info">
                  <span className="mini-name">{o.customer_name}</span>
                  <span className="mini-sub">{o.vehicle_number} · {fmtRupee(o.premium)}</span>
                </div>
                <span className={`badge ${paymentBadgeClass(o.status)}`}>{paymentStatusLabel(o.status)}</span>
              </div>
            ))}
            {recent.length === 0 ? <p className="empty">No payments yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="card table-card">
        <div className="card-head">
          <h2>Recent Transactions</h2>
          <CreditCardIcon size={18} className="head-icon" />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Vehicle No</th>
              <th>Premium</th>
              <th>Order ID</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id}>
                <td>
                  <div className="cell-name">{o.customer_name}</div>
                  <div className="cell-sub">{o.mobile}</div>
                </td>
                <td><span className="strong-cell">{o.vehicle_number}</span></td>
                <td><span className="premium-cell">{fmtRupee(o.premium)}</span></td>
                <td><span className="mono">{o.order_ref}</span></td>
                <td><span className={`badge ${paymentBadgeClass(o.status)}`}>{paymentStatusLabel(o.status)}</span></td>
                <td>{fmtDate(o.payment_date ?? null)}</td>
                <td><Link to={`/payments?order=${o.order_ref}`} className="icon-button" aria-label="View"><EyeIcon size={16} /></Link></td>
              </tr>
            ))}
            {recent.length === 0 ? (
              <tr><td colSpan={7} className="empty">No data yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}