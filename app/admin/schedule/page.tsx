import React from 'react';
import Header from "@/components/Header";
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/requireRole';
import AdminScheduleRequestsClient from '@/components/admin/AdminScheduleRequestsClient';

export default async function AdminSchedulePage() {
    await requireRole(['admin']);
    const supabase = await createClient();

    // Fetch all doctor leave & schedule cancellation requests
    const { data: requests } = await supabase
        .from('doctor_leave_requests')
        .select(`
            id,
            doctor_id,
            type,
            start_date,
            end_date,
            reason,
            status,
            created_at,
            doctor:users!doctor_id(full_name, email)
        `)
        .order('created_at', { ascending: false });

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
            <Header />
            <main className="container pt-5 mt-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 className="mb-1" style={{ color: '#0D7D72' }}>Admin: Doctor Schedule & Leave Management</h2>
                        <p className="text-muted mb-0">Review pending schedule cancellations and doctor leave applications</p>
                    </div>
                </div>

                <div className="card shadow-sm border-0 rounded-0 p-4 mb-4">
                    <h5 className="fw-bold mb-1">Doctor Leave & Schedule Cancellation Requests</h5>
                    <p className="text-muted small mb-3">
                        Approving a schedule cancellation will officially cancel active patient bookings and dispatch refund/rebooking notifications.
                    </p>
                    
                    <AdminScheduleRequestsClient initialRequests={requests || []} />
                </div>
            </main>
        </div>
    );
}
