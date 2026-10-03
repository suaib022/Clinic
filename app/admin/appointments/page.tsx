import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { updateAppointmentStatus } from './actions';
import { requireRole } from '@/lib/auth/requireRole';
import { getStatusLabel, getStatusBadgeColor, APPOINTMENT_STATUSES } from '@/lib/appointmentStatus';
import TableSearchForm from '@/components/TableSearchForm';

export default async function AdminAppointments(props: { searchParams: Promise<{ q?: string }> }) {
    const cookieStore = await cookies();
    const { role } = await requireRole(['admin', 'doctor', 'compounder']);
    if (role !== 'admin') redirect('/login');

    const searchParams = await props.searchParams;
    const q = (searchParams.q || '').toLowerCase();

    const supabase = await createClient();
    let { data: appointments } = await supabase
        .from('appointments')
        .select(`
            id, serial_no, appointment_date, start_time, end_time, status,
            patient:patients(full_name, mobile_no),
            doctor:users!appointments_doctor_id_fkey(full_name)
        `)
        .order('appointment_date', { ascending: false });
        
    if (q && appointments) {
        appointments = appointments.filter((apt: any) => 
            (apt.patient?.full_name?.toLowerCase().includes(q)) ||
            (apt.doctor?.full_name?.toLowerCase().includes(q)) ||
            (apt.serial_no?.toString().includes(q))
        );
    }

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="admin" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Manage Appointments</h2>
                            <TableSearchForm placeholder="Search by patient, doctor, or serial..." />
                        </div>
                        <div className="card border-0 shadow-sm rounded-3 p-4">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Serial No</th>
                                            <th>Date & Time</th>
                                            <th>Patient</th>
                                            <th>Doctor</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {appointments?.map((apt: any) => (
                                            <tr key={apt.id}>
                                                <td>{apt.serial_no || '-'}</td>
                                                <td>
                                                    <div className="fw-medium">{apt.appointment_date}</div>
                                                    <div className="small text-muted">{apt.start_time} - {apt.end_time}</div>
                                                </td>
                                                <td>
                                                    <div className="fw-medium">{apt.patient?.full_name || 'N/A'}</div>
                                                    <div className="small text-muted">{apt.patient?.mobile_no}</div>
                                                </td>
                                                <td>{apt.doctor?.full_name || 'N/A'}</td>
                                                <td>
                                                    <span className={`badge ${getStatusBadgeColor(apt.status)}`}>
                                                        {getStatusLabel(apt.status)}
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
                                                            {APPOINTMENT_STATUSES.map(s => (
                                                                <option key={s} value={s}>{getStatusLabel(s)}</option>
                                                            ))}
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
