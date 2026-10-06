import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import AddPatientForm from '../dashboard/AddPatientForm';

export default async function PatientMembersPage() {
    const { user } = await requireRole(['patient']);
    const supabase = await createClient();
    
    // Fetch ALL patients for this user account
    const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', user.id);

    const safePatients = patients || [];

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="patient" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Registered Patients (Family Members)</h2>
                            <button className="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#addPatientModal">
                                + Add Patient
                            </button>
                        </div>
                        
                        <div className="row g-4">
                            {safePatients.length === 0 ? (
                                <div className="col-12 text-center py-5 text-muted">
                                    <i className="bi bi-people fs-1"></i>
                                    <p className="mt-3">No family members registered yet.</p>
                                </div>
                            ) : safePatients.map((p: any) => (
                                <div className="col-md-6 col-lg-4" key={p.id}>
                                    <div className="card h-100 border-0 shadow-sm rounded-0">
                                        <div className="card-body">
                                            <h5 className="card-title fw-bold text-dark">{p.full_name}</h5>
                                            <p className="card-text text-muted mb-2">
                                                <span className="badge bg-light text-dark border me-2">{p.uhid}</span>
                                                <span className="badge bg-secondary">{p.gender}</span>
                                            </p>
                                            <hr />
                                            <div className="small text-muted">
                                                <div className="mb-1"><i className="bi bi-telephone me-2"></i>{p.mobile_no}</div>
                                                <div className="mb-1"><i className="bi bi-calendar-event me-2"></i>DOB: {p.dob}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Patient Modal */}
            <div className="modal fade" id="addPatientModal" tabIndex={-1} aria-labelledby="addPatientModalLabel" aria-hidden="true">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content rounded-0">
                        <div className="modal-header" style={{ backgroundColor: '#0ab1a9', color: 'white' }}>
                            <h1 className="modal-title fs-5" id="addPatientModalLabel">Add Family Member</h1>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body p-4">
                            <AddPatientForm />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
