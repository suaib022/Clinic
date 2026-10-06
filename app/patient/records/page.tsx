import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import RecordsClient from './RecordsClient';

export default async function PatientRecordsPage() {
    const { user } = await requireRole(['patient']);
    const supabase = await createClient();
    
    // Fetch ALL patients for this user account
    const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .eq('auth_user_id', user.id);

    const safePatients = patients || [];
    const patientIds = safePatients.length > 0 ? safePatients.map((p: any) => p.id) : [];

    // Fetch visits (completed appointments)
    let visits: any[] = [];
    if (patientIds.length > 0) {
        const { data, error: visitsErr } = await supabase
        .from('appointments')
        .select(`
            id,
            serial_no,
            appointment_date,
            start_time,
            status,
            patient_id,
            doctors:users!appointments_doctor_id_fkey(id, full_name)
        `)
        .in('patient_id', patientIds)
        .eq('status', 'completed')
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false });

        visits = data || [];
        if (visitsErr) {
            console.error('Error fetching visits:', visitsErr);
        }
    }

    // Fetch medical records
    let records: any[] = [];
    if (patientIds.length > 0) {
        const { data } = await supabase
        .from('medical_records')
        .select(`
            id,
            patient_id,
            doctor_id,
            uploaded_by,
            record_type,
            title,
            description,
            file_path,
            created_at,
            document_date,
            appointment_id,
            file_size,
            file_type,
            uploader:uploaded_by(role, full_name),
            doctor:doctor_id(full_name)
        `)
        .in('patient_id', patientIds)
        .eq('is_deleted', false)
        .order('document_date', { ascending: false })
        .order('created_at', { ascending: false });
        records = data || [];
    }

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="patient" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <RecordsClient patients={safePatients} visits={visits || []} records={records || []} userId={user.id} />
                </div>
            </div>
        </main>
    );
}
