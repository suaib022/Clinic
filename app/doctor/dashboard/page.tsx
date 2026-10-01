import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DoctorDashboard() {
    const cookieStore = await cookies();
    const role = cookieStore.get('staff_role')?.value;
    
    if (role !== 'doctor') {
        redirect('/doctor/login');
    }

    return (
        <div className="container py-5">
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
    );
}
