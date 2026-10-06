import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';

export default async function PatientSettingsPage() {
    const cookieStore = await cookies();
    
    // Basic auth check
    const { user } = await requireRole(['patient']);
    const supabase = await createClient();
    
    // Fetch user details from users table
    const { data: userRecord } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="patient" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Profile Settings</h2>
                        </div>
                        
                        <div className="row">
                            <div className="col-md-4 mb-4">
                                <div className="card border-0 shadow-sm rounded-0">
                                    <div className="card-body text-center p-4">
                                        <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 120, height: 120 }}>
                                            <i className="bi bi-person text-secondary" style={{ fontSize: '4rem' }}></i>
                                        </div>
                                        <h4 className="fw-bold mb-1">{userRecord?.full_name || 'No Name Set'}</h4>
                                        <p className="text-muted mb-0">{userRecord?.email}</p>
                                        <span className="badge mt-2" style={{ backgroundColor: '#0ab1a9' }}>Patient Account</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="col-md-8 mb-4">
                                <div className="card border-0 shadow-sm rounded-0">
                                    <div className="card-header bg-white border-bottom-0 pt-4 pb-0 px-4">
                                        <h5 className="fw-bold m-0" style={{ color: '#0D7D72' }}>Account Information</h5>
                                    </div>
                                    <div className="card-body p-4">
                                        <form>
                                            <div className="row g-3">
                                                <div className="col-md-6">
                                                    <label className="form-label text-muted small fw-bold">Full Name</label>
                                                    <input type="text" className="form-control bg-light" value={userRecord?.full_name || ''} readOnly />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label text-muted small fw-bold">Email Address</label>
                                                    <input type="email" className="form-control bg-light" value={userRecord?.email || ''} readOnly />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label text-muted small fw-bold">Phone Number</label>
                                                    <input type="text" className="form-control bg-light" value={userRecord?.phone || ''} placeholder="Not provided" readOnly />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label text-muted small fw-bold">Role</label>
                                                    <input type="text" className="form-control bg-light" value="Patient" readOnly />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label text-muted small fw-bold">Address</label>
                                                    <textarea className="form-control bg-light" rows={3} value={userRecord?.address || ''} placeholder="Not provided" readOnly></textarea>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-4 pt-3 border-top d-flex gap-2">
                                                <button type="button" className="btn text-white disabled" style={{ backgroundColor: '#0ab1a9', opacity: 0.7 }}>
                                                    Save Changes
                                                </button>
                                                <span className="form-text mt-2 ms-2">Editing profile is currently disabled.</span>
                                            </div>
                                        </form>
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
