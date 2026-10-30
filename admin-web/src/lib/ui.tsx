export function fmtRupee(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PAYMENT_LABEL: Record<string, string> = {
  CREATED: 'Unpaid',
  PAYMENT_PENDING: 'Pending',
  PAID: 'Paid',
  PAYMENT_FAILED: 'Failed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_LABEL[status] ?? status.replace(/_/g, ' ');
}

export function paymentBadgeClass(status: string): string {
  switch (status) {
    case 'PAID':
      return 'badge-success';
    case 'PAYMENT_PENDING':
      return 'badge-info';
    case 'PAYMENT_FAILED':
    case 'EXPIRED':
      return 'badge-danger';
    case 'CREATED':
      return 'badge-warning';
    default:
      return 'badge-neutral';
  }
}

const POLICY_LABEL: Record<string, string> = {
  ACTIVE: 'Issued',
  RENEWAL_PENDING: 'Pending',
  PAYMENT_COMPLETED: 'Processing',
  PROCESSING: 'Processing',
  RENEWED: 'Issued',
  EXPIRED: 'Failed',
};

export function policyStatusLabel(status: string): string {
  return POLICY_LABEL[status] ?? status.replace(/_/g, ' ');
}

export function policyBadgeClass(status: string): string {
  const s = policyStatusLabel(status);
  if (s === 'Issued') return 'badge-success';
  if (s === 'Processing') return 'badge-info';
  if (s === 'Failed') return 'badge-danger';
  return 'badge-neutral';
}