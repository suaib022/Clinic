'use client';
import { useEffect, useState } from 'react';
import type { StaffSnapshot } from '@/lib/queue/server';
import type { QueueAppointment } from '@/lib/queue/engine';
import { fmtTime, fmtMin, SESSION_TEXT, SESSION_CLASS } from '@/lib/queue/display';

const TEAL = '#0D7D72';
export const tealBtn = { backgroundColor: TEAL, borderColor: TEAL, color: '#fff' } as const;
/** The site theme recolours every .btn; these keep secondary / dangerous actions visually distinct. */
export const outlineBtn = (color: string) => ({ '--dss-c': color }) as React.CSSProperties;
export const DANGER = '#b02a37';

export function SessionBanner({ snap, busy, onStart, onPause, onResume, onEnd, onNotify }: {
  snap: StaffSnapshot; busy: boolean;
  onStart: () => void; onPause: () => void; onResume: () => void; onEnd: () => void; onNotify: () => void;
}) {
  const s = snap.session;
  const late = Math.round(s.lateStartMin);
  return (
    <div role="region" aria-label="Session" className="card border-0 shadow-sm rounded-3 mb-3">
      <div className="card-body d-flex flex-wrap align-items-center gap-2 gap-md-3 p-3">
        <span className={`badge fs-6 ${SESSION_CLASS[s.state]}`}>{SESSION_TEXT[s.state]}</span>
        <span className="text-muted small flex-grow-1" style={{ minWidth: 180 }}>
          {s.state === 'not_started' && <>Starts {fmtTime(s.scheduledStartAt)}</>}
          {s.state === 'active' && <>Started {fmtTime(s.startedAt)}{late > 0 ? ` · ${late} min late` : ' · on time'}</>}
          {s.state === 'paused' && <>On break since {fmtTime(s.pausedSinceAt)}{s.pauseReason ? ` · ${s.pauseReason}` : ''}</>}
          {s.state === 'ended' && <>Session ended</>}
        </span>
        <div className="d-flex flex-wrap gap-2">
          {s.state === 'not_started' && <button type="button" className="btn btn-lg" style={tealBtn} disabled={busy} onClick={onStart}><i className="bi bi-play-fill me-1" />Start session</button>}
          {s.state === 'active' && <button type="button" className="btn btn-lg dss-outline" style={outlineBtn('#946200')} disabled={busy} onClick={onPause}><i className="bi bi-pause-fill me-1" />Pause</button>}
          {s.state === 'paused' && <button type="button" className="btn btn-lg dss-solid-warning" disabled={busy} onClick={onResume}><i className="bi bi-play-fill me-1" />Resume</button>}
          {(s.state === 'active' || s.state === 'paused') && <button type="button" className="btn btn-lg dss-outline" style={outlineBtn('#212529')} disabled={busy} onClick={onEnd}>End session</button>}
          {s.state !== 'ended' && <button type="button" className="btn btn-lg dss-outline" style={outlineBtn(TEAL)} disabled={busy} onClick={onNotify}><i className="bi bi-megaphone me-1" />Notify waiting</button>}
        </div>
      </div>
    </div>
  );
}

export function DaySummary({ snap }: { snap: StaffSnapshot }) {
  const s = snap.result.summary;
  const items: Array<[string, string | number, string?]> = [
    ['Seen', s.seen], ['Waiting', s.waiting], ['Not arrived', s.notArrived], ['No-shows', s.noShows],
    ['Avg visit', s.avgVisitMin == null ? '—' : `${Math.round(s.avgVisitMin)} min`],
    ['Delay', `${s.delayMin} min`, s.delayMin >= snap.settings.doctorLateAlertMin ? 'text-danger' : s.delayMin > snap.settings.onTimeBandMin ? 'text-warning' : undefined],
  ];
  return (
    <div role="region" aria-label="Day summary" className="row g-2 mb-3">
      {items.map(([label, value, cls]) => (
        <div key={label} className="col-4 col-md-2">
          <div className="bg-white rounded-3 shadow-sm text-center py-2 h-100">
            <div className={`fs-5 fw-bold ${cls ?? ''}`}>{value}</div>
            <div className="small text-muted">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);
  return now;
}

export function NowServing({ snap, receivedAt, busy, onCallNext, onDone, canCall }: {
  snap: StaffSnapshot; receivedAt: number; busy: boolean; canCall: boolean; onCallNext: () => void; onDone: () => void;
}) {
  const ns = snap.result.nowServing;
  const appt: QueueAppointment | undefined = ns ? snap.appointments.find((a) => a.id === ns.appointmentId) : undefined;
  const running = snap.session.state === 'active';
  const now = useNow(!!ns && running);
  // server-computed active minutes (pauses excluded) + time since this snapshot arrived; frozen while paused
  const activeMin = ns ? ns.elapsedMin + (running ? Math.max(0, now - receivedAt) / 60000 : 0) : 0;
  const over = ns ? activeMin > ns.expectedMin : false;
  const mm = Math.floor(activeMin);
  const ss = Math.floor((activeMin - mm) * 60);
  const next = snap.result.line[0] ? snap.appointments.find((a) => a.id === snap.result.line[0]) : undefined;

  return (
    <div role="region" aria-label="Now serving" className="card border-0 shadow-sm rounded-3 mb-3" style={{ borderLeft: `5px solid ${over ? '#dc3545' : TEAL}`, minHeight: 150 }}>
      <div className="card-body p-3 p-md-4">
        <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div style={{ minWidth: 0 }}>
            <div className="text-uppercase small text-muted fw-semibold">Now serving</div>
            {ns && appt ? (
              <>
                <div className="d-flex align-items-baseline gap-2 flex-wrap">
                  <span className="display-6 fw-bold" style={{ color: TEAL }}>#{appt.serialNo}</span>
                  <span className="fs-5 fw-semibold text-truncate">{appt.patientName}</span>
                </div>
                <div className="small text-muted">
                  {appt.visitType === 'follow_up' ? 'Follow-up' : 'New patient'} · {appt.patientUhid}
                </div>
                <div className={`mt-2 fw-semibold ${over ? 'text-danger' : ''}`} aria-live="off">
                  <i className="bi bi-stopwatch me-1" />{mm}:{String(ss).padStart(2, '0')} / ~{fmtMin(ns.expectedMin)}
                  {over && <span className="ms-2 badge bg-danger">Running over</span>}
                </div>
              </>
            ) : (
              <div className="fs-5 text-muted mt-1">Nobody in the room</div>
            )}
          </div>
          <div className="d-flex flex-column gap-2 flex-grow-1 flex-md-grow-0" style={{ minWidth: 200 }}>
            <button type="button" className="btn btn-lg py-3 fw-bold" style={tealBtn} disabled={busy || !canCall} onClick={onCallNext}>
              <i className="bi bi-megaphone-fill me-2" />
              {ns ? (next ? `Done · Call #${next.serialNo}` : 'Done · Call next') : next ? `Call #${next.serialNo}` : 'Call next'}
            </button>
            {ns && <button type="button" className="btn dss-outline" style={outlineBtn('#495057')} disabled={busy} onClick={onDone}>Done (don’t call next)</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
