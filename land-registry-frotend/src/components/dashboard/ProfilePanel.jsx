import { useEffect, useState } from 'react';
import { Save, Wallet, Key, AlertTriangle } from 'lucide-react';
import { api, tokenStore } from '../../api/client.js';
import { Badge, Button, Card, Field, Notice, StatusBadge, inputStyle } from '../ui.jsx';

export default function ProfilePanel({ user, refreshUser, walletAccount, onConnectWallet }) {
  const [form, setForm] = useState({ fullName: '', phone: '', walletAddress: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordNotice, setPasswordNotice] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setForm({
        fullName: user.fullName || '',
        phone: user.phone || '',
        walletAddress: user.walletAddress || '',
      });
    });
    return () => {
      active = false;
    };
  }, [user]);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone.trim() || null,
        walletAddress: form.walletAddress.trim() || null,
      };
      await api.updateProfile(payload);
      await refreshUser();
      setNotice('Profile updated.');
    } catch (err) {
      setError(err.message || 'Unable to update profile.');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordNotice(null);
    try {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('New passwords do not match');
      }
      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      // All refresh tokens were revoked server-side, so sign the user out and
      // let them sign in again with the new password.
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('lrc:session-expired'));
      setPasswordNotice('Password changed. Please sign in again with your new password.');
    } catch (err) {
      setPasswordError(err.message || 'Unable to change password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const useConnectedWallet = () => {
    if (walletAccount) setForm((current) => ({ ...current, walletAddress: walletAccount }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card title="Profile" subtitle="Update your display name, phone number, account category, and linked EVM wallet address.">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Badge tone="info">{user?.accountType?.replace('_', ' and ') || user?.role}</Badge>
          <StatusBadge status={user?.status} />
          <Badge tone="neutral">{user?.email}</Badge>
        </div>
        <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
          <Field label="Full name *">
            <input style={inputStyle} required minLength={2} maxLength={120} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </Field>
          <Field label="Phone">
            <input style={inputStyle} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+254700000000" />
          </Field>
          <Field label="Wallet address" hint="Optional EVM wallet link for account reference. It does not authenticate you or approve a land transfer." style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: '1 1 320px' }} value={form.walletAddress} onChange={(event) => setForm({ ...form, walletAddress: event.target.value })} placeholder="0x…" />
              <Button type="button" variant="secondary" onClick={useConnectedWallet} disabled={!walletAccount}><Wallet size={14} /> {walletAccount ? 'Use connected wallet' : 'No wallet connected'}</Button>
            </div>
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <Button type="submit" disabled={busy}><Save size={14} /> {busy ? 'Saving…' : 'Save profile'}</Button>
            {onConnectWallet && (
              <Button onClick={onConnectWallet} disabled={busy}><Wallet size={14} /> Connect Wallet</Button>
            )}
          </div>
        </form>
        {error && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{error}</Notice>}
        {notice && <Notice tone="success" style={{ marginTop: '0.8rem' }}>{notice}</Notice>}
        {!walletAccount && (
          <Notice tone="info" style={{ marginTop: '0.8rem' }}>
            No browser wallet is connected. Use the “Connect Wallet” button below to link a MetaMask wallet address to your profile.
          </Notice>
        )}
      </Card>

      <Card title="Change password" subtitle="Your current password is required. All other active sessions will be signed out.">
        <form onSubmit={changePassword} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
          <Field label="Current password *">
            <input style={inputStyle} type="password" required minLength={1} maxLength={128} value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
          </Field>
          <Field label="New password *">
            <input style={inputStyle} type="password" required minLength={10} maxLength={128} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} placeholder="10+ characters, with uppercase, lowercase and a number" />
          </Field>
          <Field label="Confirm new password *">
            <input style={inputStyle} type="password" required minLength={10} maxLength={128} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <Button type="submit" disabled={passwordBusy}><Key size={14} /> {passwordBusy ? 'Changing…' : 'Change password'}</Button>
            <Button variant="ghost" onClick={() => setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })} disabled={passwordBusy}>Cancel</Button>
          </div>
        </form>
        {passwordError && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{passwordError}</Notice>}
        {passwordNotice && <Notice tone="success" style={{ marginTop: '0.8rem' }}>{passwordNotice}</Notice>}
        <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.8rem' }}>
          <AlertTriangle size={12} style={{ display: 'inline-block', marginRight: '6px' }} /> Changing your password revokes all refresh tokens, so you will need to sign in again on every device.
        </p>
      </Card>
    </div>
  );
}
