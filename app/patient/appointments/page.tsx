import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';

export default async function PatientAppointmentsPage() {
    const cookieStore = await cookies();
    
    // Basic auth check
    const patientId = cookieStore.get('patient_session')?.value;
    if (!patientId) {
        redirect('/login');
    }

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="patient" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Appointments</h2>
                        </div>
                        
                        <div className="card border-0 shadow-sm rounded-0">
                            <div className="card-body p-5 text-center text-muted">
                                <i className="bi bi-tools" style={{ fontSize: '3rem' }}></i>
                                <p className="mt-3 mb-0">This page is under construction.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
