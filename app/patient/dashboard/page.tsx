import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { todayDhaka } from '@/lib/format';
import PatientLiveQueueCard from '@/components/queue/PatientLiveQueueCard';

export default async function PatientDashboard() {
    const { user } = await requireRole(['patient']);
    const supabase = await createClient();
    const today = todayDhaka();
    
    // Fetch user email
    const { data: userData } = await supabase.auth.admin.getUserById(user.id);

    // Fetch ALL patients for this user account
    const { data: patients, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', user.id);

    const patientIds = patients && patients.length > 0 ? patients.map((p: any) => p.id) : [];

    // Fetch quick stats
    let appointmentCount = 0;
    let todayAppt: { id: string } | null = null;
    if (patientIds.length > 0) {
        const { count } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .in('patient_id', patientIds);
        appointmentCount = count || 0;

        const { data: todayList } = await supabase
            .from('appointments')
            .select('id')
            .in('patient_id', patientIds)
            .eq('appointment_date', today)
            .neq('status', 'cancelled')
            .order('serial_no', { ascending: true })
            .limit(1);

        if (todayList && todayList.length > 0) {
            todayAppt = todayList[0];
        }
    }

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="patient" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Account Overview</h2>
                            <div>
                                <a href="/patient/book" className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>Book New Appointment</a>
                            </div>
                        </div>

                        {/* Today's Live Queue Widget */}
                        {todayAppt && (
                            <div className="mb-4">
                                <PatientLiveQueueCard appointmentId={todayAppt.id} />
                            </div>
                        )}
                        
                        <div className="row g-4 mb-4">
                            <div className="col-md-6 col-lg-4">
                                <div className="card border-0 shadow-sm rounded-0 h-100" style={{ borderLeft: '4px solid #0ab1a9 !important' }}>
                                    <div className="card-body">
                                        <h6 className="text-muted text-uppercase fw-bold mb-2">Registered Patients</h6>
                                        <h2 className="display-5 fw-bold mb-0 text-dark">{patients?.length || 0}</h2>
                                        <a href="/patient/members" className="text-decoration-none mt-3 d-inline-block" style={{ color: '#0D7D72' }}>View Family Members &rarr;</a>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="col-md-6 col-lg-4">
                                <div className="card border-0 shadow-sm rounded-0 h-100" style={{ borderLeft: '4px solid #0D7D72 !important' }}>
                                    <div className="card-body">
                                        <h6 className="text-muted text-uppercase fw-bold mb-2">Total Appointments</h6>
                                        <h2 className="display-5 fw-bold mb-0 text-dark">{appointmentCount || 0}</h2>
                                        <a href="/patient/appointments" className="text-decoration-none mt-3 d-inline-block" style={{ color: '#0D7D72' }}>View Appointments &rarr;</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="card border-0 shadow-sm rounded-0">
                            <div className="card-body p-5">
                                <h4 className="fw-bold text-dark mb-3">Welcome to your Patient Portal</h4>
                                <p className="text-muted mb-4 text-break">
                                    You are logged in as: <strong>{user?.email}</strong>
                                </p>
                                <p className="text-muted">
                                    Use the sidebar navigation to manage your family members, book appointments, and view your medical records.
                                    If you want to book an appointment for a family member, make sure they are added in the <strong>My Family / Patients</strong> section first.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </main>
    );
}
