import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';

export default async function AdminDashboard() {
    const cookieStore = await cookies();
    const { user: { id: staffSession } } = await requireRole(['admin', 'doctor', 'compounder']);
    const { role } = await requireRole(['admin', 'doctor', 'compounder']);

    if (role !== 'admin' || !staffSession) {
        redirect('/doctor/login');
    }

    const supabase = await createClient();

    // Fetch stats
    const { count: doctorsCount } = await supabase.from('doctors').select('*', { count: 'exact', head: true });
    const { count: patientsCount } = await supabase.from('patients').select('*', { count: 'exact', head: true });
    const { count: appointmentsCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true });
    
    // Recent appointments
    const { data: recentAppointments } = await supabase
        .from('appointments')
        .select(`
            id, appointment_date, status,
            patient:patients(full_name),
            doctor:users!appointments_doctor_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="admin" />
                
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Admin Dashboard</h2>
                            <div className="text-muted">Welcome, System Admin</div>
                        </div>

                        {/* Stats Row */}
                        <div className="row g-4 mb-5">
                            <div className="col-md-4">
                                <div className="card border-0 shadow-sm rounded-3 h-100 p-4" style={{ borderLeft: '4px solid #0ab1a9' }}>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Total Doctors</h6>
                                            <h3 className="fw-bold mb-0">{doctorsCount || 0}</h3>
                                        </div>
                                        <div className="bg-light p-3 rounded-circle text-center" style={{ width: '60px', height: '60px' }}>
                                            <i className="bi bi-people fs-4" style={{ color: '#0ab1a9' }}></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="card border-0 shadow-sm rounded-3 h-100 p-4" style={{ borderLeft: '4px solid #0D7D72' }}>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Total Patients</h6>
                                            <h3 className="fw-bold mb-0">{patientsCount || 0}</h3>
                                        </div>
                                        <div className="bg-light p-3 rounded-circle text-center" style={{ width: '60px', height: '60px' }}>
                                            <i className="bi bi-person-badge fs-4" style={{ color: '#0D7D72' }}></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="card border-0 shadow-sm rounded-3 h-100 p-4" style={{ borderLeft: '4px solid #f39c12' }}>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Total Appointments</h6>
                                            <h3 className="fw-bold mb-0">{appointmentsCount || 0}</h3>
                                        </div>
                                        <div className="bg-light p-3 rounded-circle text-center" style={{ width: '60px', height: '60px' }}>
                                            <i className="bi bi-calendar-check fs-4" style={{ color: '#f39c12' }}></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Appointments */}
                        <div className="card border-0 shadow-sm rounded-3 p-4">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h5 className="m-0 fw-bold text-secondary">Recent Appointments</h5>
                                <a href="/admin/appointments" className="btn btn-sm btn-outline-primary" style={{ borderColor: '#0ab1a9', color: '#0ab1a9' }}>View All</a>
                            </div>
                            
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Date</th>
                                            <th>Patient</th>
                                            <th>Doctor</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentAppointments && recentAppointments.length > 0 ? (
                                            recentAppointments.map((apt: any) => (
                                                <tr key={apt.id}>
                                                    <td>{apt.appointment_date}</td>
                                                    <td className="fw-medium">{apt.patient?.full_name || 'N/A'}</td>
                                                    <td>{apt.doctor?.full_name || 'N/A'}</td>
                                                    <td>
                                                        <span className={`badge ${apt.status === 'confirmed' ? 'bg-success' : apt.status === 'pending' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                                            {apt.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="text-center py-4 text-muted">No appointments found</td>
                                            </tr>
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
