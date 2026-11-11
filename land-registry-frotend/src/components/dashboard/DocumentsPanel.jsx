import { useState } from 'react';
import { Download, FileCheck2, FileUp, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client.js';
import { Badge, Button, Card, EmptyState, Field, Notice, Spinner, Table, formatDate, inputStyle, shortHash } from '../ui.jsx';
import { useResource } from './useResource.js';

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DocumentsPanel({ user }) {
  const [targetType, setTargetType] = useState<'parcel' | 'registration'>('parcel');
  const [parcelId, setParcelId] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [version, setVersion] = useState(0);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [verification, setVerification] = useState({});

  const canUpload = ['landowner', 'administrator'].includes(user?.role);

  const parcelsResource = useResource(
    () => api.listParcels({ limit: 100 }),
    `${user?.id}:doc-parcels`,
    { enabled: Boolean(user) }
  );
  const parcels = parcelsResource.data?.data || [];
  const selectedParcel = parcels.find((row) => String(row.id) === String(parcelId));

  const registrationsResource = useResource(
    () => api.listRegistrations(),
    `${user?.id}:doc-regs`,
    { enabled: Boolean(user) }
  );
  const registrations = registrationsResource.data?.data || [];
  const selectedRegistration = registrations.find((row) => String(row.id) === String(registrationId));

  const targetId = targetType === 'registration' ? registrationId : parcelId;
  const documentsResource = useResource(
    () =>
      targetType === 'registration'
        ? registrationId
          ? api.listRegistrationDocuments(registrationId)
          : Promise.resolve({ data: [] })
        : parcelId
          ? api.listDocuments(parcelId)
          : Promise.resolve({ data: [] }),
    `${user?.id}:${targetType}:${targetId}:${version}`,
    { enabled: Boolean(user && targetId) }
  );
  const documents = documentsResource.data?.data || [];

  const refresh = async () => {
    setVersion((value) => value + 1);
    await documentsResource.reload();
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!file || !targetId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (targetType === 'registration') {
        await api.uploadDocumentToRegistration(targetId, file);
      } else {
        await api.uploadDocument(targetId, file);
      }
      setFile(null);
      event.target.reset();
      setNotice('Document uploaded. The server calculated its SHA-256 digest.');
      await refresh();
    } catch (err) {
      setError(err.message || 'Unable to upload document.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (id) => {
    setError(null);
    try {
      const { data } = await api.verifyDocument(id);
      setVerification((current) => ({ ...current, [id]: data }));
    } catch (err) {
      setError(err.message || 'Unable to verify document.');
    }
  };

  const download = async (id) => {
    setError(null);
    try {
      const document = documents.find((row) => String(row.id) === String(id));
      const result = await api.downloadDocument(id, document?.originalName);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename || 'document';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Unable to download document.');
    }
  };

  const targetLabel = targetType === 'registration' ? 'Registration application' : 'Parcel';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card title="Documents" subtitle="Upload title documents and verify their stored SHA-256 digest. Document content is stored by the backend, not on IPFS.">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Upload to</span>
          <Button
            variant={targetType === 'parcel' ? 'secondary' : 'ghost'}
            onClick={() => setTargetType('parcel')}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            Parcel
          </Button>
          <Button
            variant={targetType === 'registration' ? 'secondary' : 'ghost'}
            onClick={() => setTargetType('registration')}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            Registration application
          </Button>
        </div>

        {parcelsResource.loading || registrationsResource.loading ? (
          <Spinner label="Loading options…" />
        ) : parcelsResource.error || registrationsResource.error ? (
          <Notice tone="error">{parcelsResource.error || registrationsResource.error}</Notice>
        ) : (
          <Field label={targetLabel} hint={targetId === '' ? 'Select a target to upload and view documents.' : undefined}>
            {targetType === 'parcel' ? (
              <select style={inputStyle} value={parcelId} onChange={(event) => setParcelId(event.target.value)}>
                <option value="">Select a parcel</option>
                {parcels.map((parcel) => (
                  <option key={parcel.id} value={parcel.id}>
                    {parcel.parcelNumber} ({parcel.status})
                  </option>
                ))}
              </select>
            ) : (
              <select style={inputStyle} value={registrationId} onChange={(event) => setRegistrationId(event.target.value)}>
                <option value="">Select a registration application</option>
                {registrations.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.parcel?.parcelNumber || `Registration #${reg.id}`} · {reg.status}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        {targetId && canUpload && (
          <form onSubmit={upload} style={{ marginTop: '1rem', background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="New document version" hint="Maximum 10 MB. Uploading a file with the same name creates a new version." style={{ flex: '1 1 260px' }}>
              <input style={inputStyle} type="file" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,application/pdf,image/jpeg,image/png,image/tiff" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </Field>
            <Button type="submit" disabled={busy || !file}>{busy ? 'Uploading…' : <><FileUp size={14} /> Upload</>}</Button>
          </form>
        )}
        {!canUpload && targetId && (
          <Notice tone="info" style={{ marginTop: '1rem' }}>Only the current owner can upload documents for this target. Your role can read and verify documents you are allowed to access.</Notice>
        )}

        {error && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{error}</Notice>}
        {notice && <Notice tone="success" style={{ marginTop: '0.8rem' }}>{notice}</Notice>}
      </Card>

      {targetId && (
        <Card
          title={`Documents for ${targetType === 'registration' ? (selectedRegistration?.parcel?.parcelNumber || `registration #${registrationId}`) : (selectedParcel?.parcelNumber || `parcel #${parcelId}`)}`}
          actions={<Button variant="secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</Button>}
        >
          {documentsResource.loading ? (
            <Spinner label="Loading documents…" />
          ) : documentsResource.error ? (
            <Notice tone="error">{documentsResource.error}</Notice>
          ) : (
            <Table
              columns={['Document', 'Version', 'Size', 'SHA-256', 'Status', 'Actions']}
              rows={documents}
              empty={`No documents have been uploaded for this ${targetLabel.toLowerCase()}.`}
              renderRow={(doc) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <td style={{ padding: '11px 14px', color: '#f8fafc' }}>{doc.originalName}<div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{formatDate(doc.createdAt)}</div></td>
                  <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>v{doc.version}</td>
                  <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{formatBytes(doc.sizeBytes)}</td>
                  <td style={{ padding: '11px 14px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.78rem' }} title={doc.sha256}>{shortHash(doc.sha256, 8)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <Badge tone={doc.isCurrent ? 'success' : 'neutral'}>{doc.isCurrent ? 'Current' : 'Superseded'}</Badge>
                      {verification[doc.id] && (
                        <Badge tone={verification[doc.id].matches ? 'success' : 'danger'}>
                          {verification[doc.id].matches ? 'Digest matches' : 'Digest mismatch'}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <Button variant="secondary" onClick={() => verify(doc.id)}><ShieldCheck size={13} /> Verify</Button>
                      <Button variant="ghost" onClick={() => download(doc.id)}><Download size={13} /> Download</Button>
                    </div>
                  </td>
                </tr>
              )}
            />
          )}
          {verification && Object.values(verification).some((item) => !item.matches) && (
            <Notice tone="error" style={{ marginTop: '0.8rem' }}>
              <FileCheck2 size={14} /> At least one stored file does not match its recorded SHA-256 digest. Treat the document as compromised and investigate.
            </Notice>
          )}
        </Card>
      )}

      {!targetId && (
        <Card><EmptyState>Select a parcel or registration application to view its documents.</EmptyState></Card>
      )}
    </div>
  );
}
