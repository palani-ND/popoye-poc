import { NavLink } from 'react-router-dom';
import {
  BarChartIcon,
  CreditCardIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  SettingsIcon,
  UsersIcon,
} from './icons.tsx';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/customers', label: 'Customers', icon: UsersIcon },
  { to: '/policies', label: 'Policies', icon: FileTextIcon },
  { to: '/payments', label: 'Payments', icon: CreditCardIcon },
  { to: '/campaigns', label: 'Campaigns', icon: MessageSquareIcon },
  { to: '/reports', label: 'Reports', icon: BarChartIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">Popoye</div>
        <div className="sidebar-logo-sub">Insurance</div>
      </div>
      <nav className="sidebar-nav" aria-label="Main">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            onClick={onNavigate}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">Popoye Payments · POC</div>
    </aside>
  );
}