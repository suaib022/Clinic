import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { updateAppointmentStatus } from './actions';

export default async function AdminAppointments() {
    const cookieStore = await cookies();
    const role = cookieStore.get('staff_role')?.value;
    if (role !== 'admin') redirect('/login');

    const supabase = await createClient();
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`
            id, appointment_date, start_time, end_time, status,
            patient:patients(full_name, mobile_no),
            doctor:users!appointments_doctor_id_fkey(full_name)
        `)
        .order('appointment_date', { ascending: false });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="admin" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Manage Appointments</h2>
                        </div>
                        <div className="card border-0 shadow-sm rounded-3 p-4">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Date & Time</th>
                                            <th>Patient</th>
                                            <th>Doctor</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appointments?.map((apt: any) => (
                                            <tr key={apt.id}>
                                                <td>
                                                    <div className="fw-medium">{new Date(apt.appointment_date).toLocaleDateString()}</div>
                                                    <div className="small text-muted">{apt.start_time} - {apt.end_time}</div>
                                                </td>
                                                <td>
                                                    <div className="fw-medium">{apt.patient?.full_name || 'N/A'}</div>
                                                    <div className="small text-muted">{apt.patient?.mobile_no}</div>
                                                </td>
                                                <td>{apt.doctor?.full_name || 'N/A'}</td>
                                                <td>
                                                    <span className={`badge ${
                                                        apt.status === 'scheduled' ? 'bg-primary' : 
                                                        apt.status === 'completed' ? 'bg-success' : 
                                                        'bg-danger'
                                                    }`}>
                                                        {apt.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <form action={updateAppointmentStatus}>
                                                        <input type="hidden" name="id" value={apt.id} />
                                                        <select 
                                                            name="status" 
                                                            className="form-select form-select-sm d-inline-block w-auto me-2"
                                                            defaultValue={apt.status}
                                                        >
                                                            <option value="scheduled">Scheduled (Approved)</option>
                                                            <option value="completed">Completed</option>
                                                            <option value="cancelled">Cancelled</option>
                                                        </select>
                                                        <button type="submit" className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>Update</button>
                                                    </form>
                                                </td>
                                            </tr>
                                        ))}
                                        {!appointments?.length && (
                                            <tr><td colSpan={5} className="text-center py-4 text-muted">No appointments found.</td></tr>
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
