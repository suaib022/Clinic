import React from 'react';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { getQueueSnapshot, syncEstimates, type StaffSnapshot } from '@/lib/queue/server';
import { loadHealthData } from '@/lib/extraction/healthData';
import { listTestTypes } from '@/lib/lab/actions';
import ChamberClient from './ChamberClient';
import { todayDhaka } from '@/lib/format';

export const metadata = {
    title: 'Chamber Desk | Doctor Consultation',
    description: 'Active patient consultation chamber desk with complete electronic medical records, diagnostic test results, and live queue actions.'
};

export default async function DoctorChamberPage(props: {
    searchParams?: Promise<{ doctorId?: string }>;
}) {
    const { user, role } = await requireRole(['doctor', 'admin', 'compounder']);
    const supabase = await createClient();
    const searchParams = props.searchParams ? await props.searchParams : {};

    // Determine active doctor
    let doctorId = user.id;
    if (role !== 'doctor' && searchParams.doctorId) {
        doctorId = searchParams.doctorId;
    }

    const today = todayDhaka();

    // 1. Fetch Doctor details
    const { data: doctorUser } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('id', doctorId)
        .single();

    // 2. Fetch live queue snapshot
    let snapshot: StaffSnapshot | null = null;
    try {
        snapshot = await getQueueSnapshot(supabase, doctorId, today);
        await syncEstimates(supabase, snapshot);
    } catch (e) {
        console.error('Queue snapshot error in chamber page:', e);
    }

    // 3. Find current active consultation for this doctor today
    const { data: activeAppt } = await supabase
        .from('appointments')
        .select(`
            *,
            doctor:users!appointments_doctor_id_fkey(id, full_name)
        `)
        .eq('doctor_id', doctorId)
        .eq('appointment_date', today)
        .eq('status', 'in_consultation')
        .order('consult_started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    let patient: any = null;
    let records: any[] = [];
    let labOrders: any[] = [];
    let allVisits: any[] = [];
    let health: any = { medications: [], notes: [], labs: [], insights: [] };

    if (activeAppt?.patient_id) {
        const patientId = activeAppt.patient_id;

        // Fetch complete patient profile
        const { data: p } = await supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .single();
        patient = p;

        // Fetch medical records
        const { data: recs } = await supabase
            .from('medical_records')
            .select(`
                *,
                uploader:uploaded_by(role, full_name),
                doctor:users!medical_records_doctor_id_fkey(full_name)
            `)
            .eq('patient_id', patientId)
            .eq('is_deleted', false)
            .order('document_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });
        records = recs || [];

        // Fetch lab orders
        const { data: orders } = await supabase
            .from('lab_orders')
            .select('*, test_type:lab_test_types(*)')
            .eq('patient_id', patientId)
            .order('order_date', { ascending: false })
            .order('created_at', { ascending: false });
        labOrders = orders || [];

        // Fetch all visits
        const { data: visits } = await supabase
            .from('appointments')
            .select('*, doctor:users!appointments_doctor_id_fkey(full_name)')
            .eq('patient_id', patientId)
            .order('appointment_date', { ascending: false })
            .order('serial_no', { ascending: false });
        allVisits = visits || [];

        // Fetch health data (medications, notes, labs, insights)
        health = await loadHealthData(supabase, [patientId]);
    }

    const allTestTypes = await listTestTypes();

    return (
        <main className="main pt-5" style={{ backgroundColor: '#F5F9FC' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="doctor" />
                <div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
                    <ChamberClient
                        doctorId={doctorId}
                        doctorName={doctorUser?.full_name || 'Attending Doctor'}
                        activeAppt={activeAppt}
                        patient={patient}
                        records={records}
                        labOrders={labOrders}
                        allVisits={allVisits}
                        health={health}
                        snapshot={snapshot}
                        allTestTypes={allTestTypes}
                    />
                </div>
            </div>
        </main>
    );
}
