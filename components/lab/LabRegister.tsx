'use client';
import { useState } from 'react';
import { findLabPatient, labAction, labPatientOrders, type FoundPatient, type OpenOrder, type TestType } from '@/lib/lab/actions';
import type { LabLine } from '@/lib/lab/server';
import { tealBtn } from '@/components/queue/console/Panels';

const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Lab staff: find a patient by UHID / mobile, then either queue the tests a hospital doctor ordered earlier ("came back later"),
 * or register tests from an outside prescription.
 */
export default function LabRegister({ tests, lines }: { tests: TestType[]; lines: LabLine[] }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<FoundPatient[] | null>(null);
  const [picked, setPicked] = useState<FoundPatient | null>(null);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [prescriber, setPrescriber] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const lineName = (id: string) => lines.find((l) => l.id === id)?.name ?? '';

  const search = async () => {
    setBusy(true); setMsg(null); setPicked(null);
    const r = await findLabPatient(q);
    setBusy(false);
    if (!r.ok) setMsg({ ok: false, text: r.message ?? 'Search failed.' });
    setFound(r.patients);
  };
  const pick = async (p: FoundPatient) => {
    setPicked(p); setChosen([]); setMsg(null);
    setOrders((await labPatientOrders(p.id)).orders);
  };
  const waitingOrders = orders.filter((o) => o.status === 'ordered');
  const queueOrdered = async () => {
    setBusy(true);
    const r = await labAction({ kind: 'enqueue', orderIds: waitingOrders.map((o) => o.order_id), requestKey: newKey() });
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
    if (picked) setOrders((await labPatientOrders(picked.id)).orders);
  };
  const registerOutside = async () => {
    if (!picked) return;
    setBusy(true);
    const r = await labAction({ kind: 'register_outside', patientId: picked.id, testTypeIds: chosen, prescriber, requestKey: newKey() });
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) { setChosen([]); setPrescriber(''); setOrders((await labPatientOrders(picked.id)).orders); }
  };

  return (
    <div className="row g-3">
      <div className="col-lg-5">
        <div className="card border-0 shadow-sm p-3">
          <label htmlFor="lab-q" className="form-label fw-semibold">Find patient (UHID or mobile)</label>
          <div className="input-group">
            <input id="lab-q" className="form-control" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} placeholder="UHID-000123 or 01712345678" />
            <button type="button" className="btn" style={tealBtn} disabled={busy || q.trim().length < 4} onClick={() => void search()}>Search</button>
          </div>
          {found && found.length === 0 && <div className="small text-muted mt-2">No patient found. New patients are registered at the reception desk.</div>}
          {found?.map((p) => (
            <button key={p.id} type="button" className={`btn w-100 text-start mt-2 ${picked?.id === p.id ? 'btn-outline-success' : 'btn-outline-secondary'}`} onClick={() => void pick(p)}>
              <div className="fw-semibold">{p.full_name}</div><div className="small text-muted">{p.uhid}{p.mobile_tail ? ` · mobile …${p.mobile_tail}` : ''}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="col-lg-7">
        {msg && <div role="status" className={`alert ${msg.ok ? 'alert-success' : 'alert-warning'}`}>{msg.text}</div>}
        {picked && (
          <>
            <div className="card border-0 shadow-sm p-3 mb-3">
              <h6 className="text-uppercase small text-muted">Tests ordered by our doctors, not yet done</h6>
              {waitingOrders.length === 0 ? <div className="small text-muted">None.</div> : (
                <>
                  <ul className="mb-2">{waitingOrders.map((o) => <li key={o.order_id}>{o.test} <span className="small text-muted">· {lineName(o.line_id)} · {o.doctor ?? o.external_prescriber} · {o.order_date}</span></li>)}</ul>
                  <button type="button" className="btn" style={tealBtn} disabled={busy} onClick={() => void queueOrdered()}>Queue these tests now</button>
                </>
              )}
            </div>
            <div className="card border-0 shadow-sm p-3">
              <h6 className="text-uppercase small text-muted">Outside prescription</h6>
              <label htmlFor="lab-presc" className="form-label small">Prescribing doctor / hospital</label>
              <input id="lab-presc" className="form-control mb-2" value={prescriber} maxLength={120} onChange={(e) => setPrescriber(e.target.value)} placeholder="e.g. Dr. Alam, City Clinic" />
              <fieldset className="mb-2">
                <legend className="form-label small">Tests</legend>
                {tests.map((t) => (
                  <div key={t.id} className="form-check">
                    <input id={`t-${t.id}`} type="checkbox" className="form-check-input" checked={chosen.includes(t.id)}
                      onChange={(e) => setChosen((c) => (e.target.checked ? [...c, t.id] : c.filter((x) => x !== t.id)))} />
                    <label htmlFor={`t-${t.id}`} className="form-check-label">{t.name} <span className="small text-muted">· {lineName(t.line_id)}{t.must_first ? ' · fasting, goes first' : ''}</span></label>
                  </div>
                ))}
              </fieldset>
              <button type="button" className="btn" style={tealBtn} disabled={busy || chosen.length === 0 || prescriber.trim().length < 2} onClick={() => void registerOutside()}>Register and queue</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
