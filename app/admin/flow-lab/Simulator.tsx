'use client';
import { useMemo, useRef, useState } from 'react';
import { SCENARIOS, scenarioSources, type SourceKind } from '@/lib/flowlab/scenarios';
import { MAX_DAYS, runSimulation, type EngineMode, type SimSummary } from '@/lib/flowlab/simRunner';

const POLICY: Record<string, string> = {
  engine: 'Engine', booked: 'Booked time', position_slot: 'Place in line x slot', running_mean: 'Running mean', history_mean: 'History mean',
};
const ROUTE: Record<string, string> = {
  engine: 'Engine: must-go-first tests, then shortest expected wait', lookahead: 'Lookahead: projects each line\u2019s wait forward',
  fixed: 'Fixed: must-go-first, then the hospital\u2019s line order', random: 'Random line', shortest_line: 'Fewest people in line (what a patient sees)',
};
const KIND: Record<SourceKind, { label: string; cls: string }> = {
  cited: { label: 'cited', cls: 'text-bg-success' }, derived: { label: 'derived', cls: 'text-bg-info' },
  assumption: { label: 'assumption', cls: 'text-bg-warning' }, other: { label: 'note', cls: 'text-bg-secondary' },
};
const f1 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(1));
const pct = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(1)}%`);

function EtaTable({ title, rows }: { title: string; rows: SimSummary['eta'][EngineMode] }) {
  const doctor = rows.filter((r) => r.stage === 'doctor');
  const best = Math.min(...doctor.map((r) => r.metrics.mae ?? Infinity));
  const lab = rows.find((r) => r.stage === 'lab' && r.policy === 'engine');
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white fw-semibold">{title}</div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead><tr><th>Estimator</th><th className="text-end">MAE (min)</th><th className="text-end">±5 min</th><th className="text-end">±10 min</th><th className="text-end">Range holds</th></tr></thead>
          <tbody>
            {doctor.map((r) => (
              <tr key={r.policy} className={r.policy === 'engine' ? 'table-primary' : ''}>
                <td>{POLICY[r.policy] ?? r.policy}</td>
                <td className={`text-end ${r.metrics.mae === best ? 'fw-bold' : ''}`}>{f1(r.metrics.mae)}</td>
                <td className="text-end">{pct(r.metrics.within5)}</td><td className="text-end">{pct(r.metrics.within10)}</td>
                <td className="text-end">{pct(r.metrics.coverage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lab && <div className="card-footer bg-white small text-muted">Lab-line ETA (engine): MAE {f1(lab.metrics.mae)} min, within 5 min {pct(lab.metrics.within5)}.</div>}
    </div>
  );
}

/** Flow Lab simulator: runs the flowq hospital-day simulator in the browser (no server, no database). */
export default function Simulator() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [days, setDays] = useState(60);
  const [seed, setSeed] = useState(1);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ summary: SimSummary; scenarioId: string; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signal = useRef({ aborted: false });
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const sources = useMemo(() => scenarioSources(scenario.raw), [scenario]);
  const counts = useMemo(() => sources.reduce<Record<SourceKind, number>>((a, s) => ({ ...a, [s.kind]: a[s.kind] + 1 }), { cited: 0, derived: 0, assumption: 0, other: 0 }), [sources]);
  const running = progress !== null;
  const valid = Number.isInteger(days) && days >= 1 && days <= MAX_DAYS && Number.isInteger(seed);

  async function run() {
    setError(null); setResult(null);
    signal.current = { aborted: false };
    setProgress({ done: 0, total: days });
    const t0 = performance.now();
    try {
      const summary = await runSimulation({ raw: scenario.raw, days, seed, signal: signal.current, onProgress: (done, total) => setProgress({ done, total }) });
      setResult({ summary, scenarioId, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      if ((e as Error).message !== 'aborted') setError((e as Error).message);
    } finally { setProgress(null); }
  }

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3"><div className="card-body">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-5">
            <label className="form-label small mb-1" htmlFor="scenario">Scenario</label>
            <select id="scenario" className="form-select" value={scenarioId} disabled={running} onChange={(e) => setScenarioId(e.target.value)}>
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <label className="form-label small mb-1" htmlFor="days">Days (1–{MAX_DAYS})</label>
            <input id="days" type="number" className="form-control" value={days} min={1} max={MAX_DAYS} disabled={running} onChange={(e) => setDays(Number(e.target.value))} />
          </div>
          <div className="col-6 col-lg-2">
            <label className="form-label small mb-1" htmlFor="seed">Random seed</label>
            <input id="seed" type="number" className="form-control" value={seed} disabled={running} onChange={(e) => setSeed(Number(e.target.value))} />
          </div>
          <div className="col-12 col-lg-3 d-flex gap-2">
            {!running
              ? <button type="button" className="btn btn-primary flex-grow-1" disabled={!valid} onClick={run}><i className="bi bi-play-fill me-1" aria-hidden="true"></i>Run simulation</button>
              : <button type="button" className="btn btn-outline-danger flex-grow-1" onClick={() => { signal.current.aborted = true; }}>Cancel</button>}
          </div>
        </div>
        <p className="small text-muted mt-3 mb-0">{scenario.description} Each day is simulated with a different seed; the same seed always gives the same result.</p>
        {!valid && <div className="text-danger small mt-2">Days must be a whole number from 1 to {MAX_DAYS}.</div>}
        {running && progress && (
          <div className="progress mt-3" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total}>
            <div className="progress-bar" style={{ width: `${(100 * progress.done) / progress.total}%` }}>{progress.done} / {progress.total} days</div>
          </div>
        )}
        {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
      </div></div>

      {result && (
        <div data-testid="sim-result">
          <p className="small text-muted">
            {result.summary.days} simulated days · seed {result.summary.seed} · {SCENARIOS.find((s) => s.id === result.scenarioId)?.label} · computed in your browser in {(result.ms / 1000).toFixed(1)} s.
            MAE = average error of the predicted start time (lower is better). &ldquo;Range holds&rdquo; = share of patients whose real start fell inside the shown range (target 80%).
          </p>
          <div className="row g-3 mb-3">
            <div className="col-12 col-xl-6"><EtaTable title="Doctor queue ETA: DSS rules" rows={result.summary.eta.dss} /></div>
            <div className="col-12 col-xl-6"><EtaTable title="Doctor queue ETA: full engine" rows={result.summary.eta.full} /></div>
          </div>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold">Lab routing: where to send a patient who needs several tests</div>
            <div className="table-responsive"><table className="table table-sm align-middle mb-0">
              <thead><tr><th>Policy</th><th className="text-end">Lab wait (min)</th><th className="text-end">Doctor wait (min)</th><th className="text-end">Mean journey (min)</th><th className="text-end">90th percentile (min)</th></tr></thead>
              <tbody>{result.summary.routing.map((r) => (
                <tr key={r.route} className={r.route === 'engine' ? 'table-primary' : ''}>
                  <td>{ROUTE[r.route] ?? r.route}</td><td className="text-end">{f1(r.labWait)}</td><td className="text-end">{f1(r.doctorWait)}</td>
                  <td className="text-end">{f1(r.journeyMean)}</td><td className="text-end">{f1(r.journeyP90)}</td>
                </tr>))}</tbody>
            </table></div>
          </div>
        </div>
      )}

      <details className="card border-0 shadow-sm" open={!result}>
        <summary className="card-header bg-white fw-semibold" style={{ cursor: 'pointer' }}>
          Where the scenario&apos;s numbers come from
          <span className="ms-2">{(['cited', 'derived', 'assumption'] as const).map((k) => <span key={k} className={`badge ${KIND[k].cls} me-1`}>{counts[k]} {KIND[k].label}</span>)}</span>
        </summary>
        <div className="table-responsive"><table className="table table-sm mb-0">
          <tbody>{sources.map((s) => (
            <tr key={s.key}><td className="text-nowrap"><code>{s.key}</code></td><td><span className={`badge ${KIND[s.kind].cls}`}>{KIND[s.kind].label}</span></td><td className="small">{s.note}</td></tr>
          ))}</tbody>
        </table></div>
        <div className="card-footer bg-white small text-muted">Assumptions are values with no published source; they are covered by the sensitivity sweeps in the flowq experiments.</div>
      </details>
    </div>
  );
}
