import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import AccessLogClient from './AccessLogClient';

export default async function AccessLogPage() {
    const { user } = await requireRole(['patient']);
    const supabase = await createClient();
    
    // Fetch ALL patients for this user account
    const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', user.id);

    const safePatients = patients || [];
    const patientIds = safePatients.length > 0 ? safePatients.map((p: any) => p.id) : [];

    // Fetch access logs
    let logs: any[] = [];
    if (patientIds.length > 0) {
        const { data } = await supabase
        .from('medical_records_access_log')
        .select(`
            id,
            patient_id,
            role,
            action,
            created_at,
            accessed_by,
            accessor:users!medical_records_access_log_accessed_by_fkey(full_name)
        `)
        .in('patient_id', patientIds)
        .neq('accessed_by', user.id) // excluding own actions
        .order('created_at', { ascending: false });
        logs = data || [];
    }

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="patient" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <AccessLogClient patients={safePatients} logs={logs || []} />
                </div>
            </div>
        </main>
    );
}
