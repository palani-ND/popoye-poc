import { useEffect, useMemo, useState } from 'react';
import type { AdminOrder } from '../services/api.ts';
import { fetchOrders } from '../services/api.ts';
import { fmtRupee, policyBadgeClass, policyStatusLabel, paymentBadgeClass, paymentStatusLabel } from '../lib/ui.tsx';
import { SearchIcon } from '../components/icons.tsx';

export default function Policies() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetchOrders().then(setOrders).catch(() => setOrders([]));
  }, []);

  const rows = useMemo(() => {
    return orders.filter(
      (o) =>
        !q ||
        o.customer_name.toLowerCase().includes(q.toLowerCase()) ||
        o.vehicle_number.toLowerCase().includes(q.toLowerCase()) ||
        o.order_ref.toLowerCase().includes(q.toLowerCase()),
    );
  }, [orders, q]);

  return (
    <div className="page">
      <div className="filters-bar">
        <div className="search-box">
          <SearchIcon size={16} />
          <input placeholder="Search customer, vehicle or order…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Vehicle</th>
              <th>Order ID</th>
              <th>Premium</th>
              <th>Payment Status</th>
              <th>Policy Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td><span className="cell-name">{o.customer_name}</span></td>
                <td><span className="strong-cell">{o.vehicle_number}</span></td>
                <td><span className="mono">{o.order_ref}</span></td>
                <td><span className="premium-cell">{fmtRupee(o.premium)}</span></td>
                <td><span className={`badge ${paymentBadgeClass(o.status)}`}>{paymentStatusLabel(o.status)}</span></td>
                <td><span className={`badge ${policyBadgeClass(o.policy_status)}`}>{policyStatusLabel(o.policy_status)}</span></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={6} className="empty">No policies found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}