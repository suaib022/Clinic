import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';

export default async function AdminPatients() {
    const cookieStore = await cookies();
    const role = cookieStore.get('staff_role')?.value;
    if (role !== 'admin') redirect('/login');

    const supabase = await createClient();
    const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="admin" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>All Patients</h2>
                        </div>
                        <div className="card border-0 shadow-sm rounded-3 p-4">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Patient Name</th>
                                            <th>Mobile No</th>
                                            <th>Age</th>
                                            <th>Gender</th>
                                            <th>Blood Group</th>
                                            <th>Registered At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {patients?.map((pat: any) => (
                                            <tr key={pat.id}>
                                                <td className="fw-medium">{pat.full_name}</td>
                                                <td>{pat.mobile_no}</td>
                                                <td>{pat.age || 'N/A'}</td>
                                                <td>{pat.gender || 'N/A'}</td>
                                                <td>{pat.blood_group || 'N/A'}</td>
                                                <td>{new Date(pat.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                        {!patients?.length && (
                                            <tr><td colSpan={6} className="text-center py-4 text-muted">No patients found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
