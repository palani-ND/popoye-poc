import { MessageSquareIcon } from '../components/icons.tsx';

export default function Campaigns() {
  return (
    <div className="page">
      <div className="card empty-card">
        <MessageSquareIcon size={40} className="empty-icon" />
        <h2>WhatsApp Campaigns</h2>
        <p>
          Campaigns let you send renewal payment requests and confirmations through the configured WhatsApp
          provider. In this POC, messages are recorded per order and their status is shown on the Payments screen.
        </p>
        <p className="muted">Provider: AiSensy (replaceable via the WhatsApp provider abstraction).</p>
      </div>
    </div>
  );
}