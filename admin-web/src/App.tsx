import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Login from './pages/Login.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Payments from './pages/Payments.tsx';
import Customers from './pages/Customers.tsx';
import Policies from './pages/Policies.tsx';
import Campaigns from './pages/Campaigns.tsx';
import Reports from './pages/Reports.tsx';
import Settings from './pages/Settings.tsx';
import Sidebar from './components/Sidebar.tsx';
import Topbar from './components/Topbar.tsx';
import { fetchMe, logout } from './services/api.ts';

const titles: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Overview of renewals and collections' },
  '/customers': { title: 'Customers', subtitle: 'Manage customer records' },
  '/policies': { title: 'Policies', subtitle: 'Policy details and status' },
  '/payments': { title: 'Payments', subtitle: 'Payment transactions' },
  '/campaigns': { title: 'Campaigns', subtitle: 'WhatsApp campaigns and delivery' },
  '/reports': { title: 'Reports', subtitle: 'Exports and reconciliation' },
  '/settings': { title: 'Settings', subtitle: 'Business, branding and providers' },
};

function Shell({ me, onLogout }: { me: { email: string; role: string }; onLogout: () => void }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const meta = titles[location.pathname] ?? { title: 'Popoye Admin' };

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    onLogout();
  };

  return (
    <div className="admin-shell">
      <div className={`sidebar-overlay${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <Sidebar onNavigate={() => setDrawerOpen(false)} />
      <div className={`admin-main${drawerOpen ? ' drawer-open' : ''}`}>
        <Topbar title={meta.title} subtitle={meta.subtitle} me={me} onLogout={handleLogout} onMenu={() => setDrawerOpen(true)} />
        <main className="admin-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState<{ email: string; role: string } | null | undefined>(undefined);

  useEffect(() => {
    fetchMe().then(setMe).catch(() => setMe(null));
  }, []);

  if (me === undefined) {
    return <div className="boot">Loading…</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={me ? <Navigate to="/" replace /> : <Login onLogin={setMe} />} />
        <Route
          path="/*"
          element={me ? <Shell me={me} onLogout={() => setMe(null)} /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}