import { useState } from 'react';
import { LandPlot, Lock, MapPin, Plus, RefreshCw, Search, Unlock, X } from 'lucide-react';
import { api } from '../../api/client.js';
import { Badge, Button, Card, EmptyState, Field, Modal, Notice, Spinner, StatusBadge, Table, formatDate, inputStyle } from '../ui.jsx';
import { useResource } from './useResource.js';

const emptyForm = {
  parcelNumber: '',
  county: '',
  block: '',
  location: '',
  areaHectares: '',
  latitude: '',
  longitude: '',
};

export default function ParcelsPanel({ user }) {
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const canManage = ['registrar', 'administrator'].includes(user?.role);
  const { data, loading, error, reload } = useResource(
    () => api.listParcels({ limit: 100 }),
    `${user?.id}:${version}`,
    { enabled: Boolean(user) }
  );
  const parcels = data?.data || [];

  const refresh = async () => {
    setVersion((value) => value + 1);
    await reload();
  };

  const runSearch = async (event) => {
    event.preventDefault();
    const query = search.trim().toUpperCase();
    if (!query) return;
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const { data: parcel } = await api.searchParcel(query);
      if (!parcel) setSearchError('No parcel with that exact parcel number was found.');
      else setSearchResult(parcel);
    } catch (err) {
      setSearchError(err.message || 'Unable to search the registry.');
    } finally {
      setSearching(false);
    }
  };

  const openDetail = async (id) => {
    setDetail({ id });
    setDetailLoading(true);
    setActionError(null);
    try {
      const [parcel, ownerships] = await Promise.all([api.getParcel(id), api.parcelOwnerships(id)]);
      setDetail({ ...parcel.data, ownerships: ownerships.data || [] });
    } catch (err) {
      setActionError(err.message || 'Unable to load parcel details.');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const createParcel = async (event) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await api.createParcel({
        parcelNumber: form.parcelNumber,
        county: form.county,
        block: form.block || undefined,
        location: form.location || undefined,
        areaHectares: form.areaHectares ? Number(form.areaHectares) : undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      setForm(emptyForm);
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setActionError(err.message || 'Unable to create parcel.');
    } finally {
      setBusy(false);
    }
  };

  const toggleFreeze = async (parcel) => {
    setBusy(true);
    setActionError(null);
    try {
      await api.freezeParcel(parcel.id, !['frozen', 'disputed', 'archived'].includes(parcel.status));
      await refresh();
      if (detail?.id === parcel.id) await openDetail(parcel.id);
    } catch (err) {
      setActionError(err.message || 'Unable to update parcel status.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card
        title="Parcel registry"
        subtitle={canManage ? 'Create parcels, inspect ownership, and freeze or unfreeze titles.' : 'Parcels visible to your account.'}
        actions={
          <>
            <Button variant="secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</Button>
            {canManage && <Button onClick={() => setShowCreate((value) => !value)}><Plus size={14} /> New parcel</Button>}
          </>
        }
      >
        <form onSubmit={runSearch} style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, flex: '1 1 240px' }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Exact parcel number, e.g. NAIROBI/BLOCK103/45"
            aria-label="Parcel number"
          />
          <Button type="submit" disabled={searching}><Search size={14} /> {searching ? 'Searching…' : 'Search'}</Button>
        </form>

        {searchError && <Notice tone="error" style={{ marginBottom: '0.8rem' }}>{searchError}</Notice>}
        {searchResult && (
          <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: '10px', padding: '12px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#38bdf8', fontWeight: 700 }}>{searchResult.parcelNumber}</div>
              <div style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{searchResult.county}{searchResult.location ? ` · ${searchResult.location}` : ''}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px' }}>
                Owner: {(searchResult.ownerships || [])[0]?.owner?.fullName || 'Not assigned'} · Documents: {(searchResult.documents || []).length}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <StatusBadge status={searchResult.status} />
              <Button variant="secondary" onClick={() => openDetail(searchResult.id)}>Open</Button>
            </div>
          </div>
        )}

        {showCreate && canManage && (
          <form onSubmit={createParcel} style={{ background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <Field label="Parcel number *"><input style={inputStyle} required value={form.parcelNumber} onChange={(event) => setForm({ ...form, parcelNumber: event.target.value })} /></Field>
            <Field label="County *"><input style={inputStyle} required value={form.county} onChange={(event) => setForm({ ...form, county: event.target.value })} /></Field>
            <Field label="Block"><input style={inputStyle} value={form.block} onChange={(event) => setForm({ ...form, block: event.target.value })} /></Field>
            <Field label="Location"><input style={inputStyle} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
            <Field label="Area (hectares)"><input style={inputStyle} type="number" step="0.0001" min="0" value={form.areaHectares} onChange={(event) => setForm({ ...form, areaHectares: event.target.value })} /></Field>
            <Field label="Latitude"><input style={inputStyle} type="number" step="0.0000001" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></Field>
            <Field label="Longitude"><input style={inputStyle} type="number" step="0.0000001" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></Field>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create parcel'}</Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={busy}><X size={14} /> Cancel</Button>
            </div>
          </form>
        )}

        {actionError && <Notice tone="error" style={{ marginBottom: '0.8rem' }}>{actionError}</Notice>}
        {loading ? <Spinner label="Loading parcels…" /> : error ? <Notice tone="error">{error}</Notice> : (
          <Table
            columns={['Parcel', 'County', 'Status', 'Area', 'Updated', 'Actions']}
            rows={parcels}
            empty="No parcels are visible to your account yet."
            renderRow={(parcel) => (
              <tr key={parcel.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <td style={{ padding: '11px 14px', fontWeight: 700, color: '#38bdf8' }}>{parcel.parcelNumber}</td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{parcel.county}{parcel.block ? ` · ${parcel.block}` : ''}</td>
                <td style={{ padding: '11px 14px' }}><StatusBadge status={parcel.status} /></td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{parcel.areaHectares ? `${parcel.areaHectares} ha` : '—'}</td>
                <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '0.8rem' }}>{formatDate(parcel.updatedAt)}</td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <Button variant="secondary" onClick={() => openDetail(parcel.id)}>View</Button>
                    {canManage && (
                      <Button variant={['frozen', 'disputed', 'archived'].includes(parcel.status) ? 'success' : 'danger'} onClick={() => toggleFreeze(parcel)} disabled={busy}>
                        {['frozen', 'disputed', 'archived'].includes(parcel.status) ? <><Unlock size={13} /> Unfreeze</> : <><Lock size={13} /> Freeze</>}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          />
        )}
      </Card>

      <Modal open={Boolean(detail)} title={detail?.parcelNumber || 'Parcel details'} onClose={() => setDetail(null)} maxWidth="720px">
        {detailLoading ? <Spinner label="Loading parcel details…" /> : detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <StatusBadge status={detail.status} />
              <Badge tone="neutral"><MapPin size={12} /> {detail.county}{detail.location ? ` · ${detail.location}` : ''}</Badge>
              <Badge tone="neutral"><LandPlot size={12} /> {detail.areaHectares ? `${detail.areaHectares} ha` : 'Area not recorded'}</Badge>
            </div>
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#e2e8f0' }}>Current ownership</h4>
              {(detail.ownerships || []).length === 0 ? <EmptyState>No ownership record has been created for this parcel.</EmptyState> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {detail.ownerships.map((row) => (
                    <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', background: 'rgba(2,6,23,0.5)', borderRadius: '8px', padding: '8px 10px' }}>
                      <span style={{ color: '#f8fafc' }}>{row.owner?.fullName || `User #${row.ownerId}`} <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>({row.owner?.email || '—'})</span></span>
                      <span style={{ color: row.isCurrent ? '#4ade80' : '#94a3b8', fontSize: '0.8rem' }}>{row.isCurrent ? 'Current' : `Ended ${formatDate(row.endedAt)}`} · {row.sharePercent}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#e2e8f0' }}>Documents</h4>
              {(detail.documents || []).length === 0 ? <EmptyState>No documents uploaded for this parcel.</EmptyState> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {detail.documents.map((doc) => (
                    <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', background: 'rgba(2,6,23,0.5)', borderRadius: '8px', padding: '8px 10px' }}>
                      <span style={{ color: '#f8fafc' }}>{doc.originalName} <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>v{doc.version}</span></span>
                      <span style={{ color: doc.isCurrent ? '#4ade80' : '#94a3b8', fontSize: '0.8rem' }}>{doc.isCurrent ? 'Current' : 'Superseded'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
