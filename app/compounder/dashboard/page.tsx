import React from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { updateAppointmentStatus } from '../actions';
import { requireRole } from '@/lib/auth/requireRole';

export default async function CompounderDashboard() {
    const cookieStore = await cookies();
    const { role } = await requireRole(['admin', 'doctor', 'compounder']);
    const { user: { id: compounderId } } = await requireRole(['compounder']);
    

    const supabase = await createClient();
    
    // Get assigned doctor
    const { data: compounder } = await supabase
        .from('compounders')
        .select('assigned_doctor_id, doctor:users!compounders_assigned_doctor_id_fkey(full_name)')
        .eq('id', compounderId)
        .single();
        
    const doctorId = compounder?.assigned_doctor_id;

    // Get today's appointments for the assigned doctor
    const today = format(toZonedTime(new Date(), 'Asia/Dhaka'), 'yyyy-MM-dd');
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`
            id, appointment_date, start_time, end_time, status,
            patient:patients(id, full_name, mobile_no)
        `)
        .eq('doctor_id', doctorId)
        .eq('appointment_date', today)
        .order('start_time', { ascending: true });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="compounder" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>
                                Today's Appointments - {((compounder?.doctor as any)?.[0] || compounder?.doctor as any)?.full_name}
                            </h2>
                        </div>
                        <div className="card border-0 shadow-sm rounded-3 p-4">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Time Slot</th>
                                            <th>Patient Name</th>
                                            <th>Mobile No</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appointments?.map((apt: any) => (
                                            <tr key={apt.id}>
                                                <td>{apt.start_time} - {apt.end_time}</td>
                                                <td className="fw-medium">{apt.patient?.full_name || 'N/A'}</td>
                                                <td>{apt.patient?.mobile_no}</td>
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
                                                            <option value="scheduled">Scheduled</option>
                                                            <option value="completed">Completed</option>
                                                            <option value="cancelled">Cancelled</option>
                                                        </select>
                                                        <button type="submit" className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>Update</button>
                                                    </form>
                                                </td>
                                            </tr>
                                        ))}
                                        {!appointments?.length && (
                                            <tr><td colSpan={5} className="text-center py-4 text-muted">No appointments today.</td></tr>
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
