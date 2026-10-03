import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import DoctorPatientsClient from './DoctorPatientsClient';

export default async function DoctorPatientsPage(props: { searchParams: Promise<{ q?: string, page?: string }> }) {
    const { user } = await requireRole(['doctor']);
    const supabase = await createClient();
    
    const searchParams = await props.searchParams;
    const q = searchParams.q || '';
    const page = parseInt(searchParams.page || '1', 10);
    const limit = 10;
    const offset = (page - 1) * limit;

    const { data: patients } = await supabase
        .rpc('get_doctor_patients', {
            p_doctor_id: user.id,
            p_search: q,
            p_limit: limit,
            p_offset: offset
        });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="doctor" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <DoctorPatientsClient initialPatients={patients || []} initialQuery={q} currentPage={page} />
                </div>
            </div>
        </main>
    );
}
