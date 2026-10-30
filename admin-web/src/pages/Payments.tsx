import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminOrder } from '../services/api.ts';
import { createOrder, fetchOrders, resendOrder } from '../services/api.ts';
import {
  fmtDate,
  fmtDateTime,
  fmtRupee,
  paymentBadgeClass,
  paymentStatusLabel,
  policyBadgeClass,
  policyStatusLabel,
} from '../lib/ui.tsx';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  MoreVerticalIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from '../components/icons.tsx';

type StatusFilter = 'ALL' | 'CREATED' | 'PAYMENT_PENDING' | 'PAID' | 'PAYMENT_FAILED' | 'EXPIRED';

export default function Payments() {
  const [params] = useSearchParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    const query: Record<string, string> = {};
    if (status !== 'ALL') query.status = status;
    if (q) query.q = q;
    if (dateFrom) query.dateFrom = dateFrom;
    if (dateTo) query.dateTo = dateTo;
    fetchOrders(query).then(setOrders).catch(() => setOrders([]));
  };

  useEffect(load, [status, q, dateFrom, dateTo]);

  useEffect(() => {
    const orderRef = params.get('order');
    if (orderRef) {
      fetchOrders({ q: orderRef }).then((o) => {
        const match = o.find((x) => x.order_ref === orderRef);
        if (match) setSelected(match);
      });
    }
  }, [params]);

  const filtered = useMemo(() => orders, [orders]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [status, q, dateFrom, dateTo, perPage]);

  const exportCsv = () => {
    const header = ['Customer', 'Mobile', 'Vehicle No', 'Premium', 'Order ID', 'Status', 'Method', 'Transaction ID', 'Payment Date', 'Policy Status', 'WhatsApp Status'];
    const rows = filtered.map((o) => [
      o.customer_name,
      o.mobile,
      o.vehicle_number,
      o.premium,
      o.order_ref,
      paymentStatusLabel(o.status),
      o.payment_method ?? '',
      o.transaction_id ?? '',
      o.payment_date ?? '',
      policyStatusLabel(o.policy_status),
      o.whatsapp_status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resend = async (o: AdminOrder) => {
    await resendOrder(o.id).catch(() => undefined);
    load();
  };

  return (
    <div className="page">
      <div className="summary-grid compact">
        <Summary label="Total Payments" value={fmtRupee(filtered.reduce((s, o) => s + o.premium, 0))} sub={`${filtered.length} records`} />
        <Summary label="Paid" value={fmtRupee(filtered.filter((o) => o.status === 'PAID').reduce((s, o) => s + o.premium, 0))} sub={`${filtered.filter((o) => o.status === 'PAID').length} orders`} cls="accent-success" />
        <Summary label="Unpaid" value={`${filtered.filter((o) => ['CREATED', 'PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(o.status)).length}`} sub="Awaiting payment" cls="accent-warning" />
        <Summary label="Failed" value={`${filtered.filter((o) => o.status === 'PAYMENT_FAILED').length}`} sub="Needs attention" cls="accent-danger" />
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <SearchIcon size={16} />
          <input
            placeholder="Search name, mobile, vehicle, order ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="ALL">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="PAYMENT_PENDING">Pending</option>
          <option value="CREATED">Unpaid</option>
          <option value="PAYMENT_FAILED">Failed</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <input type="date" className="filter-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="filter-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" />
        <button className="btn-outline-secondary" onClick={exportCsv}>
          <DownloadIcon size={16} /> Export to Excel
        </button>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Renewal</button>
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Mobile</th>
              <th>Vehicle No</th>
              <th>Premium</th>
              <th>Order ID</th>
              <th>Payment Status</th>
              <th>Method</th>
              <th>Transaction ID</th>
              <th>Payment Date</th>
              <th>Policy Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((o) => (
              <tr key={o.id} onClick={() => setSelected(o)} className="clickable">
                <td>
                  <div className="cell-name">{o.customer_name}</div>
                </td>
                <td className="cell-muted">{o.mobile}</td>
                <td><span className="strong-cell">{o.vehicle_number}</span></td>
                <td><span className="premium-cell">{fmtRupee(o.premium)}</span></td>
                <td><span className="mono">{o.order_ref}</span></td>
                <td><span className={`badge ${paymentBadgeClass(o.status)}`}>{paymentStatusLabel(o.status)}</span></td>
                <td className="cell-muted">{o.payment_method ?? '—'}</td>
                <td><span className="mono">{o.transaction_id ?? '—'}</span></td>
                <td className="cell-muted">{fmtDate(o.payment_date)}</td>
                <td><span className={`badge ${policyBadgeClass(o.policy_status)}`}>{policyStatusLabel(o.policy_status)}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="icon-button" aria-label="View order" onClick={(e) => { e.stopPropagation(); setSelected(o); }}>
                      <EyeIcon size={16} />
                    </button>
                    <button className="icon-button" aria-label="More actions" onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === o.id ? null : o.id); }}>
                      <MoreVerticalIcon size={16} />
                    </button>
                    {menuFor === o.id ? (
                      <div className="kebab-menu" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { navigator.clipboard.writeText(o.payment_url); setMenuFor(null); }}>Copy Payment URL</button>
                        <button onClick={() => { void resend(o); setMenuFor(null); }}>Resend WhatsApp</button>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 ? (
              <tr><td colSpan={11} className="empty">No payments match the filters.</td></tr>
            ) : null}
          </tbody>
        </table>

        <div className="pagination">
          <div className="rows-per-page">
            Rows per page
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="page-buttons">
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="page-indicator">{page} / {totalPages}</span>
            <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </div>

      {selected ? <DetailDrawer order={selected} onClose={() => setSelected(null)} onResend={() => void resend(selected)} /> : null}
      {showCreate ? (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          onCreated={(o) => {
            setShowCreate(false);
            load();
            setSelected(o);
          }}
        />
      ) : null}
    </div>
  );
}

function Summary({ label, value, sub, cls }: { label: string; value: string; sub: string; cls?: string }) {
  return (
    <div className={`summary-card ${cls ?? ''}`}>
      <div className="summary-label">{label}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-sub">{sub}</div>
    </div>
  );
}

function TimelineStep({
  label,
  done,
  pending,
  failed,
}: {
  label: string;
  done?: boolean;
  pending?: boolean;
  failed?: boolean;
}) {
  return (
    <li className={`timeline-step ${failed ? 'failed' : done ? 'done' : pending ? 'pending' : ''}`}>
      <span className="timeline-dot">
        {done ? <CheckCircleIcon size={14} /> : failed ? <AlertTriangleIcon size={14} /> : <ClockIcon size={14} />}
      </span>
      <span className="timeline-label">{label}</span>
    </li>
  );
}

function DetailDrawer({ order, onClose, onResend }: { order: AdminOrder; onClose: () => void; onResend: () => void }) {
  const paid = order.status === 'PAID';
  const steps: { label: string; done?: boolean; pending?: boolean; failed?: boolean }[] = [
    { label: 'Order Created', done: true },
    { label: 'Payment Initiated', done: order.status !== 'CREATED' },
    { label: 'Payment Pending', pending: order.status === 'PAYMENT_PENDING' },
    { label: 'Payment Successful', done: paid },
    { label: 'WhatsApp Confirmation Sent', done: paid && order.whatsapp_status === 'SENT' },
    { label: 'Policy Processing', pending: paid },
    { label: 'Policy Issued', done: order.policy_status === 'RENEWED' || order.policy_status === 'ACTIVE' },
  ];

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>Order Details</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
        </div>

        <div className="drawer-body">
          <section className="drawer-section">
            <h3><CreditCardIcon size={15} /> Order</h3>
            <dl className="drawer-list">
              <Row label="Order ID" value={order.order_ref} mono />
              <Row label="Status" value={<span className={`badge ${paymentBadgeClass(order.status)}`}>{paymentStatusLabel(order.status)}</span>} />
              <Row label="Premium" value={fmtRupee(order.premium)} strong />
              <Row label="WhatsApp" value={order.whatsapp_status} />
            </dl>
          </section>

          <section className="drawer-section">
            <h3><ShieldCheckIcon size={15} /> Customer & Vehicle</h3>
            <dl className="drawer-list">
              <Row label="Customer" value={order.customer_name} />
              <Row label="Mobile" value={order.mobile} />
              <Row label="Vehicle No" value={order.vehicle_number} strong />
              <Row label="Policy Status" value={<span className={`badge ${policyBadgeClass(order.policy_status)}`}>{policyStatusLabel(order.policy_status)}</span>} />
            </dl>
          </section>

          <section className="drawer-section">
            <h3><CreditCardIcon size={15} /> Payment</h3>
            <dl className="drawer-list">
              <Row label="Method" value={order.payment_method ?? '—'} />
              <Row label="Transaction ID" value={order.transaction_id ?? '—'} mono />
              <Row label="Payment Date" value={fmtDateTime(order.payment_date)} />
            </dl>
          </section>

          <section className="drawer-section">
            <h3><FileTextIcon size={15} /> Payment Timeline</h3>
            <ol className="timeline">
              {steps.map((s) => (
                <TimelineStep key={s.label} label={s.label} done={s.done} pending={s.pending} failed={s.failed} />
              ))}
            </ol>
          </section>

          <div className="drawer-actions">
            <button className="btn-outline-secondary" onClick={() => navigator.clipboard.writeText(order.payment_url)}>
              Copy Payment URL
            </button>
            <button className="btn-outline-secondary" onClick={onResend}>
              Resend WhatsApp
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: React.ReactNode; strong?: boolean; mono?: boolean }) {
  return (
    <div className="drawer-row">
      <dt>{label}</dt>
      <dd className={`${strong ? 'strong' : ''} ${mono ? 'mono' : ''}`}>{value}</dd>
    </div>
  );
}

function CreateOrderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (o: AdminOrder) => void;
}) {
  const [form, setForm] = useState({
    customer_name: '',
    mobile: '',
    vehicle_number: '',
    vehicle_type: 'TWO_WHEELER',
    policy_number: '',
    premium: '',
    policy_expiry_date: '',
    product: 'TWO_WHEELER',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await createOrder({
        ...form,
        premium: Number(form.premium),
        policy_number: form.policy_number || null,
      });
      const list = await fetchOrders({ q: res.order_ref });
      const created = list.find((o) => o.order_ref === res.order_ref);
      if (created) onCreated(created);
      else onClose();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e2?.response?.data?.error?.message ?? 'Unable to create order');
      setBusy(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>New Renewal Order</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
        </div>
        <form className="drawer-body modal-form" onSubmit={submit}>
          <label>Customer name<input value={form.customer_name} onChange={set('customer_name')} required /></label>
          <label>Mobile<input value={form.mobile} onChange={set('mobile')} placeholder="+91..." required /></label>
          <label>Vehicle number<input value={form.vehicle_number} onChange={set('vehicle_number')} required /></label>
          <label>Vehicle type
            <select value={form.vehicle_type} onChange={set('vehicle_type')}>
              <option value="TWO_WHEELER">Two wheeler</option>
              <option value="PRIVATE_CAR">Private car</option>
              <option value="COMMERCIAL_VEHICLE">Commercial vehicle</option>
            </select>
          </label>
          <label>Policy number<input value={form.policy_number} onChange={set('policy_number')} /></label>
          <label>Premium (₹)<input type="number" step="0.01" min="1" value={form.premium} onChange={set('premium')} required /></label>
          <label>Policy expiry<input type="date" value={form.policy_expiry_date} onChange={set('policy_expiry_date')} required /></label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create order'}</button>
        </form>
      </aside>
    </div>
  );
}