import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { getStatusLabel, getStatusBadgeColor } from '@/lib/appointmentStatus';
import { todayDhaka } from '@/lib/format';
import PatientLiveQueueCard from '@/components/queue/PatientLiveQueueCard';
import PatientAppointmentsTable from '@/components/patient/PatientAppointmentsTable';

export default async function PatientAppointmentsPage() {
    const { user } = await requireRole(['patient']);
    const supabase = await createClient();
    const today = todayDhaka();
    
    // Fetch ALL patients for this user account
    const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', user.id);

    const patientIds = patients && patients.length > 0 ? patients.map((p: any) => p.id) : [];

    // Fetch appointments for ALL patients in this account
    let appointments: any[] = [];
    if (patientIds.length > 0) {
        const { data } = await supabase
        .from('appointments')
        .select(`
            id,
            serial_no,
            appointment_date,
            start_time,
            status,
            patient_id,
            doctor_id,
            prescription_record_id,
            cancelled_at,
            cancelled_by_role,
            cancel_reason,
            payment_status,
            paid_amount,
            refund_status,
            doctors:doctor_id (id, full_name),
            medical_records (id, title, file_path, record_type),
            appointment_feedbacks (id, doctor_rating, service_rating, overall_rating, comment, created_at)
        `)
        .in('patient_id', patientIds)
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false });
        appointments = data || [];
    }

    // Fetch active doctors for rebooking modal
    const { data: allDoctors } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'doctor')
        .order('full_name');

    const todayActiveAppts = appointments.filter(
        a => a.appointment_date === today && a.status !== 'cancelled'
    );

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="patient" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Appointments & Live Queue</h2>
                            <a href="/patient/book" className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>Book New Appointment</a>
                        </div>

                        {/* Decision Support: Live Queue Status for Today's Appointments */}
                        {todayActiveAppts.length > 0 && (
                            <div className="mb-4">
                                {todayActiveAppts.map(apt => (
                                    <PatientLiveQueueCard key={apt.id} appointmentId={apt.id} />
                                ))}
                            </div>
                        )}
                        
                        <PatientAppointmentsTable 
                            initialAppointments={appointments} 
                            patients={patients || []} 
                            availableDoctors={allDoctors || []}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
