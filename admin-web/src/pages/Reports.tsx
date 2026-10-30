import { BarChartIcon } from '../components/icons.tsx';

export default function Reports() {
  return (
    <div className="page">
      <div className="card empty-card">
        <BarChartIcon size={40} className="empty-icon" />
        <h2>Reports</h2>
        <p>
          Reconciliation and export reports between internal orders, payment attempts, gateway transactions,
          and webhook events. Available on the Payments screen today via <strong>Export to Excel</strong>.
        </p>
        <p className="muted">Full reconciliation engine is part of the production scope, not the POC.</p>
      </div>
    </div>
  );
}