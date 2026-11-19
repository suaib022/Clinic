'use client';
import { useState } from 'react';
import type { StaffSnapshot } from '@/lib/queue/server';
import type { DoctorLabVisit } from '@/lib/lab/doctorLab';
import { labAction, listTestTypes, type TestType } from '@/lib/lab/actions';
import { fmtTime } from '@/lib/queue/display';
import { tealBtn } from './Panels';

const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const STATUS_TEXT: Record<string, string> = {
  ordered: 'Not sent', queued: 'In lab queue', collected: 'Sample taken', report_ready: 'Report ready', cancelled: 'Cancelled',
};

/** Doctor or compounder: order tests for the patient in the room. */
export function OrderTestsPanel({ snap, say }: { snap: StaffSnapshot; say: (kind: 'ok' | 'warn' | 'err', text: string) => void }) {
  const current = snap.result.nowServing;
  const [open, setOpen] = useState(false);
  const [tests, setTests] = useState<TestType[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!current) return null;
  const already = snap.lab.find((v) => v.appointmentId === current.appointmentId)?.tests ?? [];
  const toggle = async () => {
    if (!open && !tests) setTests(await listTestTypes());
    setOpen((o) => !o);
  };
  const order = async () => {
    setBusy(true);
    const r = await labAction({ kind: 'order_tests', appointmentId: current.appointmentId, testTypeIds: chosen, requestKey: newKey() });
    setBusy(false);
    say(r.ok ? 'ok' : 'warn', r.message);
    if (r.ok) { setChosen([]); setOpen(false); }
  };
  return (
    <div className="card border-0 shadow-sm p-3 mb-3" data-testid="order-tests">
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <i className="bi bi-droplet text-primary" aria-hidden="true" />
        <span className="fw-semibold">Lab tests for serial {current.serialNo}</span>
        {already.length > 0 && <span className="small text-muted">Ordered: {already.map((t) => t.name).join(', ')}</span>}
        <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" aria-expanded={open} onClick={() => void toggle()}>{open ? 'Close' : 'Order tests'}</button>
      </div>
      {open && (
        <div className="mt-2">
          {!tests ? <div className="small text-muted">Loading tests…</div> : (
            <div className="row row-cols-1 row-cols-sm-2 g-1">
              {tests.map((t) => (
                <div key={t.id} className="col form-check ps-4">
                  <input id={`ot-${t.id}`} type="checkbox" className="form-check-input" checked={chosen.includes(t.id)}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, t.id] : c.filter((x) => x !== t.id)))} />
                  <label htmlFor={`ot-${t.id}`} className="form-check-label small">{t.name}{t.must_first ? ' (fasting)' : ''}</label>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-sm mt-2" style={tealBtn} disabled={busy || chosen.length === 0} onClick={() => void order()}>
            Order {chosen.length || ''} test{chosen.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Compounder: after a visit with tests, "Lab now" or "Later"; when a report is ready, the engine's return advice:
 * a same-day report review (expected time) or a later visit. Nothing happens without a tap.
 */
export function LabFollowUpPanel({ snap, busy, onLabNow, onLater, onReview, onBookLater }: {
  snap: StaffSnapshot; busy: boolean;
  onLabNow: (v: DoctorLabVisit) => void; onLater: (v: DoctorLabVisit) => void;
  onReview: (v: DoctorLabVisit) => void; onBookLater: (v: DoctorLabVisit) => void;
}) {
  const choice = snap.lab.filter((v) => v.showLabChoice);
  const review = snap.lab.filter((v) => v.showReviewOffer);
  const tracking = snap.lab.filter((v) => !v.showLabChoice && !v.showReviewOffer && v.tests.some((t) => t.status !== 'report_ready'));
  if (!choice.length && !review.length && !tracking.length) return null;
  const who = (v: DoctorLabVisit) => `Serial ${v.serialNo}${v.patientName ? ` · ${v.patientName}` : ''}`;
  return (
    <div className="card border-0 shadow-sm p-3 mb-3" data-testid="lab-follow-up">
      <h6 className="text-muted text-uppercase small mb-2"><i className="bi bi-droplet me-1" aria-hidden="true" />Lab</h6>
      {choice.map((v) => (
        <div key={`c-${v.appointmentId}`} className="d-flex flex-wrap align-items-center gap-2 border-top py-2">
          <span className="fw-semibold">{who(v)}</span>
          <span className="small text-muted">{v.tests.filter((t) => t.status === 'ordered').map((t) => t.name).join(', ')}</span>
          <div className="ms-auto d-flex gap-2">
            <button type="button" className="btn btn-sm" style={tealBtn} disabled={busy} onClick={() => onLabNow(v)}>Lab now</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => onLater(v)}>Later</button>
          </div>
        </div>
      ))}
      {review.map((v) => (
        <div key={`r-${v.appointmentId}`} className="border-top py-2">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="fw-semibold">{who(v)}</span>
            <span className="badge bg-success">Report ready</span>
            <div className="ms-auto d-flex gap-2">
              {v.advice?.kind === 'same_day' && (
                <button type="button" className="btn btn-sm" style={tealBtn} disabled={busy} onClick={() => onReview(v)}>Add report review</button>
              )}
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => onBookLater(v)}>Book later</button>
            </div>
          </div>
          <div className="small text-muted mt-1" data-testid={`advice-${v.appointmentId}`}>
            {v.advice?.kind === 'same_day'
              ? <>Can show the report today: expected about <strong>{fmtTime(v.advice.expectedStartAt)}</strong>. Ask the patient.</>
              : v.advice?.reason === 'not_enough_time' ? 'Not enough time left in today’s session. Suggest a later visit.'
                : 'The doctor is not seeing patients now. Suggest a later visit.'}
          </div>
        </div>
      ))}
      {tracking.map((v) => (
        <div key={`t-${v.appointmentId}`} className="d-flex flex-wrap gap-2 border-top py-2 small">
          <span className="fw-semibold">{who(v)}</span>
          {v.tests.map((t) => <span key={t.orderId} className="badge bg-light text-dark border">{t.name}: {STATUS_TEXT[t.status] ?? t.status}</span>)}
        </div>
      ))}
    </div>
  );
}
