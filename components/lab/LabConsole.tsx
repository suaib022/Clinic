'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LabLine, LabSnapshot, LabItemWithEta } from '@/lib/lab/server';
import { labAction, type LabActionInput, type LabActionResult } from '@/lib/lab/actions';
import { fmtTime } from '@/lib/queue/display';
import { tealBtn, outlineBtn, DANGER } from '@/components/queue/console/Panels';
import ConfirmDialog, { type ConfirmRequest } from '@/components/queue/console/ConfirmDialog';
import { useLabSnapshot } from './useLabSnapshot';

type Draft<T> = T extends unknown ? Omit<T, 'requestKey'> : never;
const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const STATUS_TEXT = { open: 'Open', paused: 'Paused', closed: 'Closed', none: 'Not open yet' } as const;
const STATUS_CLASS = { open: 'bg-success', paused: 'bg-warning text-dark', closed: 'bg-dark', none: 'bg-secondary' } as const;

function waitText(i: LabItemWithEta): string {
  if (i.waitMinLow == null) return '—';
  return i.waitMinHigh != null && i.waitMinHigh !== i.waitMinLow ? `${i.waitMinLow}–${i.waitMinHigh} min` : `${i.waitMinLow} min`;
}
function Route({ item }: { item: LabItemWithEta }) {
  if (!item.route.length) return null;
  return (
    <div className="small mt-1" data-testid={`route-${item.id}`}>
      <i className="bi bi-signpost-split me-1 text-primary" aria-hidden="true" />
      Next: {item.route.map((r, k) => (
        <span key={r.lineId}>{k > 0 && ' → '}<strong>{r.name}</strong>{r.waitMin != null ? ` (~${r.waitMin} min)` : ' (not open)'}</span>
      ))}
    </div>
  );
}

/** Lab counter for one line: open/pause/close, call next, sample collected, skip/rejoin, undo, and where the patient goes next. */
export default function LabConsole({ lines, lineId, initial }: { lines: LabLine[]; lineId: string; initial: LabSnapshot | null }) {
  const { snap, error, live, reload, replace } = useLabSnapshot(lineId, initial);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [confirmReq, setConfirmReq] = useState<(ConfirmRequest & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const say = useCallback((kind: 'ok' | 'warn' | 'err', text: string) => {
    setToast({ kind, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4500);
  }, []);
  const ask = useCallback((r: Omit<ConfirmRequest, 'resolve'>) =>
    new Promise<string | null>((resolve) => setConfirmReq({ ...r, resolve, id: Date.now() })), []);

  const run = useCallback(async (draft: Draft<LabActionInput>): Promise<LabActionResult | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await labAction({ ...draft, requestKey: newKey() } as LabActionInput);
      if (res.snapshot) replace(res.snapshot); else void reload();
      say(res.ok ? 'ok' : res.code === 'stale' || res.code === 'busy' || res.code === 'empty' ? 'warn' : 'err',
        res.code === 'duplicate' ? 'Already done.' : res.message);
      return res;
    } catch {
      say('err', 'Connection problem. Please try again.');
      void reload();
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [reload, replace, say]);

  if (!snap) {
    return (
      <div className="card border-0 shadow-sm p-4 text-center" role={error ? 'alert' : undefined} aria-busy={!error}>
        {error ? <><div className="text-danger mb-2">{error}</div><button type="button" className="btn btn-outline-secondary" onClick={() => void reload()}>Try again</button></>
          : <div className="text-muted">Loading the lab line…</div>}
      </div>
    );
  }

  const status = snap.session.status ?? 'none';
  const current = snap.items.find((i) => i.status === 'called') ?? null;
  const waiting = snap.items.filter((i) => i.status === 'queued' && !i.skipped).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const skipped = snap.items.filter((i) => i.status === 'queued' && i.skipped);
  const done = snap.items.filter((i) => i.status === 'collected').sort((a, b) => (b.collectedAt ?? 0) - (a.collectedAt ?? 0));
  const L = snap.line.id;

  const sessionBtn = async (action: 'open' | 'pause' | 'resume' | 'close') => {
    let reason: string | undefined;
    if (action === 'pause') {
      const r = await ask({ title: 'Pause this counter?', confirmLabel: 'Pause', input: { label: 'Reason (optional)', presets: ['Tea break', 'Prayer', 'Supplies'] } });
      if (r === null) return;
      reason = r || undefined;
    }
    if (action === 'close' && (await ask({ title: 'Close this counter for today?', body: waiting.length ? `${waiting.length} patient(s) are still waiting; you can still call them.` : undefined, confirmLabel: 'Close', danger: true })) === null) return;
    await run({ kind: 'session', lineId: L, action, reason });
  };

  return (
    <div>
      <ConfirmDialog key={confirmReq?.id} req={confirmReq} onClose={() => setConfirmReq(null)} />
      <div className="d-flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Lab lines">
        {lines.map((l) => (
          <Link key={l.id} href={`/lab/queue?line=${l.id}`} role="tab" aria-selected={l.id === L}
            className={`btn btn-sm ${l.id === L ? '' : 'btn-outline-secondary'}`} style={l.id === L ? tealBtn : undefined}>{l.name}</Link>
        ))}
      </div>

      <div className="card border-0 shadow-sm p-3 mb-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <h5 className="m-0 me-2">{snap.line.name}</h5>
          <span className={`badge ${STATUS_CLASS[status]}`} data-testid="counter-status">{STATUS_TEXT[status]}</span>
          <span className={`badge ${live ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>{live ? 'Live' : 'Refreshing every 10 s'}</span>
          <span className="small text-muted ms-md-2">A new patient now waits about <strong>{snap.waitMin ?? '—'} min</strong></span>
          <div className="ms-auto d-flex flex-wrap gap-2">
            {(status === 'closed' || status === 'none') && <button type="button" className="btn btn-sm" style={tealBtn} disabled={busy} onClick={() => void sessionBtn('open')}>Open counter</button>}
            {status === 'open' && <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => void sessionBtn('pause')}>Pause</button>}
            {status === 'paused' && <button type="button" className="btn btn-sm" style={tealBtn} disabled={busy} onClick={() => void sessionBtn('resume')}>Resume</button>}
            {(status === 'open' || status === 'paused') && <button type="button" className="btn btn-sm dss-outline" style={outlineBtn(DANGER)} disabled={busy} onClick={() => void sessionBtn('close')}>Close</button>}
          </div>
        </div>
      </div>

      {snap.myUndo && (
        <div className="alert alert-light border d-flex align-items-center gap-2 py-2" role="status">
          <span className="small">Last action: {snap.myUndo.message ?? snap.myUndo.type}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" disabled={busy} onClick={() => void run({ kind: 'undo', lineId: L })}>Undo</button>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm p-3 h-100" aria-live="polite">
            <h6 className="text-muted text-uppercase small">At the counter</h6>
            {current ? (
              <>
                <div className="fs-5 fw-semibold" data-testid="current-name">{current.patientName ?? 'Patient'}</div>
                <div className="small text-muted mb-2">{current.patientUhid}</div>
                <div className="mb-2">{current.tests.map((t) => <span key={t.orderId} className="badge bg-light text-dark border me-1">{t.name}</span>)}</div>
                {snap.nowServing && (
                  <div className={`small mb-2 ${snap.nowServing.overrun ? 'text-danger' : 'text-muted'}`}>
                    {Math.round(snap.nowServing.elapsedMin)} min so far (usually about {Math.round(snap.nowServing.expectedMin)} min)
                  </div>
                )}
                <Route item={current} />
                <button type="button" className="btn btn-lg w-100 mt-3" style={tealBtn} disabled={busy}
                  onClick={() => void run({ kind: 'collected', lineId: L, itemId: current.id })}>
                  <i className="bi bi-check2-circle me-1" aria-hidden="true" />Sample collected
                </button>
              </>
            ) : (
              <>
                <div className="text-muted mb-3">Nobody at the counter.</div>
                <button type="button" className="btn btn-lg w-100" style={tealBtn} disabled={busy || status === 'paused' || waiting.length === 0}
                  onClick={() => void run({ kind: 'call_next', lineId: L })}>
                  <i className="bi bi-megaphone me-1" aria-hidden="true" />Call next{waiting[0]?.patientName ? `: ${waiting[0].patientName}` : ''}
                </button>
                {status === 'paused' && <div className="small text-warning mt-2">Counter is paused.</div>}
              </>
            )}
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card border-0 shadow-sm p-3">
            <h6 className="text-muted text-uppercase small">Waiting ({waiting.length})</h6>
            {waiting.length === 0 ? <div className="text-muted small">No one is waiting.</div> : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead><tr><th>#</th><th>Patient</th><th>Tests</th><th>Joined</th><th>Expected</th><th /></tr></thead>
                  <tbody>
                    {waiting.map((i) => (
                      <tr key={i.id} data-testid={`waiting-${i.id}`}>
                        <td>{i.position}</td>
                        <td><div className="fw-semibold">{i.patientName ?? 'Patient'}</div><div className="small text-muted">{i.patientUhid}</div>
                          {i.otherLines.length > 0 && <div className="small text-primary">+{i.otherLines.length} other line(s)</div>}</td>
                        <td className="small">{i.tests.map((t) => t.name).join(', ')}</td>
                        <td className="small">{fmtTime(i.queuedAt)}</td>
                        <td className="small">{fmtTime(i.expectedStartAt)}<div className="text-muted">{waitText(i)}</div></td>
                        <td><button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} aria-label={`Skip ${i.patientName ?? 'patient'}`}
                          onClick={() => void run({ kind: 'skip', lineId: L, itemId: i.id, rejoin: false })}>Skip</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {skipped.length > 0 && (
              <>
                <h6 className="text-muted text-uppercase small mt-3">Skipped (not here when called)</h6>
                {skipped.map((i) => (
                  <div key={i.id} className="d-flex align-items-center gap-2 border-top py-2">
                    <span>{i.patientName ?? 'Patient'} <span className="small text-muted">{i.patientUhid}</span></span>
                    <button type="button" className="btn btn-sm ms-auto" style={tealBtn} disabled={busy}
                      onClick={() => void run({ kind: 'skip', lineId: L, itemId: i.id, rejoin: true })}>Back in line</button>
                  </div>
                ))}
              </>
            )}
          </div>

          {done.length > 0 && (
            <div className="card border-0 shadow-sm p-3 mt-3">
              <h6 className="text-muted text-uppercase small">Collected today ({done.length})</h6>
              {done.slice(0, 8).map((i) => (
                <div key={i.id} className="border-top py-2">
                  <span className="fw-semibold">{i.patientName ?? 'Patient'}</span> <span className="small text-muted">{fmtTime(i.collectedAt)} · {i.tests.map((t) => t.name).join(', ')}</span>
                  <Route item={i} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div role="status" className={`position-fixed bottom-0 end-0 m-3 alert ${toast.kind === 'ok' ? 'alert-success' : toast.kind === 'warn' ? 'alert-warning' : 'alert-danger'} shadow`}
          style={{ zIndex: 99999 }}>{toast.text}</div>
      )}
    </div>
  );
}
