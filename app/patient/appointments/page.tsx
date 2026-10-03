import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { getStatusLabel, getStatusBadgeColor } from '@/lib/appointmentStatus';

export default async function PatientAppointmentsPage() {
    const { user } = await requireRole(['patient']);
    const supabase = await createClient();
    
    // Fetch ALL patients for this user account
    const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', user.id);

    if (!patients || patients.length === 0) {
        redirect('/login');
    }

    const patientIds = patients.map((p: any) => p.id);

    // Fetch appointments for ALL patients in this account
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`
            id,
            serial_no,
            appointment_date,
            start_time,
            status,
            patient_id,
            doctors:doctor_id (full_name)
        `)
        .in('patient_id', patientIds)
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="patient" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Appointments</h2>
                            <a href="/patient/book" className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>Book New Appointment</a>
                        </div>
                        
                        <div className="card border-0 shadow-sm rounded-0">
                            <div className="card-body p-0">
                                {appointments && appointments.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th className="px-4 py-3">Serial No</th>
                                                    <th className="py-3">Patient</th>
                                                    <th className="py-3">Date</th>
                                                    <th className="py-3">Time</th>
                                                    <th className="py-3">Doctor</th>
                                                    <th className="px-4 py-3 text-end">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {appointments.map((apt: any) => {
                                                    const p = patients.find(pat => pat.id === apt.patient_id);
                                                    return (
                                                        <tr key={apt.id}>
                                                            <td className="px-4 py-3">{apt.serial_no || '-'}</td>
                                                            <td className="py-3 fw-medium">{p?.full_name}</td>
                                                            <td className="py-3">{apt.appointment_date}</td>
                                                            <td className="py-3">{apt.start_time}</td>
                                                            <td className="py-3">{apt.doctors?.full_name}</td>
                                                            <td className="px-4 py-3 text-end">
                                                                <span className={`badge ${getStatusBadgeColor(apt.status)}`}>
                                                                    {getStatusLabel(apt.status)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-5 text-center text-muted">
                                        <i className="bi bi-calendar-x" style={{ fontSize: '3rem' }}></i>
                                        <p className="mt-3 mb-0">You have no appointments yet.</p>
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
