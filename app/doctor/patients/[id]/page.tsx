import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import PatientDetailClient from './PatientDetailClient';

export default async function DoctorPatientDetailPage(props: { params: Promise<{ id: string }> }) {
    const { user } = await requireRole(['doctor']);
    const supabase = await createClient();
    const params = await props.params;
    const patientId = params.id;

    // 1. Verify relationship
    const { data: hasAccess } = await supabase.rpc('doctor_has_patient', {
        p_doctor_id: user.id,
        p_patient_id: patientId
    });

    if (!hasAccess) {
        notFound();
    }

    // 2. Audit open
    await supabase.rpc('log_patient_access', {
        p_patient_id: patientId,
        p_action: 'Viewed comprehensive medical history'
    });

    // 3. Fetch patient info
    const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

    // 4. Fetch ALL medical records for this patient
    const { data: records } = await supabase
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
            doctor:users!medical_records_doctor_id_fkey(full_name)
        `)
        .eq('patient_id', patientId)
        .eq('is_deleted', false)
        .order('document_date', { ascending: false })
        .order('created_at', { ascending: false });

    // 5. Fetch doctor's past completed visits with this patient (for the upload "attach to visit" dropdown)
    const { data: myVisits } = await supabase
        .from('appointments')
        .select('id, appointment_date, doctors:users!appointments_doctor_id_fkey(full_name)')
        .eq('patient_id', patientId)
        .eq('doctor_id', user.id)
        .eq('status', 'completed')
        .order('appointment_date', { ascending: false });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="doctor" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <PatientDetailClient 
                        patient={patient} 
                        records={records || []} 
                        myVisits={myVisits || []} 
                        userId={user.id} 
                    />
                </div>
            </div>
        </main>
    );
}
