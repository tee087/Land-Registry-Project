import { useState } from 'react';
import { CheckCircle2, FilePlus2, RefreshCw, Search, XCircle } from 'lucide-react';
import { api } from '../../api/client.js';
import { Badge, Button, Card, Notice, Spinner, StatusBadge, Table, formatDate, inputStyle } from '../ui.jsx';
import { useResource } from './useResource.js';
import ReviewModal from './ReviewModal.jsx';

export default function RegistrationsPanel({ user }) {
  const [version, setVersion] = useState(0);
  const [parcelQuery, setParcelQuery] = useState('');
  const [parcel, setParcel] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [review, setReview] = useState(null);

  const canCreate = ['landowner', 'administrator'].includes(user?.role);
  const canReview = ['registrar', 'administrator'].includes(user?.role);

  const { data, loading, error, reload } = useResource(
    () => api.listRegistrations(),
    `${user?.id}:${version}`,
    { enabled: Boolean(user) }
  );
  const rows = data?.data || [];

  const refresh = async () => {
    setVersion((value) => value + 1);
    await reload();
  };

  const lookupParcel = async (event) => {
    event.preventDefault();
    const query = parcelQuery.trim().toUpperCase();
    if (!query) return;
    setLookupBusy(true);
    setLookupError(null);
    setParcel(null);
    try {
      const { data: found } = await api.searchParcel(query);
      if (!found) setLookupError('No parcel with that exact parcel number was found.');
      else setParcel(found);
    } catch (err) {
      setLookupError(err.message || 'Unable to look up the parcel.');
    } finally {
      setLookupBusy(false);
    }
  };

  const submitRegistration = async () => {
    if (!parcel) return;
    setSubmitBusy(true);
    setActionError(null);
    try {
      await api.createRegistration({ parcelId: parcel.id });
      setParcel(null);
      setParcelQuery('');
      await refresh();
    } catch (err) {
      setActionError(err.message || 'Unable to submit registration.');
    } finally {
      setSubmitBusy(false);
    }
  };

  const submitReview = async ({ decision, notes }) => {
    await api.reviewRegistration(review.id, { decision, notes });
    await refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {canCreate && (
        <Card title="Submit a registration request" subtitle="The parcel must already exist in the registry. The registrar reviews the request before ownership is recorded.">
          <form onSubmit={lookupParcel} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, flex: '1 1 240px' }}
              value={parcelQuery}
              onChange={(event) => setParcelQuery(event.target.value)}
              placeholder="Parcel number"
              aria-label="Parcel number"
            />
            <Button type="submit" variant="secondary" disabled={lookupBusy}><Search size={14} /> {lookupBusy ? 'Looking up…' : 'Find parcel'}</Button>
          </form>
          {lookupError && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{lookupError}</Notice>}
          {parcel && (
            <div style={{ marginTop: '0.8rem', background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#38bdf8', fontWeight: 700 }}>{parcel.parcelNumber}</div>
                <div style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{parcel.county}{parcel.location ? ` · ${parcel.location}` : ''}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '3px' }}>Current owner: {(parcel.ownerships || [])[0]?.owner?.fullName || 'Not assigned'}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <StatusBadge status={parcel.status} />
                <Button onClick={submitRegistration} disabled={submitBusy}><FilePlus2 size={14} /> {submitBusy ? 'Submitting…' : 'Submit request'}</Button>
              </div>
            </div>
          )}
          {actionError && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{actionError}</Notice>}
        </Card>
      )}

      <Card
        title="Registrations"
        subtitle={canReview ? 'Review pending registration requests. Approval records ownership in the database and queues an on-chain anchoring event.' : 'Your registration requests and their current status.'}
        actions={<Button variant="secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</Button>}
      >
        {loading ? <Spinner label="Loading registrations…" /> : error ? <Notice tone="error">{error}</Notice> : (
          <Table
            columns={['Parcel', 'Applicant', 'Status', 'Submitted', 'Reviewer', 'Actions']}
            rows={rows}
            empty="No registration requests yet."
            renderRow={(row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <td style={{ padding: '11px 14px', fontWeight: 700, color: '#38bdf8' }}>{row.parcel?.parcelNumber || `#${row.parcelId}`}</td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{row.applicant?.fullName || `User #${row.applicantId}`}<div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{row.applicant?.email}</div></td>
                <td style={{ padding: '11px 14px' }}><StatusBadge status={row.status} /></td>
                <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '0.8rem' }}>{formatDate(row.createdAt)}</td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1', fontSize: '0.82rem' }}>{row.reviewer?.fullName || '—'}</td>
                <td style={{ padding: '11px 14px' }}>
                  {canReview && ['submitted', 'under_review'].includes(row.status) ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button variant="success" onClick={() => setReview({ id: row.id, decision: 'approve', title: `Approve registration for ${row.parcel?.parcelNumber || `#${row.parcelId}`}` })}><CheckCircle2 size={13} /> Approve</Button>
                      <Button variant="danger" onClick={() => setReview({ id: row.id, decision: 'reject', title: `Reject registration for ${row.parcel?.parcelNumber || `#${row.parcelId}`}` })}><XCircle size={13} /> Reject</Button>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{row.decisionNotes || '—'}</span>
                  )}
                </td>
              </tr>
            )}
          />
        )}
        {!canReview && rows.some((row) => row.decisionNotes) && (
          <div style={{ marginTop: '0.8rem' }}>
            <Badge tone="info">Reviewer notes are shown in the table when present.</Badge>
          </div>
        )}
      </Card>

      <ReviewModal
        open={Boolean(review)}
        title={review?.title || 'Review registration'}
        decision={review?.decision}
        onClose={() => setReview(null)}
        onSubmit={submitReview}
      />
    </div>
  );
}
