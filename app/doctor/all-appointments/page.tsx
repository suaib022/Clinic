import React from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { todayDhaka } from '@/lib/format';
import DoctorAllAppointmentsClient, { DoctorAppointmentItem } from '@/components/doctor/DoctorAllAppointmentsClient';

export default async function AllAppointmentsPage() {
    const { user } = await requireRole(['doctor', 'admin']);
    const supabase = await createClient();
    const today = todayDhaka();

    // Fetch all appointments for this doctor, ordered by most recent first
    const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
            id,
            serial_no,
            appointment_date,
            start_time,
            end_time,
            status,
            visit_type,
            visit_source,
            payment_status,
            paid_amount,
            prescription_record_id,
            patients (
                id,
                full_name,
                uhid,
                mobile_no,
                gender,
                dob
            ),
            appointment_feedbacks (
                doctor_rating,
                service_rating,
                overall_rating,
                comment
            )
        `)
        .eq('doctor_id', user.id)
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false });

    // Fetch doctor's profile name
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
                                    <i className="bi bi-calendar3 me-2"></i>All Appointments
                                </h2>
                                <small className="text-muted">Master history of past, present, and upcoming patient consultations</small>
                            </div>
                        </div>
                        
                        {error ? (
                            <div className="alert alert-danger">Error loading appointments: {error.message}</div>
                        ) : (
                            <DoctorAllAppointmentsClient
                                appointments={(appointments as unknown as DoctorAppointmentItem[]) || []}
                                doctorName={profile?.full_name || 'Doctor'}
                                todayDate={today}
                            />
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
