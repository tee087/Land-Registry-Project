import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, MailOpen } from 'lucide-react';
import { api } from '../api/client.js';
import { Badge, Button, Card, EmptyState, Field, Notice, Spinner, formatDate, inputStyle } from './ui.jsx';

const REFRESH_INTERVAL_MS = 30 * 1000;

export default function NotificationsPanel({ onUnreadChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const intervalRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.notifications(categoryFilter ? { category: categoryFilter } : undefined);
      const rows = data || [];
      setItems(rows);
      onUnreadChange?.(rows.filter((item) => !item.readAt).length);
    } catch (err) {
      setError(err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange, categoryFilter]);

  const refreshInBackground = useCallback(async () => {
    try {
      const { data } = await api.notifications(categoryFilter ? { category: categoryFilter } : undefined);
      const rows = data || [];
      setItems(rows);
      onUnreadChange?.(rows.filter((item) => !item.readAt).length);
    } catch {
      // Silent background refresh failures; the next manual refresh will surface errors.
    }
  }, [categoryFilter, onUnreadChange]);

  useEffect(() => {
    let active = true;
    const pending = Promise.resolve().then(load);
    const tick = () => {
      if (!active) return undefined;
      return Promise.resolve().then(refreshInBackground);
    };
    intervalRef.current = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      pending.catch(() => {});
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load, refreshInBackground]);

  const markAll = async () => {
    setBusy(true);
    try {
      await api.markNotificationsRead();
      await load();
    } catch (err) {
      setError(err.message || 'Unable to mark notifications read.');
    } finally {
      setBusy(false);
    }
  };

  const markOne = async (id) => {
    try {
      await api.markNotificationRead(id);
      const next = items.map((row) => (row.id === id ? { ...row, readAt: new Date().toISOString() } : row));
      setItems(next);
      onUnreadChange?.(next.filter((item) => !item.readAt).length);
    } catch (err) {
      setError(err.message || 'Unable to mark notification read.');
    }
  };

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <Card
      title="Notifications"
      subtitle={`${unread} unread of ${items.length}`}
      actions={<Button variant="secondary" onClick={markAll} disabled={busy || unread === 0}><CheckCheck size={15} /> Mark all read</Button>}
    >
      {error && <Notice tone="error" style={{ marginBottom: '0.8rem' }}>{error}</Notice>}
      <form onSubmit={(event) => event.preventDefault()} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
        <Field label="Filter by category" style={{ margin: 0, width: 'auto' }}>
          <select style={{ ...inputStyle, width: 'auto', padding: '6px 8px', fontSize: '0.8rem' }} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {[
              ...new Set(items.map((item) => item.category || item.type)),
            ].map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
        <Button variant="secondary" onClick={() => setCategoryFilter('')} disabled={!categoryFilter}>Clear filter</Button>
      </form>
      {loading ? (
        <Spinner label="Loading notifications…" />
      ) : items.length === 0 ? (
        <EmptyState>No notifications yet. Registration and transfer decisions will appear here.</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                background: item.readAt ? 'rgba(2, 6, 23, 0.45)' : 'rgba(56, 189, 248, 0.1)',
                border: item.readAt ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(56,189,248,0.35)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <Bell size={18} color={item.readAt ? '#64748b' : '#38bdf8'} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ color: '#f8fafc', fontWeight: 600 }}>{item.title}</div>
                    <Badge tone="neutral">{item.category || item.type}</Badge>
                  </div>
                  {item.body && <div style={{ color: '#cbd5e1', fontSize: '0.86rem', marginTop: '3px' }}>{item.body}</div>}
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '5px' }}>{formatDate(item.createdAt)} · {item.type}</div>
                </div>
              </div>
              {!item.readAt && (
                <Button variant="ghost" onClick={() => markOne(item.id)} title="Mark read">
                  <MailOpen size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
