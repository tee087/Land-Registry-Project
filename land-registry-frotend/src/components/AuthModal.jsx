import { useEffect, useRef, useState } from 'react';
import { X, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../context/useAuth.js';
import { api } from '../api/client.js';

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(56, 189, 248, 0.3)',
  background: 'rgba(2, 6, 23, 0.9)',
  color: '#fff',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  color: '#94a3b8',
  marginBottom: '5px',
  textAlign: 'left',
};

export default function AuthModal({ open, onClose }) {
  const { login, register, error, setError } = useAuth();
  const dialogRef = useRef(null);
  const [resetToken, setResetToken] = useState(new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [mode, setMode] = useState(window.location.pathname === '/reset-password' ? 'reset' : 'login');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    mfaCode: '',
  });
  const [mfaSetup, setMfaSetup] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.querySelector('input')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setNotice('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        const result = await login(form.email, form.password, form.mfaCode);
        if (result.mfaEnrollmentRequired) setMode('mfaSetup');
        else onClose();
      } else if (mode === 'mfaSetup') {
        if (!mfaSetup) {
          const { data } = await api.setupMfa(form.password);
          setMfaSetup(data);
          setNotice('Add this secret to an authenticator app, then enter the current six-digit code.');
          return;
        }
        await api.enableMfa(form.mfaCode);
        setNotice('Multi-factor authentication enabled.');
        onClose();
      } else if (mode === 'forgot') {
        await api.requestPasswordReset(form.email);
        setNotice('If an active account matches that address, a reset link will be sent.');
      } else if (mode === 'reset') {
        if (form.password !== form.confirmPassword) throw new Error('Passwords do not match');
        await api.resetPassword(resetToken, form.password);
        setNotice('Password reset. You can now sign in.');
        setMode('login');
        window.history.replaceState({}, '', '/');
      } else if (mode === 'register') {
        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const payload = {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
        };
        if (form.phone.trim()) payload.phone = form.phone.trim();
        const result = await register(payload);
        if (result.verificationRequired) {
          setNotice('Account created. Check your email for a verification link before signing in.');
          return;
        }
        onClose();
      }
    } catch (submitError) {
      setError(submitError.message);
      // Error is surfaced by the auth context / thrown validation message below.
    } finally {
      setBusy(false);
    }
  };

  const localError = form.password && form.confirmPassword && form.password !== form.confirmPassword;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create landowner account' : mode === 'forgot' ? 'Recover account' : mode === 'reset' ? 'Reset password' : 'Authenticator setup'}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>
            {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create landowner account' : mode === 'forgot' ? 'Recover account' : mode === 'reset' ? 'Reset password' : 'Authenticator setup'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {(mode === 'login' || mode === 'register') && <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => switchMode('login')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: mode === 'login' ? '#38bdf8' : 'transparent',
              background: mode === 'login' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: mode === 'login' ? '#38bdf8' : '#cbd5e1',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <LogIn size={16} /> Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: mode === 'register' ? '#38bdf8' : 'transparent',
              background: mode === 'register' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: mode === 'register' ? '#38bdf8' : '#cbd5e1',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <UserPlus size={16} /> Register
          </button>
        </div>}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Full name</label>
              <input
                style={inputStyle}
                value={form.fullName}
                onChange={update('fullName')}
                required
                minLength={2}
                maxLength={120}
                placeholder="Jane Doe"
              />
            </div>
          )}

          {mode !== 'reset' && mode !== 'mfaSetup' && <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={update('email')}
              required
              placeholder="jane@example.test"
            />
          </div>}

          {mode === 'reset' && <div><label style={labelStyle}>Reset token</label><input style={inputStyle} value={resetToken} onChange={(event) => setResetToken(event.target.value)} required /></div>}

          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Phone (optional)</label>
              <input
                style={inputStyle}
                value={form.phone}
                onChange={update('phone')}
                placeholder="+254700000000"
              />
            </div>
          )}

          {mode !== 'forgot' && mode !== 'mfaSetup' && <div>
            <label style={labelStyle}>Password</label>
            <input
              style={inputStyle}
              type="password"
              value={form.password}
              onChange={update('password')}
              required
              minLength={mode === 'register' || mode === 'reset' ? 10 : 1}
              maxLength={128}
            />
          </div>}

          {mode === 'login' && <div><label style={labelStyle}>Authenticator code (privileged accounts)</label><input style={inputStyle} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.mfaCode} onChange={update('mfaCode')} /></div>}
          {mode === 'mfaSetup' && <div style={{ color: '#cbd5e1', fontSize: '0.9rem', overflowWrap: 'anywhere' }}>
            <p>Privileged accounts must enroll an authenticator before using registry functions.</p>
            {mfaSetup && <><p><strong>Secret:</strong> {mfaSetup.secret}</p><p>Authenticator URI: {mfaSetup.otpauthUrl}</p><label style={labelStyle}>Six-digit code</label><input style={inputStyle} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.mfaCode} onChange={update('mfaCode')} required /></>}
          </div>}

          {(mode === 'register' || mode === 'reset') && (
            <div>
              <label style={labelStyle}>Confirm password</label>
              <input
                style={inputStyle}
                type="password"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                required
              />
            </div>
          )}

          {(error || localError) && (
            <div style={{ color: '#fca5a5', fontSize: '0.85rem', textAlign: 'left' }}>
              {localError ? 'Passwords do not match' : error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: '0.25rem',
              background: busy ? '#0e7490' : '#38bdf8',
              color: '#0f172a',
              border: 'none',
              padding: '11px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send recovery link' : mode === 'reset' ? 'Reset password' : mode === 'mfaSetup' ? (mfaSetup ? 'Enable MFA' : 'Begin MFA setup') : 'Create account'}
          </button>
        </form>

        {notice && <p role="status" style={{ color: '#86efac', fontSize: '0.85rem' }}>{notice}</p>}
        {mode === 'login' && <button type="button" onClick={() => switchMode('forgot')} style={{ marginTop: '0.8rem', background: 'none', border: 0, color: '#7dd3fc', cursor: 'pointer' }}>Forgot password?</button>}
        {mode === 'login' && <button type="button" onClick={async () => { try { await api.requestEmailVerification(form.email); setNotice('If verification is needed for that account, a link will be sent.'); } catch (requestError) { setError(requestError.message); } }} style={{ display: 'block', marginTop: '0.5rem', background: 'none', border: 0, color: '#7dd3fc', cursor: 'pointer' }}>Resend verification email</button>}
        {mode === 'forgot' && <button type="button" onClick={() => switchMode('login')} style={{ marginTop: '0.8rem', background: 'none', border: 0, color: '#7dd3fc', cursor: 'pointer' }}>Return to sign in</button>}

        {mode === 'register' && (
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.9rem 0 0 0', textAlign: 'left' }}>
            Password needs 10+ characters with uppercase, lowercase and a number. Public
            registration always creates a landowner account.
          </p>
        )}
      </div>
    </div>
  );
}
