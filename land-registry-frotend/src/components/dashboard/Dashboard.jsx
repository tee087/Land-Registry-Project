import { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Bell,
  ClipboardList,
  FileCheck2,
  FileText,
  LandPlot,
  LayoutDashboard,
  Link2,
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

export default function Dashboard({ user, refreshUser, walletAccount, onConnectWallet, onUnreadChange }) {
  const [active, setActive] = useState('overview');
  const role = user?.role;

  const sections = useMemo(() => {
    const base = [
      { id: 'overview', label: 'Overview' },
      { id: 'parcels', label: role === 'landowner' ? 'My parcels' : 'Parcels' },
      { id: 'registrations', label: 'Registrations' },
      { id: 'transfers', label: 'Transfers' },
      { id: 'documents', label: 'Documents' },
    ];
    if (['investigator', 'administrator'].includes(role)) base.push({ id: 'evidence', label: 'Evidence' });
    if (['auditor', 'administrator'].includes(role)) base.push({ id: 'audit', label: 'Audit trail' });
    if (role === 'administrator') base.push({ id: 'users', label: 'Users' });
    if (['registrar', 'administrator', 'auditor'].includes(role)) base.push({ id: 'blockchain', label: 'Blockchain' });
    base.push({ id: 'notifications', label: 'Notifications' });
    base.push({ id: 'profile', label: 'Profile' });
    return base;
  }, [role]);

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
      case 'profile': return <ProfilePanel user={user} refreshUser={refreshUser} walletAccount={walletAccount} onConnectWallet={onConnectWallet} />;
      default: return <OverviewPanel user={user} onNavigate={setActive} onUnreadChange={onUnreadChange} />;
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
      <Card style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: '#fff', fontSize: '1.7rem' }}>Registry dashboard</h1>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>Signed in as {user?.email}</p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <Badge tone="info">{user?.role}</Badge>
            {user?.walletAddress ? <Badge tone="success">wallet linked</Badge> : <Badge tone="warning">wallet not linked</Badge>}
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px, 230px) 1fr', gap: '1rem', alignItems: 'start' }} className="lrc-dashboard-grid">
        <nav aria-label="Dashboard sections" style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(56,189,248,0.28)', borderRadius: '14px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'sticky', top: '86px' }}>
          {sections.map((section) => {
            const Icon = ICONS[section.id] || LayoutDashboard;
            const isActive = current === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActive(section.id)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 11px',
                  borderRadius: '9px',
                  border: isActive ? '1px solid rgba(56,189,248,0.55)' : '1px solid transparent',
                  background: isActive ? 'rgba(56,189,248,0.16)' : 'transparent',
                  color: isActive ? '#7dd3fc' : '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                <Icon size={16} /> {section.label}
              </button>
            );
          })}
        </nav>

        <div style={{ minWidth: 0 }}>{renderPanel()}</div>
      </div>
    </div>
  );
}
