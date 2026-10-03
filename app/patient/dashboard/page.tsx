import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';

export default async function PatientDashboard() {
    const cookieStore = await cookies();
    const { patientId } = await requireRole(['patient']);
    
    

    const supabase = await createClient();
    
    // Fetch patient info
    const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

    if (!patient) {
        redirect('/patient/login');
    }

    // Fetch patient appointments
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`
            id,
            appointment_date,
            start_time,
            status,
            doctors:doctor_id (full_name)
        `)
        .eq('patient_id', patientId)
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="patient" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                    <h2 className="m-0" style={{ color: '#0D7D72' }}>Welcome, {patient.full_name}</h2>
                    <div>
                        <span className="badge bg-secondary me-2 p-2">UHID: {patient.uhid}</span>
                        <a href="/" className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>Book New Appointment</a>
                    </div>
                </div>
                
                <div className="card border-0 shadow-sm rounded-0 mb-4">
                    <div className="card-header bg-white py-3">
                        <h5 className="mb-0 text-secondary fw-bold">My Appointments</h5>
                    </div>
                    <div className="card-body p-0">
                        {appointments && appointments.length > 0 ? (
                            <div className="table-responsive">
                                <table className="table table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="py-3">Time</th>
                                            <th className="py-3">Doctor</th>
                                            <th className="px-4 py-3 text-end">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appointments.map((apt: any) => (
                                            <tr key={apt.id}>
                                                <td className="px-4 py-3">{apt.appointment_date}</td>
                                                <td className="py-3">{apt.start_time}</td>
                                                <td className="py-3">{apt.doctors?.full_name}</td>
                                                <td className="px-4 py-3 text-end">
                                                    <span className={`badge ${apt.status === 'hold' ? 'bg-warning text-dark' : apt.status === 'confirmed' ? 'bg-success' : 'bg-secondary'}`}>
                                                        {apt.status.toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
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
