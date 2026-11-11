import { useState } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { api } from '../../api/client.js';
import { Button, Card, Field, Notice, Spinner, Table, formatDate, inputStyle } from '../ui.jsx';
import { useResource } from './useResource.js';

export default function AuditPanel({ user }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ entityType: '', action: '', fromDate: '', toDate: '' });
  const [applied, setApplied] = useState({ entityType: '', action: '', fromDate: '', toDate: '' });

  const { data, loading, error, reload } = useResource(
    () => api.listAuditLogs({ ...applied, page, limit: 20 }),
    `${user?.id}:${page}:${applied.entityType}:${applied.action}:${applied.fromDate}:${applied.toDate}`,
    { enabled: Boolean(user) }
  );
  const rows = data?.data || [];
  const meta = data?.meta;

  const apply = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  };

  return (
    <Card
      title="Audit trail"
      subtitle="Append-only record of security-relevant actions. Metadata is shown exactly as recorded."
      actions={<Button variant="secondary" onClick={reload}><RefreshCw size={14} /> Refresh</Button>}
    >
      <form onSubmit={apply} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem', marginBottom: '1rem' }}>
        <Field label="Entity type">
          <input style={inputStyle} value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })} placeholder="e.g. land_parcel" />
        </Field>
        <Field label="Action">
          <input style={inputStyle} value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} placeholder="e.g. transfer.approve" />
        </Field>
        <Field label="From date">
          <input style={inputStyle} type="date" value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} />
        </Field>
        <Field label="To date">
          <input style={inputStyle} type="date" value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} />
        </Field>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button type="submit"><Filter size={14} /> Apply filters</Button>
        </div>
      </form>

      {loading ? <Spinner label="Loading audit logs…" /> : error ? <Notice tone="error">{error}</Notice> : (
        <>
          <Table
            columns={['Time', 'Actor', 'Action', 'Entity', 'Metadata']}
            rows={rows}
            empty="No audit events match these filters."
            renderRow={(row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{formatDate(row.createdAt)}</td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1', fontSize: '0.82rem' }}>{row.actor?.fullName || 'System'}<div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{row.actor?.role || '—'}</div></td>
                <td style={{ padding: '11px 14px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.action}</td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1', fontSize: '0.82rem' }}>{row.entityType}{row.entityId ? ` #${row.entityId}` : ''}</td>
                <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '0.75rem', maxWidth: '300px', wordBreak: 'break-word' }}>
                  {row.metadata ? JSON.stringify(row.metadata) : '—'}
                </td>
              </tr>
            )}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{meta ? `${meta.total} event(s) · page ${meta.page} of ${Math.max(1, meta.totalPages)}` : ''}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
              <Button variant="ghost" disabled={!meta || page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
