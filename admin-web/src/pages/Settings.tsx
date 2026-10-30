import { CreditCardIcon, LockIcon, MessageSquareIcon, SettingsIcon, ShieldCheckIcon } from '../components/icons.tsx';

function ProviderRow({ name, current, options, icon }: { name: string; current: string; options: string[]; icon: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-icon">{icon}</div>
      <div className="settings-info">
        <span className="settings-name">{name}</span>
        <span className="settings-current">Current: {current}</span>
        <span className="settings-options">Available: {options.join(', ')}</span>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <div className="page">
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2><SettingsIcon size={16} /> Business & Branding</h2>
          </div>
          <p className="muted">
            Business name, logo, colors, support details, and customer-facing messages are managed here.
            Branding drives the customer payment page without code changes.
          </p>
          <div className="brand-preview" style={{ '--preview': '#D1041F' } as React.CSSProperties}>
            <span className="brand-preview-name">Popoye Insurance</span>
            <span className="brand-preview-chip">Primary #D1041F</span>
            <span className="brand-preview-chip secondary">Secondary #184CB2</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2><ShieldCheckIcon size={16} /> Providers</h2>
          </div>
          <ProviderRow name="Payments" current="Cashfree" options={['Cashfree', 'Razorpay', 'Future providers']} icon={<CreditCardIcon size={18} />} />
          <ProviderRow name="WhatsApp" current="AiSensy" options={['AiSensy', 'Meta WhatsApp', 'Future providers']} icon={<MessageSquareIcon size={18} />} />
          <ProviderRow name="Storage" current="S3-compatible" options={['AWS S3', 'GCS', 'Azure Blob']} icon={<LockIcon size={18} />} />
          <p className="muted credentials-note">
            Credentials are never shown as plaintext and are managed through secret management, not business configuration.
          </p>
        </div>

        <div className="card">
          <div className="card-head">
            <h2><LockIcon size={16} /> Security</h2>
          </div>
          <p className="muted">
            All sensitive data is encrypted at rest and in transit. Admin sessions use HttpOnly cookies with role-based
            access control enforced on the backend. Webhook signatures are verified and payloads are encrypted end to end.
          </p>
        </div>
      </div>
    </div>
  );
}