import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';

export default async function AdminSettings() {
    const cookieStore = await cookies();
    const { role } = await requireRole(['admin', 'doctor', 'compounder']);
    if (role !== 'admin') redirect('/login');

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="admin" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>System Settings</h2>
                        </div>
                        
                        <div className="row g-4">
                            <div className="col-md-6">
                                <div className="card border-0 shadow-sm rounded-3 p-4">
                                    <h5 className="fw-bold mb-4">General Settings</h5>
                                    <form>
                                        <div className="mb-3">
                                            <label className="form-label text-muted small fw-bold">Clinic Name</label>
                                            <input type="text" className="form-control" defaultValue="Labaid Diagnostic Center" />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label text-muted small fw-bold">Contact Email</label>
                                            <input type="email" className="form-control" defaultValue="info@labaid.com.bd" />
                                        </div>
                                        <div className="mb-4">
                                            <label className="form-label text-muted small fw-bold">Support Phone</label>
                                            <input type="text" className="form-control" defaultValue="10606" />
                                        </div>
                                        <button type="button" className="btn text-white" style={{ backgroundColor: '#0ab1a9' }}>Save Changes</button>
                                    </form>
                                </div>
                            </div>
                            
                            <div className="col-md-6">
                                <div className="card border-0 shadow-sm rounded-3 p-4">
                                    <h5 className="fw-bold mb-4">Notification Settings</h5>
                                    <div className="form-check form-switch mb-3">
                                        <input className="form-check-input" type="checkbox" role="switch" defaultChecked />
                                        <label className="form-check-label">Email notifications for new appointments</label>
                                    </div>
                                    <div className="form-check form-switch mb-3">
                                        <input className="form-check-input" type="checkbox" role="switch" defaultChecked />
                                        <label className="form-check-label">SMS alerts to patients</label>
                                    </div>
                                    <div className="form-check form-switch mb-3">
                                        <input className="form-check-input" type="checkbox" role="switch" />
                                        <label className="form-check-label">Daily summary report</label>
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
