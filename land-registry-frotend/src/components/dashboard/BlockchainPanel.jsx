import { useState } from 'react';
import { Link2, RefreshCw, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client.js';
import { Badge, Button, Card, EmptyState, Field, Notice, Spinner, StatusBadge, Table, formatDate, inputStyle, shortHash } from '../ui.jsx';
import { useResource } from './useResource.js';

function Count({ label, value, tone }) {
  return (
    <div style={{ background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 12px' }}>
      <div style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ color: tone || '#fff', fontSize: '1.4rem', fontWeight: 800 }}>{value}</div>
    </div>
  );
}

export default function BlockchainPanel({ user }) {
  const isAdmin = user?.role === 'administrator';
  const canVerify = ['administrator', 'registrar', 'auditor'].includes(user?.role);
  const [version, setVersion] = useState(0);
  const [parcelNumber, setParcelNumber] = useState('');
  const [verification, setVerification] = useState(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const statusResource = useResource(
    () => api.blockchainStatus(),
    `${user?.id}:status:${version}`,
    { enabled: Boolean(user && isAdmin) }
  );
  const transactionsResource = useResource(
    () => api.listBlockchainTransactions({ status: statusFilter || undefined, limit: 50 }),
    `${user?.id}:tx:${version}:${statusFilter}`,
    { enabled: Boolean(user && isAdmin) }
  );
  const status = statusResource.data?.data;
  const transactions = transactionsResource.data?.data || [];

  const refresh = async () => {
    setVersion((value) => value + 1);
    if (isAdmin) {
      await statusResource.reload();
      await transactionsResource.reload();
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    const query = parcelNumber.trim().toUpperCase();
    if (!query) return;
    setVerifyBusy(true);
    setError(null);
    setVerification(null);
    try {
      const { data } = await api.verifyParcelOnChain(query);
      setVerification(data);
    } catch (err) {
      setError(err.message || 'Unable to verify parcel on chain.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const retry = async (id) => {
    setError(null);
    setNotice(null);
    try {
      await api.retryBlockchainTransaction(id);
      setNotice(`Transaction #${id} was queued for retry. The worker will re-check on-chain state before submitting.`);
      await refresh();
    } catch (err) {
      setError(err.message || 'Unable to retry transaction.');
    }
  };

  const toneFor = (value, successValue = 'MATCH') => {
    if (value === successValue) return 'success';
    if (value === 'MISMATCH' || value === 'BLOCKCHAIN_FAILED') return 'danger';
    if (value === 'NOT_AVAILABLE' || value === 'BLOCKCHAIN_PENDING') return 'warning';
    return 'neutral';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Notice tone="info">
        Database approvals and on-chain confirmation are separate states. Legal ownership is established by the authorized registry process in MariaDB. Blockchain only records and verifies that an approved registry event was immutably anchored — it never establishes or reverses legal ownership.
      </Notice>

      {canVerify && (
        <Card title="Verify a parcel on chain" subtitle="Shows official registry ownership (database — authoritative) alongside blockchain anchoring evidence (transaction reference + document digest). Blockchain confirmation is not legal proof of ownership.">
          <form onSubmit={verify} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, flex: '1 1 240px' }} value={parcelNumber} onChange={(event) => setParcelNumber(event.target.value)} placeholder="Parcel number" aria-label="Parcel number" />
            <Button type="submit" disabled={verifyBusy}><Search size={14} /> {verifyBusy ? 'Reading chain…' : 'Verify on chain'}</Button>
          </form>
          {error && <Notice tone="error" style={{ marginTop: '0.8rem' }}>{error}</Notice>}
          {verification && (
            <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {/* Verification status summary */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <Badge tone={toneFor(verification.verification.registryApprovalStatus, 'REGISTRY_APPROVED')}>Registry: {verification.verification.registryApprovalStatus}</Badge>
                <Badge tone={toneFor(verification.verification.blockchainStatus, 'BLOCKCHAIN_CONFIRMED')}>Blockchain: {verification.verification.blockchainStatus}</Badge>
                <Badge tone={toneFor(verification.verification.documentHashStatus)}>Document: {verification.verification.documentHashStatus}</Badge>
                <Badge tone={toneFor(verification.verification.eventReferenceStatus)}>Event ref: {verification.verification.eventReferenceStatus}</Badge>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.8rem' }}>
                {/* A. Official registry information (authoritative) */}
                <div style={{ background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ color: '#38bdf8', fontSize: '0.75rem', marginBottom: '4px', textTransform: 'uppercase' }}>Official registry (database — authoritative)</div>
                  {verification.registry ? (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', marginBottom: '3px' }}>
                        Owner: <span style={{ fontWeight: 600 }}>{verification.registry.owner?.fullName || 'Not assigned'}</span>
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: '3px' }}>
                        Email: {verification.registry.owner?.email || '—'}
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: '3px' }}>
                        Status: <StatusBadge status={verification.registry.status} />
                      </div>
                      {verification.registry.latestRegistration && (
                        <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: '3px' }}>
                          Latest registration: approved by {verification.registry.latestRegistration.reviewedBy?.fullName || '—'} on {formatDate(new Date(verification.registry.latestRegistration.reviewedAt))}
                        </div>
                      )}
                      {verification.registry.latestTransfer && (
                        <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: '3px' }}>
                          Latest transfer: approved by {verification.registry.latestTransfer.reviewedBy?.fullName || '—'} on {formatDate(new Date(verification.registry.latestTransfer.reviewedAt))}
                        </div>
                      )}
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
                        Document: {verification.registry.document?.originalName || 'None'}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>Parcel not found in the official registry database.</div>
                  )}
                </div>

                {/* B. Blockchain verification (evidence only) */}
                <div style={{ background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '4px', textTransform: 'uppercase' }}>Blockchain anchoring (evidence only — not legal title)</div>
                  {verification.blockchain?.onChain ? (
                    <>
                      <div style={{ color: '#f8fafc', fontSize: '0.85rem', marginBottom: '3px' }}>
                        Transaction reference: <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortHash(verification.blockchain.onChain.transactionReference || verification.blockchain.onChain.parcelReference, 6)}</span>
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: '3px' }}>
                        Status: <StatusBadge status={verification.blockchain.onChain.status} />
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: '3px' }}>
                        Document digest: <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortHash(verification.blockchain.onChain.documentHash || '', 8)}</span>
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: '3px' }}>
                        Blockchain status: {verification.blockchain.status}
                      </div>
                      {verification.blockchain.transactionHash && (
                        <div style={{ color: '#38bdf8', fontSize: '0.8rem', marginBottom: '3px' }}>
                          Tx hash: <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortHash(verification.blockchain.transactionHash, 6)}</span>
                        </div>
                      )}
                      {verification.blockchain.confirmedAt && (
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '3px' }}>
                          Confirmed: {formatDate(new Date(verification.blockchain.confirmedAt))}
                        </div>
                      )}
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
                        Not legal proof of ownership
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>No on-chain record found.</div>
                  )}
                </div>
              </div>

              {verification.verification.note && (
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '4px' }}>
                  {verification.verification.note}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {isAdmin && (
        <Card
          title="Blockchain integration"
          subtitle="Outbox status and worker transactions."
          actions={<Button variant="secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</Button>}
        >
          {statusResource.loading ? <Spinner label="Loading blockchain status…" /> : statusResource.error ? <Notice tone="error">{statusResource.error}</Notice> : status && (
            <>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                <Badge tone={status.configured ? 'success' : 'warning'}>{status.configured ? 'Live anchoring configured' : 'Live anchoring not configured'}</Badge>
                <Badge tone={status.rpcConfigured ? 'success' : 'neutral'}>RPC {status.rpcConfigured ? 'set' : 'missing'}</Badge>
                <Badge tone={status.contractConfigured ? 'success' : 'neutral'}>Contract {status.contractConfigured ? 'set' : 'missing'}</Badge>
                <Badge tone={status.signerConfigured ? 'success' : 'neutral'}>Signer {status.signerConfigured ? 'set' : 'missing'}</Badge>
                {status.chainId && <Badge tone="info">chain {status.chainId}</Badge>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.6rem', marginBottom: '0.9rem' }}>
                <Count label="Pending" value={status.counts.pending} tone="#fbbf24" />
                <Count label="Submitted" value={status.counts.submitted} tone="#38bdf8" />
                <Count label="Confirmed" value={status.counts.confirmed} tone="#4ade80" />
                <Count label="Failed" value={status.counts.failed} tone="#f87171" />
              </div>
              {status.lastFailure && (
                <Notice tone="warning" style={{ marginBottom: '0.9rem' }}>
                  Last failure: {status.lastFailure.entityType}:{status.lastFailure.action} #{status.lastFailure.entityId} — {status.lastFailure.lastError}
                </Notice>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.7rem', flexWrap: 'wrap' }}>
            <Field label="Filter by status" style={{ margin: 0 }}>
              <select style={{ ...inputStyle, width: 'auto' }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All</option>
                <option value="pending">pending</option>
                <option value="submitted">submitted</option>
                <option value="confirmed">confirmed</option>
                <option value="failed">failed</option>
              </select>
            </Field>
            {notice && <Notice tone="success">{notice}</Notice>}
          </div>

          {transactionsResource.loading ? <Spinner label="Loading transactions…" /> : transactionsResource.error ? <Notice tone="error">{transactionsResource.error}</Notice> : (
            <Table
              columns={['Outbox event', 'Status', 'Attempts', 'Tx hash', 'Block', 'Updated', 'Actions']}
              rows={transactions}
              empty="No blockchain outbox events yet."
              renderRow={(tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.8rem' }}>{tx.entityType}:{tx.action}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>#{tx.id} · domain #{tx.entityId}</div>
                    {tx.lastError && <div style={{ color: '#fca5a5', fontSize: '0.72rem', marginTop: '3px', maxWidth: '260px' }}>{tx.lastError}</div>}
                  </td>
                  <td style={{ padding: '11px 14px' }}><StatusBadge status={tx.status} /></td>
                  <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{tx.attempts}</td>
                  <td style={{ padding: '11px 14px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.76rem' }} title={tx.txHash || ''}>{tx.txHash ? shortHash(tx.txHash, 6) : '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{tx.blockNumber ?? '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: '0.76rem' }}>{formatDate(tx.updatedAt)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {tx.status !== 'confirmed' ? (
                      <Button variant="secondary" onClick={() => retry(tx.id)}><RotateCcw size={13} /> Retry</Button>
                    ) : (
                      <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}><ShieldCheck size={14} /> Confirmed</span>
                    )}
                  </td>
                </tr>
              )}
            />
          )}
          <div style={{ marginTop: '0.8rem', color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link2 size={14} /> Retry resets the retry budget; the worker re-checks on-chain state before sending anything.
          </div>
        </Card>
      )}

      {!isAdmin && !canVerify && (
        <Card><EmptyState>Your role does not have blockchain verification access.</EmptyState></Card>
      )}
    </div>
  );
}
