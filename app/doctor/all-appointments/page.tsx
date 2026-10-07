import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { format, parseISO } from 'date-fns';

export default async function AllAppointmentsPage() {
    const { user } = await requireRole(['doctor']);
    const supabase = await createClient();

    // Fetch all appointments for this doctor, ordered by most recent first
    const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
            id,
            appointment_date,
            start_time,
            status,
            visit_type,
            patients (
                full_name,
                mobile_no
            )
        `)
        .eq('doctor_id', user.id)
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="doctor" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>All Appointments</h2>
                        </div>
                        
                        <div className="card border-0 shadow-sm rounded-0">
                            <div className="card-body p-4">
                                {error ? (
                                    <div className="alert alert-danger">Error loading appointments: {error.message}</div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Time</th>
                                                    <th>Patient Name</th>
                                                    <th>Mobile</th>
                                                    <th>Visit Type</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {appointments?.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="text-center py-4 text-muted">
                                                            No appointments found.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    appointments?.map((appt) => {
                                                        let statusBadgeClass = 'bg-secondary';
                                                        switch (appt.status) {
                                                            case 'completed':
                                                                statusBadgeClass = 'bg-success';
                                                                break;
                                                            case 'cancelled':
                                                            case 'no_show':
                                                                statusBadgeClass = 'bg-danger';
                                                                break;
                                                            case 'in_consultation':
                                                                statusBadgeClass = 'bg-primary';
                                                                break;
                                                            case 'scheduled':
                                                            case 'checked_in':
                                                                statusBadgeClass = 'bg-info';
                                                                break;
                                                        }

                                                        const patientInfo: any = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;

                                                        return (
                                                            <tr key={appt.id}>
                                                                <td>
                                                                    <div className="d-flex align-items-center">
                                                                        <i className="bi bi-calendar-event text-muted me-2"></i>
                                                                        {appt.appointment_date ? format(parseISO(appt.appointment_date), 'MMM dd, yyyy') : 'N/A'}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex align-items-center">
                                                                        <i className="bi bi-clock text-muted me-2"></i>
                                                                        {appt.start_time || 'N/A'}
                                                                    </div>
                                                                </td>
                                                                <td className="fw-medium">
                                                                    {patientInfo?.full_name || 'N/A'}
                                                                </td>
                                                                <td>
                                                                    {patientInfo?.mobile_no || 'N/A'}
                                                                </td>
                                                                <td className="text-capitalize">
                                                                    {appt.visit_type ? appt.visit_type.replace('_', ' ') : 'N/A'}
                                                                </td>
                                                                <td>
                                                                    <span className={`badge ${statusBadgeClass} text-capitalize px-3 py-2 rounded-pill`}>
                                                                        {appt.status ? appt.status.replace('_', ' ') : 'Unknown'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
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
