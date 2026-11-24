import type { ProcessMap } from '@/lib/flowlab/processMap';

const NAME: Record<string, string> = {
  book: 'Booked', check_in: 'Checked in', walk_in: 'Walk-in', call: 'Called', consult_start: 'Consultation start', consult_end: 'Consultation end',
  skip: 'Skipped', rejoin: 'Rejoined', no_show: 'No-show', priority_set: 'Priority set', undo: 'Undo',
  session_start: 'Session start', session_pause: 'Session pause', session_resume: 'Session resume', session_end: 'Session end',
};
const label = (a: string) => NAME[a] ?? a;

/** Event-log summary: activity counts, the directly-follows map with typical times, the most common paths, downloads. */
export default function LogView({ map, from, to, rows }: { map: ProcessMap; from: string; to: string; rows: number }) {
  const maxEdge = Math.max(1, ...map.edges.map((e) => e.count));
  const q = `from=${from}&to=${to}`;
  return (
    <div>
      <div className="row g-3 mb-3">
        {[['Log rows read', rows], ['Events in the log', map.events], ['Appointments (cases)', map.cases], ['Different paths', map.variants.length]].map(([t, v]) => (
          <div className="col-6 col-md-3" key={String(t)}><div className="card border-0 shadow-sm h-100"><div className="card-body">
            <div className="small text-muted">{t}</div><div className="h4 mb-0">{v}</div>
          </div></div></div>
        ))}
      </div>
      <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
        <a className="btn btn-primary" href={`/api/admin/flow-log?format=ocel&${q}`}><i className="bi bi-download me-1" aria-hidden="true"></i>Download OCEL 2.0 (.json)</a>
        <a className="btn btn-outline-primary" href={`/api/admin/flow-log?format=xes&${q}`}><i className="bi bi-download me-1" aria-hidden="true"></i>Download XES (.xes)</a>
        <span className="small text-muted">Open in process-mining tools, or with the Python analysis in <code>analysis/</code>. Contains pseudonymous IDs only, no names.</span>
      </div>
      {map.events === 0 ? (
        <div className="alert alert-info">No queue events between {from} and {to}. Run a queue day (check-in, call next, end consult) and refresh.</div>
      ) : (
        <>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold">Process map: what happens next, and how long it takes</div>
            <div className="table-responsive"><table className="table table-sm align-middle mb-0">
              <thead><tr><th>From</th><th>To</th><th style={{ width: '30%' }}>How often</th><th className="text-end">Typical gap (median)</th><th className="text-end">Average gap</th></tr></thead>
              <tbody>{map.edges.map((e) => (
                <tr key={`${e.from}>${e.to}`}>
                  <td>{label(e.from)}</td><td>{label(e.to)}</td>
                  <td><div className="d-flex align-items-center gap-2"><div className="progress flex-grow-1" style={{ height: 8 }}><div className="progress-bar" style={{ width: `${(100 * e.count) / maxEdge}%` }} /></div><span className="small">{e.count}</span></div></td>
                  <td className="text-end">{e.medianMin} min</td><td className="text-end">{e.meanMin} min</td>
                </tr>))}</tbody>
            </table></div>
          </div>
          <div className="row g-3">
            <div className="col-12 col-lg-5"><div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white fw-semibold">Activities</div>
              <ul className="list-group list-group-flush">{map.activities.map((a) => <li key={a.activity} className="list-group-item d-flex justify-content-between"><span>{label(a.activity)}</span><span className="text-muted">{a.count}</span></li>)}</ul>
            </div></div>
            <div className="col-12 col-lg-7"><div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white fw-semibold">Most common paths of an appointment</div>
              <ul className="list-group list-group-flush">{map.variants.map((v) => (
                <li key={v.path.join('>')} className="list-group-item"><span className="badge text-bg-primary me-2">{v.count}×</span>{v.path.map(label).join(' → ')}</li>))}</ul>
            </div></div>
          </div>
        </>
      )}
    </div>
  );
}
