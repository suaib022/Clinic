import { fmtTime } from '@/lib/queue/display';
import type { Comparison } from '@/lib/flowlab/compare';

const range = (lo: number | null, hi: number | null) => (lo == null || hi == null ? '' : `${fmtTime(lo)}–${fmtTime(hi)}`);
const STAGE: Record<string, string> = { in_room: 'In room', waiting: 'Waiting', not_arrived: 'Not arrived', skipped: 'Skipped' };

/** One doctor's queue today: the DSS-rule estimate and the full-engine estimate side by side. */
export default function LiveCompare({ c, doctorName }: { c: Comparison; doctorName: string | null }) {
  const active = c.rows.filter((r) => r.stage !== 'in_room');
  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4"><div className="card border-0 shadow-sm h-100"><div className="card-body">
          <div className="small text-muted">Live screens use</div>
          <div className="h5 mb-0" data-testid="live-mode">{c.liveMode === 'full' ? 'Full engine' : 'DSS rules'}</div>
          <div className="small text-muted">Change in Queue Settings</div>
        </div></div></div>
        <div className="col-6 col-md-4"><div className="card border-0 shadow-sm h-100"><div className="card-body">
          <div className="small text-muted">Mean shown range, DSS rules</div>
          <div className="h5 mb-0">{c.meanRangeMin.dss == null ? '—' : `${c.meanRangeMin.dss} min`}</div>
        </div></div></div>
        <div className="col-6 col-md-4"><div className="card border-0 shadow-sm h-100"><div className="card-body">
          <div className="small text-muted">Mean shown range, full engine</div>
          <div className="h5 mb-0">{c.meanRangeMin.full == null ? '—' : `${c.meanRangeMin.full} min`}</div>
        </div></div></div>
      </div>
      <div className="table-responsive card border-0 shadow-sm">
        <table className="table align-middle mb-0">
          <thead><tr>
            <th>#</th><th>Patient</th><th>State</th><th className="text-end">Ahead</th><th>Booked</th>
            <th>DSS rules: start (range)</th><th>Full engine: start (range)</th><th className="text-end">Shift</th>
          </tr></thead>
          <tbody>
            {c.rows.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-4">
              No active patients for {doctorName ?? 'this doctor'} today. Check a patient in to see the estimates move.</td></tr>}
            {c.rows.map((r) => (
              <tr key={r.appointmentId}>
                <td className="fw-semibold">{r.serialNo}</td>
                <td>{r.patientName ?? '—'}</td>
                <td><span className="badge text-bg-light border">{STAGE[r.stage] ?? r.stage}</span></td>
                <td className="text-end">{r.patientsAhead ?? '—'}</td>
                <td>{fmtTime(r.bookedAt)}</td>
                <td>{r.stage === 'in_room' ? 'with doctor' : <>{fmtTime(r.dss.expectedStartAt)} <span className="text-muted small">{range(r.dss.lowAt, r.dss.highAt)}</span></>}</td>
                <td>{r.stage === 'in_room' ? 'with doctor' : <>{fmtTime(r.full.expectedStartAt)} <span className="text-muted small">{range(r.full.lowAt, r.full.highAt)}</span></>}</td>
                <td className={`text-end ${r.shiftMin ? 'fw-bold' : 'text-muted'}`}>{r.shiftMin == null || r.stage === 'in_room' ? '—' : `${r.shiftMin > 0 ? '+' : ''}${r.shiftMin} min`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small text-muted mt-2">
        {active.length} patient{active.length === 1 ? '' : 's'} still to be seen. The full engine also counts booked patients who have not arrived yet
        and walk-ins, uses mean visit lengths, and builds the range so that about 80% of real start times fall inside it.
        Its settings here are the values from the HospitalOPD-calibrated evaluation, not this clinic&apos;s own. Refreshes every 15 seconds.
      </p>
    </div>
  );
}
