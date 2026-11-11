'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { MyQueueStatus } from '@/lib/queue/server';
import { createClient } from '@/lib/supabase/client';
import { subscribeLive } from '@/lib/realtime';
import { fmtTime, LABEL_TEXT, LABEL_CLASS } from '@/lib/queue/display';

const FALLBACK_MS = 15_000; // DSS-84

/**
 * DSS-80..86: a patient's own live queue panel. Uses only /api/queue/my-status, which returns nothing
 * about other patients (their serial, the serial being served, how many are ahead, and this visit's estimate).
 */
export default function PatientLiveQueueCard({ appointmentId, userId }: { appointmentId: string; userId?: string }) {
  const [s, setS] = useState<MyQueueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    try {
      const res = await fetch(`/api/queue/my-status?appointmentId=${appointmentId}`, { signal: c.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 404 ? 'Appointment not found.' : 'Live queue is unavailable right now.');
      setS(await res.json());
      setError(null);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    }
  }, [appointmentId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    // own appointment row and own notifications are visible to the patient (RLS); anything else arrives by polling
    const stop = subscribeLive(createClient(), `my-queue:${appointmentId}`, [
      { table: 'appointments', filter: `id=eq.${appointmentId}` },
      ...(userId ? [{ table: 'notifications', filter: `user_id=eq.${userId}` }] : []),
    ], () => { void load(); }, { fallbackMs: FALLBACK_MS });
    const tick = setInterval(load, FALLBACK_MS * 2);
    return () => { clearTimeout(first); clearInterval(tick); stop(); ctl.current?.abort(); };
  }, [appointmentId, userId, load]);

  const box = 'card border-0 shadow-sm rounded-3 mb-4';
  if (!s) {
    return (
      <div className={box} style={{ minHeight: 120 }} aria-busy={!error}>
        <div className="card-body d-flex align-items-center justify-content-center gap-2 text-muted">
          {error ? <><span className="text-danger">{error}</span><button type="button" className="btn btn-sm" onClick={() => void load()}>Retry</button></>
            : <><span className="spinner-border spinner-border-sm" role="status" />Loading your live queue…</>}
        </div>
      </div>
    );
  }

  const head = (
    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
      <div>
        <div className="small text-muted text-uppercase fw-semibold">Live queue · {s.patientName}</div>
        <div className="fw-semibold">{s.doctorName} · {s.date}</div>
      </div>
      {s.label && <span className={`badge ${LABEL_CLASS[s.label]}`}>{LABEL_TEXT[s.label]}</span>}
    </div>
  );

  let body: React.ReactNode;
  if (s.stage === 'upcoming') {
    body = <p className="mb-0">Your serial is <strong>{s.serialNo}</strong>, booked for {fmtTime(s.bookedAt)}. The live queue opens on the day of your visit.</p>;
  } else if (s.stage === 'cancelled' || s.stage === 'no_show') {
    body = (
      <>
        <p className="mb-2">{s.stage === 'no_show' ? 'You were marked absent for this visit.' : 'This appointment is cancelled.'}</p>
        <Link href="/patient/book" className="btn">Book a new visit</Link>
      </>
    );
  } else if (s.stage === 'done') {
    body = (
      <>
        <p className="mb-2">Your visit is complete. Thank you!</p>
        <div className="d-flex flex-wrap gap-2">
          <Link href="/patient/appointments" className="btn btn-sm">Give feedback</Link>
          <Link href="/patient/records" className="btn btn-sm">My records</Link>
        </div>
      </>
    );
  } else if (s.stage === 'in_room') {
    body = <div className="alert alert-success mb-0 fs-5 fw-semibold" role="status"><i className="bi bi-door-open me-2" aria-hidden="true" />Please go to the doctor now.</div>;
  } else {
    const waiting = s.stage === 'waiting';
    body = (
      <>
        {!waiting && (
          <div className="alert alert-info py-2" role="status">
            Please arrive by <strong>{fmtTime(s.bookedAt)}</strong> and tell the compounder your UHID or serial number.
          </div>
        )}
        {waiting && s.patientsAhead === 0 && <div className="alert alert-warning py-2 fw-semibold" role="status">You are next. Please be ready.</div>}
        <dl className="row g-2 text-center mb-2">
          {[
            ['My serial', s.serialNo],
            ['Now serving', s.nowServingSerial ?? '—'],
            ['Ahead of me', s.patientsAhead ?? '—'],
            ['Estimated wait', s.waitMinLow == null ? (waiting ? '—' : 'After check-in') : s.waitMinHigh === 0 ? 'Any minute' : `${s.waitMinLow}–${s.waitMinHigh} min`],
          ].map(([k, v]) => (
            <div key={k} className="col-6 col-md-3">
              <div className="bg-light rounded-3 py-2 h-100">
                <dt className="small text-muted fw-normal">{k}</dt>
                <dd className="fs-4 fw-bold mb-0" style={{ color: '#1B2978' }}>{v}</dd>
              </div>
            </div>
          ))}
        </dl>
        <div className="small">
          Booked {fmtTime(s.bookedAt)} · Expected {fmtTime(s.expectedStartAt)}
          {s.confidence === 'low' && <span className="text-muted"> (rough estimate)</span>}
        </div>
        {s.reason && <div className="small text-muted mt-1"><i className="bi bi-info-circle me-1" aria-hidden="true" />{s.reason}. Estimates can change.</div>}
      </>
    );
  }

  return (
    <div className={box} style={{ borderLeft: '4px solid #1B2978' }} aria-live="polite">
      <div className="card-body p-3 p-md-4">
        {head}
        {body}
        <div className="small text-muted mt-2 text-end">Updated {fmtTime(s.lastUpdated)}</div>
      </div>
    </div>
  );
}
