import React from 'react';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { todayDhaka, formatTime } from '@/lib/format';
import { StatusBadge } from '@/components/appointments/StatusBadge';
import Link from 'next/link';

export default async function CompounderDashboard() {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const today = todayDhaka();

    // Get compounder info + assigned doctor
    const { data: compounder } = await supabase
        .from('compounders')
        .select('assigned_doctor_id')
        .eq('id', user.id)
        .single();

    const doctorId = compounder?.assigned_doctor_id;

    // No doctor assigned - empty state
    if (!doctorId) {
        return (
            <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
                <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                    <DashboardSidebar role="compounder" />
                    <div className="flex-grow-1 p-4 p-md-5">
                        <div className="text-center py-5">
                            <i className="bi bi-info-circle display-1 text-muted"></i>
                            <h3 className="mt-3 text-muted">No Doctor Assigned</h3>
                            <p className="text-muted">Contact the admin to get assigned to a doctor before you can use this portal.</p>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // Doctor info
    const { data: doctor } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', doctorId)
        .single();

    // Doctor speciality
    const { data: docSpeciality } = await supabase
        .from('doctors')
        .select('designation')
        .eq('id', doctorId)
        .single();

    // Doctor session today
    const { data: sessions } = await supabase
        .from('doctor_sessions')
        .select('status')
        .eq('doctor_id', doctorId)
        .eq('session_date', today)
        .limit(1);
    
    const sessionStatus = sessions?.[0]?.status || 'not_started';

    // Today's appointments - explicit field list (C13)
    const { data: appointments } = await supabase
        .from('appointments')
        .select('id, serial_no, start_time, status, visit_source, is_priority, priority_reason, checked_in_at, patient:patients!inner(full_name, uhid, mobile:mobile_no, gender)')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', today)
        .order('serial_no', { ascending: true });

    const appts = appointments || [];
    const counts = {
        notArrived: appts.filter(a => a.status === 'scheduled').length,
        waiting: appts.filter(a => a.status === 'checked_in').length,
        inConsultation: appts.filter(a => a.status === 'in_consultation').length,
        completed: appts.filter(a => a.status === 'completed').length,
        noShow: appts.filter(a => a.status === 'no_show').length,
    };

    // Next 3 expected patients (scheduled, ordered by serial)
    const nextPatients = appts.filter(a => a.status === 'scheduled').slice(0, 3);

    const sessionLabels: Record<string, { label: string; color: string }> = {
        not_started: { label: 'Not Started', color: 'text-muted' },
        open: { label: 'Open', color: 'text-success' },
        paused: { label: 'Paused', color: 'text-warning' },
        ended: { label: 'Ended', color: 'text-danger' },
    };
    const sess = sessionLabels[sessionStatus] || sessionLabels.not_started;

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="compounder" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid" style={{ maxWidth: '1200px' }}>
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>
                                <i className="bi bi-grid me-2"></i>Dashboard
                            </h2>
                        </div>

                        {/* Doctor Card */}
                        <div className="card border-0 shadow-sm rounded-3 mb-4" style={{ borderLeft: '4px solid #0D7D72' }}>
                            <div className="card-body d-flex align-items-center gap-3 p-4">
                                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                                    <i className="bi bi-person-badge fs-3" style={{ color: '#0D7D72' }}></i>
                                </div>
                                <div>
                                    <h5 className="m-0 fw-bold">Dr. {doctor?.full_name}</h5>
                                    <small className="text-muted">{docSpeciality?.designation || 'General Physician'}</small>
                                </div>
                                <div className="ms-auto text-end">
                                    <small className="text-muted d-block">Session Today</small>
                                    <span className={`fw-bold ${sess.color}`}>
                                        <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>
                                        {sess.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="row g-3 mb-4">
                            {[
                                { label: 'Not Yet Arrived', count: counts.notArrived, icon: 'bi-clock', color: '#6c757d' },
                                { label: 'Waiting', count: counts.waiting, icon: 'bi-hourglass-split', color: '#17a2b8' },
                                { label: 'In Consultation', count: counts.inConsultation, icon: 'bi-chat-dots', color: '#6f42c1' },
                                { label: 'Completed', count: counts.completed, icon: 'bi-check-circle', color: '#28a745' },
                                { label: 'No Show', count: counts.noShow, icon: 'bi-x-circle', color: '#343a40' },
                            ].map((s) => (
                                <div className="col-6 col-md" key={s.label}>
                                    <div className="card border-0 shadow-sm rounded-3 h-100">
                                        <div className="card-body text-center py-3">
                                            <i className={`bi ${s.icon} fs-4`} style={{ color: s.color }}></i>
                                            <div className="display-6 fw-bold mt-1" style={{ color: s.color }}>{s.count}</div>
                                            <small className="text-muted">{s.label}</small>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Next Expected + Quick Actions */}
                        <div className="row g-4">
                            <div className="col-md-7">
                                <div className="card border-0 shadow-sm rounded-3">
                                    <div className="card-header bg-white border-0 pt-4 px-4">
                                        <h5 className="m-0 fw-bold"><i className="bi bi-people me-2"></i>Next Expected Patients</h5>
                                    </div>
                                    <div className="card-body px-4">
                                        {nextPatients.length === 0 ? (
                                            <p className="text-muted text-center py-3">No patients waiting to arrive.</p>
                                        ) : (
                                            <div className="list-group list-group-flush">
                                                {nextPatients.map((a: any) => (
                                                    <div key={a.id} className="list-group-item d-flex align-items-center gap-3 px-0 py-3">
                                                        <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fw-bold">#{a.serial_no}</span>
                                                        <div>
                                                            <div className="fw-medium">{(a.patient as any)?.full_name}</div>
                                                            <small className="text-muted">{(a.patient as any)?.uhid} · {formatTime(a.start_time)}</small>
                                                        </div>
                                                        <StatusBadge status={a.status} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-5">
                                <div className="card border-0 shadow-sm rounded-3">
                                    <div className="card-header bg-white border-0 pt-4 px-4">
                                        <h5 className="m-0 fw-bold"><i className="bi bi-lightning me-2"></i>Quick Actions</h5>
                                    </div>
                                    <div className="card-body px-4 d-grid gap-2">
                                        <Link href="/compounder/bookings" className="btn btn-outline-primary d-flex align-items-center gap-2 py-3">
                                            <i className="bi bi-calendar-check"></i> Today&apos;s Bookings
                                        </Link>
                                        <Link href="/compounder/walk-in" className="btn btn-outline-success d-flex align-items-center gap-2 py-3">
                                            <i className="bi bi-person-plus"></i> Add Walk-in
                                        </Link>
                                        <Link href="/compounder/upload" className="btn btn-outline-secondary d-flex align-items-center gap-2 py-3">
                                            <i className="bi bi-file-arrow-up"></i> Upload Document
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
