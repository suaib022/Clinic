import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminDashboard() {
    const cookieStore = await cookies();
    const role = cookieStore.get('staff_role')?.value;
    
    if (role !== 'admin') {
        redirect('/doctor/login');
    }

    return (
        <div className="container py-5">
            <h2 style={{ color: '#0D7D72' }}>Admin Dashboard</h2>
            <div className="row mt-4">
                <div className="col-md-3">
                    <div className="card shadow-sm border-0 rounded-0 mb-3">
                        <div className="card-body">
                            <h5>Appointments</h5>
                            <p className="small text-muted">Manage all appointments across all doctors.</p>
                            <button className="btn btn-sm text-white w-100" style={{ backgroundColor: '#0ab1a9' }}>Manage</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card shadow-sm border-0 rounded-0 mb-3">
                        <div className="card-body">
                            <h5>Schedules & Leaves</h5>
                            <p className="small text-muted">Approve leaves and manage doctor schedules.</p>
                            <button className="btn btn-sm text-white w-100" style={{ backgroundColor: '#0ab1a9' }}>Manage</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card shadow-sm border-0 rounded-0 mb-3">
                        <div className="card-body">
                            <h5>Users & Roles</h5>
                            <p className="small text-muted">Create/edit doctors, compounders, and patients.</p>
                            <button className="btn btn-sm text-white w-100" style={{ backgroundColor: '#0ab1a9' }}>Manage</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card shadow-sm border-0 rounded-0 mb-3">
                        <div className="card-body">
                            <h5>Security</h5>
                            <p className="small text-muted">Reset PINs and view audit logs.</p>
                            <button className="btn btn-sm text-white w-100" style={{ backgroundColor: '#0ab1a9' }}>Manage</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
