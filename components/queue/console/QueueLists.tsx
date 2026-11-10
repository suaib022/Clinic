'use client';
import { useMemo, useState } from 'react';
import type { StaffSnapshot } from '@/lib/queue/server';
import type { QueueAppointment, Suggestion, PatientEstimate } from '@/lib/queue/engine';
import { fmtTime, LABEL_TEXT, LABEL_CLASS, PRIORITY_TEXT, matchesSearch } from '@/lib/queue/display';
import { tealBtn, outlineBtn, DANGER } from './Panels';

export type RowAction = 'check_in' | 'skip' | 'rejoin' | 'priority' | 'no_show';

const SEVERITY_CLASS = { urgent: 'border-danger', warning: 'border-warning', info: 'border-info' } as const;
const SEVERITY_ICON = { urgent: 'bi-exclamation-octagon-fill text-danger', warning: 'bi-exclamation-triangle-fill text-warning', info: 'bi-lightbulb-fill text-info' } as const;

export function SuggestionsPanel({ suggestions, busy, onConfirm, onDismiss }: {
  suggestions: Suggestion[]; busy: boolean; onConfirm: (s: Suggestion) => void; onDismiss: (s: Suggestion) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div role="region" aria-label="Suggestions" className="mb-3" aria-live="polite">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2">
          <h6 className="fw-bold text-muted text-uppercase small m-0">
            <i className="bi bi-stars me-1 text-warning" />Suggestions
          </h6>
          {suggestions.length > 0 && (
            <span
              className="badge rounded-pill"
              style={{
                fontSize: '11px',
                backgroundColor: '#fef3c7',
                color: '#b45309',
                padding: '2px 8px',
                fontWeight: 600,
              }}
            >
              {suggestions.length}
            </span>
          )}
        </div>

        {suggestions.length > 0 && (
          <button
            type="button"
            className="btn btn-sm d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill border bg-white text-secondary shadow-xs hover-bg-light transition-all"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-controls="dss-suggestions-content"
            title={collapsed ? 'Expand suggestions' : 'Collapse suggestions'}
            style={{ fontSize: '12px', fontWeight: 600 }}
          >
            <span>{collapsed ? 'Show' : 'Hide'}</span>
            <i className={`bi ${collapsed ? 'bi-chevron-down' : 'bi-chevron-up'} fs-6 transition-transform`} />
          </button>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="bg-white rounded-3 shadow-sm p-3 text-muted small">No suggestions right now. The queue looks fine.</div>
      ) : collapsed ? (
        <div
          onClick={() => setCollapsed(false)}
          className="bg-white rounded-3 shadow-sm px-3 py-2.5 d-flex align-items-center justify-content-between border cursor-pointer transition-all hover-bg-light"
          style={{ borderColor: '#e2e8f0', cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCollapsed(false);
            }
          }}
        >
          <div className="d-flex align-items-center gap-2 small text-muted">
            <i className="bi bi-lightbulb-fill text-warning fs-6" />
            <span>
              <strong>{suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}</strong> hidden. Click to expand.
            </span>
          </div>
          <span className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold" style={{ color: '#0D7D72', fontSize: '12px' }}>
            <span>Show suggestions</span>
            <i className="bi bi-chevron-down ms-1" />
          </span>
        </div>
      ) : (
        <div id="dss-suggestions-content" className="d-flex flex-column gap-2">
          {suggestions.map((s) => (
            <div key={s.key} className={`bg-white rounded-3 shadow-sm p-3 border-start border-4 ${SEVERITY_CLASS[s.severity]}`}>
              <div className="d-flex gap-2 align-items-start">
                <i className={`bi ${SEVERITY_ICON[s.severity]} fs-5`} aria-hidden="true" />
                <div className="flex-grow-1">
                  <div className="fw-semibold">{s.message}</div>
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button type="button" className="btn" style={tealBtn} disabled={busy} onClick={() => onConfirm(s)}>{s.action.label}</button>
                    <button type="button" className="btn dss-outline" style={outlineBtn('#6c757d')} disabled={busy} onClick={() => onDismiss(s)}>Dismiss</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function stageBadge(e: PatientEstimate | undefined, a: QueueAppointment) {
  if (a.status === 'in_consultation') return <span className="badge bg-primary">In room</span>;
  if (a.status === 'prescription_pending' || a.status === 'completed') return <span className="badge bg-light text-dark border">Seen</span>;
  if (a.status === 'no_show') return <span className="badge bg-dark">No-show</span>;
  if (a.skippedAt) return <span className="badge bg-light text-dark border">Skipped</span>;
  return e?.label ? <span className={`badge ${LABEL_CLASS[e.label]}`}>{LABEL_TEXT[e.label]}</span> : null;
}

export function NextUp({ snap, busy, canCall, onCall }: { snap: StaffSnapshot; busy: boolean; canCall: boolean; onCall: () => void }) {
  const byId = new Map(snap.appointments.map((a) => [a.id, a]));
  const waiting = snap.result.line.map((id) => byId.get(id)!).filter(Boolean);
  const notArrived = snap.appointments.filter((a) => a.status === 'scheduled' && !a.skippedAt).sort((a, b) => a.bookedAt - b.bookedAt);
  const next3 = [...waiting, ...notArrived].slice(0, 3);
  return (
    <div role="region" aria-label="Next up" className="mb-3">
      <h6 className="fw-bold text-muted text-uppercase small mb-2">Next up</h6>
      {next3.length === 0 ? (
        <div className="bg-white rounded-3 shadow-sm p-3 text-muted small">Nobody is waiting.</div>
      ) : (
        <div className="row g-2">
          {next3.map((a, i) => {
            const e = snap.result.estimates[a.id];
            const arrived = a.status === 'checked_in';
            return (
              <div key={a.id} className="col-12 col-md-4">
                <div className="bg-white rounded-3 shadow-sm p-3 h-100 d-flex justify-content-between align-items-center gap-2">
                  <div style={{ minWidth: 0 }}>
                    <div className="fw-bold">#{a.serialNo} <span className="fw-normal text-truncate">{a.patientName}</span></div>
                    <div className="small">
                      {arrived ? <span className="text-success"><i className="bi bi-check-circle-fill me-1" />Arrived</span>
                        : <span className="text-muted"><i className="bi bi-clock me-1" />Not arrived</span>}
                      {a.priorityLevel > 0 && <span className={`badge ms-2 ${a.priorityLevel === 2 ? 'bg-danger' : 'bg-warning text-dark'}`}>{PRIORITY_TEXT[a.priorityLevel]}</span>}
                    </div>
                    <div className="small text-muted">~{fmtTime(e?.expectedStartAt)}</div>
                  </div>
                  {i === 0 && arrived && (
                    <button type="button" className="btn btn-sm" style={tealBtn} disabled={busy || !canCall} onClick={onCall}>Call</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WaitingList({ snap, busy, onRow, readOnly = false }: {
  snap: StaffSnapshot; busy: boolean; readOnly?: boolean; onRow: (a: QueueAppointment, action: RowAction) => void;
}) {
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);
  const rows = useMemo(() => {
    const pos = new Map(snap.result.line.map((id, i) => [id, i]));
    const rank = (a: QueueAppointment) =>
      a.status === 'in_consultation' ? -1 : pos.has(a.id) ? pos.get(a.id)! : a.status === 'scheduled' ? 1000 + a.serialNo : 5000 + a.serialNo;
    return snap.appointments
      .filter((a) => showDone || !['prescription_pending', 'completed', 'no_show'].includes(a.status))
      .filter((a) => matchesSearch(a, q))
      .sort((a, b) => rank(a) - rank(b));
  }, [snap, q, showDone]);

  return (
    <div role="region" aria-label="Waiting list" className="card border-0 shadow-sm rounded-3 mb-3">
      <div className="card-header bg-white d-flex flex-wrap gap-2 align-items-center py-3">
        <h6 className="fw-bold m-0 me-auto">Today’s list</h6>
        <input type="search" className="form-control" style={{ maxWidth: 260 }} placeholder="Search UHID, mobile, serial or name"
          aria-label="Search patients" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="form-check form-switch m-0">
          <input id="dss-show-done" className="form-check-input" type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          <label className="form-check-label small" htmlFor="dss-show-done">Show seen / no-shows</label>
        </div>
      </div>
      <ul className="list-group list-group-flush">
        {rows.length === 0 && <li className="list-group-item text-muted py-4 text-center">{q ? 'No patient matches this search.' : 'No patients booked for today yet.'}</li>}
        {rows.map((a) => {
          const e = snap.result.estimates[a.id];
          const waiting = a.status === 'scheduled' || a.status === 'checked_in';
          return (
            <li key={a.id} className="list-group-item py-3">
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <div className="fw-bold fs-5" style={{ width: 56 }}>#{a.serialNo}</div>
                <div className="flex-grow-1" style={{ minWidth: 160 }}>
                  <div className="fw-semibold">{a.patientName}
                    {a.visitSource === 'walk_in' && <span className="badge bg-light text-dark border ms-2">Walk-in</span>}
                    {a.priorityLevel > 0 && <span className={`badge ms-2 ${a.priorityLevel === 2 ? 'bg-danger' : 'bg-warning text-dark'}`}>{PRIORITY_TEXT[a.priorityLevel]}</span>}
                  </div>
                  <div className="small text-muted">
                    {a.patientUhid} · Booked {fmtTime(a.bookedAt)}
                    {waiting && e?.expectedStartAt != null && <> · Expected {fmtTime(e.expectedStartAt)}</>}
                    {a.status === 'checked_in' && a.checkedInAt != null && <> · Arrived {fmtTime(a.checkedInAt)}</>}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">{stageBadge(e, a)}</div>
                {!readOnly && waiting && (
                  <div className="d-flex flex-wrap gap-2 w-100 w-md-auto justify-content-end">
                    {a.status === 'scheduled' && <button type="button" className="btn" style={tealBtn} disabled={busy} onClick={() => onRow(a, 'check_in')}>Check in</button>}
                    {!a.skippedAt && <button type="button" className="btn dss-outline" style={outlineBtn('#495057')} disabled={busy} onClick={() => onRow(a, 'skip')}>Skip</button>}
                    {a.skippedAt && <button type="button" className="btn dss-outline" style={outlineBtn('#0d6efd')} disabled={busy} onClick={() => onRow(a, 'rejoin')}>Rejoin</button>}
                    <button type="button" className="btn dss-outline" style={outlineBtn('#946200')} disabled={busy} onClick={() => onRow(a, 'priority')}>Priority</button>
                    <button type="button" className="btn dss-outline" style={outlineBtn(DANGER)} disabled={busy} onClick={() => onRow(a, 'no_show')}>No-show</button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
