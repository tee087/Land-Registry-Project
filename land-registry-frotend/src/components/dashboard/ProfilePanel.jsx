import { useEffect, useState } from 'react';
import { Camera, Save, Wallet, Key, AlertTriangle, Trash2, ShieldCheck, Sun, Moon, LogOut, Smartphone, MailCheck, CalendarDays, UserRound, Settings2, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import { api, tokenStore } from '../../api/client.js';
import { Badge, Button, Card, Field, Notice, PasswordField, StatusBadge, inputStyle } from '../ui.jsx';

async function normalizeProfileImage(file) {
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose an image smaller than 15 MB.');
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file, such as JPG, PNG, HEIC, GIF, or WebP.');
  if (typeof createImageBitmap !== 'function') throw new Error('This browser cannot convert that image. Try saving it as JPG or PNG first.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image format is not supported by your browser. Try saving it as JPG or PNG.');
  }
  try {
    for (let edge = 1200; edge >= 320; edge = Math.round(edge * 0.78)) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Image conversion is unavailable in this browser.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.88, 0.78, 0.68, 0.58, 0.48]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (blob && blob.size <= 512 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
          const basename = file.name.replace(/\.[^.]+$/, '') || 'profile-photo';
          const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
          return new File([blob], `${basename}.${extension}`, { type: blob.type });
        }
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error('This photo could not be compressed below 512 KB. Try a smaller image.');
}

const KENYA_COUNTIES = ['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang’a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'];

export default function ProfilePanel({ user, refreshUser, walletAccount, onConnectWallet, theme = 'dark', setTheme, density = 'comfortable', setDensity, onLogout, onRequestModeChange, modeBusy = false, modeError = '', modeNotice = '', modeRequest = null }) {
  const [form, setForm] = useState({ fullName: '', phone: '', accountType: 'buyer', walletAddress: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [avatarSrc, setAvatarSrc] = useState('');
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordNotice, setPasswordNotice] = useState(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);
  const [recoveryNotice, setRecoveryNotice] = useState(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [verifyNotice, setVerifyNotice] = useState(null);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaPassword, setMfaPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState(null);
  const [mfaNotice, setMfaNotice] = useState(null);
  const [reviewRequest, setReviewRequest] = useState({ county: '', applicationType: 'platform_committee', boardName: '', appointingAuthority: '', appointmentReference: '', term: '', experience: '', documentsReady: false });
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewNotice, setReviewNotice] = useState(null);
  const canUseMfa = Boolean(user);
  const systemAccessLabel = user?.role === 'landowner'
    ? 'Standard property account'
    : ({ registrar: 'Registry reviewer', administrator: 'Administrator', investigator: 'Investigator', auditor: 'Auditor' }[user?.role] || 'Registry staff');
  const completionItems = [Boolean(user?.fullName), Boolean(user?.emailVerifiedAt), Boolean(user?.phone), Boolean(user?.hasAvatar)];
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);
  const formatProfileDate = (value) => value ? new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(new Date(value)) : 'Not available';

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setForm({
        fullName: user.fullName || '',
        phone: user.phone || '',
        accountType: user.accountType || 'buyer',
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
  }, [user?.id, user?.hasAvatar, avatarVersion]);

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const normalizedFile = await normalizeProfileImage(file);
      await api.uploadProfileAvatar(normalizedFile);
      await refreshUser();
      setAvatarVersion((version) => version + 1);
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

  const beginMfaSetup = async (event) => {
    event.preventDefault();
    setMfaBusy(true);
    setMfaError(null);
    setMfaNotice(null);
    try {
      const { data } = await api.setupMfa(mfaPassword);
      const qrCodeDataUrl = await QRCode.toDataURL(data.otpauthUrl, { width: 220, margin: 2, errorCorrectionLevel: 'M' });
      setMfaSetup({ ...data, qrCodeDataUrl });
      setMfaPassword('');
      setMfaNotice('Add this account in your authenticator app, then confirm with its current code.');
    } catch (err) {
      setMfaError(err.message || 'Unable to start authenticator setup.');
    } finally {
      setMfaBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    setRecoveryBusy(true);
    setRecoveryError(null);
    setRecoveryNotice(null);
    try {
      await api.requestPasswordReset(user.email);
      setRecoveryNotice(`If password recovery is available for ${user.email}, a secure reset link will be sent.`);
    } catch (err) {
      setRecoveryError(err.message || 'Unable to request a password reset right now.');
    } finally {
      setRecoveryBusy(false);
    }
  };

  const resendVerification = async () => {
    setVerifyBusy(true);
    setVerifyError(null);
    setVerifyNotice(null);
    try {
      const { data } = await api.requestEmailVerification(user.email);
      setVerifyNotice(data?.emailSent ? `Verification email sent to ${user.email}.` : `If verification is needed, an email will be sent to ${user.email}.`);
    } catch (err) {
      setVerifyError(err.message || 'Could not send a verification email.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const scrollToProfileSection = (sectionId) => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const confirmMfaSetup = async (event) => {
    event.preventDefault();
    setMfaBusy(true);
    setMfaError(null);
    setMfaNotice(null);
    try {
      await api.enableMfa(mfaCode);
      await refreshUser();
      setMfaSetup(null);
      setMfaCode('');
      setMfaNotice('Authenticator app protection is enabled for your next sign-in.');
    } catch (err) {
      setMfaError(err.message || 'That authenticator code could not be verified.');
    } finally {
      setMfaBusy(false);
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
    <div className="lrc-profile-page">
      <div className="lrc-profile-page-heading">
        <div><span className="lrc-workspace-eyebrow">ACCOUNT SETTINGS</span><h2>Profile & preferences</h2><p>Manage your identity, security, and workspace experience.</p></div>
        <Badge tone={user?.emailVerifiedAt ? 'success' : 'warning'}>{user?.emailVerifiedAt ? 'Verified account' : 'Email verification needed'}</Badge>
      </div>
      <nav className="lrc-profile-section-nav" aria-label="Profile settings sections">
        {[
          ['profile-personal', 'Personal details'],
          ['profile-account', 'Account'],
          ['profile-preferences', 'Preferences'],
          ['profile-security', 'Security'],
          ...(!['administrator', 'registrar'].includes(user?.role) ? [['profile-board-access', 'Board access']] : []),
        ].map(([sectionId, label]) => <button key={sectionId} type="button" onClick={() => scrollToProfileSection(sectionId)}>{label}</button>)}
      </nav>

      <Card id="profile-personal" title="Personal details" subtitle="Keep your contact details current so registry updates can reach you.">
        <div className="lrc-profile-identity">
          <div className="lrc-profile-avatar-wrap">
            {avatarSrc ? (
              <img src={avatarSrc} alt={`${user?.fullName || 'Account'} profile`} width="112" height="112" className="lrc-profile-avatar" />
            ) : (
              <div aria-label="No profile photo" className="lrc-profile-avatar lrc-profile-avatar-placeholder">
                {(user?.fullName || user?.email || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <label className="lrc-profile-camera" title="Add or change profile photo">
              <Camera size={17} aria-hidden="true" />
              <input type="file" accept="image/*" disabled={avatarBusy} onChange={uploadAvatar} aria-label="Add or change profile photo" />
            </label>
          </div>
          <div>
            <strong style={{ color: '#f8fafc', display: 'block' }}>Profile photo</strong>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{avatarBusy ? 'Saving your photo…' : 'JPG, PNG, or WebP · Up to 512 KB'}</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {user?.hasAvatar && <Button type="button" variant="secondary" disabled={avatarBusy} onClick={removeAvatar}><Trash2 size={14} /> Remove photo</Button>}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.76rem', margin: '8px 0 0' }}>Your photo is saved to your account and will still be here next time you sign in.</p>
            <p style={{ color: '#94a3b8', fontSize: '0.76rem', margin: '4px 0 0' }}>Choose any image format your browser can open. The image is resized and converted before it is saved.</p>
          </div>
          <div className="lrc-profile-completion">
            <div><span>Profile completion</span><strong>{completion}%</strong></div>
            <div className="lrc-profile-progress" role="progressbar" aria-label="Profile completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completion}><span style={{ width: `${completion}%` }} /></div>
            <small>{completionItems.filter(Boolean).length} of 4 profile details complete</small>
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
            <input style={inputStyle} type="tel" autoComplete="tel" pattern="\+?[0-9]{9,15}" title="Use digits only: 0712345678 or +254712345678." value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+254712345678" />
          </Field>
          <Field label="Email address" hint="Email changes are managed by account support.">
            <input style={inputStyle} type="email" value={user?.email || ''} readOnly aria-readonly="true" />
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

      <Card id="profile-account" title="Account overview" subtitle="Your registered identity and access state on this platform.">
        <div className="lrc-profile-account-grid">
          <div><span>Account type</span><strong><UserRound size={15} />{user?.accountType?.replace('_', ' and ') || 'Registry staff'}</strong></div>
          <div><span>System access</span><strong>{systemAccessLabel}</strong></div>
          <div><span>Account status</span><strong><StatusBadge status={user?.status} /></strong></div>
          <div><span>Email verification</span><strong>{user?.emailVerifiedAt ? <><CheckCircle2 size={15} /> Verified</> : <><MailCheck size={15} /> Pending</>}</strong></div>
          <div><span>Member since</span><strong><CalendarDays size={15} />{formatProfileDate(user?.createdAt)}</strong></div>
          <div><span>Last sign-in</span><strong><CalendarDays size={15} />{formatProfileDate(user?.lastLoginAt)}</strong></div>
        </div>
        {user?.role === 'landowner' && <div className="lrc-profile-mode-settings">
          <div><strong>Workspace mode</strong><p>Request a change between Buyer, Seller, or Both. Your current mode stays active until the site owner approves the request.</p></div>
          <div className="lrc-profile-theme-options" role="group" aria-label="Request workspace mode change">
            {[
              ['buyer', 'Buyer'],
              ['seller', 'Seller'],
              ['buyer_seller', 'Both'],
            ].map(([mode, label]) => <Button key={mode} type="button" variant={user?.accountType === mode ? 'primary' : 'secondary'} aria-pressed={user?.accountType === mode} disabled={modeBusy} onClick={() => onRequestModeChange?.(mode)}>{label}{user?.accountType === mode ? ' · Current' : ''}</Button>)}
          </div>
          {modeBusy && <small role="status">Sending your approval request…</small>}
          {modeError && <Notice tone="error">{modeError}</Notice>}
          {modeNotice && <Notice tone="success">{modeNotice}</Notice>}
          {modeRequest && <div className="lrc-account-mode-request" role="status"><strong>Mode change awaiting review</strong><span>{modeRequest.currentAccountType?.replace('_', ' + ')} → {modeRequest.requestedAccountType?.replace('_', ' + ')} · Request {modeRequest.reference}</span><small>Approval link sent to the site owner. Reviews usually take a few hours. Your current mode remains active until approval.</small></div>}
        </div>}
        {!user?.emailVerifiedAt && <div className="lrc-profile-action-block"><p>Verify your email to keep account recovery and registry notices available.</p><Button type="button" variant="secondary" disabled={verifyBusy} onClick={resendVerification}><MailCheck size={15} />{verifyBusy ? 'Sending…' : 'Resend verification email'}</Button></div>}
        {verifyError && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{verifyError}</Notice>}
        {verifyNotice && <Notice tone="info" style={{ marginTop: '0.8rem' }}>{verifyNotice}</Notice>}
      </Card>

      <Card id="profile-preferences" title="Workspace preferences" subtitle="Personalize how the signed-in workspace looks on this device.">
        <div className="lrc-profile-setting-row">
          <div><strong style={{ color: '#f8fafc' }}>Workspace theme</strong><p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '0.82rem' }}>Switch between dark and light mode.</p></div>
          <div className="lrc-profile-theme-options" role="group" aria-label="Workspace theme">
            <Button variant={theme === 'dark' ? 'primary' : 'secondary'} aria-pressed={theme === 'dark'} onClick={() => setTheme?.('dark')}><Moon size={15} /> Dark</Button>
            <Button variant={theme === 'light' ? 'primary' : 'secondary'} aria-pressed={theme === 'light'} onClick={() => setTheme?.('light')}><Sun size={15} /> Light</Button>
          </div>
        </div>
        <div className="lrc-profile-setting-divider" />
        <div className="lrc-profile-setting-row">
          <div><strong style={{ color: '#f8fafc' }}>Content spacing</strong><p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '0.82rem' }}>Choose a layout that feels right on your screen.</p></div>
          <div className="lrc-profile-theme-options" role="group" aria-label="Content spacing">
            <Button variant={density === 'comfortable' ? 'primary' : 'secondary'} aria-pressed={density === 'comfortable'} onClick={() => setDensity?.('comfortable')}><Settings2 size={15} /> Comfortable</Button>
            <Button variant={density === 'compact' ? 'primary' : 'secondary'} aria-pressed={density === 'compact'} onClick={() => setDensity?.('compact')}>Compact</Button>
          </div>
        </div>
      </Card>

      <Card id="profile-security" title="Sign-in & security" subtitle="Protect your account and manage how you regain access.">
        <div className="lrc-profile-security-row"><div><strong><Key size={16} /> Password</strong><p>Use a unique password and update it if you think it may have been exposed.</p></div><Button type="button" variant="secondary" disabled={recoveryBusy} onClick={sendPasswordReset}>{recoveryBusy ? 'Sending…' : 'Email password reset link'}</Button></div>
        {recoveryError && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{recoveryError}</Notice>}
        {recoveryNotice && <Notice tone="info" style={{ marginTop: '0.8rem' }}>{recoveryNotice}</Notice>}
        <div className="lrc-profile-setting-divider" />
        <div className="lrc-profile-security-row"><div><strong><ShieldCheck size={16} /> Authenticator app</strong><p>Add an extra sign-in check using Google Authenticator, Microsoft Authenticator, Authy, or another time-based code app.</p></div></div>
        {canUseMfa ? (user?.mfaEnabled ? (
          <Notice tone="success"><ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Authenticator protection is enabled. You’ll need a current code when you sign in.</Notice>
        ) : mfaSetup ? (
          <form onSubmit={confirmMfaSetup} className="lrc-mfa-setup-form">
            <div className="lrc-mfa-enrollment-card">
              <div className="lrc-mfa-qr-wrap"><img src={mfaSetup.qrCodeDataUrl} alt="Scan this QR code with an authenticator app to add LandRegistryChain" /><span>SCAN TO ADD ACCOUNT</span></div>
              <div className="lrc-mfa-secret"><Smartphone size={18} /><div><strong>Connect your authenticator app</strong><p>Scan this QR code in Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app. If you cannot scan it, enter this setup key manually:</p><code>{mfaSetup.secret}</code><a href={mfaSetup.otpauthUrl} className="lrc-mfa-setup-link">Open authenticator setup link</a></div></div>
            </div>
            <Field label="Six-digit authenticator code *" hint="Enter the current code shown in your authenticator app.">
              <input style={inputStyle} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} />
            </Field>
            <Button type="submit" disabled={mfaBusy}>{mfaBusy ? 'Verifying…' : 'Verify and enable 2FA'}</Button>
          </form>
        ) : (
          <form onSubmit={beginMfaSetup} className="lrc-mfa-setup-form">
            <Field label="Confirm your password *" hint="Confirm your password before creating an authenticator secret. For Google sign-in accounts, set a password first using the recovery link above.">
              <PasswordField value={mfaPassword} onChange={(event) => setMfaPassword(event.target.value)} required minLength={1} maxLength={128} autoComplete="current-password" />
            </Field>
            <Button type="submit" disabled={mfaBusy}><ShieldCheck size={15} /> {mfaBusy ? 'Preparing…' : 'Set up authenticator app'}</Button>
          </form>
        )) : (
          <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>Authenticator app enrollment is required for privileged registry roles. Buyer and seller accounts do not currently have this setting.</p>
        )}
        {mfaError && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{mfaError}</Notice>}
        {mfaNotice && <Notice tone="info" style={{ marginTop: '0.8rem' }}>{mfaNotice}</Notice>}
      </Card>

      {!['administrator', 'registrar'].includes(user?.role) && (
        <Card id="profile-board-access" title="Board & reviewer access" subtitle="Submit appointment details for review. A request does not grant permissions or equal statutory Land Control Board appointment.">
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

      <Card title="Sign out" subtitle="End your current session on this device.">
        <Button variant="danger" onClick={onLogout}><LogOut size={15} /> Log out</Button>
      </Card>
    </div>
  );
}
