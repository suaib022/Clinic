import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';

export default async function DoctorDashboard() {
    const cookieStore = await cookies();
    const role = cookieStore.get('staff_role')?.value;
    
    if (role !== 'doctor') {
        redirect('/doctor/login');
    }

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="doctor" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <h2 style={{ color: '#0D7D72' }}>Doctor Dashboard</h2>
            <div className="row mt-4">
                <div className="col-md-4">
                    <div className="card shadow-sm border-0 rounded-0 mb-3">
                        <div className="card-body">
                            <h5>Appointments</h5>
                            <p className="small text-muted">View and manage today's and upcoming appointments.</p>
                            <button className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>View Appointments</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card shadow-sm border-0 rounded-0 mb-3">
                        <div className="card-body">
                            <h5>Patient History</h5>
                            <p className="small text-muted">Access medical records and past visits for your patients.</p>
                            <button className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>View Records</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card shadow-sm border-0 rounded-0 mb-3">
                        <div className="card-body">
                            <h5>Leave Requests</h5>
                            <p className="small text-muted">Request time off or partial day breaks.</p>
                            <button className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>Manage Leave</button>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            </div>
            </div>
        </main>
    );
}
