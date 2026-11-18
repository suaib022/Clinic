'use client';
import { useState } from 'react';
import { saveLabLine, saveLabTest } from './actions';
import { tealBtn } from '@/components/queue/console/Panels';

export interface LineRow { id: string; code: string; name: string; typical_min: number; active: boolean }
export interface TestRow { id: string; code: string; name: string; line_id: string; must_first: boolean; turnaround_min: number; active: boolean }

/** Admin: lab lines (one counter each) and the tests that go to them. */
export default function LabSettingsClient({ lines, tests }: { lines: LineRow[]; tests: TestRow[] }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newLine, setNewLine] = useState({ code: '', name: '', typical_min: 4 });
  const [newTest, setNewTest] = useState({ code: '', name: '', line_id: lines[0]?.id ?? '', must_first: false, turnaround_min: 60 });
  const show = (r: { ok: boolean; message: string }) => setMsg({ ok: r.ok, text: r.message });

  return (
    <div>
      {msg && <div role="status" className={`alert ${msg.ok ? 'alert-success' : 'alert-warning'}`}>{msg.text}</div>}
      <div className="card border-0 shadow-sm p-3 mb-4">
        <h5>Lines (counters)</h5>
        <p className="small text-muted">Typical minutes per patient is used until the line has its own history.</p>
        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Name</th><th>Code</th><th>Typical min</th><th>Active</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td><td className="small text-muted">{l.code}</td>
                  <td><input type="number" aria-label={`Typical minutes for ${l.name}`} className="form-control form-control-sm" style={{ maxWidth: 100 }} defaultValue={l.typical_min} min={0.5} step={0.1}
                    onBlur={async (e) => show(await saveLabLine({ ...l, typical_min: Number(e.target.value) }))} /></td>
                  <td><input type="checkbox" aria-label={`${l.name} active`} className="form-check-input" defaultChecked={l.active}
                    onChange={async (e) => show(await saveLabLine({ ...l, active: e.target.checked }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div><label className="form-label small" htmlFor="nl-name">New line name</label><input id="nl-name" className="form-control form-control-sm" value={newLine.name} onChange={(e) => setNewLine({ ...newLine, name: e.target.value })} /></div>
          <div><label className="form-label small" htmlFor="nl-code">Code</label><input id="nl-code" className="form-control form-control-sm" value={newLine.code} onChange={(e) => setNewLine({ ...newLine, code: e.target.value })} placeholder="ultrasound" /></div>
          <div><label className="form-label small" htmlFor="nl-min">Typical min</label><input id="nl-min" type="number" className="form-control form-control-sm" value={newLine.typical_min} onChange={(e) => setNewLine({ ...newLine, typical_min: Number(e.target.value) })} /></div>
          <button type="button" className="btn btn-sm" style={tealBtn} onClick={async () => show(await saveLabLine({ ...newLine, active: true }))}>Add line</button>
        </div>
      </div>

      <div className="card border-0 shadow-sm p-3">
        <h5>Tests</h5>
        <p className="small text-muted">Fasting tests go first when a patient has tests in several lines. Report minutes 0 = ready at once (e.g. ECG).</p>
        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Test</th><th>Line</th><th>Fasting first</th><th>Report minutes</th><th>Active</th></tr></thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}<div className="small text-muted">{t.code}</div></td>
                  <td><select aria-label={`Line for ${t.name}`} className="form-select form-select-sm" defaultValue={t.line_id}
                    onChange={async (e) => show(await saveLabTest({ ...t, line_id: e.target.value }))}>
                    {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></td>
                  <td><input type="checkbox" aria-label={`${t.name} fasting first`} className="form-check-input" defaultChecked={t.must_first}
                    onChange={async (e) => show(await saveLabTest({ ...t, must_first: e.target.checked }))} /></td>
                  <td><input type="number" aria-label={`Report minutes for ${t.name}`} className="form-control form-control-sm" style={{ maxWidth: 110 }} defaultValue={t.turnaround_min} min={0}
                    onBlur={async (e) => show(await saveLabTest({ ...t, turnaround_min: Math.round(Number(e.target.value)) }))} /></td>
                  <td><input type="checkbox" aria-label={`${t.name} active`} className="form-check-input" defaultChecked={t.active}
                    onChange={async (e) => show(await saveLabTest({ ...t, active: e.target.checked }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div><label className="form-label small" htmlFor="nt-name">New test name</label><input id="nt-name" className="form-control form-control-sm" value={newTest.name} onChange={(e) => setNewTest({ ...newTest, name: e.target.value })} /></div>
          <div><label className="form-label small" htmlFor="nt-code">Code</label><input id="nt-code" className="form-control form-control-sm" value={newTest.code} onChange={(e) => setNewTest({ ...newTest, code: e.target.value })} placeholder="hba1c" /></div>
          <div><label className="form-label small" htmlFor="nt-line">Line</label><select id="nt-line" className="form-select form-select-sm" value={newTest.line_id} onChange={(e) => setNewTest({ ...newTest, line_id: e.target.value })}>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
          <div><label className="form-label small" htmlFor="nt-tat">Report minutes</label><input id="nt-tat" type="number" className="form-control form-control-sm" value={newTest.turnaround_min} onChange={(e) => setNewTest({ ...newTest, turnaround_min: Number(e.target.value) })} /></div>
          <div className="form-check mb-1"><input id="nt-first" type="checkbox" className="form-check-input" checked={newTest.must_first} onChange={(e) => setNewTest({ ...newTest, must_first: e.target.checked })} /><label htmlFor="nt-first" className="form-check-label small">Fasting first</label></div>
          <button type="button" className="btn btn-sm" style={tealBtn} onClick={async () => show(await saveLabTest({ ...newTest, active: true }))}>Add test</button>
        </div>
      </div>
    </div>
  );
}
