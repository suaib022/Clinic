import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';

export default async function CompounderPatients() {
    const cookieStore = await cookies();
    const role = cookieStore.get('staff_role')?.value;
    const compounderId = cookieStore.get('staff_session')?.value;
    if (role !== 'compounder' || !compounderId) redirect('/login');

    const supabase = await createClient();
    
    const { data: compounder } = await supabase.from('compounders').select('assigned_doctor_id').eq('id', compounderId).single();
    const doctorId = compounder?.assigned_doctor_id;

    // Get all past and future appointments for this doctor to show history
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`
            id, appointment_date, status,
            patient:patients(id, full_name, mobile_no, age, gender)
        `)
        .eq('doctor_id', doctorId)
        .order('appointment_date', { ascending: false });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="compounder" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Assigned Patients History</h2>
                        </div>
                        <div className="card border-0 shadow-sm rounded-3 p-4">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Patient Name</th>
                                            <th>Mobile No</th>
                                            <th>Age / Gender</th>
                                            <th>Appointment Date</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appointments?.map((apt: any) => (
                                            <tr key={apt.id}>
                                                <td className="fw-medium">{apt.patient?.full_name || 'N/A'}</td>
                                                <td>{apt.patient?.mobile_no}</td>
                                                <td>{apt.patient?.age} / {apt.patient?.gender}</td>
                                                <td>{new Date(apt.appointment_date).toLocaleDateString()}</td>
                                                <td>
                                                    <span className={`badge ${
                                                        apt.status === 'scheduled' ? 'bg-primary' : 
                                                        apt.status === 'completed' ? 'bg-success' : 
                                                        'bg-danger'
                                                    }`}>
                                                        {apt.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {!appointments?.length && (
                                            <tr><td colSpan={5} className="text-center py-4 text-muted">No patient history found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
