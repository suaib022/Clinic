'use client';
import React, { useState, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StatusBadge, VisitSourceBadge, PriorityFlag } from '@/components/appointments/StatusBadge';
import { getAvailableActions } from '@/lib/appointmentActions';
import { formatTime, formatDate, formatTimeOnly } from '@/lib/format';
import { checkInAppointment, undoCheckIn, markNoShow, setPriority, retractWalkIn } from '../actions';
import Link from 'next/link';

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
    created_by_user_id: string | null;
    status_changed_by: string | null;
    created_at: string;
    patient: { full_name: string; uhid: string; mobile: string; gender: string };
}

export default function BookingsClient({ todayAppts, upcomingAppts, previousAppts, currentUserId, initialTab }: {
    todayAppts: Appointment[];
    upcomingAppts: Appointment[];
    previousAppts: Appointment[];
    currentUserId: string;
    initialTab: string;
}) {
    const router = useRouter();
    const [tab, setTab] = useState(initialTab);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [isPending, startTransition] = useTransition();
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [priorityModal, setPriorityModal] = useState<string | null>(null);
    const [priorityReason, setPriorityReason] = useState('');
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Auto refresh every 30s
    React.useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
            setLastUpdated(new Date());
        }, 30000);
        
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

    const filteredAppts = useMemo(() => {
        let list: Appointment[] = [];
        if (tab === 'today') {
            // Non-cancelled first, cancelled at bottom
            const active = todayAppts.filter(a => a.status !== 'cancelled');
            const cancelled = todayAppts.filter(a => a.status === 'cancelled');
            list = [...active, ...cancelled];
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
    }, [tab, todayAppts, upcomingAppts, previousAppts, statusFilter, search]);

    const renderRow = (a: Appointment, showActions: boolean) => {
        const actions = showActions ? getAvailableActions('compounder', a.status as any, {
            isToday: tab === 'today',
            visitSource: a.visit_source as any,
            checkedInAt: a.checked_in_at,
            createdByUserId: a.created_by_user_id,
            statusChangedBy: a.status_changed_by,
            currentUserId,
            scheduledStart: a.scheduled_start,
            createdAt: a.created_at,
        }) : null;

        return (
            <div key={a.id} className={`card border-0 shadow-sm rounded-3 mb-2 ${a.status === 'cancelled' ? 'opacity-50' : ''}`}>
                <div className="card-body p-3">
                    <div className="row align-items-center g-2">
                        {/* Serial */}
                        <div className="col-auto">
                            <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold fs-6">
                                {a.serial_no ? `#${a.serial_no}` : 'N/A'}
                            </span>
                        </div>
                        {/* Time */}
                        <div className="col-auto">
                            <small className="text-muted">{formatTime(a.start_time)}</small>
                        </div>
                        {/* Patient Info */}
                        <div className="col">
                            <div className="fw-medium">{a.patient?.full_name}</div>
                            <small className="text-muted">
                                {a.patient?.uhid}
                                {a.patient?.gender && <> · {a.patient.gender}</>}
                            </small>
                        </div>
                        {/* Mobile */}
                        <div className="col-auto d-none d-md-block">
                            {a.patient?.mobile && (
                                <a href={`tel:${a.patient.mobile}`} className="text-decoration-none">
                                    <i className="bi bi-telephone me-1"></i>{a.patient.mobile}
                                </a>
                            )}
                        </div>
                        {/* Badges */}
                        <div className="col-auto d-flex gap-1 flex-wrap">
                            <VisitSourceBadge source={a.visit_source} />
                            <PriorityFlag isPriority={a.is_priority} reason={a.priority_reason} />
                            <StatusBadge status={a.status} />
                        </div>
                        {/* Check-in time */}
                        {a.checked_in_at && (
                            <div className="col-auto">
                                <small className="text-success"><i className="bi bi-clock-fill me-1"></i>Arrived {formatTimeOnly(a.checked_in_at)}</small>
                            </div>
                        )}
                    </div>

                    {/* Actions row */}
                    {showActions && actions && (
                        <div className="mt-2 pt-2 border-top d-flex gap-2 flex-wrap">
                            {actions.check_in.allowed && (
                                <button className="btn btn-sm btn-success" disabled={isPending} onClick={() => doAction(() => checkInAppointment(a.id))}>
                                    <i className="bi bi-check2-circle me-1"></i>Check In
                                </button>
                            )}
                            {actions.undo_check_in.allowed && (
                                <button className="btn btn-sm btn-outline-warning" disabled={isPending} onClick={() => doAction(() => undoCheckIn(a.id))}>
                                    <i className="bi bi-arrow-counterclockwise me-1"></i>Undo Check-in
                                </button>
                            )}
                            {actions.mark_no_show.allowed && (
                                <button className="btn btn-sm btn-outline-dark" disabled={isPending}
                                    onClick={() => { if (confirm('Mark this patient as no-show?')) doAction(() => markNoShow(a.id, 'Patient did not arrive')); }}>
                                    <i className="bi bi-x-circle me-1"></i>No Show
                                </button>
                            )}
                            {!actions.mark_no_show.allowed && a.status === 'scheduled' && tab === 'today' && actions.mark_no_show.reason && (
                                <button className="btn btn-sm btn-outline-dark" disabled title={actions.mark_no_show.reason}>
                                    <i className="bi bi-x-circle me-1"></i>No Show
                                    <small className="ms-1 text-muted">({actions.mark_no_show.reason})</small>
                                </button>
                            )}
                            {actions.set_priority.allowed && !a.is_priority && (
                                <button className="btn btn-sm btn-outline-danger" disabled={isPending} onClick={() => setPriorityModal(a.id)}>
                                    <i className="bi bi-exclamation-triangle me-1"></i>Priority
                                </button>
                            )}
                            {actions.retract_walk_in.allowed && (
                                <button className="btn btn-sm btn-outline-danger" disabled={isPending}
                                    onClick={() => { if (confirm('Retract this walk-in? It will be cancelled as "created in error".')) doAction(() => retractWalkIn(a.id)); }}>
                                    <i className="bi bi-trash me-1"></i>Retract Walk-in
                                </button>
                            )}
                            {/* Upload button (C12) */}
                            {a.status !== 'cancelled' && (
                                <Link href={`/compounder/upload?patient=${a.patient?.uhid}`} className="btn btn-sm btn-outline-secondary ms-auto">
                                    <i className="bi bi-file-arrow-up me-1"></i>Upload
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="container-fluid" style={{ maxWidth: '1200px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                <h2 className="m-0" style={{ color: '#0D7D72' }}>
                    <i className="bi bi-calendar-check me-2"></i>Bookings
                </h2>
                <div className="d-flex align-items-center gap-2">
                    <small className="text-muted">Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</small>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => { router.refresh(); setLastUpdated(new Date()); }}>
                        <i className="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
            </div>

            {/* Feedback */}
            {actionMessage && (
                <div className={`alert alert-${actionMessage.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`}>
                    {actionMessage.text}
                    <button type="button" className="btn-close" onClick={() => setActionMessage(null)}></button>
                </div>
            )}

            {/* Tabs */}
            <ul className="nav nav-tabs mb-3">
                {[
                    { key: 'today', label: `Today (${todayAppts.length})` },
                    { key: 'upcoming', label: `Upcoming (${upcomingAppts.length})` },
                    { key: 'previous', label: `Previous (${previousAppts.length})` },
                ].map(t => (
                    <li className="nav-item" key={t.key}>
                        <button className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => handleTabChange(t.key)}>
                            {t.label}
                        </button>
                    </li>
                ))}
            </ul>

            {/* Filters */}
            <div className="row g-2 mb-3">
                <div className="col-md-6">
                    <input type="text" className="form-control" placeholder="Search by name, UHID, or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="col-md-3">
                    <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="ALL">All Statuses</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="checked_in">Checked In</option>
                        <option value="in_consultation">In Consultation</option>
                        <option value="completed">Completed</option>
                        <option value="no_show">No Show</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* List */}
            {filteredAppts.length === 0 ? (
                <div className="text-center py-5">
                    <i className="bi bi-calendar-x display-4 text-muted"></i>
                    <p className="text-muted mt-2">
                        {tab === 'today' ? 'No appointments for today.' : tab === 'upcoming' ? 'No upcoming appointments.' : 'No previous appointments found.'}
                    </p>
                    {tab === 'today' && (
                        <Link href="/compounder/walk-in" className="btn btn-success mt-2">
                            <i className="bi bi-person-plus me-1"></i>Add Walk-in
                        </Link>
                    )}
                </div>
            ) : (
                filteredAppts.map(a => renderRow(a, tab === 'today'))
            )}

            {/* Priority Modal */}
            {priorityModal && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setPriorityModal(null)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                        <div className="modal-content rounded-3">
                            <div className="modal-header border-0">
                                <h5 className="modal-title">Set Priority</h5>
                                <button type="button" className="btn-close" onClick={() => setPriorityModal(null)}></button>
                            </div>
                            <div className="modal-body">
                                <label className="form-label">Reason <span className="text-danger">*</span></label>
                                <textarea className="form-control" rows={3} value={priorityReason} onChange={e => setPriorityReason(e.target.value)} placeholder="e.g., Elderly patient, emergency..." />
                            </div>
                            <div className="modal-footer border-0">
                                <button className="btn btn-secondary" onClick={() => setPriorityModal(null)}>Cancel</button>
                                <button className="btn btn-danger" disabled={!priorityReason.trim() || isPending}
                                    onClick={() => {
                                        doAction(() => setPriority(priorityModal, priorityReason));
                                        setPriorityModal(null);
                                        setPriorityReason('');
                                    }}>
                                    Set Priority
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
