import { useEffect, useState } from 'react';
import { Save, Wallet, Key, AlertTriangle, Trash2 } from 'lucide-react';
import { api, tokenStore } from '../../api/client.js';
import { Badge, Button, Card, Field, Notice, PasswordField, StatusBadge, inputStyle } from '../ui.jsx';

const KENYA_COUNTIES = ['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang’a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'];

export default function ProfilePanel({ user, refreshUser, walletAccount, onConnectWallet }) {
  const [form, setForm] = useState({ fullName: '', phone: '', walletAddress: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [avatarSrc, setAvatarSrc] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordNotice, setPasswordNotice] = useState(null);
  const [reviewRequest, setReviewRequest] = useState({ county: '', applicationType: 'platform_committee', boardName: '', appointingAuthority: '', appointmentReference: '', term: '', experience: '', documentsReady: false });
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewNotice, setReviewNotice] = useState(null);

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

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!user?.hasAvatar) {
      Promise.resolve().then(() => { if (active) setAvatarSrc(''); });
      return () => { active = false; };
    }
    api.getProfileAvatar()
      .then(({ blob }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setAvatarSrc(objectUrl);
      })
      .catch(() => { if (active) setAvatarSrc(''); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.id, user?.hasAvatar]);

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 512 * 1024) {
      setAvatarError('Choose an image smaller than 512 KB.');
      return;
    }
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await api.uploadProfileAvatar(file);
      await refreshUser();
      setNotice('Profile photo updated.');
    } catch (err) {
      setAvatarError(err.message || 'Unable to upload the profile photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await api.removeProfileAvatar();
      await refreshUser();
      setNotice('Profile photo removed.');
    } catch (err) {
      setAvatarError(err.message || 'Unable to remove the profile photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

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

  const submitReviewerRequest = async (event) => {
    event.preventDefault();
    setReviewBusy(true);
    setReviewError(null);
    setReviewNotice(null);
    try {
      const { data } = await api.requestReviewerAccess(reviewRequest);
      setReviewNotice(`Request ${data.reference} was sent for manual review. Email your appointment evidence to watchoverlandregistry@yahoo.com and include this reference.`);
      setReviewRequest({ county: '', applicationType: 'platform_committee', boardName: '', appointingAuthority: '', appointmentReference: '', term: '', experience: '', documentsReady: false });
    } catch (err) {
      setReviewError(err.message || 'Unable to send the reviewer access request.');
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card title="Profile" subtitle="Update your display name, phone number, account category, and linked EVM wallet address.">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {avatarSrc ? (
            <img src={avatarSrc} alt={`${user?.fullName || 'Account'} profile`} width="88" height="88" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '2px solid #38bdf8' }} />
          ) : (
            <div aria-label="No profile photo" style={{ width: 88, height: 88, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(56,189,248,.15)', border: '1px solid rgba(56,189,248,.45)', color: '#7dd3fc', fontSize: '1.8rem', fontWeight: 800 }}>
              {(user?.fullName || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <strong style={{ color: '#f8fafc', display: 'block' }}>Profile photo</strong>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>JPG, PNG, or WebP. Maximum 512 KB.</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: '4px', color: '#cbd5e1', fontSize: '0.78rem' }}>
                {avatarBusy ? 'Saving photo…' : 'Choose a photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarBusy} onChange={uploadAvatar} aria-label="Choose profile photo" />
              </label>
              {user?.hasAvatar && <Button type="button" variant="secondary" disabled={avatarBusy} onClick={removeAvatar}><Trash2 size={14} /> Remove photo</Button>}
            </div>
          </div>
        </div>
        {avatarError && <Notice tone="error" style={{ marginBottom: '0.8rem' }}>{avatarError}</Notice>}
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

      {!['administrator', 'registrar'].includes(user?.role) && (
        <Card title="Request county reviewer access" subtitle="This application requests a platform review role. It does not appoint you to a statutory Land Control Board or grant registry permissions.">
          <form onSubmit={submitReviewerRequest} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
            <Field label="Request type *">
              <select style={inputStyle} value={reviewRequest.applicationType} onChange={(event) => setReviewRequest({ ...reviewRequest, applicationType: event.target.value })}>
                <option value="platform_committee">LandRegistryChain county review committee</option>
                <option value="statutory_lcb">Verify an existing Land Control Board appointment</option>
              </select>
            </Field>
            <Field label="County *">
              <select style={inputStyle} required value={reviewRequest.county} onChange={(event) => setReviewRequest({ ...reviewRequest, county: event.target.value })}>
                <option value="">Select county</option>
                {KENYA_COUNTIES.map((county) => <option key={county} value={county}>{county}</option>)}
              </select>
            </Field>
            <Field label="Board or committee name *"><input style={inputStyle} required minLength={3} maxLength={160} value={reviewRequest.boardName} onChange={(event) => setReviewRequest({ ...reviewRequest, boardName: event.target.value })} /></Field>
            <Field label="Appointing authority *"><input style={inputStyle} required minLength={3} maxLength={160} placeholder="Authority named on your appointment" value={reviewRequest.appointingAuthority} onChange={(event) => setReviewRequest({ ...reviewRequest, appointingAuthority: event.target.value })} /></Field>
            <Field label="Appointment or Gazette reference *"><input style={inputStyle} required minLength={3} maxLength={120} value={reviewRequest.appointmentReference} onChange={(event) => setReviewRequest({ ...reviewRequest, appointmentReference: event.target.value })} /></Field>
            <Field label="Appointment term *"><input style={inputStyle} required minLength={3} maxLength={120} placeholder="Start and end dates" value={reviewRequest.term} onChange={(event) => setReviewRequest({ ...reviewRequest, term: event.target.value })} /></Field>
            <Field label="Relevant experience and reason for access *" style={{ gridColumn: '1 / -1' }}>
              <textarea style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }} required minLength={50} maxLength={1200} value={reviewRequest.experience} onChange={(event) => setReviewRequest({ ...reviewRequest, experience: event.target.value })} />
            </Field>
            <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: '9px', color: '#cbd5e1', fontSize: '0.85rem' }}>
              <input type="checkbox" required checked={reviewRequest.documentsReady} onChange={(event) => setReviewRequest({ ...reviewRequest, documentsReady: event.target.checked })} />
              I have official appointment evidence ready to email for verification. I understand no permissions are granted until an administrator reviews the evidence.
            </label>
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>After submitting, email your appointment letter or Gazette notice and supporting credentials to <a href="mailto:watchoverlandregistry@yahoo.com" style={{ color: '#7dd3fc' }}>watchoverlandregistry@yahoo.com</a>. Include the request reference shown after submission. Do not email passwords or one-time codes.</p>
              <Button type="submit" disabled={reviewBusy}>{reviewBusy ? 'Submitting…' : 'Submit for manual review'}</Button>
            </div>
          </form>
          {reviewError && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{reviewError}</Notice>}
          {reviewNotice && <Notice tone="success" style={{ marginTop: '0.8rem' }}>{reviewNotice}</Notice>}
        </Card>
      )}

      <Card title="Change password" subtitle="Your current password is required. All other active sessions will be signed out.">
        <form onSubmit={changePassword} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
          <PasswordField label="Current password *" required minLength={1} maxLength={128} value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} autoComplete="current-password" />
          <PasswordField label="New password *" required minLength={10} maxLength={128} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} placeholder="10+ characters, with uppercase, lowercase and a number" autoComplete="new-password" />
          <PasswordField label="Confirm new password *" required minLength={10} maxLength={128} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} autoComplete="new-password" />
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
