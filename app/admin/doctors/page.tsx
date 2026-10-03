import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';

export default async function AdminDoctors() {
    const cookieStore = await cookies();
    const { role } = await requireRole(['admin', 'doctor', 'compounder']);
    if (role !== 'admin') redirect('/login');

    const supabase = await createClient();
    const { data: doctors } = await supabase
        .from('users')
        .select(`
            id, full_name, email,
            doctors!inner ( doctor_id, consultation_fee )
        `)
        .eq('role', 'doctor')
        .order('full_name');

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="admin" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>All Doctors</h2>
                        </div>
                        <div className="card border-0 shadow-sm rounded-3 p-4">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Doctor Name</th>
                                            <th>Doctor ID</th>
                                            <th>Email</th>
                                            <th>Consultation Fee</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {doctors?.map((doc: any) => (
                                            <tr key={doc.id}>
                                                <td className="fw-medium">{doc.full_name}</td>
                                                <td>{doc.doctors?.doctor_id}</td>
                                                <td>{doc.email || 'N/A'}</td>
                                                <td className="fw-bold text-success">৳ {doc.doctors?.consultation_fee}</td>
                                            </tr>
                                        ))}
                                        {!doctors?.length && (
                                            <tr><td colSpan={5} className="text-center py-4 text-muted">No doctors found.</td></tr>
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
