import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { api } from '../api/client.js';

const modeName = (value) => ({ buyer: 'Buyer', seller: 'Seller', buyer_seller: 'Buyer and seller' }[value] || value || 'Unknown');

export default function AccountModeApprovalPage() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api.getAccountModeApproval(token)
      .then(({ data }) => { if (active) setRequest(data); })
      .catch((err) => { if (active) setError(err.message || 'This approval link is invalid or has expired.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      await api.approveAccountMode(token);
      setApproved(true);
      setRequest(null);
      window.history.replaceState({}, '', '/approve-account-mode');
    } catch (err) {
      setError(err.message || 'Could not approve this request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(ellipse at top, #12314a 0%, #07111f 55%, #030712 100%)', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ width: 'min(100%, 560px)', padding: 'clamp(22px, 5vw, 38px)', border: '1px solid rgba(56,189,248,.28)', borderRadius: 22, background: 'rgba(15,23,42,.94)', boxShadow: '0 25px 80px rgba(0,0,0,.38)' }}>
        <div style={{ display: 'grid', placeItems: 'center', width: 54, height: 54, borderRadius: 16, background: 'rgba(56,189,248,.12)', color: '#7dd3fc' }}>
          {approved ? <CheckCircle2 size={28} /> : <ShieldCheck size={28} />}
        </div>
        <p style={{ margin: '20px 0 8px', color: '#7dd3fc', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.13em' }}>LANDREGISTRYCHAIN · MAILBOX REVIEW</p>
        <h1 style={{ margin: 0, color: '#f8fafc', fontSize: 'clamp(1.55rem, 5vw, 2rem)' }}>{approved ? 'Request approved' : 'Review account mode request'}</h1>
        {loading && <p role="status" style={{ color: '#cbd5e1' }}>Loading request…</p>}
        {!token && !approved && <p role="alert" style={{ color: '#fca5a5' }}>This link is missing its approval token.</p>}
        {request && !approved && <>
          <p style={{ color: '#cbd5e1', lineHeight: 1.65 }}>Confirm this account mode change. Approval immediately updates the applicant’s workspace.</p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(115px, .7fr) 1.3fr', gap: '11px 14px', padding: 16, borderRadius: 14, background: 'rgba(2,6,23,.55)', fontSize: '.9rem' }}>
            <dt style={{ color: '#94a3b8' }}>Applicant</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{request.applicantName}</dd>
            <dt style={{ color: '#94a3b8' }}>Email</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{request.applicantEmail}</dd>
            <dt style={{ color: '#94a3b8' }}>Current mode</dt><dd style={{ margin: 0 }}>{modeName(request.currentAccountType)}</dd>
            <dt style={{ color: '#94a3b8' }}>Requested mode</dt><dd style={{ margin: 0, color: '#7dd3fc', fontWeight: 750 }}>{modeName(request.requestedAccountType)}</dd>
            <dt style={{ color: '#94a3b8' }}>Reference</dt><dd style={{ margin: 0 }}>{request.reference}</dd>
          </dl>
          <p style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#fbbf24', fontSize: '.82rem', lineHeight: 1.5 }}><Clock3 size={17} />This one-time approval link expires at {new Date(request.expiresAt).toLocaleString()}.</p>
          <button type="button" disabled={busy} onClick={approve} style={{ width: '100%', marginTop: 8, padding: '13px 18px', border: 0, borderRadius: 11, background: '#38bdf8', color: '#082f49', fontWeight: 800, fontSize: '.95rem', cursor: busy ? 'wait' : 'pointer', opacity: busy ? .65 : 1 }}>{busy ? 'Approving…' : 'Approve this account mode change'}</button>
        </>}
        {approved && <p role="status" style={{ color: '#86efac', lineHeight: 1.65 }}>The requested mode is now active. The approval link has been used and cannot be reused.</p>}
        {error && <p role="alert" style={{ color: '#fca5a5', lineHeight: 1.6 }}>{error}</p>}
        <p style={{ margin: '20px 0 0', paddingTop: 16, borderTop: '1px solid rgba(148,163,184,.15)', color: '#94a3b8', fontSize: '.75rem', lineHeight: 1.5 }}>Only approve requests you recognize. Opening this page does not approve anything; approval happens only when you press the button.</p>
      </section>
    </main>
  );
}
