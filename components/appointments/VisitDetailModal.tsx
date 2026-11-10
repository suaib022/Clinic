'use client';

import React, { useEffect, useState } from 'react';
import { StatusBadge, VisitSourceBadge, PriorityFlag } from './StatusBadge';
import {
  getAppointmentDocuments,
  getDocumentSignedUrl,
  getDocumentDownloadUrl,
} from '@/app/compounder/actions';

export interface DocumentItem {
  id: string;
  title: string;
  description?: string | null;
  file_path: string;
  file_size?: number | null;
  file_type?: string | null;
  created_at?: string;
  record_type?: string;
  document_date?: string;
}

export interface VisitDetailModalProps {
  appt: any | null;
  onClose: () => void;
  doctorName?: string;
  specialityName?: string;
  onOpenUpload?: (appt: any) => void;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function VisitDetailModal({ appt, onClose, doctorName, specialityName, onOpenUpload }: VisitDetailModalProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!appt?.id) {
      setDocuments([]);
      return;
    }

    if (Array.isArray(appt.medical_records) && appt.medical_records.length > 0) {
      setDocuments(appt.medical_records);
    }

    let isMounted = true;
    setLoadingDocs(true);
    setActionError(null);

    getAppointmentDocuments(appt.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.documents) {
          setDocuments(res.documents);
        } else if (res.error) {
          console.warn('Could not load appointment documents:', res.error);
        }
      })
      .catch((err) => {
        console.error('Error fetching appointment documents:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingDocs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [appt?.id, appt?.medical_records]);

  const handleView = async (doc: DocumentItem) => {
    setActionLoadingId(`view-${doc.id}`);
    setActionError(null);
    try {
      const res = await getDocumentSignedUrl(doc.file_path);
      if (res.success && res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      } else {
        setActionError(res.error || 'Failed to open document');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error opening document');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    setActionLoadingId(`dl-${doc.id}`);
    setActionError(null);
    try {
      const extMatch = doc.file_path.match(/\.([^.]+)$/);
      let fileName = doc.title || 'document';
      if (extMatch && !fileName.endsWith(extMatch[0])) {
        fileName += extMatch[0];
      }
      const res = await getDocumentDownloadUrl(doc.file_path, fileName);
      if (res.success && res.url) {
        const link = document.createElement('a');
        link.href = res.url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setActionError(res.error || 'Failed to download document');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error downloading document');
    } finally {
      setActionLoadingId(null);
    }
  };

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

  const consultDurationMin = consultStartedAt && consultEndedAt
    ? Math.max(1, Math.round((new Date(consultEndedAt).getTime() - new Date(consultStartedAt).getTime()) / 60000))
    : null;

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

            {/* Grid: Schedule & Encounter Journey Stepper */}
            <div className="row g-3">
              {/* Schedule & Timing Card */}
              <div className="col-md-5">
                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white">
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <h6 className="fw-bold text-muted text-uppercase small m-0">
                      <i className="bi bi-calendar-event me-1.5" style={{ color: '#0D7D72' }} />
                      Schedule & Details
                    </h6>
                    <span className="badge bg-light text-secondary border font-monospace" style={{ fontSize: '0.75rem' }}>
                      #{serialNo}
                    </span>
                  </div>

                  <div className="d-flex flex-column gap-2 small">
                    <div className="d-flex justify-content-between py-1.5 border-bottom">
                      <span className="text-muted">Appointment Date:</span>
                      <strong className="text-dark">
                        {apptDate ? formatDateDisplay(apptDate) : formatDateDisplay(new Date())}
                      </strong>
                    </div>

                    <div className="d-flex justify-content-between py-1.5 border-bottom">
                      <span className="text-muted">Time Slot:</span>
                      <strong className="text-dark">
                        {startTime ? formatTimeDisplay(startTime) : '—'}
                        {endTime ? ` – ${formatTimeDisplay(endTime)}` : ''}
                      </strong>
                    </div>

                    <div className="d-flex justify-content-between py-1.5 border-bottom">
                      <span className="text-muted">Visit Type:</span>
                      <span className="badge bg-light text-dark border px-2 py-1">{visitType}</span>
                    </div>

                    <div className="d-flex justify-content-between py-1.5 border-bottom">
                      <span className="text-muted">Booking Source:</span>
                      <span className="fw-semibold text-capitalize text-dark">{visitSource.replace('_', ' ')}</span>
                    </div>

                    <div className="d-flex justify-content-between py-1.5">
                      <span className="text-muted">Live Queue Status:</span>
                      <StatusBadge status={status} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Queue Journey Stepper Card */}
              <div className="col-md-7">
                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white">
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <h6 className="fw-bold text-muted text-uppercase small m-0">
                      <i className="bi bi-diagram-3-fill me-1.5" style={{ color: '#0D7D72' }} />
                      Encounter Journey
                    </h6>
                    {consultDurationMin && (
                      <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill">
                        <i className="bi bi-stopwatch me-1" />
                        {consultDurationMin}m consultation
                      </span>
                    )}
                  </div>

                  <div className="d-flex flex-column gap-2.5 small">
                    {/* Step 1: Booking */}
                    <div className="d-flex align-items-start gap-2.5">
                      <div className="rounded-circle d-flex align-items-center justify-content-center bg-light text-primary border flex-shrink-0" style={{ width: 28, height: 28 }}>
                        <i className="bi bi-calendar-check" style={{ fontSize: '0.8rem' }} />
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-semibold text-dark">Appointment Booked</span>
                          <span className="text-muted">{bookedAt ? formatTimeDisplay(bookedAt) : 'Confirmed'}</span>
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Registered via {visitSource.replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Arrival / Check-in */}
                    <div className="d-flex align-items-start gap-2.5">
                      <div className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${checkedInAt ? 'bg-success text-white' : 'bg-light text-muted border'}`} style={{ width: 28, height: 28 }}>
                        <i className={`bi ${checkedInAt ? 'bi-check2' : 'bi-person-check'}`} style={{ fontSize: '0.85rem' }} />
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center">
                          <span className={`fw-semibold ${checkedInAt ? 'text-success' : 'text-muted'}`}>Patient Arrival</span>
                          {checkedInAt ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle">{formatTimeDisplay(checkedInAt)}</span>
                          ) : (
                            <span className="text-muted">Not arrived</span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {checkedInAt ? 'Checked in & present in waiting room' : 'Awaiting arrival at clinic desk'}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Chamber Consultation */}
                    <div className="d-flex align-items-start gap-2.5">
                      <div className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${consultEndedAt ? 'bg-success text-white' : consultStartedAt ? 'bg-primary text-white' : 'bg-light text-muted border'}`} style={{ width: 28, height: 28 }}>
                        <i className={`bi ${consultEndedAt ? 'bi-check-all' : consultStartedAt ? 'bi-door-open-fill' : 'bi-door-closed'}`} style={{ fontSize: '0.85rem' }} />
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center">
                          <span className={`fw-semibold ${consultEndedAt ? 'text-success' : consultStartedAt ? 'text-primary' : 'text-muted'}`}>Doctor Consultation</span>
                          {consultEndedAt ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle">{formatTimeDisplay(consultEndedAt)}</span>
                          ) : consultStartedAt ? (
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle">In Chamber ({formatTimeDisplay(consultStartedAt)})</span>
                          ) : (
                            <span className="text-muted">In Queue</span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {consultStartedAt && consultEndedAt 
                            ? `In chamber: ${formatTimeDisplay(consultStartedAt)} – ${formatTimeDisplay(consultEndedAt)} (${consultDurationMin} min)`
                            : consultStartedAt 
                            ? `Patient entered chamber at ${formatTimeDisplay(consultStartedAt)}`
                            : expectedStartAt 
                            ? `Estimated call time: ~${formatTimeDisplay(expectedStartAt)}` 
                            : 'Pending consultation call'}
                        </div>
                      </div>
                    </div>

                    {/* Step 4: Prescription & Records */}
                    <div className="d-flex align-items-start gap-2.5">
                      <div className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${documents.length > 0 ? 'bg-success text-white' : status === 'prescription_pending' ? 'bg-warning text-dark' : 'bg-light text-muted border'}`} style={{ width: 28, height: 28 }}>
                        <i className={`bi ${documents.length > 0 ? 'bi-file-earmark-check-fill' : status === 'prescription_pending' ? 'bi-file-earmark-medical-fill' : 'bi-file-earmark'}`} style={{ fontSize: '0.85rem' }} />
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center">
                          <span className={`fw-semibold ${documents.length > 0 ? 'text-success' : status === 'prescription_pending' ? 'text-warning-emphasis' : 'text-muted'}`}>Prescription & Vault</span>
                          {documents.length > 0 ? (
                            <span className="badge bg-success text-white">{documents.length} File{documents.length > 1 ? 's' : ''}</span>
                          ) : status === 'prescription_pending' ? (
                            <span className="badge bg-warning text-dark border border-warning">Rx Pending</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {documents.length > 0
                            ? `${documents.length} document(s) uploaded to Medical Records Vault`
                            : status === 'prescription_pending'
                            ? 'Consultation finished; awaiting prescription upload to complete visit'
                            : 'Will be available upon visit completion'}
                        </div>
                      </div>
                    </div>
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

            {/* Action error banner if view/download fails */}
            {actionError && (
              <div className="alert alert-danger border-danger mt-3 mb-0 py-2 px-3 small d-flex align-items-center justify-content-between">
                <span>{actionError}</span>
                <button type="button" className="btn-close btn-sm" onClick={() => setActionError(null)} />
              </div>
            )}

            {/* Uploaded Documents & Prescriptions Section */}
            <div className="card border-0 shadow-sm rounded-3 mt-3 p-3 bg-white">
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-file-earmark-medical-fill fs-5" style={{ color: '#0D7D72' }} />
                  <h6 className="fw-bold text-dark m-0" style={{ fontSize: '0.95rem' }}>
                    Uploaded Documents & Prescriptions
                  </h6>
                  <span className="badge rounded-pill bg-light text-dark border ms-1" style={{ fontSize: '0.75rem' }}>
                    {documents.length}
                  </span>
                </div>
                {onOpenUpload && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success fw-semibold d-inline-flex align-items-center gap-1 shadow-xs"
                    style={{ fontSize: '0.8rem' }}
                    onClick={() => onOpenUpload(appt)}
                  >
                    <i className="bi bi-cloud-arrow-up-fill" />
                    {documents.length > 0 ? 'Upload Another Document' : 'Upload Document'}
                  </button>
                )}
              </div>

              {loadingDocs && documents.length === 0 ? (
                <div className="text-center py-4 text-muted small">
                  <span className="spinner-border spinner-border-sm me-2 text-success" role="status" />
                  Loading attached documents...
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-4 px-3 rounded-3 bg-light border border-dashed">
                  <i className="bi bi-file-earmark-text text-muted fs-2 d-block mb-1" />
                  <p className="text-muted small mb-2">No prescriptions or documents uploaded for this visit yet.</p>
                  {onOpenUpload && (status === 'prescription_pending' || status === 'completed') && (
                    <button
                      type="button"
                      className="btn btn-sm btn-success fw-bold px-3 shadow-xs"
                      onClick={() => onOpenUpload(appt)}
                    >
                      <i className="bi bi-upload me-1.5" />
                      Upload Prescription / Document Now
                    </button>
                  )}
                </div>
              ) : (
                <div className="d-flex flex-column gap-2.5">
                  {documents.map((doc) => {
                    const isPdf = doc.file_type?.includes('pdf') || doc.file_path?.toLowerCase().endsWith('.pdf');
                    const isImage = doc.file_type?.includes('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.file_path);
                    const isViewing = actionLoadingId === `view-${doc.id}`;
                    const isDownloading = actionLoadingId === `dl-${doc.id}`;

                    return (
                      <div
                        key={doc.id}
                        className="d-flex align-items-center justify-content-between p-2.5 rounded-3 border bg-light bg-opacity-50 hover-shadow-sm transition-all flex-wrap gap-2"
                      >
                        <div className="d-flex align-items-center gap-3" style={{ minWidth: 220, flex: 1 }}>
                          <div
                            className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-xs"
                            style={{
                              width: 44,
                              height: 44,
                              backgroundColor: isPdf ? '#fee2e2' : isImage ? '#e0f2fe' : '#e2e8f0',
                              color: isPdf ? '#dc2626' : isImage ? '#0284c7' : '#475569',
                            }}
                          >
                            <i className={`bi fs-4 ${isPdf ? 'bi-file-earmark-pdf-fill' : isImage ? 'bi-file-earmark-image-fill' : 'bi-file-earmark-text-fill'}`} />
                          </div>
                          <div className="overflow-hidden">
                            <div className="fw-semibold text-dark text-truncate" style={{ fontSize: '0.9rem', maxWidth: 440 }} title={doc.title}>
                              {doc.title || 'Attached Document'}
                            </div>
                            <div className="text-muted d-flex align-items-center gap-2 flex-wrap mt-0.5" style={{ fontSize: '0.78rem' }}>
                              <span className="badge bg-white text-secondary border px-1.5 py-0.5 text-uppercase" style={{ fontSize: '0.7rem' }}>
                                {doc.record_type ? doc.record_type.replace('_', ' ') : 'Document'}
                              </span>
                              {doc.file_size ? <span>{formatBytes(doc.file_size)}</span> : null}
                              {doc.created_at && (
                                <>
                                  <span>•</span>
                                  <span>{formatDateDisplay(doc.created_at)}</span>
                                </>
                              )}
                            </div>
                            {doc.description && doc.description !== doc.title && (
                              <div className="text-muted small text-truncate mt-1" style={{ fontSize: '0.78rem', maxWidth: 440 }}>
                                <i className="bi bi-chat-left-text me-1 text-secondary" />
                                {doc.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-2 ms-auto">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary fw-semibold d-inline-flex align-items-center gap-1 shadow-xs"
                            disabled={Boolean(actionLoadingId)}
                            onClick={() => handleView(doc)}
                            title="Open and view document in a new browser tab"
                          >
                            {isViewing ? (
                              <>
                                <span className="spinner-border spinner-border-sm" role="status" />
                                <span>Opening...</span>
                              </>
                            ) : (
                              <>
                                <i className="bi bi-eye-fill text-primary" />
                                <span>View</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary fw-semibold d-inline-flex align-items-center gap-1 shadow-xs"
                            disabled={Boolean(actionLoadingId)}
                            onClick={() => handleDownload(doc)}
                            title="Download document to device"
                          >
                            {isDownloading ? (
                              <>
                                <span className="spinner-border spinner-border-sm" role="status" />
                                <span>Downloading...</span>
                              </>
                            ) : (
                              <>
                                <i className="bi bi-download" />
                                <span>Download</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer border-0 px-4 py-3 bg-white d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              Appt ID: <code className="text-muted" style={{ fontSize: '0.75rem' }}>{appt.id?.slice(0, 8)}...</code>
            </span>
            <div className="d-flex align-items-center gap-2">
              {onOpenUpload && (status === 'prescription_pending' || status === 'completed') && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success fw-semibold d-inline-flex align-items-center gap-1"
                  onClick={() => onOpenUpload(appt)}
                >
                  <i className="bi bi-upload" />
                  {documents.length > 0 ? 'Upload More' : 'Upload Document'}
                </button>
              )}
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
    </div>
  );
}
