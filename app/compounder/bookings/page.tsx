import React from 'react';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { todayDhaka } from '@/lib/format';
import BookingsClient from './BookingsClient';

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const today = todayDhaka();
    const params = await searchParams;
    const tab = params.tab || 'today';

    // Get assigned doctor
    const { data: compounder } = await supabase
        .from('compounders')
        .select('assigned_doctor_id')
        .eq('id', user.id)
        .single();

    const doctorId = compounder?.assigned_doctor_id;

    if (!doctorId) {
        return (
            <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
                <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                    <DashboardSidebar role="compounder" />
                    <div className="flex-grow-1 p-4 p-md-5">
                        <div className="text-center py-5">
                            <i className="bi bi-info-circle display-1 text-muted"></i>
                            <h3 className="mt-3 text-muted">No Doctor Assigned</h3>
                            <p className="text-muted">Contact the admin to get assigned to a doctor.</p>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // Explicit field list for compounder (C13) - including consultation timestamps for queue DSS
    const selectFields = `
        id, serial_no, appointment_date, start_time, end_time, status, visit_type,
        visit_source, is_priority, priority_reason, checked_in_at, scheduled_start,
        consult_started_at, consult_ended_at,
        created_by_user_id, status_changed_by, created_at,
        patient:patients!inner(full_name, uhid, mobile:mobile_no, gender)
    `;

    // Fetch Doctor Info
    const { data: doctor } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', doctorId)
        .single();

    // Fetch Doctor Speciality
    const { data: docSpecs } = await supabase
        .from('doctor_specialities')
        .select('speciality:specialities!inner(name)')
        .eq('doctor_id', doctorId)
        .limit(1);

    const specialityName = (docSpecs?.[0]?.speciality as any)?.name || 'General Physician';

    // Fetch Benchmark for this Speciality
    const { data: benchmarkRow } = await supabase
        .from('department_benchmarks')
        .select('*')
        .eq('speciality_name', specialityName)
        .single();

    // Fetch Doctor Session Today
    const { data: sessions } = await supabase
        .from('doctor_sessions')
        .select('id, status, started_at, scheduled_start, delay_minutes, delay_reason')
        .eq('doctor_id', doctorId)
        .eq('session_date', today)
        .order('created_at', { ascending: false })
        .limit(1);

    const doctorSession = sessions?.[0] || null;

    // Fetch Today's Scheduled Working Hours
    const todayDateObj = new Date();
    const dayOfWeek = todayDateObj.getDay();
    const { data: schedule } = await supabase
        .from('doctor_schedules')
        .select('start_time, end_time')
        .eq('doctor_id', doctorId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .limit(1);

    const scheduledStartTime = schedule?.[0]?.start_time || doctorSession?.scheduled_start || '09:00:00';

    // Fetch today's appointments
    const { data: todayAppts } = await supabase
        .from('appointments')
        .select(selectFields)
        .eq('doctor_id', doctorId)
        .eq('appointment_date', today)
        .order('serial_no', { ascending: true });

    // Fetch upcoming (next 30 days)
    const { data: upcomingAppts } = await supabase
        .from('appointments')
        .select(selectFields)
        .eq('doctor_id', doctorId)
        .gt('appointment_date', today)
        .eq('status', 'scheduled')
        .order('appointment_date', { ascending: true })
        .order('serial_no', { ascending: true })
        .limit(100);

    // Fetch previous (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: previousAppts } = await supabase
        .from('appointments')
        .select(selectFields)
        .eq('doctor_id', doctorId)
        .lt('appointment_date', today)
        .gte('appointment_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('appointment_date', { ascending: false })
        .order('serial_no', { ascending: false })
        .limit(100);

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="compounder" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <BookingsClient
                        todayAppts={(todayAppts as any) || []}
                        upcomingAppts={(upcomingAppts as any) || []}
                        previousAppts={(previousAppts as any) || []}
                        currentUserId={user.id}
                        initialTab={tab}
                        doctorName={doctor?.full_name || 'Assigned Doctor'}
                        specialityName={specialityName}
                        doctorSession={doctorSession}
                        scheduledStartTime={scheduledStartTime}
                        benchmarkMinutes={benchmarkRow?.avg_consult_minutes || 10}
                    />
                </div>
            </div>
        </main>
    );
}
