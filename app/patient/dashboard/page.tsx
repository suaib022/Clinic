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

    // Fetch quick stats & unreviewed visits within last 7 days
    let appointmentCount = 0;
    let todayAppt: { id: string } | null = null;
    let unreviewedVisit: any = null;
    let recentDoctorCancellation: any = null;

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

        // Check for completed visits within last 7 days awaiting feedback
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: pendingFeedbackList } = await supabase
            .from('appointments')
            .select(`
                id,
                serial_no,
                appointment_date,
                doctors:doctor_id (full_name),
                appointment_feedbacks (id)
            `)
            .in('patient_id', patientIds)
            .eq('status', 'completed')
            .gte('appointment_date', sevenDaysAgo)
            .order('appointment_date', { ascending: false });

        if (pendingFeedbackList) {
            unreviewedVisit = pendingFeedbackList.find(
                a => !a.appointment_feedbacks || (Array.isArray(a.appointment_feedbacks) && a.appointment_feedbacks.length === 0)
            );
        }

        // Check for recent appointments cancelled by doctor
        const { data: cancelledList } = await supabase
            .from('appointments')
            .select(`
                id,
                serial_no,
                appointment_date,
                cancel_reason,
                payment_status,
                paid_amount,
                refund_status,
                doctors:doctor_id (full_name)
            `)
            .in('patient_id', patientIds)
            .eq('status', 'cancelled')
            .eq('cancelled_by_role', 'doctor')
            .in('refund_status', ['eligible', 'not_applicable'])
            .order('cancelled_at', { ascending: false })
            .limit(1);

        recentDoctorCancellation = cancelledList && cancelledList.length > 0 ? cancelledList[0] : null;
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

                        {/* Urgent Alert: Doctor Cancellation with Refund / Rebook Option */}
                        {recentDoctorCancellation && (
                            <div className="alert alert-danger border-0 shadow-sm rounded-0 p-3 mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style={{ borderLeft: '4px solid #dc3545' }}>
                                <div className="d-flex align-items-center gap-3">
                                    <i className="bi bi-exclamation-octagon-fill text-danger fs-3"></i>
                                    <div>
                                        <h6 className="fw-bold mb-1 text-danger">Appointment Cancelled by Doctor</h6>
                                        <div className="small text-dark">
                                            Your appointment on <strong>{recentDoctorCancellation.appointment_date}</strong> (Serial #{recentDoctorCancellation.serial_no}) with <strong>Dr. {(recentDoctorCancellation.doctors as any)?.full_name || 'your doctor'}</strong> was cancelled ({recentDoctorCancellation.cancel_reason || 'Doctor unavailable'}).
                                            {recentDoctorCancellation.payment_status === 'paid' ? ' You are eligible for a full refund or can rebook another day with fee transferred.' : ' You can easily rebook for an upcoming day.'}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <a href="/patient/appointments" className="btn btn-danger btn-sm fw-bold px-3 text-white text-nowrap">
                                        {recentDoctorCancellation.payment_status === 'paid' ? 'Claim Refund / Rebook' : 'Rebook Now'}
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Unreviewed Visit Prompt (within 7-day window) */}
                        {unreviewedVisit && (
                            <div className="alert alert-warning border-0 shadow-sm rounded-0 p-3 mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style={{ backgroundColor: '#fff9e6', borderLeft: '4px solid #ffc107' }}>
                                <div className="d-flex align-items-center gap-3">
                                    <i className="bi bi-star-fill text-warning fs-3"></i>
                                    <div>
                                        <h6 className="fw-bold mb-1 text-dark">Share your visit experience</h6>
                                        <div className="small text-muted">
                                            How was your consultation with <strong>Dr. {(unreviewedVisit.doctors as any)?.full_name || 'your doctor'}</strong> on {unreviewedVisit.appointment_date}? Your feedback helps improve clinic services!
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <a href="/patient/appointments" className="btn btn-warning btn-sm fw-bold px-3 text-dark text-nowrap">
                                        <i className="bi bi-star me-1"></i>Rate Visit Now
                                    </a>
                                </div>
                            </div>
                        )}

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
