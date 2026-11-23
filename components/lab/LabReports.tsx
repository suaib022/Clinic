'use client';
import { useEffect, useState } from 'react';
import { labAction, labPendingReports, type PendingReport } from '@/lib/lab/actions';
import type { LabLine } from '@/lib/lab/server';
import { fmtTime } from '@/lib/queue/display';
import LabReportUploadModal, { type ReportModalTarget } from './LabReportUploadModal';

const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Lab staff: reports waiting to be marked ready. Marking one ready tells the patient and lets the compounder offer a report review. */
export default function LabReports({ initial, lines }: { initial: PendingReport[]; lines: LabLine[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportModalTarget | null>(null);
  // Clock for "due" marks, ticking from the browser (0 until the first tick: nothing is shown as due on the server render).
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);

  const lineName = (id: string) => lines.find((l) => l.id === id)?.name ?? '';

  const refreshList = async () => {
    const res = await labPendingReports();
    setRows(res.reports);
  };

  const directReady = async (r: ReportModalTarget) => {
    setBusy(r.order_id);
    const res = await labAction({ kind: 'report_ready', orderId: r.order_id, requestKey: newKey() });
    setMsg(res.message);
    await refreshList();
    setBusy(null);
    setActiveReport(null);
  };

  const handleUploadSuccess = async (message: string) => {
    setActiveReport(null);
    setMsg(message);
    await refreshList();
  };

  return (
    <div className="card border-0 shadow-sm p-3">
      {msg && <div role="status" className="alert alert-info py-2">{msg}</div>}
      {rows.length === 0 ? <div className="text-muted">No reports are waiting.</div> : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Test</th>
                <th>Collected</th>
                <th>Expected ready</th>
                <th>Doctor</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const due = now > 0 && Date.parse(r.expected_ready_at) <= now;
                return (
                  <tr key={r.order_id}>
                    <td>
                      <div className="fw-semibold">{r.patient_name}</div>
                      <div className="small text-muted">{r.patient_uhid}</div>
                    </td>
                    <td>
                      {r.test}
                      <div className="small text-muted">{lineName(r.line_id)}</div>
                    </td>
                    <td className="small">{fmtTime(Date.parse(r.collected_at))}</td>
                    <td className={`small ${due ? 'text-danger fw-semibold' : ''}`}>
                      {fmtTime(Date.parse(r.expected_ready_at))}{due ? ' (due)' : ''}
                    </td>
                    <td className="small">{r.doctor ?? 'Outside'}</td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm text-white fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                          style={{ backgroundColor: '#1B2978', borderColor: '#1B2978', borderRadius: 8 }}
                          disabled={busy !== null}
                          onClick={() => setActiveReport(r)}
                        >
                          <i className="bi bi-file-earmark-arrow-up me-1" />
                          Report ready
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lab Report Upload & AI Vision Modal */}
      {activeReport && (
        <LabReportUploadModal
          report={activeReport}
          onClose={() => setActiveReport(null)}
          onSuccess={handleUploadSuccess}
          onDirectReady={() => directReady(activeReport)}
        />
      )}
    </div>
  );
}
