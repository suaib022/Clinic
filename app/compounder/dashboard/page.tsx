import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function CompounderDashboard() {
    const cookieStore = await cookies();
    const role = cookieStore.get('staff_role')?.value;
    
    if (role !== 'compounder') {
        redirect('/doctor/login');
    }

    return (
        <div className="container py-5">
            <h2 style={{ color: '#0D7D72' }}>Compounder Dashboard</h2>
            <div className="row mt-4">
                <div className="col-md-6">
                    <div className="card shadow-sm border-0 rounded-0 mb-3">
                        <div className="card-body">
                            <h5>Assigned Doctor's Patients</h5>
                            <p className="small text-muted">View patients booked with your assigned doctor today.</p>
                            <button className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>View Patients</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card shadow-sm border-0 rounded-0 mb-3">
                        <div className="card-body">
                            <h5>Upload Documents</h5>
                            <p className="small text-muted">Upload prescriptions and test reports to patient profiles.</p>
                            <button className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>Upload Document</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
