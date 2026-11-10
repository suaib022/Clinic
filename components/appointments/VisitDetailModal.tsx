'use client';

import React, { useEffect } from 'react';
import { StatusBadge, VisitSourceBadge, PriorityFlag } from './StatusBadge';

export interface VisitDetailModalProps {
  appt: any | null;
  onClose: () => void;
  doctorName?: string;
  specialityName?: string;
}

function formatTimeDisplay(val: Date | number | string | null | undefined): string {
  if (!val) return '—';
  try {
    if (val instanceof Date) {
      return val.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (typeof val === 'string' && val.includes(':') && !val.includes('T') && !val.includes('-')) {
      // "09:00:00" time-only string
      const [h, m] = val.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${m} ${ampm}`;
    }
    const d = typeof val === 'number' ? new Date(val) : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return String(val);
  }
}

function formatDateDisplay(val: Date | number | string | null | undefined): string {
  if (!val) return '—';
  try {
    const d = val instanceof Date ? val : typeof val === 'number' ? new Date(val) : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(val);
  }
}

export default function VisitDetailModal({ appt, onClose, doctorName, specialityName }: VisitDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!appt) return null;

  const isQueue = 'serialNo' in appt;
  const serialNo = isQueue ? appt.serialNo : appt.serial_no;
  const patientName = isQueue ? appt.patientName : appt.patient?.full_name;
  const uhid = isQueue ? appt.patientUhid : appt.patient?.uhid;
  const mobile = isQueue ? appt.patientMobile : appt.patient?.mobile;
  const gender = isQueue ? null : appt.patient?.gender;
  const status = appt.status;
  const visitType = appt.visit_type || appt.visitType || 'General Consultation';
  const visitSource = appt.visit_source || appt.visitSource || 'online';
  const isPriority = isQueue ? appt.priorityLevel > 0 : Boolean(appt.is_priority);
  const priorityReason = isQueue
    ? (appt.priorityLevel === 2 ? 'Emergency' : appt.priorityLevel === 1 ? 'Priority' : null)
    : appt.priority_reason;
  const apptDate = appt.appointment_date || null;
  const startTime = appt.start_time || null;
  const endTime = appt.end_time || null;
  const bookedAt = isQueue ? appt.bookedAt : appt.created_at;
  const checkedInAt = isQueue ? appt.checkedInAt : appt.checked_in_at;
  const consultStartedAt = isQueue ? appt.consultStartedAt : appt.consult_started_at;
  const consultEndedAt = isQueue ? appt.consultEndedAt : appt.consult_ended_at;
  const skippedAt = isQueue ? appt.skippedAt : null;
  const expectedStartAt = appt.expectedStartAt || null;

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', zIndex: 1065 }}
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* Header */}
          <div
            className="modal-header border-0 px-4 py-3 text-white d-flex align-items-center justify-content-between"
            style={{ background: 'linear-gradient(135deg, #0D7D72 0%, #08554e 100%)' }}
          >
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center bg-white bg-opacity-20 text-white"
                style={{ width: 36, height: 36 }}
              >
                <i className="bi bi-person-vcard fs-5" />
              </div>
              <div>
                <h5 className="modal-title fw-bold m-0" style={{ fontSize: '1.15rem' }}>
                  Visit Details · Serial #{serialNo}
                </h5>
                <small className="text-white text-opacity-75" style={{ fontSize: '0.8rem' }}>
                  Patient Queue & Consultation Record
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={onClose}
            />
          </div>

          <div className="modal-body p-4" style={{ backgroundColor: '#f8fafc' }}>
            {/* Top Patient Summary Card */}
            <div className="card border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs"
                    style={{
                      width: 52,
                      height: 52,
                      backgroundColor: '#0D7D72',
                      fontSize: '1.25rem',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {patientName ? patientName.trim().charAt(0).toUpperCase() : 'P'}
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <h5 className="fw-bold mb-0 text-dark">{patientName || 'Unknown Patient'}</h5>
                      {gender && (
                        <span className="badge bg-light text-secondary border rounded-pill px-2 py-1" style={{ fontSize: '0.75rem' }}>
                          {gender}
                        </span>
                      )}
                    </div>
                    <div className="text-muted small mt-1 d-flex align-items-center gap-2 flex-wrap">
                      <span>UHID: <strong>{uhid || 'N/A'}</strong></span>
                      {mobile && (
                        <>
                          <span>•</span>
                          <a
                            href={`tel:${mobile}`}
                            className="text-decoration-none d-inline-flex align-items-center gap-1 text-primary fw-semibold"
                          >
                            <i className="bi bi-telephone-fill" style={{ fontSize: '0.8rem' }} />
                            {mobile}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status & Serial Badges */}
                <div className="d-flex flex-column align-items-end gap-1">
                  <span
                    className="badge rounded-pill px-3 py-2 fw-bold fs-6 shadow-xs"
                    style={{
                      backgroundColor: status === 'in_consultation' ? '#0D7D72' : status === 'completed' || status === 'prescription_pending' ? '#059669' : '#0f172a',
                      color: '#ffffff',
                    }}
                  >
                    Serial #{serialNo}
                  </span>
                  <div className="d-flex gap-1 flex-wrap mt-1">
                    <VisitSourceBadge source={visitSource} />
                    <PriorityFlag isPriority={isPriority} reason={priorityReason} />
                    <StatusBadge status={status} />
                  </div>
                </div>
              </div>
            </div>

            {/* Doctor info banner if available */}
            {(doctorName || specialityName) && (
              <div className="card border-0 shadow-sm rounded-3 p-3 mb-3 bg-white">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2 text-muted small">
                    <i className="bi bi-hospital fs-5" style={{ color: '#0D7D72' }} />
                    <div>
                      Consulting: <strong className="text-dark">Dr. {doctorName || 'Assigned Doctor'}</strong>
                      {specialityName && <span className="ms-1 text-muted">({specialityName})</span>}
                    </div>
                  </div>
                  <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 small">
                    <i className="bi bi-tag me-1 text-secondary" />
                    {visitType}
                  </span>
                </div>
              </div>
            )}

            {/* Priority Reason Alert if set */}
            {isPriority && priorityReason && (
              <div className="alert alert-danger border-danger d-flex align-items-center gap-2 py-2 px-3 mb-3 shadow-xs rounded-3">
                <i className="bi bi-exclamation-triangle-fill fs-5" />
                <div className="small">
                  <strong>Priority Case:</strong> {priorityReason}
                </div>
              </div>
            )}

            {/* Grid: Timing & Lifecycle Timeline */}
            <div className="row g-3">
              {/* Timing Card */}
              <div className="col-md-6">
                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white">
                  <h6 className="fw-bold text-muted text-uppercase small mb-3">
                    <i className="bi bi-calendar3 me-1.5" style={{ color: '#0D7D72' }} />
                    Schedule & Timing
                  </h6>

                  <div className="d-flex flex-column gap-2 small">
                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Appointment Date:</span>
                      <strong className="text-dark">
                        {apptDate ? formatDateDisplay(apptDate) : formatDateDisplay(new Date())}
                      </strong>
                    </div>

                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Allocated Time Slot:</span>
                      <strong className="text-dark">
                        {startTime ? formatTimeDisplay(startTime) : '—'}
                        {endTime ? ` - ${formatTimeDisplay(endTime)}` : ''}
                      </strong>
                    </div>

                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Visit Type:</span>
                      <span className="badge bg-light text-dark border">{visitType}</span>
                    </div>

                    <div className="d-flex justify-content-between py-1">
                      <span className="text-muted">Source:</span>
                      <span className="fw-semibold text-capitalize">{visitSource.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lifecycle & Status Card */}
              <div className="col-md-6">
                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white">
                  <h6 className="fw-bold text-muted text-uppercase small mb-3">
                    <i className="bi bi-stopwatch me-1.5" style={{ color: '#0D7D72' }} />
                    Queue & Visit Progress
                  </h6>

                  <div className="d-flex flex-column gap-2 small">
                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Check-in Status:</span>
                      {checkedInAt ? (
                        <span className="text-success fw-semibold">
                          <i className="bi bi-check-circle-fill me-1" />
                          Present at {formatTimeDisplay(checkedInAt)}
                        </span>
                      ) : (
                        <span className="text-muted">
                          <i className="bi bi-hourglass me-1" />
                          Not arrived yet
                        </span>
                      )}
                    </div>

                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Chamber Entry:</span>
                      {consultStartedAt ? (
                        <span className="text-primary fw-semibold">
                          <i className="bi bi-door-open-fill me-1" />
                          {formatTimeDisplay(consultStartedAt)}
                        </span>
                      ) : (
                        <span className="text-muted">Not entered</span>
                      )}
                    </div>

                    <div className="d-flex justify-content-between py-1 border-bottom">
                      <span className="text-muted">Consultation Ended:</span>
                      {consultEndedAt ? (
                        <span className="text-success fw-semibold">
                          <i className="bi bi-check2-circle me-1" />
                          {formatTimeDisplay(consultEndedAt)}
                        </span>
                      ) : (
                        <span className="text-muted">In queue / in room</span>
                      )}
                    </div>

                    {expectedStartAt != null && (
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-muted">Estimated Call:</span>
                        <strong className="text-primary">~{formatTimeDisplay(expectedStartAt)}</strong>
                      </div>
                    )}

                    {bookedAt && (
                      <div className="d-flex justify-content-between py-1">
                        <span className="text-muted">Booked At:</span>
                        <span className="text-muted">{formatTimeDisplay(bookedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Skipped warning if applicable */}
            {skippedAt && (
              <div className="alert alert-warning border-warning mt-3 mb-0 py-2 px-3 small d-flex align-items-center gap-2">
                <i className="bi bi-skip-forward-circle-fill fs-5" />
                <div>
                  Patient was temporarily skipped at <strong>{formatTimeDisplay(skippedAt)}</strong>. They can rejoin the queue at any time.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer border-0 px-4 py-3 bg-white d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              Appt ID: <code className="text-muted" style={{ fontSize: '0.75rem' }}>{appt.id?.slice(0, 8)}...</code>
            </span>
            <button
              type="button"
              className="btn px-4 fw-semibold text-white"
              style={{ backgroundColor: '#0D7D72' }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
