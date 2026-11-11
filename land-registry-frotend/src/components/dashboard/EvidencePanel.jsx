import { useState } from 'react';
import { ClipboardList, Eye, FileText, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../../api/client.js';
import { Badge, Button, Card, EmptyState, Field, Modal, Notice, Spinner, StatusBadge, Table, formatDate, inputStyle } from '../ui.jsx';
import { useResource } from './useResource.js';

const emptyForm = { parcelId: '', description: '' };
const emptyFinding = { caseId: '', title: '', description: '', finding: '', riskLevel: 'medium', status: 'open', parcelId: '' };

export default function EvidencePanel({ user }) {
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [custody, setCustody] = useState(null);
  const [custodyForm, setCustodyForm] = useState({ action: '', notes: '', status: '' });
  const [trail, setTrail] = useState(null);
  const [trailLoading, setTrailLoading] = useState(false);
  const [findingForm, setFindingForm] = useState({ ...emptyFinding });
  const [findingEvidenceId, setFindingEvidenceId] = useState('');
  const [findingBusy, setFindingBusy] = useState(false);
  const [findingError, setFindingError] = useState(null);
  const [findingNotice, setFindingNotice] = useState(null);

  const findingsResource = useResource(
    () => api.listForensicFindings({ limit: 100 }),
    `${user?.id}:findings`,
    { enabled: Boolean(user) }
  );
  const findings = findingsResource.data?.data || [];

  const evidenceResource = useResource(
    () => api.listEvidence(),
    `${user?.id}:${version}`,
    { enabled: Boolean(user) }
  );
  const parcelsResource = useResource(
    () => api.listParcels({ limit: 100 }),
    `${user?.id}:evidence-parcels`,
    { enabled: Boolean(user) }
  );
  const evidence = evidenceResource.data?.data || [];
  const parcels = parcelsResource.data?.data || [];

  const refresh = async () => {
    setVersion((value) => value + 1);
    await evidenceResource.reload();
  };

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.createEvidence({
        description: form.description,
        parcelId: form.parcelId || undefined,
      });
      setForm(emptyForm);
      setNotice('Evidence record created with a custody reference.');
      await refresh();
    } catch (err) {
      setError(err.message || 'Unable to create evidence record.');
    } finally {
      setBusy(false);
    }
  };

  const addCustody = async () => {
    if (!custody) return;
    setBusy(true);
    setError(null);
    try {
      await api.addEvidenceCustody(custody.id, {
        action: custodyForm.action,
        notes: custodyForm.notes || undefined,
        status: custodyForm.status || undefined,
      });
      setCustody(null);
      setCustodyForm({ action: '', notes: '', status: '' });
      setNotice('Custody event recorded.');
      await refresh();
    } catch (err) {
      setError(err.message || 'Unable to record custody event.');
    } finally {
      setBusy(false);
    }
  };

  const createForensicFinding = async (event) => {
    event.preventDefault();
    setFindingBusy(true);
    setFindingError(null);
    setFindingNotice(null);
    try {
      const payload = {
        caseId: findingForm.caseId.trim(),
        title: findingForm.title.trim(),
        description: findingForm.description.trim() || null,
        finding: findingForm.finding.trim(),
        riskLevel: findingForm.riskLevel,
        status: findingForm.status,
        parcelId: findingForm.parcelId.trim() || undefined,
      };
      if (!findingEvidenceId) throw new Error('Please select the related evidence item.');
      await api.createForensicFinding(findingEvidenceId, payload);
      setFindingForm({ ...emptyFinding });
      setFindingEvidenceId('');
      setFindingNotice('Forensic finding recorded.');
      await findingsResource.reload();
    } catch (err) {
      setFindingError(err.message || 'Unable to record forensic finding.');
    } finally {
      setFindingBusy(false);
    }
  };

  const openTrail = async (id) => {
    setTrail({ id });
    setTrailLoading(true);
    setError(null);
    try {
      const { data } = await api.getEvidence(id);
      setTrail(data);
    } catch (err) {
      setError(err.message || 'Unable to load custody trail.');
      setTrail(null);
    } finally {
      setTrailLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Card title="Record evidence" subtitle="Create an investigation evidence record and attach it to a parcel when known.">
        <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
          <Field label="Related parcel (optional)">
            <select style={inputStyle} value={form.parcelId} onChange={(event) => setForm({ ...form, parcelId: event.target.value })}>
              <option value="">No parcel</option>
              {parcels.map((parcel) => (
                <option key={parcel.id} value={parcel.id}>{parcel.parcelNumber}</option>
              ))}
            </select>
          </Field>
          <Field label="Description *" style={{ gridColumn: 'span 2' }}>
            <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} required minLength={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the evidence and why it was collected" />
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button type="submit" disabled={busy}><Plus size={14} /> {busy ? 'Saving…' : 'Create record'}</Button>
          </div>
        </form>
        {error && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{error}</Notice>}
        {notice && <Notice tone="success" style={{ marginTop: '0.8rem' }}>{notice}</Notice>}
      </Card>

      <Card title="Evidence custody register" subtitle="Every custody event is appended to the evidence history." actions={<Button variant="secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</Button>}>
        {evidenceResource.loading ? <Spinner label="Loading evidence…" /> : evidenceResource.error ? <Notice tone="error">{evidenceResource.error}</Notice> : (
          <Table
            columns={['Custody reference', 'Description', 'Status', 'Collected by', 'Created', 'Actions']}
            rows={evidence}
            empty="No evidence has been recorded yet."
            renderRow={(item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <td style={{ padding: '11px 14px', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.custodyRef}</td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1', maxWidth: '280px' }}>{item.description}</td>
                <td style={{ padding: '11px 14px' }}><StatusBadge status={item.status} /></td>
                <td style={{ padding: '11px 14px', color: '#cbd5e1', fontSize: '0.82rem' }}>{item.collector?.fullName || '—'}</td>
                <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '0.8rem' }}>{formatDate(item.createdAt)}</td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <Button variant="secondary" onClick={() => openTrail(item.id)}><Eye size={13} /> Trail</Button>
                    <Button variant="ghost" onClick={() => { setCustody(item); setCustodyForm({ action: '', notes: '', status: item.status }); }}><ClipboardList size={13} /> Custody</Button>
                  </div>
                </td>
              </tr>
            )}
          />
        )}
      </Card>

      <Card title="Forensic findings" subtitle="Record the actual forensic conclusions for an evidence item. Findings are linked to evidence and a case reference.">
        {findingsResource.loading ? (
          <Spinner label="Loading forensic findings…" />
        ) : findingsResource.error ? (
          <Notice tone="error">{findingsResource.error}</Notice>
        ) : (
          <>
            <form onSubmit={createForensicFinding} style={{ marginBottom: '1rem', background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
              <Field label="Related evidence *">
                <select style={inputStyle} required value={findingEvidenceId} onChange={(event) => setFindingEvidenceId(event.target.value)}>
                  <option value="">Select evidence</option>
                  {evidence.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.custodyRef} — {item.description}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Case reference *">
                <input style={inputStyle} required value={findingForm.caseId} onChange={(event) => setFindingForm({ ...findingForm, caseId: event.target.value })} placeholder="CASE-2026-001" />
              </Field>
              <Field label="Title *">
                <input style={inputStyle} required value={findingForm.title} onChange={(event) => setFindingForm({ ...findingForm, title: event.target.value })} />
              </Field>
              <Field label="Risk level">
                <select style={inputStyle} value={findingForm.riskLevel} onChange={(event) => setFindingForm({ ...findingForm, riskLevel: event.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
              <Field label="Finding *">
                <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} required value={findingForm.finding} onChange={(event) => setFindingForm({ ...findingForm, finding: event.target.value })} placeholder="Describe the forensic finding and conclusion" />
              </Field>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <Button type="submit" disabled={findingBusy || !findingEvidenceId}><FileText size={14} /> {findingBusy ? 'Recording…' : 'Record finding'}</Button>
                <Button variant="ghost" onClick={() => setFindingForm({ ...emptyFinding })} disabled={findingBusy}>Cancel</Button>
              </div>
            </form>
            {findingError && <Notice tone="error" style={{ marginBottom: '0.8rem' }}>{findingError}</Notice>}
            {findingNotice && <Notice tone="success" style={{ marginBottom: '0.8rem' }}>{findingNotice}</Notice>}
            <Table
              columns={['Case', 'Title', 'Risk', 'Status', 'Recorded by', 'Created', 'Evidence']}
              rows={findings}
              empty="No forensic findings have been recorded yet."
              renderRow={(finding) => (
                <tr key={finding.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.8rem' }}>{finding.caseId}</td>
                  <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{finding.title}</td>
                  <td style={{ padding: '11px 14px' }}><Badge tone={finding.riskLevel === 'critical' ? 'danger' : finding.riskLevel === 'high' ? 'warning' : finding.riskLevel === 'medium' ? 'warning' : 'neutral'}>{finding.riskLevel}</Badge></td>
                  <td style={{ padding: '11px 14px' }}><StatusBadge status={finding.status} /></td>
                  <td style={{ padding: '11px 14px', color: '#cbd5e1', fontSize: '0.82rem' }}>{finding.recorder?.fullName || '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '0.8rem' }}>{formatDate(finding.createdAt)}</td>
                  <td style={{ padding: '11px 14px', color: '#cbd5e1', fontSize: '0.82rem' }}>{finding.evidence?.custodyRef || '—'}</td>
                </tr>
              )}
            />
          </>
        )}
      </Card>

      <Modal open={Boolean(custody)} title={`Custody event · ${custody?.custodyRef || ''}`} onClose={() => setCustody(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <Field label="Action *" hint="For example: checked out, transferred, analyzed, returned.">
            <input style={inputStyle} value={custodyForm.action} onChange={(event) => setCustodyForm({ ...custodyForm, action: event.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={custodyForm.notes} onChange={(event) => setCustodyForm({ ...custodyForm, notes: event.target.value })} />
          </Field>
          <Field label="New evidence status (optional)">
            <select style={inputStyle} value={custodyForm.status} onChange={(event) => setCustodyForm({ ...custodyForm, status: event.target.value })}>
              <option value="">Leave unchanged</option>
              <option value="collected">collected</option>
              <option value="in_custody">in_custody</option>
              <option value="analyzed">analyzed</option>
              <option value="released">released</option>
            </select>
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setCustody(null)} disabled={busy}>Cancel</Button>
            <Button onClick={addCustody} disabled={busy || !custodyForm.action.trim()}>{busy ? 'Saving…' : 'Record event'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(trail)} title={`Custody trail · ${trail?.custodyRef || ''}`} onClose={() => setTrail(null)} maxWidth="680px">
        {trailLoading ? <Spinner label="Loading custody trail…" /> : trail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <StatusBadge status={trail.status} />
              <Badge tone="neutral">{trail.collector?.fullName || 'Collector unknown'}</Badge>
              {trail.parcelId && <Badge tone="info">Parcel #{trail.parcelId}</Badge>}
            </div>
            <p style={{ margin: 0, color: '#cbd5e1' }}>{trail.description}</p>
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldAlert size={16} /> Events</h4>
              {(trail.custody || []).length === 0 ? <EmptyState>No custody events recorded.</EmptyState> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {trail.custody.map((entry) => (
                    <div key={entry.id} style={{ background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '9px 11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <strong style={{ color: '#38bdf8' }}>{entry.action}</strong>
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{formatDate(entry.createdAt)}</span>
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.84rem', marginTop: '3px' }}>{entry.notes || 'No notes'} · {entry.actor?.fullName || 'Unknown actor'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
