import { useState } from 'react';
import { ArrowRightLeft, CheckCircle2, RefreshCw, Search, Send, XCircle, ClipboardCheck } from 'lucide-react';
import { api } from '../../api/client.js';
import { Button, Card, Field, Notice, Spinner, StatusBadge, Table, formatDate, inputStyle } from '../ui.jsx';
import { useResource } from './useResource.js';
import ReviewModal from './ReviewModal.jsx';

export default function TransfersPanel({ user }) {
  const [version, setVersion] = useState(0);
  const [parcelId, setParcelId] = useState('');
  const [email, setEmail] = useState('');
  const [recipient, setRecipient] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [review, setReview] = useState(null);

  const canCreate = ['landowner', 'administrator'].includes(user?.role);
  const canReview = ['registrar', 'administrator'].includes(user?.role);

  const transfersResource = useResource(
    () => api.listTransfers(),
    `${user?.id}:${version}`,
    { enabled: Boolean(user) }
  );
  const parcelsResource = useResource(
    () => api.listParcels({ limit: 100 }),
    `${user?.id}:parcels`,
    { enabled: Boolean(user) }
  );

  const transfers = transfersResource.data?.data || [];
  const parcels = parcelsResource.data?.data || [];
  const selectedParcel = parcels.find((row) => String(row.id) === String(parcelId));

  const refresh = async () => {
    setVersion((value) => value + 1);
    await transfersResource.reload();
  };

  const lookup = async (event) => {
    event.preventDefault();
    const query = email.trim().toLowerCase();
    if (!query) return;
    setLookupBusy(true);
    setError(null);
    setRecipient(null);
    try {
      const { data } = await api.lookupUser(query);
      setRecipient(data);
    } catch (err) {
      setError(err.message || 'Recipient not found.');
    } finally {
      setLookupBusy(false);
    }
  };

  const createTransfer = async (event) => {
    event.preventDefault();
    if (!selectedParcel || !recipient) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.createTransfer({ parcelId: selectedParcel.id, toOwnerId: recipient.id });
      setNotice(`Transfer request sent to ${recipient.fullName}. A registrar must review it.`);
      setParcelId('');
      setEmail('');
      setRecipient(null);
      await refresh();
    } catch (err) {
      setError(err.message || 'Unable to create transfer.');
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async ({ decision, notes }) => {
    await api.reviewTransfer(review.id, { decision, notes });
    await refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card title="Kenya land sale preparation" subtitle="A practical checklist for buyer, seller, and the professionals involved. Exact requirements depend on the title, tenure, county, and transaction.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem', color: '#cbd5e1', fontSize: '0.88rem' }}>
          {[
            ['Buyer and seller', 'Agree written sale terms, confirm identities, and use advocates for conveyancing and execution.'],
            ['Conveyancing team', 'The parties’ advocates handle the sale agreement, transfer instrument, execution, and lodgement. A registered valuer prepares the valuation; a licensed surveyor may be needed for boundary or survey issues.'],
            ['Official land search', 'Buyer should obtain an official search to confirm the registered proprietor and recorded interests, charges, or cautions.'],
            ['Land Control Board', 'For a controlled transaction involving agricultural land, obtain the required LCB consent. It is not a blanket requirement for every sale.'],
            ['Transfer documents', 'Prepare the executed transfer and collect applicable consents, valuation, rent/rates clearances, stamp duty proof, original title, IDs and KRA PIN documents.'],
            ['Registration', 'Submit the complete transfer through the relevant land registry and verify the updated register after registration.'],
          ].map(([title, description]) => <div key={title} style={{ display: 'flex', gap: '9px', padding: '12px', background: 'rgba(2,6,23,.45)', borderRadius: '9px' }}><ClipboardCheck size={17} color="#38bdf8" style={{ flexShrink: 0 }} /><div><strong style={{ color: '#f8fafc' }}>{title}</strong><div style={{ marginTop: '4px' }}>{description}</div></div></div>)}
        </div>
        <p style={{ margin: '12px 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>This platform is not Ardhisasa or a government registry and does not grant consent or replace legal advice. Confirm current requirements with the relevant land registry or a Kenyan conveyancing advocate.</p>
      </Card>
      {canCreate && (
        <Card title="Initiate a transfer" subtitle="Only the current owner can initiate a transfer. The recipient must have an active account. A registrar must approve before ownership changes.">
          <form onSubmit={createTransfer} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
            <Field label="Parcel *" hint={parcels.length === 0 ? 'No parcels are visible to your account.' : undefined}>
              <select style={inputStyle} required value={parcelId} onChange={(event) => setParcelId(event.target.value)}>
                <option value="">Select a parcel</option>
                {parcels.map((parcel) => (
                  <option key={parcel.id} value={parcel.id}>{parcel.parcelNumber} ({parcel.status})</option>
                ))}
              </select>
            </Field>
            <Field label="Recipient email *">
              <div style={{ display: 'flex', gap: '6px' }}>
                <input style={inputStyle} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="recipient@example.test" />
                <Button type="button" variant="secondary" onClick={lookup} disabled={lookupBusy}><Search size={14} /></Button>
              </div>
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button type="submit" disabled={busy || !selectedParcel || !recipient}><Send size={14} /> {busy ? 'Sending…' : 'Request transfer'}</Button>
            </div>
          </form>
          {recipient && (
            <Notice tone="success" style={{ marginTop: '0.8rem' }}>
              Recipient: <strong>{recipient.fullName}</strong> ({recipient.email})
            </Notice>
          )}
          {selectedParcel && ['frozen', 'disputed', 'archived'].includes(selectedParcel.status) && (
            <Notice tone="warning" style={{ marginTop: '0.8rem' }}>This parcel is {selectedParcel.status}; the server will reject a transfer request until it is active.</Notice>
          )}
          {error && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{error}</Notice>}
          {notice && <Notice tone="success" style={{ marginTop: '0.8rem' }}>{notice}</Notice>}
        </Card>
      )}

      <Card
        title="Ownership transfers"
        subtitle={canReview ? 'Review pending transfer requests. Approval updates ownership in the database and queues an on-chain anchoring event.' : 'Transfers you initiated or received.'}
        actions={<Button variant="secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</Button>}
      >
        {transfersResource.loading ? <Spinner label="Loading transfers…" /> : transfersResource.error ? <Notice tone="error">{transfersResource.error}</Notice> : (
          <Table
            columns={['Parcel', 'From', 'To', 'Status', 'Created', 'Actions']}
            rows={transfers}
            empty="No transfer requests yet."
            renderRow={(row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <td style={{ padding: '11px 14px', fontWeight: 700, color: '#38bdf8' }}>{row.parcel?.parcelNumber || `#${row.parcelId}`}</td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{row.fromOwner?.fullName || `User #${row.fromOwnerId}`}</td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{row.toOwner?.fullName || `User #${row.toOwnerId}`}<div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{row.toOwner?.email}</div></td>
                <td style={{ padding: '11px 14px' }}><StatusBadge status={row.status} /></td>
                <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '0.8rem' }}>{formatDate(row.createdAt)}</td>
                <td style={{ padding: '11px 14px' }}>
                  {canReview && row.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button variant="success" onClick={() => setReview({ id: row.id, decision: 'approve', title: `Approve transfer of ${row.parcel?.parcelNumber || `#${row.parcelId}`}` })}><CheckCircle2 size={13} /> Approve</Button>
                      <Button variant="danger" onClick={() => setReview({ id: row.id, decision: 'reject', title: `Reject transfer of ${row.parcel?.parcelNumber || `#${row.parcelId}`}` })}><XCircle size={13} /> Reject</Button>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{row.notes || '—'}</span>
                  )}
                </td>
              </tr>
            )}
          />
        )}
        {transfers.length === 0 && !transfersResource.loading && (
          <div style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>
            <ArrowRightLeft size={15} /> Transfers appear here after an owner initiates one.
          </div>
        )}
      </Card>

      <ReviewModal
        open={Boolean(review)}
        title={review?.title || 'Review transfer'}
        decision={review?.decision}
        onClose={() => setReview(null)}
        onSubmit={submitReview}
      />
    </div>
  );
}
