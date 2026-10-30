import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createOrder } from '../services/api.ts';

export default function CreateOrder() {
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
  const [success, setSuccess] = useState<{ payment_url: string } | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await createOrder({
        ...form,
        premium: Number(form.premium),
        policy_number: form.policy_number || null,
      });
      setSuccess({ payment_url: res.payment_url });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          'Unable to create order',
      );
    }
  };

  if (success) {
    return (
      <div className="page-shell center">
        <div className="card">
          <h1>Order created</h1>
          <p>Payment link:</p>
          <code className="url">{success.payment_url}</code>
          <div className="row">
            <button className="ghost" onClick={() => navigator.clipboard.writeText(success.payment_url)}>
              Copy
            </button>
            <Link to="/orders">View payments</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <Link to="/orders" className="back">← Back</Link>
        <span className="brand-name">New renewal</span>
      </header>
      <div className="card">
        <form onSubmit={submit} className="form">
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
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="primary">Create order</button>
        </form>
      </div>
    </div>
  );
}
