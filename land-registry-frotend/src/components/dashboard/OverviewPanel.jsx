import { useCallback } from 'react';
import { ArrowRight, Bell, FileCheck2, LandPlot, RefreshCw, ShieldCheck, Scale } from 'lucide-react';
import { api } from '../../api/client.js';
import { Button, Card, EmptyState, Notice, Spinner, StatusBadge, formatDate } from '../ui.jsx';
import { useResource } from './useResource.js';

const ROLE_COPY = {
  landowner: 'Manage your parcels, submit registration requests, and transfer ownership.',
  registrar: 'Review registration and transfer requests, manage parcels, and verify titles on chain.',
  administrator: 'Full system administration: users, parcels, reviews, audit, and blockchain operations.',
  investigator: 'Read land records, manage evidence custody, and review investigation indicators.',
  auditor: 'Read registry records, review audit trails, and inspect registration and transfer history.',
};

const ACCOUNT_COPY = {
  buyer: 'Your buyer workspace brings registry searches and incoming purchase or transfer requests together. A registry search is a due diligence aid, not an official certificate.',
  seller: 'Manage your land records, prepare required sale documents, and track transfer requests. Ownership changes only after the authorized registry review.',
  buyer_seller: 'Manage your land records and review incoming or outgoing transfer requests from one workspace.',
};

function StatCard({ icon: Icon, label, value, tone = '#38bdf8' }) {
  return (
    <div className="lrc-dashboard-stat">
      <div className="lrc-dashboard-stat-label">
        <span className="lrc-dashboard-stat-icon" style={{ color: tone, background: `${tone}1c` }}><Icon size={17} /></span><span>{label}</span>
      </div>
      <div className="lrc-dashboard-stat-value">{value}</div>
    </div>
  );
}

export default function OverviewPanel({ user, onNavigate, onFindLand, onUnreadChange }) {
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
  const isBuyer = user?.role === 'landowner' && ['buyer', 'buyer_seller'].includes(user?.accountType);
  const isSeller = user?.role === 'landowner' && ['seller', 'buyer_seller'].includes(user?.accountType);
  const relevantPendingTransfers = pendingTransfers.filter((row) => (isBuyer && String(row.toOwnerId) === String(user?.id)) || (isSeller && String(row.fromOwnerId) === String(user?.id)) || isStaff);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const workspaceLabel = isBuyer && isSeller ? 'BUYER + SELLER SERVICES' : isBuyer ? 'BUYER SERVICES' : isSeller ? 'SELLER SERVICES' : isStaff ? 'REGISTRY OPERATIONS' : 'PROPERTY WORKSPACE';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <section className="lrc-overview-hero">
        <div className="lrc-overview-hero-copy">
          <span className="lrc-overview-eyebrow">{workspaceLabel}</span>
          <h2>{greeting}, {user?.fullName?.split(' ')[0] || 'there'}</h2>
          <p>{user?.role === 'landowner' ? (ACCOUNT_COPY[user?.accountType] || ACCOUNT_COPY.buyer_seller) : ROLE_COPY[user?.role] || 'Your role-based registry workspace.'}</p>
          <div className="lrc-overview-hero-actions">
            {isBuyer && isSeller ? <>
              <Button onClick={onFindLand}><LandPlot size={15} /> Search land records</Button>
              <Button variant="secondary" onClick={() => onNavigate('registrations')}><FileCheck2 size={15} /> Manage properties</Button>
              <Button variant="ghost" onClick={() => onNavigate('transfers')}><ArrowRight size={15} /> Purchase and sale requests</Button>
            </> : isBuyer ? <>
              <Button onClick={onFindLand}><LandPlot size={15} /> Search land records</Button>
              <Button variant="secondary" onClick={() => onNavigate('transfers')}><ArrowRight size={15} /> Purchase requests</Button>
            </> : isSeller ? <>
              <Button onClick={() => onNavigate('registrations')}><FileCheck2 size={15} /> Start a registration</Button>
              <Button variant="secondary" onClick={() => onNavigate('parcels')}><LandPlot size={15} /> My properties</Button>
              <Button variant="ghost" onClick={() => onNavigate('transfers')}><ArrowRight size={15} /> Sales and transfers</Button>
            </> : user?.role === 'landowner' ? <>
              <Button onClick={() => onNavigate('parcels')}><LandPlot size={15} /> My properties</Button>
              <Button variant="secondary" onClick={() => onNavigate('transfers')}><ArrowRight size={15} /> Transfer activity</Button>
            </> : <>
              <Button onClick={() => onNavigate('registrations')}><FileCheck2 size={15} /> Review registrations</Button>
              <Button variant="secondary" onClick={() => onNavigate('transfers')}><ArrowRight size={15} /> Review transfers</Button>
            </>}
          </div>
          {isBuyer && <small>Registry records support due diligence. Confirm ownership and documents through the official process before making payment.</small>}
        </div>
        <div className="lrc-overview-hero-visual" aria-hidden="true"><div className="lrc-overview-orbit orbit-one" /><div className="lrc-overview-orbit orbit-two" /><div className="lrc-overview-hero-mark"><LandPlot size={34} /><span>KENYA<br />LAND RECORDS</span></div></div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem' }}>
        <StatCard icon={LandPlot} label={isStaff ? 'Parcels in scope' : 'Your parcels'} value={parcels.length} />
        <StatCard icon={ShieldCheck} label="Active titles" value={owned.length} tone="#4ade80" />
        <StatCard icon={Scale} label="Frozen / disputed" value={frozen.length} tone="#f87171" />
        {!isBuyer && <StatCard icon={FileCheck2} label={isStaff ? 'Awaiting review' : 'Pending registrations'} value={pendingRegistrations.length} tone="#fbbf24" />}
        <StatCard icon={ArrowRight} label={isBuyer ? 'Incoming purchase requests' : 'Pending transfers'} value={isBuyer ? relevantPendingTransfers.length : pendingTransfers.length} tone="#a78bfa" />
        <StatCard icon={Bell} label="Unread notifications" value={data?.unread || 0} tone="#38bdf8" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {isBuyer ? (
          <Card title="Buyer due diligence" subtitle="Steps to take before you commit to a purchase">
            <ol style={{ color: '#cbd5e1', lineHeight: 1.8, paddingLeft: '1.2rem', margin: 0 }}>
              <li>Run a registry search and confirm the parcel reference and location.</li>
              <li>Request an official search and verify the seller’s identity and authority.</li>
              <li>Have a conveyancing advocate review the title and sale documents.</li>
              <li>Do not pay based only on this preview or a blockchain reference.</li>
            </ol>
          </Card>
        ) : <Card title="Recent registrations" subtitle="Latest requests visible to your role" actions={<Button variant="secondary" onClick={() => onNavigate('registrations')}>Open <ArrowRight size={14} /></Button>}>
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
        </Card>}

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
