import React from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { todayDhaka } from '@/lib/format';
import Link from 'next/link';
import DoctorTodayAppointmentsClient, { TodayAppointment } from '@/components/doctor/DoctorTodayAppointmentsClient';

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
            payment_status,
            paid_amount,
            prescription_record_id,
            patient:patients!inner(id, full_name, uhid, mobile:mobile_no, gender, dob)
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

    const session = sessions?.[0] || null;

    // Fetch Doctor's profile
    const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

    return (
        <main className="main pt-5" style={{ backgroundColor: '#F5F9FC' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="doctor" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid #E3EAF3' }}>
                            <div>
                                <h2 className="m-0" style={{ color: '#1B2978' }}>
                                    <i className="bi bi-calendar-check me-2"></i>Today&apos;s Appointments & Chamber Queue
                                </h2>
                                <small className="text-muted">Live serial tracking, queue management and consultation slips</small>
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

                        <DoctorTodayAppointmentsClient
                            appointments={(appointments as unknown as TodayAppointment[]) || []}
                            todayDate={today}
                            doctorName={profile?.full_name || 'Doctor'}
                            session={session}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
