import { useEffect, useState } from 'react';
import { Button, Field, Modal, Notice, inputStyle } from '../ui.jsx';

export default function ReviewModal({ open, title, decision, onClose, onSubmit }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setNotes('');
      setError(null);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ decision, notes: notes.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err.message || 'Review failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <Notice tone={decision === 'approve' ? 'success' : 'warning'}>
          You are about to {decision === 'approve' ? 'approve' : 'reject'} this request. The decision is recorded in the audit log.
        </Notice>
        <Field label="Decision notes (optional)">
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Reason or instructions for the applicant"
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={decision === 'approve' ? 'success' : 'danger'} onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : decision === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
