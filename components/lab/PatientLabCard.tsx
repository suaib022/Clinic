'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MyLabPlace, MyLabReport } from '@/lib/lab/myLab';
import { patientEnterFollowUp } from '@/lib/lab/followUpActions';

/** Patient dashboard: where I am in the lab lines and which reports are ready. Refreshes every 30 s. */
export default function PatientLabCard({ initial }: { initial: { places: MyLabPlace[]; reports: MyLabReport[] } }) {
  const [data, setData] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/lab/my-status', { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch { /* keep the last data */ }
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const handleFollowUp = (appointmentId: string) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await patientEnterFollowUp(appointmentId);
        if (res.ok) {
          setMessage({ type: 'success', text: res.message || 'Follow-up consultation entered successfully!' });
          router.refresh();
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to enter follow-up queue.' });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Something went wrong.' });
      }
    });
  };

  const waiting = data.places.filter((p) => p.status !== 'collected');
  const ready = data.reports.filter((r) => r.status === 'report_ready');
  const pending = data.reports.filter((r) => r.status === 'collected');
  if (!waiting.length && !ready.length && !pending.length && !message) return null;

  return (
    <div className="card border-0 shadow-sm p-3 mb-3" data-testid="patient-lab-card" aria-live="polite">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="mb-0"><i className="bi bi-droplet me-2 text-danger" aria-hidden="true" />Diagnostic Laboratory</h5>
        {ready.length > 0 && <span className="badge bg-success-subtle text-success border border-success-subtle">{ready.length} Report{ready.length > 1 ? 's' : ''} Ready</span>}
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show py-2 mb-2`} role="alert">
          {message.type === 'success' ? <i className="bi bi-check-circle-fill me-2" /> : <i className="bi bi-exclamation-triangle-fill me-2" />}
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage(null)} aria-label="Close" />
        </div>
      )}

      {/* Actionable Report Ready Cards with Follow-up Option */}
      {ready.map((r) => (
        <div key={r.orderId} className="border rounded-3 p-3 my-2 bg-success bg-opacity-10 border-success-subtle d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="badge bg-success fw-bold">Report Ready</span>
              <strong className="text-dark">{r.test}</strong>
              <span className="small text-muted">({r.patientName})</span>
            </div>
            <div className="small text-secondary mt-1">
              Your test report has been verified by the lab{r.doctorName ? ` for Dr. ${r.doctorName}` : ''}. You can now enter the chamber queue for a follow-up consultation with your report.
            </div>
          </div>
          {r.appointmentId && (
            <button
              type="button"
              className="btn btn-sm text-white fw-bold px-3 py-1.5 shadow-sm text-nowrap align-self-start align-self-md-center"
              style={{ backgroundColor: '#0D7D72', borderColor: '#0D7D72' }}
              disabled={isPending}
              onClick={() => handleFollowUp(r.appointmentId!)}
            >
              {isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                  Joining Queue…
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right me-1" />
                  Enter Follow-up with Report
                </>
              )}
            </button>
          )}
        </div>
      ))}

      {/* Lab Queue Waiting Line status */}
      {waiting.map((p) => (
        <div key={p.itemId} className="border-top py-2">
          <div className="fw-semibold">{p.lineName} <span className="small text-muted">· {p.patientName}</span></div>
          <div className="small">{p.tests.join(', ')}</div>
          <div className="small">
            {p.status === 'called' ? <strong className="text-success">Please go to the counter now.</strong>
              : p.skipped ? <span className="text-warning">You were called but not found. Please tell the lab desk you are here.</span>
                : !p.counterOpen ? <>Place {p.position ?? '—'} · the counter is not open yet</>
                : <>Place {p.position ?? '—'} · about {p.waitMinLow ?? '—'}{p.waitMinHigh != null && p.waitMinHigh !== p.waitMinLow ? `–${p.waitMinHigh}` : ''} min</>}
          </div>
        </div>
      ))}

      {pending.length > 0 && (
        <div className="border-top py-2 small text-muted">
          <i className="bi bi-hourglass-split me-1" />
          Sample collected, waiting for report: <strong>{pending.map((r) => r.test).join(', ')}</strong>
        </div>
      )}
    </div>
  );
}
