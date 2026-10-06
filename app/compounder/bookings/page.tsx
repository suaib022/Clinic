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

    // Explicit field list for compounder (C13) - no age, dob, email, notes, medical data
    const selectFields = `
        id, serial_no, appointment_date, start_time, end_time, status, visit_type,
        visit_source, is_priority, priority_reason, checked_in_at, scheduled_start,
        created_by_user_id, status_changed_by, created_at,
        patient:patients!inner(full_name, uhid, mobile:mobile_no, gender)
    `;

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
                        todayAppts={todayAppts || []}
                        upcomingAppts={upcomingAppts || []}
                        previousAppts={previousAppts || []}
                        currentUserId={user.id}
                        initialTab={tab}
                    />
                </div>
            </div>
        </main>
    );
}
