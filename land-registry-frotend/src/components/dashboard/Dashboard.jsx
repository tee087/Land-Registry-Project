import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Bell,
  ClipboardList,
  FileCheck2,
  FileText,
  LandPlot,
  LayoutDashboard,
  Link2,
  Menu,
  X,
  ScrollText,
  UserCircle,
  Users,
} from 'lucide-react';
import OverviewPanel from './OverviewPanel.jsx';
import ParcelsPanel from './ParcelsPanel.jsx';
import RegistrationsPanel from './RegistrationsPanel.jsx';
import TransfersPanel from './TransfersPanel.jsx';
import DocumentsPanel from './DocumentsPanel.jsx';
import EvidencePanel from './EvidencePanel.jsx';
import AuditPanel from './AuditPanel.jsx';
import UsersPanel from './UsersPanel.jsx';
import BlockchainPanel from './BlockchainPanel.jsx';
import ProfilePanel from './ProfilePanel.jsx';
import NotificationsPanel from '../NotificationsPanel.jsx';
import { Badge, Card } from '../ui.jsx';

const ICONS = {
  overview: LayoutDashboard,
  parcels: LandPlot,
  registrations: FileCheck2,
  transfers: ArrowRightLeft,
  documents: FileText,
  evidence: ClipboardList,
  audit: ScrollText,
  users: Users,
  blockchain: Link2,
  notifications: Bell,
  profile: UserCircle,
};

export default function Dashboard({ user, refreshUser, walletAccount, onConnectWallet, onUnreadChange, onFindLand, onLogout }) {
  const [active, setActive] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('lrc.dashboardTheme') || 'dark');
  const [density, setDensity] = useState(() => localStorage.getItem('lrc.dashboardDensity') || 'comfortable');
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const role = user?.role;

  useEffect(() => {
    localStorage.setItem('lrc.dashboardTheme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lrc.dashboardDensity', density);
  }, [density]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const returnFocusTo = menuButtonRef.current;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    drawerRef.current?.querySelector('button')?.focus();
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      returnFocusTo?.focus();
    };
  }, [menuOpen]);

  const sections = useMemo(() => {
    const isBuyer = user?.accountType === 'buyer';
    const base = [
      { id: 'overview', label: 'Overview' },
      { id: 'parcels', label: isBuyer ? 'Land records' : role === 'landowner' ? 'My properties' : 'Parcels' },
      { id: 'transfers', label: isBuyer ? 'Purchase requests' : 'Sales & transfers' },
    ];
    if (!isBuyer || role !== 'landowner') base.push({ id: 'registrations', label: 'Registrations' }, { id: 'documents', label: 'Documents' });
    if (['investigator', 'administrator'].includes(role)) base.push({ id: 'evidence', label: 'Evidence' });
    if (['auditor', 'administrator'].includes(role)) base.push({ id: 'audit', label: 'Audit trail' });
    if (role === 'administrator') base.push({ id: 'users', label: 'Users' });
    if (['registrar', 'administrator', 'auditor'].includes(role)) base.push({ id: 'blockchain', label: 'Blockchain' });
    base.push({ id: 'notifications', label: 'Notifications' });
    base.push({ id: 'profile', label: 'Profile' });
    return base;
  }, [role, user?.accountType]);

  const current = sections.some((section) => section.id === active) ? active : 'overview';

  const renderPanel = () => {
    switch (current) {
      case 'parcels': return <ParcelsPanel user={user} />;
      case 'registrations': return <RegistrationsPanel user={user} />;
      case 'transfers': return <TransfersPanel user={user} />;
      case 'documents': return <DocumentsPanel user={user} />;
      case 'evidence': return <EvidencePanel user={user} />;
      case 'audit': return <AuditPanel user={user} />;
      case 'users': return <UsersPanel user={user} />;
      case 'blockchain': return <BlockchainPanel user={user} />;
      case 'notifications': return <NotificationsPanel onUnreadChange={onUnreadChange} />;
      case 'profile': return <ProfilePanel user={user} refreshUser={refreshUser} walletAccount={walletAccount} onConnectWallet={onConnectWallet} theme={theme} setTheme={setTheme} density={density} setDensity={setDensity} onLogout={onLogout} />;
      default: return <OverviewPanel user={user} onNavigate={setActive} onFindLand={onFindLand} onUnreadChange={onUnreadChange} />;
    }
  };

  return (
    <div className="lrc-dashboard-shell" data-theme={theme} data-density={density} style={{ maxWidth: '1240px', margin: '1.35rem auto 3rem', padding: '0 1.25rem' }}>
      <Card className="lrc-dashboard-topcard" style={{ marginBottom: '1.1rem' }}>
        <div className="lrc-workspace-heading">
          <div>
            <span className="lrc-workspace-eyebrow">LANDREGISTRYCHAIN · SECURE WORKSPACE</span>
            <h1 className="lrc-workspace-title">{user?.role === 'landowner' ? (user?.accountType === 'buyer' ? 'Buyer workspace' : user?.accountType === 'seller' ? 'Seller workspace' : 'Property workspace') : user?.role === 'registrar' ? 'Registry review workspace' : user?.role === 'administrator' ? 'Administration workspace' : user?.role === 'auditor' ? 'Audit and assurance workspace' : user?.role === 'investigator' ? 'Forensic workspace' : 'Registry workspace'}</h1>
            <p className="lrc-workspace-subtitle">Welcome back, {user?.fullName || user?.email}. Your records and tasks are organized here.</p>
          </div>
          <div className="lrc-workspace-actions">
            <div className="lrc-workspace-user-badges"><Badge tone="info">{user?.role}</Badge>{user?.accountType && <Badge tone="neutral">{user.accountType.replace('_', ' and ')}</Badge>}</div>
            <button ref={menuButtonRef} type="button" className="lrc-workspace-menu-button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen} aria-label="Open workspace menu">
              <Menu size={18} /> Menu
            </button>
          </div>
        </div>
      </Card>

      {menuOpen && <button type="button" className="lrc-dashboard-backdrop" aria-label="Close workspace menu" onClick={() => setMenuOpen(false)} />}
      <aside ref={drawerRef} className={`lrc-dashboard-drawer${menuOpen ? ' is-open' : ''}`} role="dialog" aria-modal={menuOpen ? 'true' : undefined} aria-label="Workspace navigation" aria-hidden={!menuOpen} inert={!menuOpen}>
        <div className="lrc-dashboard-drawer-heading">
          <div><strong>Workspace</strong><span>{user?.fullName || user?.email}</span></div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close workspace menu"><X size={20} /></button>
        </div>
        <nav aria-label="Dashboard sections" className="lrc-dashboard-nav">
          {sections.map((section) => {
            const Icon = ICONS[section.id] || LayoutDashboard;
            const isActive = current === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => { setActive(section.id); setMenuOpen(false); }}
                aria-current={isActive ? 'page' : undefined}
                className={`lrc-dashboard-nav-item${isActive ? ' is-active' : ''}`}
              >
                <Icon size={16} /> {section.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div style={{ minWidth: 0 }}>{renderPanel()}</div>
    </div>
  );
}
