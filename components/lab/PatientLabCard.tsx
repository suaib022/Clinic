'use client';
import { useEffect, useState } from 'react';
import type { MyLabPlace, MyLabReport } from '@/lib/lab/myLab';

/** Patient dashboard: where I am in the lab lines and which reports are ready. Refreshes every 30 s. */
export default function PatientLabCard({ initial }: { initial: { places: MyLabPlace[]; reports: MyLabReport[] } }) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/lab/my-status', { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch { /* keep the last data */ }
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  const waiting = data.places.filter((p) => p.status !== 'collected');
  const ready = data.reports.filter((r) => r.status === 'report_ready');
  const pending = data.reports.filter((r) => r.status === 'collected');
  if (!waiting.length && !ready.length && !pending.length) return null;
  return (
    <div className="card border-0 shadow-sm p-3 mb-3" data-testid="patient-lab-card" aria-live="polite">
      <h5 className="mb-2"><i className="bi bi-droplet me-2" aria-hidden="true" />Lab</h5>
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
      {ready.length > 0 && <div className="border-top py-2 small"><span className="badge bg-success me-1">Ready</span>{ready.map((r) => `${r.test} (${r.patientName})`).join(', ')}</div>}
      {pending.length > 0 && <div className="border-top py-2 small text-muted">Waiting for report: {pending.map((r) => r.test).join(', ')}</div>}
    </div>
  );
}
