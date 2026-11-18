'use client';
import React, { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge, VisitSourceBadge, PriorityFlag } from '@/components/appointments/StatusBadge';
import VisitDetailModal from '@/components/appointments/VisitDetailModal';
import { getAvailableActions } from '@/lib/appointmentActions';
import { formatTime, formatDate, formatTimeOnly } from '@/lib/format';
import {
    checkInAppointment,
    undoCheckIn,
    markNoShow,
    setPriority,
    retractWalkIn,
    startConsultation,
    endConsultation,
    completeConsultation,
    uploadVisitPrescription,
    startChamberSession,
    recordChamberDelay,
    pauseChamberSession,
    resumeChamberSession,
    endChamberSession,
    getDocumentSignedUrl
} from '../actions';

interface Appointment {
    id: string;
    serial_no: number;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    visit_type: string;
    visit_source: string;
    is_priority: boolean;
    priority_reason: string;
    checked_in_at: string | null;
    scheduled_start: string | null;
    consult_started_at: string | null;
    consult_ended_at: string | null;
    prescription_record_id?: string | null;
    medical_records?: Array<{
        id: string;
        title: string;
        description?: string | null;
        file_path: string;
        file_size?: number | null;
        file_type?: string | null;
        created_at?: string;
        record_type?: string;
    }> | null;
    created_by_user_id: string | null;
    status_changed_by: string | null;
    created_at: string;
    patient: { full_name: string; uhid: string; mobile: string; gender: string };
}

interface DoctorSession {
    id: string;
    status: string;
    started_at: string | null;
    scheduled_start: string | null;
    delay_minutes: number;
    delay_reason: string | null;
    ended_at?: string | null;
    created_at?: string;
}

export default function BookingsClient({
    todayAppts,
    upcomingAppts,
    previousAppts,
    currentUserId,
    initialTab,
    doctorName,
    doctorEmail,
    specialityName,
    doctorSession,
    scheduledStartTime,
    benchmarkMinutes
}: {
    todayAppts: Appointment[];
    upcomingAppts: Appointment[];
    previousAppts: Appointment[];
    currentUserId: string;
    initialTab: string;
    doctorName?: string;
    doctorEmail?: string;
    specialityName?: string;
    doctorSession?: DoctorSession | null;
    scheduledStartTime?: string;
    benchmarkMinutes?: number;
}) {
    const router = useRouter();
    const [tab, setTab] = useState(initialTab);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [isPending, startTransition] = useTransition();
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [priorityModal, setPriorityModal] = useState<string | null>(null);
    const [priorityReason, setPriorityReason] = useState('');
    const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
    const [openingDocId, setOpeningDocId] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Chamber delay modal state
    const [delayModalOpen, setDelayModalOpen] = useState(false);
    const [delayMinutesInput, setDelayMinutesInput] = useState('30');
    const [delayReasonInput, setDelayReasonInput] = useState('Doctor delayed due to emergency');

    // Prescription upload modal state
    const [prescriptionModalAppt, setPrescriptionModalAppt] = useState<Appointment | null>(null);
    const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
    const [prescriptionNotes, setPrescriptionNotes] = useState('');
    const [isUploadingPrescription, setIsUploadingPrescription] = useState(false);

    const handleEndConsultation = async (appt: Appointment) => {
        await doAction(() => endConsultation(appt.id));
        setPrescriptionModalAppt(appt);
        setPrescriptionFile(null);
        setPrescriptionNotes('');
    };

    const handlePrescriptionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prescriptionModalAppt || !prescriptionFile) {
            alert('Please select a document file (PDF or image).');
            return;
        }
        setIsUploadingPrescription(true);
        try {
            const formData = new FormData();
            formData.append('appointmentId', prescriptionModalAppt.id);
            formData.append('file', prescriptionFile);
            formData.append('notes', prescriptionNotes);

            const res = await uploadVisitPrescription(formData);
            if (res.success) {
                setActionMessage({ type: 'success', text: res.message || 'Document uploaded successfully!' });
                setPrescriptionModalAppt(null);
                setPrescriptionFile(null);
                setPrescriptionNotes('');
                router.refresh();
            } else {
                setActionMessage({ type: 'error', text: res.error || 'Failed to upload prescription.' });
            }
        } catch (err: any) {
            setActionMessage({ type: 'error', text: err.message || 'Upload failed.' });
        } finally {
            setIsUploadingPrescription(false);
            setTimeout(() => setActionMessage(null), 6000);
        }
    };

    // Auto refresh every 20s
    React.useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
            setLastUpdated(new Date());
        }, 20000);

        const handleVisibility = () => {
            if (!document.hidden) {
                router.refresh();
                setLastUpdated(new Date());
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [router]);

    const handleTabChange = (newTab: string) => {
        setTab(newTab);
        setSearch('');
        setStatusFilter('ALL');
        const url = new URL(window.location.href);
        url.searchParams.set('tab', newTab);
        router.push(url.pathname + url.search);
    };

    const doAction = async (actionFn: () => Promise<{ success: boolean; error?: string }>) => {
        setActionMessage(null);
        startTransition(async () => {
            const result = await actionFn();
            if (result.success) {
                setActionMessage({ type: 'success', text: 'Action completed successfully!' });
                router.refresh();
                setLastUpdated(new Date());
            } else {
                setActionMessage({ type: 'error', text: result.error || 'Something went wrong. Please refresh and try again.' });
            }
            setTimeout(() => setActionMessage(null), 5000);
        });
    };

    const handleStartChamber = async () => {
        const delay = parseInt(delayMinutesInput || '0', 10);
        await doAction(() => startChamberSession(scheduledStartTime, delayReasonInput, delay));
        setDelayModalOpen(false);
    };

    const handleRecordDelay = async () => {
        const delay = parseInt(delayMinutesInput || '0', 10);
        await doAction(() => recordChamberDelay(delay, delayReasonInput));
        setDelayModalOpen(false);
    };

    const consultationDoneAppts = useMemo(() => {
        return todayAppts.filter(
            a => a.status === 'prescription_pending' || a.status === 'completed' || Boolean(a.consult_ended_at && a.status !== 'in_consultation')
        );
    }, [todayAppts]);
    const consultationDoneCount = consultationDoneAppts.length;

    const filteredAppts = useMemo(() => {
        let list: Appointment[] = [];
        if (tab === 'today') {
            const active = todayAppts.filter(a => a.status !== 'cancelled');
            const cancelled = todayAppts.filter(a => a.status === 'cancelled');
            list = [...active, ...cancelled];
        } else if (tab === 'done') {
            list = consultationDoneAppts;
        } else if (tab === 'upcoming') {
            list = upcomingAppts;
        } else {
            list = previousAppts;
        }

        if (statusFilter !== 'ALL') {
            list = list.filter(a => a.status === statusFilter);
        }

        if (search.trim()) {
            const s = search.trim().toLowerCase();
            list = list.filter(a =>
                a.patient?.full_name?.toLowerCase().includes(s) ||
                a.patient?.uhid?.toLowerCase().includes(s) ||
                a.patient?.mobile?.includes(s)
            );
        }

        return list;
    }, [tab, todayAppts, consultationDoneAppts, upcomingAppts, previousAppts, statusFilter, search]);

    // Live Queue DSS Counters for Today
    const currentInConsult = todayAppts.find(a => a.status === 'in_consultation');
    const waitingPresentCount = todayAppts.filter(a => a.status === 'checked_in').length;
    const notArrivedCount = todayAppts.filter(a => a.status === 'scheduled').length;
    const completedCount = todayAppts.filter(a => a.status === 'completed').length;
    const prescriptionPendingAppts = todayAppts.filter(a => a.status === 'prescription_pending');
    const prescriptionPendingCount = prescriptionPendingAppts.length;
    const chamberStatus = doctorSession?.status || 'not_started';

    const renderRow = (a: Appointment, showActions: boolean) => {
        const isTodayRow = tab === 'today' || tab === 'done';
        const actions = showActions ? getAvailableActions('compounder', a.status as any, {
            isToday: isTodayRow,
            visitSource: a.visit_source as any,
            checkedInAt: a.checked_in_at,
            createdByUserId: a.created_by_user_id,
            statusChangedBy: a.status_changed_by,
            currentUserId,
            scheduledStart: a.scheduled_start,
            createdAt: a.created_at,
        }) : null;

        const isCurrentlyInside = a.status === 'in_consultation';
        const isRxPending = a.status === 'prescription_pending';
        const isCompleted = a.status === 'completed';
        const isConsultationDone = isRxPending || isCompleted || Boolean(a.consult_ended_at && a.status !== 'in_consultation');
        const apptDocs = (a.medical_records && a.medical_records.length > 0) ? a.medical_records : [];
        const hasDocs = apptDocs.length > 0 || Boolean(a.prescription_record_id);

        const cardBorderLeft = isCurrentlyInside
            ? '5px solid #1B2978'
            : isRxPending
            ? '5px solid #f59e0b'
            : isCompleted
            ? '5px solid #10b981'
            : a.status === 'checked_in'
            ? '5px solid #0284c7'
            : '5px solid #cbd5e1';

        const cardBg = isCurrentlyInside
            ? '#f0fdf9'
            : isRxPending
            ? '#fffdf5'
            : '#ffffff';

        const cardBorderColor = isCurrentlyInside
            ? '#C9D6F5'
            : isRxPending
            ? '#fed7aa'
            : '#e2e8f0';

        const serialBg = isCurrentlyInside
            ? '#1B2978'
            : isCompleted
            ? '#059669'
            : isRxPending
            ? '#fef3c7'
            : a.status === 'checked_in'
            ? '#e0f2fe'
            : '#f1f5f9';

        const serialColor = isCurrentlyInside || isCompleted
            ? '#ffffff'
            : isRxPending
            ? '#92400e'
            : a.status === 'checked_in'
            ? '#0369a1'
            : '#475569';

        return (
            <div
                key={a.id}
                className="card shadow-xs rounded-3 mb-2.5 transition-all hover-shadow-sm"
                style={{
                    cursor: 'pointer',
                    backgroundColor: cardBg,
                    border: `1px solid ${cardBorderColor}`,
                    borderLeft: cardBorderLeft,
                    opacity: a.status === 'cancelled' ? 0.6 : 1,
                    transition: 'all 0.15s ease-in-out'
                }}
                onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, a, input, label, select, textarea')) return;
                    setDetailAppt(a);
                }}
                title="Click to view comprehensive visit details"
            >
                <div className="card-body p-3">
                    {/* Top Row: Serial, Time, Patient Name & Highlights, Phone, Badges */}
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            {/* Serial Badge */}
                            <span
                                className="badge rounded-pill px-3 py-1.5 fw-bold fs-6 shadow-xs"
                                style={{
                                    backgroundColor: serialBg,
                                    color: serialColor,
                                    border: isRxPending ? '1px solid #fde047' : a.status === 'checked_in' ? '1px solid #7dd3fc' : 'none'
                                }}
                            >
                                {a.serial_no ? `#${a.serial_no}` : 'N/A'}
                            </span>

                            {/* Time Slot */}
                            <span className="badge bg-light text-secondary border px-2 py-1 font-monospace" style={{ fontSize: '0.8rem' }}>
                                <i className="bi bi-clock me-1 text-muted" />
                                {formatTime(a.start_time)}
                            </span>

                            {/* Patient Name & Status Highlights */}
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <span className="fw-bold text-dark fs-6">{a.patient?.full_name}</span>

                                {isCurrentlyInside && (
                                    <span className="badge bg-primary text-white shadow-xs" style={{ fontSize: '0.75rem', animation: 'pulse 2s infinite' }}>
                                        <i className="bi bi-person-walking me-1"></i>IN CHAMBER
                                    </span>
                                )}
                                {isRxPending && (
                                    <span className="badge text-dark border shadow-xs" style={{ backgroundColor: '#fef08a', borderColor: '#fde047', fontSize: '0.75rem' }}>
                                        <i className="bi bi-file-earmark-medical-fill text-warning me-1"></i>RX PENDING
                                    </span>
                                )}
                                {isCompleted && (
                                    <span className="badge text-white shadow-xs" style={{ backgroundColor: '#15803d', fontSize: '0.75rem' }}>
                                        <i className="bi bi-check-all me-1"></i>VISIT COMPLETED
                                    </span>
                                )}
                                {!isRxPending && !isCompleted && isConsultationDone && (
                                    <span className="badge text-white shadow-xs" style={{ backgroundColor: '#059669', fontSize: '0.75rem' }}>
                                        <i className="bi bi-check2-circle me-1"></i>CONSULTATION DONE
                                    </span>
                                )}
                            </div>

                            {/* UHID in monospace pill & Gender */}
                            <span className="badge bg-white text-secondary border px-2 py-0.5 font-monospace" style={{ fontSize: '0.75rem' }}>
                                {a.patient?.uhid}
                            </span>
                            {a.patient?.gender && (
                                <span className="text-muted small">· {a.patient.gender}</span>
                            )}
                        </div>

                        {/* Right side: Phone & Badges */}
                        <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
                            {a.patient?.mobile && (
                                <a
                                    href={`tel:${a.patient.mobile}`}
                                    className="text-decoration-none d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill border bg-white text-primary fw-semibold small shadow-xs"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <i className="bi bi-telephone-fill" style={{ fontSize: '0.75rem' }} />
                                    <span>{a.patient.mobile}</span>
                                </a>
                            )}
                            <VisitSourceBadge source={a.visit_source} />
                            <PriorityFlag isPriority={a.is_priority} reason={a.priority_reason} />
                            <StatusBadge status={a.status} />
                        </div>
                    </div>

                    {/* Queue Journey Milestones Bar */}
                    {(a.checked_in_at || a.consult_started_at || a.consult_ended_at) && (
                        <div className="d-flex align-items-center gap-3 flex-wrap mt-2 pt-1 small text-muted">
                            {a.checked_in_at && (
                                <span className="d-inline-flex align-items-center gap-1 text-success fw-semibold">
                                    <i className="bi bi-check-circle-fill text-success" />
                                    <span>Present {formatTimeOnly(a.checked_in_at)}</span>
                                </span>
                            )}
                            {a.consult_started_at && (
                                <span className="d-inline-flex align-items-center gap-1 text-primary fw-semibold">
                                    <span>•</span>
                                    <i className="bi bi-door-open-fill text-primary" />
                                    <span>Chamber {formatTimeOnly(a.consult_started_at)}</span>
                                </span>
                            )}
                            {a.consult_ended_at && (
                                <span className="d-inline-flex align-items-center gap-1 text-success fw-semibold">
                                    <span>•</span>
                                    <i className="bi bi-check2-circle text-success" />
                                    <span>Finished {formatTimeOnly(a.consult_ended_at)}</span>
                                </span>
                            )}
                            {hasDocs && (
                                <span className="d-inline-flex align-items-center gap-1 ms-auto text-success fw-semibold bg-success bg-opacity-10 px-2 py-0.5 rounded-pill border border-success-subtle">
                                    <i className="bi bi-paperclip" />
                                    <span>{apptDocs.length || 1} Document{apptDocs.length > 1 ? 's' : ''} Attached</span>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Actions row */}
                    {showActions && actions && (
                        <div className="mt-2.5 pt-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div className="d-flex gap-2 flex-wrap align-items-center">
                                {/* Check In / Mark Present */}
                                {actions.check_in.allowed && (
                                    <button className="btn btn-sm btn-success fw-semibold px-3 shadow-xs" disabled={isPending} onClick={() => doAction(() => checkInAppointment(a.id))}>
                                        <i className="bi bi-check2-circle me-1"></i>Mark Present (Check In)
                                    </button>
                                )}

                                {/* Call into Chamber (In Consultation) */}
                                {actions.start_consultation.allowed && (
                                    <button
                                        className="btn btn-sm text-white fw-bold px-3 shadow-xs"
                                        disabled={isPending}
                                        style={{ backgroundColor: '#1B2978', borderColor: '#1B2978' }}
                                        onClick={() => doAction(() => startConsultation(a.id))}
                                        title="Call patient into doctor chamber"
                                    >
                                        <i className="bi bi-door-open me-1"></i>Enter Chamber / Call
                                    </button>
                                )}

                                {/* In Consultation -> Visit Done (Frees room, opens Rx upload) */}
                                {a.status === 'in_consultation' && (
                                    <button
                                        className="btn btn-sm btn-success fw-bold px-3 shadow-xs"
                                        disabled={isPending}
                                        onClick={() => handleEndConsultation(a)}
                                        title="Mark doctor consultation done, frees chamber for next patient, and prepares prescription"
                                    >
                                        <i className="bi bi-door-closed me-1"></i>Visit Done (Prepare Rx)
                                    </button>
                                )}

                                {/* Prescription Pending -> Upload Prescription OR Complete Visit */}
                                {a.status === 'prescription_pending' && (
                                    <>
                                        <button
                                            className="btn btn-sm btn-warning text-dark fw-bold px-3 shadow-xs"
                                            disabled={isPending}
                                            onClick={() => {
                                                setPrescriptionModalAppt(a);
                                                setPrescriptionFile(null);
                                                setPrescriptionNotes('');
                                            }}
                                            title="Upload patient prescription to complete visit"
                                        >
                                            <i className="bi bi-file-earmark-arrow-up-fill me-1"></i>Upload Prescription
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-success fw-semibold px-3 shadow-xs"
                                            disabled={isPending}
                                            onClick={() => {
                                                if (confirm(`Mark visit for Serial #${a.serial_no} (${a.patient?.full_name}) as Completed without uploading documents?`)) {
                                                    doAction(() => completeConsultation(a.id));
                                                }
                                            }}
                                            title="Mark visit completed without uploading prescription"
                                        >
                                            <i className="bi bi-check2-circle me-1"></i>Complete Visit
                                        </button>
                                    </>
                                )}

                                {/* View Document(s) for Consultation Done / Completed Visits */}
                                {hasDocs && (
                                    <button
                                        className="btn btn-sm btn-outline-success fw-semibold px-3 shadow-sm d-inline-flex align-items-center gap-1.5"
                                        disabled={isPending || openingDocId === a.id}
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (apptDocs.length === 1 && apptDocs[0].file_path) {
                                                setOpeningDocId(a.id);
                                                try {
                                                    const res = await getDocumentSignedUrl(apptDocs[0].file_path);
                                                    if (res.success && res.url) {
                                                        window.open(res.url, '_blank', 'noopener,noreferrer');
                                                    } else {
                                                        setDetailAppt(a);
                                                    }
                                                } catch {
                                                    setDetailAppt(a);
                                                } finally {
                                                    setOpeningDocId(null);
                                                }
                                            } else {
                                                setDetailAppt(a);
                                            }
                                        }}
                                        title={apptDocs.length === 1 ? `View ${apptDocs[0].title || 'Prescription'}` : 'View uploaded documents for this visit'}
                                    >
                                        {openingDocId === a.id ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm text-success" role="status" />
                                                <span>Opening...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-file-earmark-check-fill text-success" />
                                                <span>View Document{apptDocs.length > 1 ? `s (${apptDocs.length})` : ''}</span>
                                            </>
                                        )}
                                    </button>
                                )}

                                {/* Completed -> Upload Further Documents */}
                                {a.status === 'completed' && (
                                    <button
                                        className="btn btn-sm btn-outline-primary fw-semibold px-3 shadow-xs"
                                        disabled={isPending}
                                        onClick={() => {
                                            setPrescriptionModalAppt(a);
                                            setPrescriptionFile(null);
                                            setPrescriptionNotes('');
                                        }}
                                        title="Upload additional prescription or medical document for this patient"
                                    >
                                        <i className="bi bi-file-earmark-arrow-up me-1"></i>Upload Document
                                    </button>
                                )}

                                {actions.undo_check_in.allowed && (
                                    <button className="btn btn-sm btn-outline-warning fw-semibold" disabled={isPending} onClick={() => doAction(() => undoCheckIn(a.id))}>
                                        <i className="bi bi-arrow-counterclockwise me-1"></i>Undo Present
                                    </button>
                                )}

                                {actions.mark_no_show.allowed && (
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        disabled={isPending}
                                        onClick={() => {
                                            if (confirm('Mark this patient as no-show?')) doAction(() => markNoShow(a.id, 'Patient did not arrive'));
                                        }}
                                    >
                                        <i className="bi bi-x-circle me-1"></i>No Show
                                    </button>
                                )}

                                {actions.set_priority.allowed && !a.is_priority && (
                                    <button className="btn btn-sm btn-outline-danger fw-semibold" disabled={isPending} onClick={() => setPriorityModal(a.id)}>
                                        <i className="bi bi-exclamation-triangle me-1"></i>Priority
                                    </button>
                                )}

                                {actions.retract_walk_in.allowed && (
                                    <button
                                        className="btn btn-sm btn-outline-danger fw-semibold"
                                        disabled={isPending}
                                        onClick={() => {
                                            if (confirm('Retract this walk-in? It will be cancelled as "created in error".')) doAction(() => retractWalkIn(a.id));
                                        }}
                                    >
                                        <i className="bi bi-trash me-1"></i>Retract Walk-in
                                    </button>
                                )}
                            </div>

                            <div className="ms-auto text-muted small d-flex align-items-center gap-1 opacity-75" style={{ fontSize: '0.78rem' }}>
                                <span>Details</span>
                                <i className="bi bi-chevron-right" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="container-fluid" style={{ maxWidth: '1200px' }}>
            {/* Page Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid #E3EAF3' }}>
                <div>
                    <h2 className="m-0" style={{ color: '#1B2978' }}>
                        <i className="bi bi-calendar-check me-2"></i>Appointments & Chamber Queue
                    </h2>
                    <small className="text-muted">
                        Assigned to: <strong>Dr. {doctorName || 'Doctor'}</strong> ({specialityName || 'General'})
                        {doctorEmail && (
                            <span className="ms-2 d-inline-flex align-items-center gap-1">
                                • <i className="bi bi-envelope" style={{ color: '#1B2978' }}></i>
                                <a href={`mailto:${doctorEmail}`} className="text-decoration-none text-muted">
                                    {doctorEmail}
                                </a>
                            </span>
                        )}
                    </small>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <small className="text-muted">Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</small>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => { router.refresh(); setLastUpdated(new Date()); }}>
                        <i className="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
            </div>

            {/* Chamber Status & Control Center (Decision Support System) */}
            {tab === 'today' && (
                <div className="card border-0 shadow-sm rounded-3 mb-4" style={{ borderLeft: '5px solid #1B2978' }}>
                    <div className="card-body p-4">
                        <div className="row align-items-center g-3">
                            <div className="col-md-7">
                                <div className="d-flex align-items-center gap-3">
                                    <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white"
                                        style={{
                                            width: 48,
                                            height: 48,
                                            backgroundColor:
                                                chamberStatus === 'open'
                                                    ? '#28a745'
                                                    : chamberStatus === 'paused'
                                                    ? '#ffc107'
                                                    : chamberStatus === 'ended'
                                                    ? '#475569'
                                                    : '#6c757d'
                                        }}
                                    >
                                        <i
                                            className={`bi fs-4 ${
                                                chamberStatus === 'open'
                                                    ? 'bi-activity'
                                                    : chamberStatus === 'paused'
                                                    ? 'bi-pause-circle-fill'
                                                    : chamberStatus === 'ended'
                                                    ? 'bi-door-closed-fill'
                                                    : 'bi-door-closed'
                                            }`}
                                        ></i>
                                    </div>
                                    <div>
                                        <h5 className="m-0 fw-bold d-flex align-items-center gap-2 flex-wrap">
                                            <span>Chamber Status:</span>
                                            <span
                                                className={`badge ${
                                                    chamberStatus === 'open'
                                                        ? 'bg-success'
                                                        : chamberStatus === 'paused'
                                                        ? 'bg-warning text-dark'
                                                        : chamberStatus === 'ended'
                                                        ? 'bg-secondary text-white'
                                                        : 'bg-light text-secondary border'
                                                }`}
                                            >
                                                {chamberStatus === 'open'
                                                    ? 'ACTIVE / IN PROGRESS'
                                                    : chamberStatus === 'paused'
                                                    ? 'PAUSED / BREAK'
                                                    : chamberStatus === 'ended'
                                                    ? 'SESSION CONCLUDED TODAY'
                                                    : 'NOT STARTED YET'}
                                            </span>
                                        </h5>
                                        <div className="text-muted small mt-1 d-flex align-items-center gap-2 flex-wrap">
                                            <span>Scheduled: <strong>{scheduledStartTime ? formatTime(scheduledStartTime) : '10:00 AM'}</strong></span>
                                            {doctorSession?.started_at && (
                                                <>
                                                    <span>•</span>
                                                    <span>Started: <strong>{formatTimeOnly(doctorSession.started_at)}</strong></span>
                                                </>
                                            )}
                                            {chamberStatus === 'ended' && doctorSession?.ended_at && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-secondary fw-semibold">
                                                        <i className="bi bi-stop-circle me-1"></i>
                                                        Ended: <strong>{formatTimeOnly(doctorSession.ended_at)}</strong>
                                                    </span>
                                                </>
                                            )}
                                            {chamberStatus !== 'ended' && doctorSession && doctorSession.delay_minutes > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-danger fw-semibold">
                                                        <i className="bi bi-exclamation-circle me-1"></i>
                                                        Delayed by {doctorSession.delay_minutes} min
                                                        {doctorSession.delay_reason ? ` (${doctorSession.delay_reason})` : ''}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-5 d-flex gap-2 justify-content-md-end flex-wrap align-items-center">
                                {chamberStatus === 'not_started' && (
                                    <>
                                        <button
                                            className="btn btn-success fw-bold px-3 shadow-xs"
                                            disabled={isPending}
                                            onClick={() => setDelayModalOpen(true)}
                                        >
                                            <i className="bi bi-play-circle-fill me-1.5"></i>Start Chamber Today
                                        </button>
                                        <button
                                            className="btn btn-outline-warning text-dark fw-semibold"
                                            disabled={isPending}
                                            onClick={() => setDelayModalOpen(true)}
                                        >
                                            <i className="bi bi-clock-history me-1"></i>Announce Delay
                                        </button>
                                    </>
                                )}
                                {chamberStatus === 'ended' && (
                                    <>
                                        <button
                                            className="btn btn-success fw-bold px-3 shadow-xs d-inline-flex align-items-center gap-1.5"
                                            disabled={isPending}
                                            onClick={() => {
                                                setDelayMinutesInput('0');
                                                setDelayReasonInput('');
                                                setDelayModalOpen(true);
                                            }}
                                            title="Start a new chamber session today (allows multiple sessions per day)"
                                        >
                                            <i className="bi bi-arrow-repeat fs-6"></i>
                                            <span>Start New Session Today</span>
                                        </button>
                                        <button
                                            className="btn btn-outline-warning text-dark fw-semibold"
                                            disabled={isPending}
                                            onClick={() => setDelayModalOpen(true)}
                                            title="Announce delay for upcoming evening or secondary session"
                                        >
                                            <i className="bi bi-clock-history me-1"></i>Announce Delay
                                        </button>
                                    </>
                                )}
                                {chamberStatus === 'open' && (
                                    <>
                                        <button
                                            className="btn btn-sm btn-outline-warning text-dark fw-semibold"
                                            disabled={isPending}
                                            onClick={() => setDelayModalOpen(true)}
                                        >
                                            <i className="bi bi-clock-history me-1"></i>Update Delay
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-secondary fw-semibold"
                                            disabled={isPending}
                                            onClick={() => {
                                                const reason = prompt('Reason for short break / pause:', 'Doctor emergency consultation / 10 min break');
                                                if (reason) doAction(() => pauseChamberSession(reason));
                                            }}
                                        >
                                            <i className="bi bi-pause-fill me-1"></i>Take Break
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-danger fw-semibold"
                                            disabled={isPending}
                                            onClick={() => {
                                                if (confirm('End today’s doctor chamber session? You can start a new session later today if needed.')) doAction(() => endChamberSession());
                                            }}
                                        >
                                            <i className="bi bi-stop-circle me-1"></i>End Session
                                        </button>
                                    </>
                                )}
                                {chamberStatus === 'paused' && (
                                    <div className="d-flex gap-2 flex-wrap">
                                        <button
                                            className="btn btn-success fw-bold px-3 shadow-xs"
                                            disabled={isPending}
                                            onClick={() => doAction(() => resumeChamberSession())}
                                        >
                                            <i className="bi bi-play-circle me-1"></i>Resume Chamber
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-danger fw-semibold"
                                            disabled={isPending}
                                            onClick={() => {
                                                if (confirm('End today’s doctor chamber session? You can start a new session later today if needed.')) doAction(() => endChamberSession());
                                            }}
                                        >
                                            <i className="bi bi-stop-circle me-1"></i>End Session
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* DSS Live Serial Indicators Bar */}
                        <div className="row g-2 mt-3 pt-3 border-top align-items-stretch">
                            <div className="col-6 col-md">
                                <div
                                    className="card h-100 border-0 shadow-xs rounded-3 p-2.5 text-center d-flex flex-column justify-content-center"
                                    style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                                >
                                    <div className="d-flex align-items-center justify-content-center gap-1 text-muted small fw-semibold text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.3px' }}>
                                        <i className="bi bi-door-open-fill text-primary" />
                                        <span>Serving Inside</span>
                                    </div>
                                    <div className="mt-1">
                                        {currentInConsult ? (
                                            <>
                                                <div className="fs-5 fw-bold text-primary lh-1">#{currentInConsult.serial_no}</div>
                                                <div className="small text-muted text-truncate mt-1" style={{ fontSize: '12px' }} title={(currentInConsult.patient as any)?.full_name}>
                                                    {(currentInConsult.patient as any)?.full_name}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="fs-5 fw-bold text-muted lh-1">Empty</div>
                                                <div className="small text-muted mt-1" style={{ fontSize: '12px' }}>Chamber ready</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="col-6 col-md">
                                <div
                                    className="card h-100 border-0 shadow-xs rounded-3 p-2.5 text-center d-flex flex-column justify-content-center"
                                    style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                                >
                                    <div className="d-flex align-items-center justify-content-center gap-1 text-muted small fw-semibold text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.3px' }}>
                                        <i className="bi bi-people-fill text-info" />
                                        <span>Present & Waiting</span>
                                    </div>
                                    <div className="mt-1">
                                        <div className="fs-5 fw-bold text-dark lh-1">{waitingPresentCount}</div>
                                        <div className="small text-muted mt-1" style={{ fontSize: '12px' }}>
                                            {waitingPresentCount === 1 ? 'Patient in queue' : 'Patients in queue'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-6 col-md">
                                <div
                                    className="card h-100 border-0 shadow-xs rounded-3 p-2.5 text-center d-flex flex-column justify-content-center"
                                    style={{
                                        backgroundColor: prescriptionPendingCount > 0 ? '#fefce8' : '#f8fafc',
                                        border: prescriptionPendingCount > 0 ? '1px solid #fde047' : '1px solid #e2e8f0'
                                    }}
                                >
                                    <div className="d-flex align-items-center justify-content-center gap-1 text-muted small fw-semibold text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.3px' }}>
                                        <i className="bi bi-file-earmark-medical-fill text-warning" />
                                        <span>Rx Pending</span>
                                    </div>
                                    <div className="mt-1">
                                        <div className={`fs-5 fw-bold lh-1 ${prescriptionPendingCount > 0 ? 'text-warning-emphasis' : 'text-dark'}`}>
                                            {prescriptionPendingCount}
                                        </div>
                                        <div className="small text-muted mt-1" style={{ fontSize: '12px' }}>
                                            {prescriptionPendingCount === 1 ? 'Needs prescription' : 'Need prescription'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-6 col-md">
                                <div
                                    className="card h-100 border-0 shadow-xs rounded-3 p-2.5 text-center d-flex flex-column justify-content-center"
                                    style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                                >
                                    <div className="d-flex align-items-center justify-content-center gap-1 text-muted small fw-semibold text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.3px' }}>
                                        <i className="bi bi-check-circle-fill text-success" />
                                        <span>Visits Completed</span>
                                    </div>
                                    <div className="mt-1">
                                        <div className="fs-5 fw-bold text-success lh-1">{completedCount}</div>
                                        <div className="small text-muted mt-1" style={{ fontSize: '12px' }}>
                                            {completedCount === 1 ? 'Visit completed' : 'Visits completed'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-6 col-md">
                                <div
                                    className="card h-100 border-0 shadow-xs rounded-3 p-2.5 text-center d-flex flex-column justify-content-center"
                                    style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                                >
                                    <div className="d-flex align-items-center justify-content-center gap-1 text-muted small fw-semibold text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.3px' }}>
                                        <i className="bi bi-stopwatch-fill text-secondary" />
                                        <span>Benchmark</span>
                                    </div>
                                    <div className="mt-1">
                                        <div className="fs-5 fw-bold text-dark lh-1">~{benchmarkMinutes || 10}m</div>
                                        <div className="small text-muted mt-1" style={{ fontSize: '12px' }}>Avg visit target</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Prescription Pending Callout Banner */}
            {(tab === 'today' || tab === 'done') && prescriptionPendingCount > 0 && (
                <div className="alert alert-warning border-warning d-flex flex-wrap align-items-center justify-content-between mb-3 shadow-sm py-2 px-3 gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-file-earmark-medical-fill fs-4 text-warning"></i>
                        <div>
                            <strong>{prescriptionPendingCount} patient{prescriptionPendingCount > 1 ? 's' : ''} awaiting prescription upload.</strong>
                            <div className="text-muted small">Doctor room is free for the next patient. Upload prescription to finalize visits.</div>
                        </div>
                    </div>
                    <button
                        className="btn btn-sm btn-warning text-dark fw-bold shadow-sm"
                        onClick={() => {
                            setPrescriptionModalAppt(prescriptionPendingAppts[0]);
                            setPrescriptionFile(null);
                            setPrescriptionNotes('');
                        }}
                    >
                        <i className="bi bi-upload me-1"></i>Upload for Serial #{prescriptionPendingAppts[0].serial_no}
                    </button>
                </div>
            )}

            {/* Feedback alert */}
            {actionMessage && (
                <div className={`alert alert-${actionMessage.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`}>
                    {actionMessage.text}
                    <button type="button" className="btn-close" onClick={() => setActionMessage(null)}></button>
                </div>
            )}

            {/* Navigation Tabs */}
            <ul className="nav nav-tabs mb-3">
                {[
                    { key: 'today', label: `Today's Queue (${todayAppts.length})` },
                    { key: 'done', label: `Consultation Done (${consultationDoneCount})` },
                    { key: 'upcoming', label: `Upcoming (${upcomingAppts.length})` },
                    { key: 'previous', label: `Previous (${previousAppts.length})` },
                ].map((t) => (
                    <li className="nav-item" key={t.key}>
                        <button
                            className={`nav-link ${tab === t.key ? 'active fw-bold' : ''}`}
                            style={tab === t.key ? { color: '#1B2978', borderBottomColor: '#1B2978' } : {}}
                            onClick={() => handleTabChange(t.key)}
                        >
                            {t.label}
                        </button>
                    </li>
                ))}
            </ul>

            {/* Filter and Search Bar */}
            <div className="row g-2 mb-3">
                <div className="col-md-8">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search by Patient Name, UHID, or Mobile Number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="col-md-4">
                    <select
                        className="form-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="scheduled">Scheduled (Not Arrived)</option>
                        <option value="checked_in">Present (Waiting)</option>
                        <option value="in_consultation">In Consultation</option>
                        <option value="prescription_pending">Prescription Pending ({prescriptionPendingCount})</option>
                        <option value="completed">Completed ({completedCount})</option>
                        <option value="no_show">No Show</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Appointment List */}
            {filteredAppts.length === 0 ? (
                <div className="card border-0 shadow-sm rounded-3 p-5 text-center text-muted">
                    <i className="bi bi-inbox fs-1"></i>
                    <p className="mt-2 mb-0">
                        {tab === 'done' ? 'No patients have completed consultation yet today.' : 'No appointments found.'}
                    </p>
                </div>
            ) : (
                filteredAppts.map((a) => renderRow(a, tab === 'today' || tab === 'done'))
            )}

            {/* Priority Reason Modal */}
            {priorityModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title fw-bold">Set Priority Visit</h5>
                                <button type="button" className="btn-close" onClick={() => setPriorityModal(null)}></button>
                            </div>
                            <div className="modal-body">
                                <label className="form-label">Clinical / Priority Reason:</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    placeholder="e.g. Elderly patient with acute distress, post-operative emergency, etc."
                                    value={priorityReason}
                                    onChange={(e) => setPriorityReason(e.target.value)}
                                />
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setPriorityModal(null)}>Cancel</button>
                                <button
                                    className="btn btn-danger"
                                    disabled={isPending || !priorityReason.trim()}
                                    onClick={() => {
                                        doAction(() => setPriority(priorityModal, priorityReason));
                                        setPriorityModal(null);
                                        setPriorityReason('');
                                    }}
                                >
                                    Confirm Priority
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Chamber Start / Delay Control Modal */}
            {delayModalOpen && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header text-white" style={{ backgroundColor: '#1B2978' }}>
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-clock-history me-2"></i>
                                    {chamberStatus === 'not_started' 
                                        ? 'Start Chamber / Record Delay' 
                                        : chamberStatus === 'ended' 
                                        ? 'Start New Chamber Session Today' 
                                        : 'Update Chamber Delay'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setDelayModalOpen(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <p className="text-muted small">
                                    {chamberStatus === 'ended' 
                                        ? 'Starting a new chamber session lets you run an evening shift or secondary consultation round today with fresh queue tracking.' 
                                        : 'Keeping the schedule and delay updated ensures the Decision Support System gives accurate, conservative arrival recommendations so patients do not wait unnecessarily.'}
                                </p>
                                <div className="mb-3">
                                    <label className="form-label fw-bold">Delay Minutes (e.g. 0 for on-time, 30 for half hour late):</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="240"
                                        className="form-control"
                                        value={delayMinutesInput}
                                        onChange={(e) => setDelayMinutesInput(e.target.value)}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold">Reason for Delay (Visible on Decision Support alerts):</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Emergency OT at hospital, Heavy traffic, Urgent ICU round"
                                        value={delayReasonInput}
                                        onChange={(e) => setDelayReasonInput(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setDelayModalOpen(false)}>Cancel</button>
                                {chamberStatus === 'not_started' || chamberStatus === 'ended' ? (
                                    <button className="btn btn-success fw-bold px-4" onClick={handleStartChamber} disabled={isPending}>
                                        <i className="bi bi-play-circle me-1"></i>{chamberStatus === 'ended' ? 'Start New Session Now' : 'Start Chamber Now'}
                                    </button>
                                ) : (
                                    <button className="btn btn-primary fw-bold px-4" onClick={handleRecordDelay} disabled={isPending}>
                                        <i className="bi bi-check2-circle me-1"></i>Save Delay Notice
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Prescription / Document Upload Modal */}
            {prescriptionModalAppt && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <form onSubmit={handlePrescriptionSubmit}>
                                <div className="modal-header text-white" style={{ backgroundColor: '#1B2978' }}>
                                    <h5 className="modal-title fw-bold">
                                        <i className="bi bi-file-earmark-arrow-up me-2"></i>
                                        {prescriptionModalAppt.status === 'completed'
                                            ? `Upload Document (Serial #${prescriptionModalAppt.serial_no})`
                                            : `Upload Prescription (Serial #${prescriptionModalAppt.serial_no})`}
                                    </h5>
                                    <button 
                                        type="button" 
                                        className="btn-close btn-close-white" 
                                        disabled={isUploadingPrescription}
                                        onClick={() => setPrescriptionModalAppt(null)}
                                    ></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="bg-light p-3 rounded mb-3 border">
                                        <div className="fw-bold fs-6 text-dark">{prescriptionModalAppt.patient?.full_name}</div>
                                        <div className="text-muted small">
                                            UHID: <strong>{prescriptionModalAppt.patient?.uhid || 'N/A'}</strong> · Serial: <strong>#{prescriptionModalAppt.serial_no}</strong>
                                            {prescriptionModalAppt.status === 'completed' && (
                                                <span className="badge bg-success ms-2">Visit Completed</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold">
                                            {prescriptionModalAppt.status === 'completed' ? 'Document File' : 'Prescription Document'} <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            accept="image/*,.pdf"
                                            required
                                            disabled={isUploadingPrescription}
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setPrescriptionFile(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <div className="form-text">
                                            Supports PDF documents or scanned images (JPG, PNG). Max 15MB.
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold">
                                            {prescriptionModalAppt.status === 'completed' ? 'Document Title / Notes (Optional):' : 'Clinical Notes / Medication Summary (Optional):'}
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows={2}
                                            placeholder={prescriptionModalAppt.status === 'completed' 
                                                ? "e.g. Lab report, follow-up prescription, discharge summary"
                                                : "e.g. 5-day antibiotic course prescribed, follow-up in 2 weeks"}
                                            value={prescriptionNotes}
                                            disabled={isUploadingPrescription}
                                            onChange={(e) => setPrescriptionNotes(e.target.value)}
                                        />
                                    </div>

                                    <div className="alert alert-info py-2 px-3 small mb-0 d-flex align-items-center gap-2">
                                        <i className="bi bi-info-circle-fill fs-5"></i>
                                        <div>
                                            {prescriptionModalAppt.status === 'completed' ? (
                                                <>This document will be added to the patient&apos;s records and immediately accessible in their Medical Records Vault.</>
                                            ) : (
                                                <>Uploading this prescription will mark the visit as <strong>Completed</strong>. The patient can instantly access and download it in their Medical Records Vault.</>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer d-flex justify-content-between flex-wrap gap-2">
                                    <div className="d-flex gap-2">
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-secondary" 
                                            disabled={isUploadingPrescription}
                                            onClick={() => setPrescriptionModalAppt(null)}
                                        >
                                            Cancel
                                        </button>
                                        {prescriptionModalAppt.status === 'prescription_pending' && (
                                            <button
                                                type="button"
                                                className="btn btn-outline-success"
                                                disabled={isUploadingPrescription}
                                                onClick={async () => {
                                                    const apptId = prescriptionModalAppt.id;
                                                    setPrescriptionModalAppt(null);
                                                    await doAction(() => completeConsultation(apptId));
                                                }}
                                                title="Mark this visit complete without uploading any document"
                                            >
                                                <i className="bi bi-check2-circle me-1"></i>Complete Without Document
                                            </button>
                                        )}
                                    </div>
                                    <button 
                                        type="submit" 
                                        className="btn btn-success fw-bold px-4"
                                        disabled={isUploadingPrescription || !prescriptionFile}
                                    >
                                        {isUploadingPrescription ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-check-circle-fill me-1"></i>
                                                {prescriptionModalAppt.status === 'completed' ? 'Upload Document' : 'Upload & Complete Visit'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Visit Details Modal */}
            <VisitDetailModal
                appt={detailAppt}
                onClose={() => setDetailAppt(null)}
                doctorName={doctorName}
                specialityName={specialityName}
                onOpenUpload={(appt) => {
                    setDetailAppt(null);
                    setPrescriptionModalAppt(appt);
                    setPrescriptionFile(null);
                    setPrescriptionNotes('');
                }}
            />
        </div>
    );
}
