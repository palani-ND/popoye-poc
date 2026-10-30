import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import type { BrandConfig, OrderSummary, PaidSummary } from '../services/api.ts';
import { fetchPaymentPage, createPaymentSession, fetchStatus, fetchUpiQr } from '../services/api.ts';
import {
  AlertTriangleIcon,
  BikeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  CreditCardIcon,
  DownloadIcon,
  LandmarkIcon,
  LockIcon,
  PhoneIcon,
  QrCodeIcon,
  RefreshIcon,
  ShareIcon,
  ShieldCheckIcon,
  UserIcon,
  XCircleIcon,
} from '../components/icons.tsx';

const defaultBrand: BrandConfig = {
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

declare global {
  interface Window {
    Cashfree: {
      new (opts: { mode: string }): {
        checkout(opts: { paymentSessionId: string; redirectTarget: string | Element }): void;
      };
    };
  }
}

type MethodKey = 'upi' | 'scan' | 'card' | 'netbanking';
type PageState =
  | { kind: 'loading' }
  | { kind: 'checkout'; order: OrderSummary; brand: BrandConfig }
  | { kind: 'processing'; order: OrderSummary; brand: BrandConfig }
  | { kind: 'success'; paid: PaidSummary; brand: BrandConfig }
  | { kind: 'failed'; order: OrderSummary; brand: BrandConfig }
  | { kind: 'expired'; brand: BrandConfig; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'error'; message: string };

function loadCashfreeSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load payment SDK'));
    document.head.appendChild(script);
  });
}

function fmtAmount(amount: number): string {
  return `₹${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function maskMobile(mobile: string): string {
  if (mobile.startsWith('+')) return mobile;
  return mobile;
}

export default function PayNow() {
  const { token = '' } = useParams();
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [method, setMethod] = useState<MethodKey>('upi');
  const [paying, setPaying] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState<{ upi_payload: string; amount: number; currency: string; order_ref: string } | null>(null);
  const [qrImage, setQrImage] = useState('');
  const checkoutRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async () => {
    if (!token) {
      setState({ kind: 'invalid', message: 'This payment link is invalid.' });
      return;
    }
    fetchPaymentPage(token)
      .then((data) => {
        if (data.order.status === 'PAID') {
          setState({ kind: 'success', paid: data.order as PaidSummary, brand: data.brand });
        } else {
          setState({ kind: 'checkout', order: data.order as OrderSummary, brand: data.brand });
        }
      })
      .catch((err: unknown) => {
        const e = err as { response?: { status?: number; data?: { brand?: BrandConfig; error?: { message?: string } } } };
        const status = e?.response?.status;
        const brand = e?.response?.data?.brand ?? defaultBrand;
        const message = e?.response?.data?.error?.message ?? 'This payment link is invalid.';
        if (status === 410) setState({ kind: 'expired', brand, message });
        else if (status === 404) setState({ kind: 'invalid', message });
        else setState({ kind: 'error', message });
      });
  }, [token]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const pollStatus = useCallback(async () => {
    try {
      const s = await fetchStatus(token);
      if (s.status === 'PAID' || s.status === 'REFUNDED') {
        const data = await fetchPaymentPage(token);
        setState({ kind: 'success', paid: data.order as PaidSummary, brand: data.brand });
        return true;
      }
      if (s.status === 'PAYMENT_FAILED') {
        setState((prev) =>
          prev.kind === 'processing' ? { ...prev, kind: 'failed' } : prev,
        );
        return true;
      }
    } catch {
      /* transient */
    }
    return false;
  }, [token]);

  useEffect(() => {
    if (state.kind !== 'processing') return;
    const timer = setInterval(() => void pollStatus(), 3000);
    return () => clearInterval(timer);
  }, [state.kind, pollStatus]);

  const handlePay = async () => {
    if (paying || state.kind !== 'checkout') return;

    if (method === 'scan') {
      try {
        const qr = await fetchUpiQr(token);
        const img = await QRCode.toDataURL(qr.upi_payload, { width: 220, margin: 1 });
        setQrData(qr);
        setQrImage(img);
        setShowQr(true);
      } catch {
        alert('Unable to load the QR code. Please try again.');
      }
      return;
    }

    setPaying(true);
    setState((prev) => (prev.kind === 'checkout' ? { ...prev, kind: 'processing' } : prev));
    try {
      const session = await createPaymentSession(token, method === 'upi' ? 'upi' : method);
      await loadCashfreeSdk();
      if (!checkoutRef.current) return;
      const cashfree = new window.Cashfree({
        mode: import.meta.env.VITE_CASHFREE_ENV === 'production' ? 'production' : 'sandbox',
      });
      cashfree.checkout({
        paymentSessionId: session.payment_session_id,
        redirectTarget: checkoutRef.current,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setState((prev) =>
        prev.kind === 'processing' ? { ...prev, kind: 'checkout' } : prev,
      );
      setPaying(false);
      alert(e?.response?.data?.error?.message ?? 'Unable to start payment. Please try again.');
    }
  };

  if (state.kind === 'loading') {
    return <Shell brand={defaultBrand}><div className="loader" /></Shell>;
  }

  if (state.kind === 'invalid' || state.kind === 'error') {
    return (
      <Shell brand={defaultBrand}>
        <div className="state-card">
          <XCircleIcon size={48} className="state-icon danger" />
          <h1>Invalid Payment Request</h1>
          <p>{state.message}</p>
          <p className="muted">Contact Popoye Insurance for assistance.</p>
        </div>
      </Shell>
    );
  }

  if (state.kind === 'expired') {
    return (
      <Shell brand={state.brand}>
        <div className="state-card">
          <ClockIcon size={48} className="state-icon warning" />
          <h1>Payment Link Expired</h1>
          <p>{state.brand.expired_message || state.message}</p>
          <p className="muted">Contact Popoye Insurance for assistance.</p>
        </div>
      </Shell>
    );
  }

  if (state.kind === 'success') {
    return <SuccessView paid={state.paid} brand={state.brand} />;
  }

  if (state.kind === 'failed') {
    return (
      <Shell brand={state.brand}>
        <div className="state-card">
          <AlertTriangleIcon size={48} className="state-icon danger" />
          <h1>Payment Failed</h1>
          <p>Your payment was not completed. Please try again.</p>
          <button className="pay-button" onClick={() => setState((prev) => (prev.kind === 'failed' ? { ...prev, kind: 'checkout' } : prev))}>
            <RefreshIcon size={18} /> Try Again
          </button>
        </div>
      </Shell>
    );
  }

  if (state.kind === 'processing') {
    return (
      <Shell brand={state.brand}>
        <PageHeader brand={state.brand} />
        <SecurityBanner />
        <div className="content processing-view">
          <div className="card processing-card">
            <div className="loader" />
            <h1>Payment Processing</h1>
            <p>Your payment is being verified.</p>
            <p className="muted">Do not close or refresh this page.</p>
            <div ref={checkoutRef} className="checkout-host" />
          </div>
        </div>
      </Shell>
    );
  }

  const { order, brand } = state;

  if (showQr && qrData) {
    return <QrView data={qrData} image={qrImage} brand={brand} onBack={() => setShowQr(false)} />;
  }

  return (
    <Shell brand={brand}>
      <PageHeader brand={brand} />
      <SecurityBanner />

      <div className="content">
        <section className="card">
          <div className="card-title">
            <UserIcon size={16} /> Customer Details
          </div>
          <dl className="details">
            <DetailRow icon={<UserIcon size={16} />} label="Name" value={order.customer_name} />
            <DetailRow icon={<PhoneIcon size={16} />} label="Mobile" value={maskMobile(order.mobile)} />
            <DetailRow icon={<BikeIcon size={16} />} label="Vehicle Number" value={order.vehicle_number} strong />
            <DetailRow icon={<BikeIcon size={16} />} label="Vehicle" value={order.vehicle_label} />
            <DetailRow icon={<CalendarIcon size={16} />} label="Policy Expiry" value={fmtDate(order.policy_expiry)} />
          </dl>
        </section>

        <section className="card amount-card">
          <div className="card-title">
            <CreditCardIcon size={16} /> Payment Amount
          </div>
          <div className="amount">{fmtAmount(order.premium)}</div>
          <div className="amount-sub">{order.currency} · Insurance renewal</div>
        </section>

        <section className="card">
          <div className="card-title">Choose Payment Method</div>
          <MethodList value={method} onChange={setMethod} />
        </section>

        <button className="pay-button" onClick={handlePay} disabled={paying}>
          <LockIcon size={18} /> Pay {fmtAmount(order.premium)}
        </button>

        <TrustFooter />

        <div ref={checkoutRef} className="checkout-host" />
      </div>
    </Shell>
  );
}

/* ---------- shared layout ---------- */

function Shell({ brand, children }: { brand: BrandConfig; children: React.ReactNode }) {
  return (
    <div
      className="shell"
      style={{ '--brand': brand.primary_color, '--brand2': brand.secondary_color } as CSSProperties}
    >
      {children}
    </div>
  );
}

function PageHeader({ brand }: { brand: BrandConfig }) {
  return (
    <header className="page-header">
      <div className="header-logo">
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={brand.business_name} />
        ) : (
          <div className="logo-fallback">Popoye</div>
        )}
      </div>
      <div className="secure-badge">
        <ShieldCheckIcon size={14} /> Secured
      </div>
    </header>
  );
}

function SecurityBanner() {
  return (
    <div className="security-banner">
      <ShieldCheckIcon size={22} />
      <div>
        <p className="banner-title">Secure Insurance Renewal</p>
        <p className="banner-sub">Your payment is 100% secure</p>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  strong,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`detail-row${icon ? '' : ' no-icon'}`}>
      {icon ? <span className="detail-icon">{icon}</span> : null}
      <dt>{label}</dt>
      <dd className={strong ? 'strong' : ''}>{value}</dd>
    </div>
  );
}

function MethodList({ value, onChange }: { value: MethodKey; onChange: (m: MethodKey) => void }) {
  const methods: { key: MethodKey; icon: React.ReactNode; title: string; sub: string; badge?: string; recommended?: boolean }[] = [
    {
      key: 'upi',
      icon: <QrCodeIcon size={22} />,
      title: 'UPI',
      sub: 'GPay · PhonePe · Paytm',
      badge: 'Recommended',
      recommended: true,
    },
    { key: 'scan', icon: <QrCodeIcon size={22} />, title: 'Scan & Pay', sub: 'Scan QR using any UPI app' },
    { key: 'card', icon: <CreditCardIcon size={22} />, title: 'Debit / Credit Card', sub: 'Visa, Mastercard, RuPay' },
    { key: 'netbanking', icon: <LandmarkIcon size={22} />, title: 'Net Banking', sub: 'All major banks supported' },
  ];
  return (
    <div className="method-list" role="radiogroup" aria-label="Choose Payment Method">
      {methods.map((m) => (
        <button
          key={m.key}
          type="button"
          role="radio"
          aria-checked={value === m.key}
          className={`method-card${value === m.key ? ' selected' : ''}${m.recommended ? ' recommended' : ''}`}
          onClick={() => onChange(m.key)}
        >
          <span className="method-icon">{m.icon}</span>
          <span className="method-text">
            <span className="method-title">{m.title}</span>
            <span className="method-sub">{m.sub}</span>
          </span>
          {m.badge ? <span className="recommended-badge">{m.badge}</span> : null}
          <ChevronRightIcon size={18} className="method-chevron" />
        </button>
      ))}
    </div>
  );
}

function TrustFooter() {
  return (
    <div className="trust-footer">
      <span><LockIcon size={12} /> Secure Payment</span>
      <span className="sep">|</span>
      <span><ShieldCheckIcon size={12} /> Trusted Gateway</span>
      <span className="sep">|</span>
      <span>100% Secure</span>
    </div>
  );
}

function SuccessView({ paid, brand }: { paid: PaidSummary; brand: BrandConfig }) {
  return (
    <Shell brand={brand}>
      <PageHeader brand={brand} />
      <div className="content success-view">
        <div className="success-hero">
          <div className="success-check">
            <CheckCircleIcon size={56} />
          </div>
          <h1>Payment Successful!</h1>
          <p>Your payment has been received successfully.</p>
          <div className="success-amount">{fmtAmount(paid.amount)}</div>
        </div>

        <div className="card">
          <dl className="details success-details">
            <DetailRow label="Transaction ID" value={paid.transaction_id ?? '—'} />
            <DetailRow label="Amount" value={fmtAmount(paid.amount)} />
            <DetailRow label="Payment Method" value={paid.method ?? '—'} />
            <DetailRow label="Date / Time" value={paid.payment_time ? new Date(paid.payment_time).toLocaleString('en-IN') : '—'} />
            <DetailRow label="Vehicle Number" value={paid.vehicle_number} strong />
          </dl>
        </div>

        <div className="success-actions">
          <button className="outline-button" onClick={() => window.print()}>
            <DownloadIcon size={16} /> Download Receipt
          </button>
          <button className="outline-button">
            <ShareIcon size={16} /> Share on WhatsApp
          </button>
        </div>
      </div>
    </Shell>
  );
}

function QrView({
  data,
  image,
  brand,
  onBack,
}: {
  data: { upi_payload: string; amount: number; currency: string; order_ref: string };
  image: string;
  brand: BrandConfig;
  onBack: () => void;
}) {
  return (
    <Shell brand={brand}>
      <PageHeader brand={brand} />
      <SecurityBanner />
      <div className="content qr-view">
        <button className="back-button" onClick={onBack}>← Back</button>
        <div className="card qr-card">
          <h1>Pay using UPI</h1>
          <img src={image} alt="UPI QR code" className="qr-image" />
          <p className="qr-hint">Scan QR using any UPI app</p>

          <div className="upi-apps">
            <span className="upi-app"><span className="app-badge gpay">G</span>GPay</span>
            <span className="upi-app"><span className="app-badge phonepe">P</span>PhonePe</span>
            <span className="upi-app"><span className="app-badge paytm">P</span>Paytm</span>
          </div>

          <div className="or-divider"><span>OR</span></div>

          <button
            className="pay-button"
            onClick={() => {
              window.location.href = data.upi_payload;
            }}
          >
            <QrCodeIcon size={18} /> Open UPI Apps
          </button>

          <dl className="qr-meta">
            <div><dt>Amount</dt><dd>{fmtAmount(data.amount)}</dd></div>
            <div><dt>Order ID</dt><dd>{data.order_ref}</dd></div>
          </dl>
        </div>
      </div>
    </Shell>
  );
}