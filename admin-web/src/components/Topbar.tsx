import { BellIcon, ChevronDownIcon, LogOutIcon, MenuIcon } from './icons.tsx';

export default function Topbar({
  title,
  subtitle,
  me,
  onLogout,
  onMenu,
}: {
  title: string;
  subtitle?: string;
  me: { email: string; role: string };
  onLogout: () => void;
  onMenu: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button menu-button" onClick={onMenu} aria-label="Open menu">
          <MenuIcon size={20} />
        </button>
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      <div className="topbar-right">
        <button className="icon-button" aria-label="Notifications">
          <BellIcon size={19} />
        </button>
        <div className="user-chip">
          <div className="avatar">{me.email.charAt(0).toUpperCase()}</div>
          <div className="user-meta">
            <span className="user-name">{me.email}</span>
            <span className="user-role">{me.role}</span>
          </div>
          <ChevronDownIcon size={16} />
        </div>
        <button className="icon-button" onClick={onLogout} aria-label="Logout">
          <LogOutIcon size={19} />
        </button>
      </div>
    </header>
  );
}