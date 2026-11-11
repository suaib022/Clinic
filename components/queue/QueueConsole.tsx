'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffSnapshot } from '@/lib/queue/server';
import type { QueueAppointment, Suggestion } from '@/lib/queue/engine';
import { queueAction, type QueueActionInput, type QueueActionResult } from '@/lib/queue/actions';
import { fmtTime, PRIORITY_TEXT } from '@/lib/queue/display';
import { useLiveSnapshot } from './console/useLiveSnapshot';
import ConfirmDialog, { type ConfirmRequest } from './console/ConfirmDialog';
import { SessionBanner, DaySummary, NowServing } from './console/Panels';
import { SuggestionsPanel, NextUp, WaitingList, type RowAction } from './console/QueueLists';
import WalkInPanel from './console/WalkInPanel';
import VisitDetailModal from '@/components/appointments/VisitDetailModal';

type Draft<T> = T extends unknown ? Omit<T, 'requestKey'> : never;
type ActionDraft = Draft<QueueActionInput>;
const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export interface QueueConsoleProps {
  mode: 'compounder' | 'doctor';
  doctors: { id: string; full_name: string | null }[];
  doctorId: string;
  initial: StaffSnapshot | null;
}

/** DSS-60..69: the live queue screen. The compounder runs the whole line from here; doctors get the same core. */
export default function QueueConsole({ mode, doctors, doctorId, initial }: QueueConsoleProps) {
  const router = useRouter();
  const { snap, error, live, lastUpdated, reload, replace } = useLiveSnapshot(doctorId, initial);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // blocks a second tap before React re-renders
  const [toast, setToast] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [confirmReq, setConfirmReq] = useState<(ConfirmRequest & { id: number }) | null>(null);
  const [detailAppt, setDetailAppt] = useState<QueueAppointment | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((kind: 'ok' | 'warn' | 'err', text: string) => {
    setToast({ kind, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const ask = useCallback((r: Omit<ConfirmRequest, 'resolve'>) =>
    new Promise<string | null>((resolve) => setConfirmReq({ ...r, resolve, id: Date.now() })), []);

  const run = useCallback(async (draft: ActionDraft): Promise<QueueActionResult | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    try {
      const input = (draft.kind === 'dismiss' ? draft : { ...draft, requestKey: newKey() }) as QueueActionInput;
      const res = await queueAction(input);
      if (res.snapshot) replace(res.snapshot);
      else void reload();
      if (res.ok) say('ok', res.code === 'duplicate' ? 'Already done.' : res.message);
      else say(res.code === 'stale' ? 'warn' : 'err', res.message);
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
    return error ? (
      <div className="card border-0 shadow-sm p-4 text-center" role="alert">
        <div className="text-danger mb-2"><i className="bi bi-exclamation-triangle me-1" />{error}</div>
        <button type="button" className="btn btn-outline-secondary" onClick={() => void reload()}>Try again</button>
      </div>
    ) : (
      <div className="card border-0 shadow-sm p-5 text-center" aria-busy="true">
        <div className="spinner-border text-secondary mx-auto mb-2" role="status" />
        <div className="text-muted">Loading the queue…</div>
      </div>
    );
  }

  const current = snap.result.nowServing?.appointmentId ?? null;
  const canCall = snap.session.state !== 'paused' && snap.session.state !== 'ended' && (snap.result.line.length > 0 || current != null);
  const callNext = () => run({ kind: 'call_next', doctorId, expectedCurrent: current });
  const toTell = snap.result.summary.waiting + snap.result.summary.notArrived;

  const notifyDelay = async (minutes?: number) => {
    const m = minutes ?? Math.max(5, Math.round(snap.result.summary.delayMin / 5) * 5);
    const v = await ask({
      title: `Notify ${toTell} patient(s)?`,
      body: <>Each waiting or booked patient gets: <em>“The doctor is running about N min late. Your expected time has moved.”</em></>,
      confirmLabel: `Send to ${toTell}`,
      input: { label: 'Minutes late (N)', initial: String(m), presets: ['10', '15', '20', '30', '45', '60'] },
    });
    const n = Number(v);
    if (v != null && Number.isInteger(n) && n > 0) await run({ kind: 'broadcast_delay', doctorId, minutes: n });
  };
  const pause = async () => {
    const reason = await ask({ title: 'Pause the session?', confirmLabel: 'Pause', body: 'Waiting patients are told the doctor is on a short break. Nothing is counted while paused.',
      input: { label: 'Reason', initial: 'Short break', presets: ['Short break', 'Prayer', 'Emergency call', 'Ward round'] } });
    if (reason != null) await run({ kind: 'session_pause', doctorId, reason });
  };
  const endSession = async () => {
    const remaining = snap.result.summary.waiting + snap.result.summary.notArrived;
    const ok = await ask({ title: 'End the session?', confirmLabel: 'End session', danger: true,
      body: remaining ? `${remaining} patient(s) have not been seen. You will be asked to resolve them.` : 'Everyone has been seen.' });
    if (ok != null) await run({ kind: 'session_end', doctorId });
  };
  const noShow = async (a: QueueAppointment) => {
    const ok = await ask({ title: `Mark serial ${a.serialNo} as no-show?`, body: `${a.patientName ?? 'The patient'} will be told they were marked absent, with a rebook link.`, confirmLabel: 'Mark no-show', danger: true });
    if (ok != null) await run({ kind: 'no_show', appointmentId: a.id });
  };
  const priority = async (a: QueueAppointment) => {
    const v = await ask({ title: `Priority for serial ${a.serialNo}`, confirmLabel: 'Save',
      body: `Now: ${PRIORITY_TEXT[a.priorityLevel]}. Emergency goes next, then priority, then normal.`,
      input: { label: 'Type Normal, Priority or Emergency', initial: a.priorityLevel === 0 ? 'Priority' : PRIORITY_TEXT[a.priorityLevel], presets: [...PRIORITY_TEXT] } });
    if (v == null) return;
    const level = PRIORITY_TEXT.findIndex((p) => p.toLowerCase() === v.trim().toLowerCase());
    if (level < 0) return say('err', 'Choose Normal, Priority or Emergency.');
    await run({ kind: 'priority', appointmentId: a.id, level, reason: PRIORITY_TEXT[level] });
  };
  const onRow = (a: QueueAppointment, action: RowAction) => {
    if (action === 'no_show') return void noShow(a);
    if (action === 'priority') return void priority(a);
    return void run({ kind: action, appointmentId: a.id });
  };
  const onSuggestion = async (s: Suggestion) => {
    const a = s.action.appointmentId ? snap.appointments.find((x) => x.id === s.action.appointmentId) : undefined;
    switch (s.action.kind) {
      case 'call_next': return void callNext();
      case 'skip': return void run({ kind: 'skip', appointmentId: s.action.appointmentId! });
      case 'no_show': return void (a && noShow(a));
      case 'broadcast_delay': return void notifyDelay(s.action.minutes);
      case 'resume': return void run({ kind: 'session_resume', doctorId });
      case 'acknowledge': return void run({ kind: 'dismiss', doctorId, suggestionKey: s.key });
      case 'open_walk_in':
        document.getElementById('dss-walkin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      case 'resolve_remaining': {
        const ok = await ask({ title: 'Resolve remaining patients?', danger: true, confirmLabel: 'Mark as no-show',
          body: 'Everyone not seen today is marked as no-show and gets a rebook link. To keep someone, check them in first.' });
        if (ok != null) await run({ kind: 'resolve_remaining', doctorId });
      }
    }
  };

  return (
    // bottom padding keeps the last buttons clear of the site's floating chat widget and the toast
    <div style={{ paddingBottom: 110 }}>
      {/* header: doctor switcher + live indicator */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        {doctors.length > 1 ? (
          <select className="form-select form-select-lg" style={{ maxWidth: 360 }} aria-label="Doctor" value={doctorId}
            onChange={(e) => router.replace(`?doctor=${e.target.value}`)}>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        ) : (
          <div className="fs-5 fw-semibold">{snap.doctor.name}</div>
        )}
        <span className="ms-auto small text-muted" aria-live="polite">
          <span className={`badge me-2 ${live ? 'bg-success' : 'bg-warning text-dark'}`}>{live ? '● Live' : 'Reconnecting…'}</span>
          Updated {fmtTime(lastUpdated || snap.serverNow)}
        </span>
      </div>
      {error && <div className="alert alert-warning py-2 small" role="status">{error} Showing the last known data.</div>}

      <SessionBanner snap={snap} busy={busy}
        onStart={() => void run({ kind: 'session_start', doctorId })}
        onPause={() => void pause()}
        onResume={() => void run({ kind: 'session_resume', doctorId })}
        onEnd={() => void endSession()}
        onNotify={() => void notifyDelay()} />
      <DaySummary snap={snap} />
      <NowServing snap={snap} receivedAt={lastUpdated} busy={busy} canCall={canCall} onCallNext={() => void callNext()}
        onDone={() => current && void run({ kind: 'end_consult', appointmentId: current })} />
      <UndoBar snap={snap} receivedAt={lastUpdated} busy={busy} onUndo={() => void run({ kind: 'undo', doctorId })} />
      <NextUp snap={snap} busy={busy} canCall={canCall} onCall={() => void callNext()} onSelectAppt={setDetailAppt} />
      {mode === 'compounder' && (
        <SuggestionsPanel suggestions={snap.suggestions} busy={busy} onConfirm={(s) => void onSuggestion(s)}
          onDismiss={(s) => void run({ kind: 'dismiss', doctorId, suggestionKey: s.key })} />
      )}
      {mode === 'compounder' && (
        <div id="dss-walkin">
          <WalkInPanel snap={snap} busy={busy} onAdd={async (p) => !!(await run({ kind: 'walk_in', doctorId, ...p }))?.ok} />
        </div>
      )}
      <WaitingList snap={snap} busy={busy} readOnly={mode === 'doctor'} onRow={onRow} onSelectAppt={setDetailAppt} />

      <VisitDetailModal
        appt={detailAppt ? { ...detailAppt, expectedStartAt: snap.result.estimates[detailAppt.id]?.expectedStartAt } : null}
        onClose={() => setDetailAppt(null)}
        doctorName={doctors.find((d) => d.id === doctorId)?.full_name || undefined}
      />

      <div aria-live="assertive" className="position-fixed start-50 translate-middle-x px-3" style={{ bottom: 96, zIndex: 100000, width: 'min(520px, 100%)' }}>
        {toast && (
          <div role="status" className={`alert shadow mb-0 ${toast.kind === 'ok' ? 'alert-success' : toast.kind === 'warn' ? 'alert-warning' : 'alert-danger'}`}>
            {toast.text}
          </div>
        )}
      </div>
      <ConfirmDialog key={confirmReq?.id ?? 0} req={confirmReq} onClose={() => setConfirmReq(null)} />
    </div>
  );
}

/** DSS-69: "Undo" for your own last action, visible for undo_window_sec. */
function UndoBar({ snap, receivedAt, busy, onUndo }: { snap: StaffSnapshot; receivedAt: number; busy: boolean; onUndo: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const u = snap.myUndo;
  useEffect(() => {
    if (!u) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [u]);
  if (!u) return null;
  const serverNow = snap.serverNow + (now - receivedAt);
  const left = Math.ceil(snap.settings.undoWindowSec - (serverNow - Date.parse(u.at)) / 1000);
  if (left <= 0) return null;
  return (
    <div className="alert alert-secondary d-flex align-items-center gap-2 py-2 mb-3" role="status">
      <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
      <span className="flex-grow-1 small">{u.message ?? 'Last action'} <span className="text-muted">({Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} left to undo)</span></span>
      <button type="button" className="btn btn-sm btn-dark" disabled={busy} onClick={onUndo}>Undo</button>
    </div>
  );
}
