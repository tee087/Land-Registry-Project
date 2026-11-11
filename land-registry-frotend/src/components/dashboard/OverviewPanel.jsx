import { useCallback } from 'react';
import { ArrowRight, Bell, FileCheck2, LandPlot, RefreshCw, ShieldCheck, Scale } from 'lucide-react';
import { api } from '../../api/client.js';
import { Badge, Button, Card, EmptyState, Notice, Spinner, StatusBadge, formatDate } from '../ui.jsx';
import { useResource } from './useResource.js';

const ROLE_COPY = {
  landowner: 'Manage your parcels, submit registration requests, and transfer ownership.',
  registrar: 'Review registration and transfer requests, manage parcels, and verify titles on chain.',
  administrator: 'Full system administration: users, parcels, reviews, audit, and blockchain operations.',
  investigator: 'Read land records, manage evidence custody, and review investigation indicators.',
  auditor: 'Read registry records, review audit trails, and inspect registration and transfer history.',
};

function StatCard({ icon: Icon, label, value, tone = '#38bdf8' }) {
  return (
    <div style={{ background: 'rgba(2, 6, 23, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        <Icon size={16} color={tone} /> {label}
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff', marginTop: '6px' }}>{value}</div>
    </div>
  );
}

export default function OverviewPanel({ user, onNavigate, onUnreadChange }) {
  const load = useCallback(async () => {
    const [parcels, registrations, transfers, notifications] = await Promise.all([
      api.listParcels({ limit: 100 }),
      api.listRegistrations(),
      api.listTransfers(),
      api.notifications({ unread: 'true' }),
    ]);
    const unread = (notifications.data || []).length;
    onUnreadChange?.(unread);
    return {
      parcels: parcels.data || [],
      registrations: registrations.data || [],
      transfers: transfers.data || [],
      unread,
    };
  }, [onUnreadChange]);

  const { data, loading, error, reload } = useResource(load, user?.id, { enabled: Boolean(user) });

  if (loading) return <Card title="Overview"><Spinner label="Loading your registry summary…" /></Card>;
  if (error) return <Card title="Overview"><Notice tone="error">{error}</Notice><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={reload}><RefreshCw size={14} /> Retry</Button></div></Card>;

  const parcels = data?.parcels || [];
  const registrations = data?.registrations || [];
  const transfers = data?.transfers || [];
  const pendingRegistrations = registrations.filter((row) => ['submitted', 'under_review'].includes(row.status));
  const pendingTransfers = transfers.filter((row) => row.status === 'pending');
  const frozen = parcels.filter((row) => ['frozen', 'disputed', 'archived'].includes(row.status));
  const owned = parcels.filter((row) => row.status === 'active');
  const isStaff = ['registrar', 'administrator', 'auditor', 'investigator'].includes(user?.role);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }}>Welcome, {user?.fullName || user?.email}</h2>
            <p style={{ margin: '6px 0 0 0', color: '#94a3b8', maxWidth: '650px', lineHeight: 1.55 }}>
              {ROLE_COPY[user?.role] || 'Land registry dashboard.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Badge tone="info">{user?.role}</Badge>
            <StatusBadge status={user?.status} />
            {user?.walletAddress ? <Badge tone="success">wallet linked</Badge> : <Badge tone="warning">no wallet</Badge>}
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem' }}>
        <StatCard icon={LandPlot} label={isStaff ? 'Parcels in scope' : 'Your parcels'} value={parcels.length} />
        <StatCard icon={ShieldCheck} label="Active titles" value={owned.length} tone="#4ade80" />
        <StatCard icon={Scale} label="Frozen / disputed" value={frozen.length} tone="#f87171" />
        <StatCard icon={FileCheck2} label="Pending registrations" value={pendingRegistrations.length} tone="#fbbf24" />
        <StatCard icon={ArrowRight} label="Pending transfers" value={pendingTransfers.length} tone="#a78bfa" />
        <StatCard icon={Bell} label="Unread notifications" value={data?.unread || 0} tone="#38bdf8" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <Card title="Recent registrations" subtitle="Latest requests visible to your role" actions={<Button variant="secondary" onClick={() => onNavigate('registrations')}>Open <ArrowRight size={14} /></Button>}>
          {registrations.length === 0 ? <EmptyState>No registrations yet.</EmptyState> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {registrations.slice(0, 4).map((row) => (
                <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px', padding: '9px 11px' }}>
                  <div>
                    <div style={{ color: '#f8fafc', fontWeight: 600 }}>{row.parcel?.parcelNumber || `Parcel #${row.parcelId}`}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{row.applicant?.fullName || 'Applicant'} · {formatDate(row.createdAt)}</div>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent transfers" subtitle="Ownership transfer requests" actions={<Button variant="secondary" onClick={() => onNavigate('transfers')}>Open <ArrowRight size={14} /></Button>}>
          {transfers.length === 0 ? <EmptyState>No transfers yet.</EmptyState> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {transfers.slice(0, 4).map((row) => (
                <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px', padding: '9px 11px' }}>
                  <div>
                    <div style={{ color: '#f8fafc', fontWeight: 600 }}>{row.parcel?.parcelNumber || `Parcel #${row.parcelId}`}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{row.fromOwner?.fullName || 'Sender'} → {row.toOwner?.fullName || 'Recipient'}</div>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Notice tone="info">
        Blockchain status is separate from database approval. A registration or transfer is only anchored on chain after the outbox worker submits it and a receipt is confirmed. Database success alone is not blockchain confirmation.
      </Notice>
    </div>
  );
}
