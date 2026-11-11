import { useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { api } from '../../api/client.js';
import { Badge, Button, Card, Notice, Spinner, StatusBadge, Table, formatDate, inputStyle, shortHash } from '../ui.jsx';
import { useResource } from './useResource.js';

export default function UsersPanel({ user }) {
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const { data, loading, error: loadError, reload } = useResource(
    () => api.listUsers({ page: 1, limit: 100 }),
    `${user?.id}:${version}`,
    { enabled: Boolean(user) }
  );
  const rows = data?.data || [];

  const refresh = async () => {
    setVersion((value) => value + 1);
    await reload();
  };

  const changeStatus = async (target, status) => {
    setBusyId(target.id);
    setError(null);
    setNotice(null);
    try {
      await api.updateUserStatus(target.id, status);
      setNotice(`${target.fullName || target.email} is now ${status}.`);
      await refresh();
    } catch (err) {
      setError(err.message || 'Unable to update user status.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card
      title="User administration"
      subtitle="Activate, suspend, or disable accounts. Role assignment is not exposed through this UI."
      actions={<Button variant="secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</Button>}
    >
      {error && <Notice tone="error" style={{ marginBottom: '0.8rem' }}>{error}</Notice>}
      {notice && <Notice tone="success" style={{ marginBottom: '0.8rem' }}>{notice}</Notice>}
      {loading ? <Spinner label="Loading users…" /> : loadError ? <Notice tone="error">{loadError}</Notice> : (
        <Table
          columns={['User', 'Role', 'Status', 'Wallet', 'Joined', 'Change status']}
          rows={rows}
          empty="No users found."
          renderRow={(row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <td style={{ padding: '11px 14px' }}>
                <div style={{ color: '#f8fafc', fontWeight: 600 }}>{row.fullName}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{row.email}</div>
              </td>
              <td style={{ padding: '11px 14px' }}><Badge tone="info">{row.role}</Badge></td>
              <td style={{ padding: '11px 14px' }}><StatusBadge status={row.status} /></td>
              <td style={{ padding: '11px 14px', color: row.walletAddress ? '#4ade80' : '#94a3b8', fontFamily: 'monospace', fontSize: '0.78rem' }} title={row.walletAddress || ''}>{row.walletAddress ? shortHash(row.walletAddress, 6) : 'Not linked'}</td>
              <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '0.78rem' }}>{formatDate(row.createdAt)}</td>
              <td style={{ padding: '11px 14px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Users size={14} color="#94a3b8" />
                  <select
                    style={{ ...inputStyle, width: 'auto', padding: '6px 8px', fontSize: '0.8rem' }}
                    value={row.status}
                    disabled={busyId === row.id}
                    onChange={(event) => changeStatus(row, event.target.value)}
                  >
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="disabled">disabled</option>
                  </select>
                  {busyId === row.id && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Saving…</span>}
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </Card>
  );
}
