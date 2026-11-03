import React from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { todayDhaka, formatTime, formatTimeOnly } from '@/lib/format';
import { StatusBadge, VisitSourceBadge, PriorityFlag } from '@/components/appointments/StatusBadge';
import Link from 'next/link';

export default async function DoctorAppointmentsPage() {
    const { user } = await requireRole(['doctor', 'admin']);
    const supabase = await createClient();
    const today = todayDhaka();

    // Fetch Today's Appointments for this doctor
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`
            id,
            serial_no,
            start_time,
            end_time,
            status,
            visit_type,
            visit_source,
            is_priority,
            priority_reason,
            checked_in_at,
            consult_started_at,
            consult_ended_at,
            patient:patients!inner(id, full_name, uhid, mobile:mobile_no, gender)
        `)
        .eq('doctor_id', user.id)
        .eq('appointment_date', today)
        .order('serial_no', { ascending: true });

    // Fetch Today's Session
    const { data: sessions } = await supabase
        .from('doctor_sessions')
        .select('*')
        .eq('doctor_id', user.id)
        .eq('session_date', today)
        .order('created_at', { ascending: false })
        .limit(1);

    const session = sessions?.[0];
    const chamberStatus = session?.status || 'not_started';

    const appts = appointments || [];
    const inConsult = appts.find(a => a.status === 'in_consultation');
    const waitingCount = appts.filter(a => a.status === 'checked_in').length;
    const completedCount = appts.filter(a => a.status === 'completed').length;
    const scheduledCount = appts.filter(a => a.status === 'scheduled').length;

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="doctor" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <div>
                                <h2 className="m-0" style={{ color: '#0D7D72' }}>
                                    <i className="bi bi-calendar-check me-2"></i>Today&apos;s Appointments & Chamber Queue
                                </h2>
                                <small className="text-muted">Live serial tracking and consultation overview</small>
                            </div>
                            <div className="d-flex gap-2">
                                <Link href="/doctor/schedule" className="btn btn-outline-danger btn-sm">
                                    <i className="bi bi-calendar-x me-1"></i>Cancel Schedule / Days
                                </Link>
                                <Link href="/doctor/all-appointments" className="btn btn-outline-secondary btn-sm">
                                    <i className="bi bi-list-ul me-1"></i>All Appointments
                                </Link>
                            </div>
                        </div>

                        {/* Chamber Status Bar */}
                        <div className="card border-0 shadow-sm rounded-3 mb-4" style={{ borderLeft: '4px solid #0D7D72' }}>
                            <div className="card-body p-4">
                                <div className="row align-items-center g-3">
                                    <div className="col-md-7">
                                        <h5 className="fw-bold mb-1">
                                            Chamber Status:{' '}
                                            <span className={`badge ${
                                                chamberStatus === 'open' ? 'bg-success' :
                                                chamberStatus === 'paused' ? 'bg-warning text-dark' : 'bg-secondary'
                                            }`}>
                                                {chamberStatus === 'open' ? 'ACTIVE' :
                                                 chamberStatus === 'paused' ? 'PAUSED' : 'NOT STARTED'}
                                            </span>
                                        </h5>
                                        <small className="text-muted">
                                            {session?.started_at ? `Started at ${formatTimeOnly(session.started_at)}` : 'Chamber not yet started by staff'}
                                            {session && session.delay_minutes > 0 && (
                                                <span className="text-danger ms-2 fw-semibold">
                                                    · Delay: {session.delay_minutes} min ({session.delay_reason || 'Emergency delay'})
                                                </span>
                                            )}
                                        </small>
                                    </div>
                                    <div className="col-md-5 text-md-end">
                                        <span className="badge bg-light text-dark border px-3 py-2 fs-6">
                                            Currently Inside: <strong>{inConsult ? `#${inConsult.serial_no} (${(inConsult.patient as any)?.full_name})` : 'Room Available'}</strong>
                                        </span>
                                    </div>
                                </div>

                                <div className="row g-2 mt-3 pt-3 border-top text-center">
                                    <div className="col-3">
                                        <small className="text-muted d-block">Present & Waiting</small>
                                        <strong className="fs-5 text-info">{waitingCount}</strong>
                                    </div>
                                    <div className="col-3">
                                        <small className="text-muted d-block">Not Yet Arrived</small>
                                        <strong className="fs-5 text-secondary">{scheduledCount}</strong>
                                    </div>
                                    <div className="col-3">
                                        <small className="text-muted d-block">Completed</small>
                                        <strong className="fs-5 text-success">{completedCount}</strong>
                                    </div>
                                    <div className="col-3">
                                        <small className="text-muted d-block">Total Today</small>
                                        <strong className="fs-5 text-dark">{appts.length}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Serials List */}
                        <div className="card border-0 shadow-sm rounded-3">
                            <div className="card-header bg-white border-0 pt-4 px-4">
                                <h5 className="m-0 fw-bold">Queue Serials</h5>
                            </div>
                            <div className="card-body p-4">
                                {appts.length === 0 ? (
                                    <div className="text-center py-5 text-muted">
                                        <i className="bi bi-inbox fs-1"></i>
                                        <p className="mt-2 mb-0">No appointments scheduled for today.</p>
                                    </div>
                                ) : (
                                    <div className="list-group list-group-flush">
                                        {appts.map((a: any) => (
                                            <div
                                                key={a.id}
                                                className={`list-group-item d-flex align-items-center justify-content-between p-3 rounded-2 mb-2 border ${
                                                    a.status === 'in_consultation' ? 'bg-primary-subtle border-primary' : 'bg-light'
                                                }`}
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <span className={`badge rounded-pill px-3 py-2 fw-bold fs-6 ${
                                                        a.status === 'in_consultation' ? 'bg-success text-white' : 'bg-white text-dark border'
                                                    }`}>
                                                        #{a.serial_no}
                                                    </span>
                                                    <div>
                                                        <div className="fw-bold d-flex align-items-center gap-2">
                                                            {(a.patient as any)?.full_name}
                                                            {a.status === 'in_consultation' && (
                                                                <span className="badge bg-primary text-white" style={{ fontSize: '0.7rem' }}>
                                                                    IN ROOM
                                                                </span>
                                                            )}
                                                        </div>
                                                        <small className="text-muted">
                                                            {(a.patient as any)?.uhid} · {formatTime(a.start_time)}
                                                            {a.checked_in_at && <> · <span className="text-success">Present</span></>}
                                                        </small>
                                                    </div>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <PriorityFlag isPriority={a.is_priority} reason={a.priority_reason} />
                                                    <VisitSourceBadge source={a.visit_source} />
                                                    <StatusBadge status={a.status} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </main>
    );
}
