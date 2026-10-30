import { useEffect, useMemo, useState } from 'react';
import type { AdminOrder } from '../services/api.ts';
import { fetchOrders } from '../services/api.ts';
import { fmtDate } from '../lib/ui.tsx';
import { SearchIcon } from '../components/icons.tsx';

export default function Customers() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetchOrders().then(setOrders).catch(() => setOrders([]));
  }, []);

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; mobile: string; vehicles: Set<string>; policies: Set<string>; pending: number; lastPaid: string | null }>();
    for (const o of orders) {
      const key = o.mobile;
      const existing = map.get(key) ?? { name: o.customer_name, mobile: o.mobile, vehicles: new Set(), policies: new Set(), pending: 0, lastPaid: null };
      existing.vehicles.add(o.vehicle_number);
      existing.policies.add(o.order_ref);
      if (o.status === 'PAID') existing.lastPaid = o.payment_date;
      else if (['CREATED', 'PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(o.status)) existing.pending += 1;
      map.set(key, existing);
    }
    return [...map.values()]
      .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.mobile.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, q]);

  return (
    <div className="page">
      <div className="filters-bar">
        <div className="search-box">
          <SearchIcon size={16} />
          <input placeholder="Search by name, mobile or vehicle…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Mobile</th>
              <th>Vehicle Count</th>
              <th>Renewals</th>
              <th>Pending Renewals</th>
              <th>Last Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.mobile}>
                <td><span className="cell-name">{c.name}</span></td>
                <td className="cell-muted">{c.mobile}</td>
                <td>{c.vehicles.size}</td>
                <td>{c.policies.size}</td>
                <td>{c.pending}</td>
                <td className="cell-muted">{c.lastPaid ? fmtDate(c.lastPaid) : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={6} className="empty">No customers found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}