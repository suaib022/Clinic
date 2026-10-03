import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import TableSearchForm from '@/components/TableSearchForm';

export default async function AdminCompounders(props: { searchParams: Promise<{ q?: string }> }) {
    const { role } = await requireRole(['admin']);
    if (role !== 'admin') redirect('/login');

    const searchParams = await props.searchParams;
    const q = searchParams.q || '';

    const supabase = await createClient();
    let query = supabase
        .from('compounders')
        .select(`
            id,
            users!compounders_id_fkey ( id, full_name, email, phone, role ),
            doctors:users!compounders_assigned_doctor_id_fkey ( id, full_name )
        `);

    if (q) {
        query = query.textSearch('users.full_name', q);
        // Note: Filtering a joined table can be tricky in postgrest, 
        // a simple textSearch might fail if not configured correctly.
        // As a fallback, we'll fetch all and filter in JS if needed.
    }

    const { data: compounders, error } = await query;
    if (error) console.error('Error fetching compounders:', error);

    // If q is provided, filter in JS to be safe
    let filteredCompounders = compounders || [];
    if (q) {
        filteredCompounders = filteredCompounders.filter((c: any) => 
            c.users?.full_name?.toLowerCase().includes(q.toLowerCase()) ||
            c.users?.email?.toLowerCase().includes(q.toLowerCase()) ||
            c.doctors?.full_name?.toLowerCase().includes(q.toLowerCase())
        );
    }

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="admin" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>All Compounders</h2>
                            <TableSearchForm placeholder="Search compounders..." />
                        </div>
                        <div className="card border-0 shadow-sm rounded-3 p-4">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Compounder Name</th>
                                            <th>Email / Login ID</th>
                                            <th>Phone</th>
                                            <th>Assigned Doctor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCompounders?.map((c: any) => (
                                            <tr key={c.id}>
                                                <td className="fw-medium">{c.users?.full_name || 'N/A'}</td>
                                                <td>{c.users?.email || 'N/A'}</td>
                                                <td>{c.users?.phone || 'N/A'}</td>
                                                <td>
                                                    {c.doctors?.full_name ? `Dr. ${c.doctors.full_name.replace('Dr. ', '').replace('Prof. ', '').replace('Professor. ', '').replace('Professor ', '')}` : 'Unassigned'}
                                                </td>
                                            </tr>
                                        ))}
                                        {!filteredCompounders?.length && (
                                            <tr><td colSpan={4} className="text-center py-4 text-muted">No compounders found.</td></tr>
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
