import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import CompounderUploadClient from './CompounderUploadClient';
import { format } from 'date-fns';

export default async function CompounderUploadPage() {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();

    // Fetch compounder's assigned doctor
    const { data: userData } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('id', user.id)
        .single();
        
    const { data: compounderDocId } = await supabase.rpc('compounder_doctor_id', { c_id: user.id });

    if (!compounderDocId) {
        return (
            <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
                <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                    <DashboardSidebar role="compounder" />
                    <div className="flex-grow-1 p-4 p-md-5">
                        <div className="alert alert-warning">
                            You are not assigned to any doctor. You cannot upload documents.
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // V10: Today's patients of assigned doctor
    // (Also include yesterday's patients to be safe, or just rely on what the RPC allows for upload)
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: todaysAppointments } = await supabase
        .from('appointments')
        .select('patient_id, patient:patients(id, full_name, uhid)')
        .eq('doctor_id', compounderDocId)
        .eq('appointment_date', today)
        .neq('status', 'cancelled');

    // Deduplicate patients
    const patientsMap = new Map();
    todaysAppointments?.forEach((a: any) => {
        if (a.patient) {
            patientsMap.set(a.patient_id, a.patient);
        }
    });
    const patients = Array.from(patientsMap.values());

    // Fetch recent uploads (receipts)
    const { data: recentUploads } = await supabase.rpc('get_recent_compounder_uploads');

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="compounder" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <CompounderUploadClient 
                        patients={patients} 
                        recentUploads={recentUploads || []} 
                    />
                </div>
            </div>
        </main>
    );
}
