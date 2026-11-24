'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import StarRating from '@/components/feedback/StarRating';
import VoiceInput from '@/components/feedback/VoiceInput';
import { submitLabFeedback } from '@/app/patient/lab-actions';

/** Rate one lab test: test experience + hospital service, optional comment (typed or voice). */
export default function LabFeedbackModal({
  orderId,
  testName,
  onClose,
  onDone,
}: {
  orderId: string;
  testName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [testRating, setTestRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [comment, setComment] = useState('');
  const [inputMethod, setInputMethod] = useState<'typed' | 'voice'>('typed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = testRating > 0 && serviceRating > 0 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const res = await submitLabFeedback({ labOrderId: orderId, testRating, serviceRating, comment, inputMethod });
    setBusy(false);
    if (!res.success) {
      setError(res.error || 'Could not save your feedback.');
      return;
    }
    onDone();
  };

  return createPortal(
    <div
      className="modal d-block"
      role="dialog"
      aria-modal="true"
      aria-label={`Rate ${testName}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 99999, overflowY: 'auto' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered my-4" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content border-0 shadow-lg rounded-3">
          <form onSubmit={submit}>
            <div className="modal-header text-white" style={{ backgroundColor: '#1B2978' }}>
              <h5 className="modal-title text-white m-0">Rate your test: {testName}</h5>
              <button type="button" className="btn-close btn-close-white" disabled={busy} onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body p-4 bg-white">
              {error && <div className="alert alert-danger py-2 small">{error}</div>}

              <div className="mb-4">
                <label className="form-label fw-bold mb-1">Test experience <span className="text-danger">*</span></label>
                <div className="small text-muted mb-2">How was the sample collection and the test process?</div>
                <StarRating value={testRating} onChange={setTestRating} disabled={busy} />
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold mb-1">Hospital service <span className="text-danger">*</span></label>
                <div className="small text-muted mb-2">How was the lab counter, the staff, and the waiting time?</div>
                <StarRating value={serviceRating} onChange={setServiceRating} disabled={busy} />
              </div>

              <div className="mb-2">
                <label className="form-label fw-bold mb-1">Comments <span className="text-muted fw-normal">(optional)</span></label>
                <textarea
                  className="form-control"
                  rows={3}
                  maxLength={2000}
                  placeholder="Tell us about your test experience or the staff."
                  value={comment}
                  disabled={busy}
                  onChange={(e) => {
                    setComment(e.target.value);
                    setInputMethod('typed');
                  }}
                />
                <div className="mt-2">
                  <VoiceInput
                    disabled={busy}
                    onText={(text) => {
                      setComment((prev) => (prev ? `${prev} ${text}` : text).slice(0, 2000));
                      setInputMethod('voice');
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer bg-light d-flex justify-content-between">
              <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success fw-bold px-4" disabled={!canSubmit}>
                {busy ? 'Submitting…' : 'Submit feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
