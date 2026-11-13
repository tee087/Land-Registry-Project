import { Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';

export const colors = {
  bg: 'rgba(15, 23, 42, 0.88)',
  panel: 'rgba(2, 6, 23, 0.65)',
  border: 'rgba(56, 189, 248, 0.28)',
  borderSoft: 'rgba(255, 255, 255, 0.1)',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#38bdf8',
  success: '#4ade80',
  danger: '#f87171',
  warning: '#fbbf24',
};

export const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '9px',
  border: '1px solid rgba(56, 189, 248, 0.3)',
  background: 'rgba(2, 6, 23, 0.9)',
  color: '#fff',
  fontSize: '0.92rem',
  boxSizing: 'border-box',
};

export const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  color: colors.muted,
  marginBottom: '5px',
};

export function Card({ title, subtitle, actions, children, style, id, className }) {
  return (
    <section id={id} className={className} style={{ background: colors.bg, backdropFilter: 'blur(18px)', border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.4rem', boxShadow: '0 10px 35px rgba(0,0,0,0.35)', ...style }}>
      {(title || actions) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            {title && <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>{title}</h3>}
            {subtitle && <p style={{ margin: '4px 0 0 0', color: colors.muted, fontSize: '0.85rem' }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ children, variant = 'primary', type = 'button', ...props }) {
  const palette = {
    primary: { background: '#38bdf8', color: '#0f172a', border: '1px solid #38bdf8' },
    secondary: { background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.5)' },
    danger: { background: 'rgba(239, 68, 68, 0.18)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.6)' },
    success: { background: 'rgba(34, 197, 94, 0.18)', color: '#86efac', border: '1px solid rgba(34, 197, 94, 0.6)' },
    ghost: { background: 'transparent', color: colors.muted, border: '1px solid rgba(255,255,255,0.14)' },
  }[variant];
  return (
    <button
      type={type}
      {...props}
      style={{
        ...palette,
        padding: '8px 14px',
        borderRadius: '8px',
        fontWeight: 700,
        fontSize: '0.82rem',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.55 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, style }) {
  return (
    <div style={style}>
      {label && <label style={labelStyle}>{label}</label>}
      {children}
      {hint && <p style={{ margin: '4px 0 0 0', color: colors.muted, fontSize: '0.72rem' }}>{hint}</p>}
    </div>
  );
}

export function PasswordField({ label, id, value, onChange, style, inputStyle: customInputStyle = inputStyle, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} style={style}>
      <div style={{ position: 'relative' }}>
        <input
          {...props}
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={props.autoComplete || 'current-password'}
          style={{ ...customInputStyle, paddingRight: '46px' }}
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label || 'password'}` : `Show ${label || 'password'}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          style={{ position: 'absolute', top: '50%', right: '8px', transform: 'translateY(-50%)', display: 'grid', placeItems: 'center', width: 34, height: 34, padding: 0, border: 0, borderRadius: 7, background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
}

export function Badge({ tone = 'neutral', children }) {
  const palette = {
    neutral: { background: 'rgba(148, 163, 184, 0.18)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.35)' },
    success: { background: 'rgba(34, 197, 94, 0.18)', color: '#86efac', border: '1px solid rgba(34, 197, 94, 0.45)' },
    danger: { background: 'rgba(239, 68, 68, 0.18)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.45)' },
    warning: { background: 'rgba(234, 179, 8, 0.18)', color: '#fde047', border: '1px solid rgba(234, 179, 8, 0.45)' },
    info: { background: 'rgba(56, 189, 248, 0.18)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.45)' },
  }[tone];
  return (
    <span style={{ ...palette, padding: '3px 9px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const value = String(status || 'unknown').toLowerCase();
  const tone = ['active', 'approved', 'confirmed', 'match', 'released'].includes(value)
    ? 'success'
    : ['rejected', 'failed', 'mismatch', 'suspended', 'disabled', 'frozen', 'disputed', 'archived'].includes(value)
      ? 'danger'
      : ['pending', 'submitted', 'under_review', 'in_custody', 'collected', 'not_available'].includes(value)
        ? 'warning'
        : 'neutral';
  return <Badge tone={tone}>{String(status || 'unknown').replaceAll('_', ' ')}</Badge>;
}

export function Notice({ tone = 'info', children, style }) {
  const palette = {
    info: { background: 'rgba(14, 116, 144, 0.25)', border: '1px solid rgba(56, 189, 248, 0.5)', color: '#bae6fd' },
    success: { background: 'rgba(6, 78, 59, 0.45)', border: '1px solid rgba(34, 197, 94, 0.5)', color: '#bbf7d0' },
    error: { background: 'rgba(127, 29, 29, 0.45)', border: '1px solid rgba(239, 68, 68, 0.55)', color: '#fecaca' },
    warning: { background: 'rgba(120, 53, 15, 0.45)', border: '1px solid rgba(234, 179, 8, 0.55)', color: '#fde68a' },
  }[tone];
  return (
    <div style={{ ...palette, borderRadius: '10px', padding: '10px 12px', fontSize: '0.85rem', ...style }} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return <div style={{ color: colors.muted, padding: '1.25rem', textAlign: 'center', border: `1px dashed ${colors.borderSoft}`, borderRadius: '10px', fontSize: '0.88rem' }}>{children}</div>;
}

export function Spinner({ label = 'Loading…' }) {
  return <div style={{ color: colors.muted, fontSize: '0.85rem', padding: '0.5rem 0' }}>{label}</div>;
}

export function Modal({ open, title, onClose, children, maxWidth = '560px' }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(2, 6, 23, 0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        style={{ width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.98)', border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.4rem', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: colors.muted, cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Table({ columns, rows, renderRow, empty = 'Nothing to show yet.' }) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${colors.borderSoft}`, borderRadius: '12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff', minWidth: '640px' }}>
        <thead>
          <tr style={{ background: 'rgba(2, 6, 23, 0.9)', borderBottom: `1px solid ${colors.borderSoft}` }}>
            {columns.map((column) => (
              <th key={column} style={{ padding: '12px 14px', color: colors.accent, fontSize: '0.72rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '20px', color: colors.muted, textAlign: 'center' }}>{empty}</td>
            </tr>
          ) : (
            rows.map(renderRow)
          )}
        </tbody>
      </table>
    </div>
  );
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function shortHash(value, size = 10) {
  if (!value) return '—';
  const text = String(value);
  if (text.length <= size * 2 + 2) return text;
  return `${text.slice(0, size + 2)}…${text.slice(-size)}`;
}
