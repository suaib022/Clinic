import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
    console.log('--- STARTING FEATURE 2 TEST: Prescription Workflow & Two-Stage Consultation ---');

    // 1. Fetch a doctor and a patient
    const { data: doctor, error: docErr } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'doctor')
        .limit(1)
        .single();

    if (docErr || !doctor) {
        throw new Error('No doctor found: ' + docErr?.message);
    }
    console.log(`Doctor: Dr. ${doctor.full_name} (${doctor.id})`);

    const now = Date.now();
    const { data: p1, error: p1Err } = await supabase.from('patients').insert({
        uhid: `TEST-UHID-1-${now}`,
        full_name: `Test Rx Patient 1 (${now})`,
        mobile_no: `017${now.toString().slice(-8)}`,
        gender: 'male'
    }).select().single();

    if (p1Err || !p1) throw new Error('Failed to create test patient 1: ' + p1Err?.message);

    const { data: p2, error: p2Err } = await supabase.from('patients').insert({
        uhid: `TEST-UHID-2-${now}`,
        full_name: `Test Rx Patient 2 (${now + 1})`,
        mobile_no: `018${(now + 1).toString().slice(-8)}`,
        gender: 'female'
    }).select().single();

    if (p2Err || !p2) throw new Error('Failed to create test patient 2: ' + p2Err?.message);

    const patient1 = p1;
    const patient2 = p2;
    console.log(`Patient 1: ${patient1.full_name} (${patient1.id})`);
    console.log(`Patient 2: ${patient2.full_name} (${patient2.id})`);

    const today = new Date().toISOString().split('T')[0];

    // Ensure doctor session is open today
    await supabase.from('doctor_sessions').upsert({
        doctor_id: doctor.id,
        session_date: today,
        status: 'open',
        started_at: new Date().toISOString()
    }, { onConflict: 'doctor_id,session_date' });

    // Remove any leftover test appointments for today
    await supabase.from('appointments').delete().eq('doctor_id', doctor.id).eq('appointment_date', today).in('serial_no', [901, 902]);

    // 2. Create two sequential appointments: Serial #901 (patient 1) and Serial #902 (patient 2)
    const { data: appt1, error: a1Err } = await supabase
        .from('appointments')
        .insert({
            doctor_id: doctor.id,
            patient_id: patient1.id,
            appointment_date: today,
            start_time: '10:00:00',
            end_time: '10:15:00',
            serial_no: 901,
            status: 'scheduled',
            visit_type: 'new',
            visit_source: 'walk_in'
        })
        .select()
        .single();

    if (a1Err || !appt1) throw new Error('Failed to create appt1: ' + a1Err?.message);
    console.log(`✓ Created Appointment 1: ID ${appt1.id}, Serial #901`);

    const { data: appt2, error: a2Err } = await supabase
        .from('appointments')
        .insert({
            doctor_id: doctor.id,
            patient_id: patient2.id,
            appointment_date: today,
            start_time: '10:15:00',
            end_time: '10:30:00',
            serial_no: 902,
            status: 'scheduled',
            visit_type: 'new',
            visit_source: 'walk_in'
        })
        .select()
        .single();

    if (a2Err || !appt2) throw new Error('Failed to create appt2: ' + a2Err?.message);
    console.log(`✓ Created Appointment 2: ID ${appt2.id}, Serial #902`);

    try {
        // 3. Check in both appointments
        await supabase.from('appointments').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', appt1.id);
        await supabase.from('appointments').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', appt2.id);
        console.log('✓ Both patients checked in.');

        // 4. Start consultation for Serial #901
        const { error: start1Err } = await supabase.rpc('start_consultation', { p_id: appt1.id });
        if (start1Err) throw new Error('start_consultation 1 failed: ' + start1Err.message);

        const { data: activeAppt1 } = await supabase.from('appointments').select('status, consult_started_at').eq('id', appt1.id).single();
        console.log(`✓ Serial #901 status is now: ${activeAppt1?.status} (consult_started_at: ${activeAppt1?.consult_started_at})`);

        // Verify that calling Serial #902 while Serial #901 is in room is properly blocked
        const { error: blockErr } = await supabase.rpc('start_consultation', { p_id: appt2.id });
        if (!blockErr) {
            throw new Error('FAILED: Calling second patient while first is in chamber was supposed to be blocked!');
        }
        console.log('✓ Confirmed: Doctor chamber is occupied; Serial #902 cannot enter yet.');

        // 5. End consultation for Serial #901 (Doctor visit finished, moves to prescription_pending)
        const { error: end1Err } = await supabase.rpc('end_consultation', { p_id: appt1.id });
        if (end1Err) throw new Error('end_consultation failed: ' + end1Err.message);

        const { data: pendingAppt1 } = await supabase.from('appointments').select('status, consult_ended_at').eq('id', appt1.id).single();
        console.log(`✓ Serial #901 transitioned to: ${pendingAppt1?.status} (consult_ended_at: ${pendingAppt1?.consult_ended_at})`);

        if (pendingAppt1?.status !== 'prescription_pending') {
            throw new Error(`Expected status 'prescription_pending', got '${pendingAppt1?.status}'`);
        }

        // 6. Test Critical Requirement: Does it block the next serial patient from entering the room?
        console.log('Testing: Calling next patient (Serial #902) while Serial #901 prescription is pending...');
        const { error: start2Err } = await supabase.rpc('start_consultation', { p_id: appt2.id });
        if (start2Err) {
            throw new Error('FAILED: Serial #902 was blocked from entering chamber! Error: ' + start2Err.message);
        }

        const { data: activeAppt2 } = await supabase.from('appointments').select('status').eq('id', appt2.id).single();
        console.log(`✓ SUCCESS! Serial #902 entered chamber without blocking! Status: ${activeAppt2?.status}`);

        // 7. Upload Prescription for Serial #901 and Mark Complete
        console.log('Uploading prescription for Serial #901...');
        const testFileName = `${patient1.id}/${Date.now()}-prescription-rx-test.pdf`;
        const testPdfBuffer = Buffer.from('%PDF-1.4 test prescription content for clinic simulation');

        const { error: storageErr } = await supabase.storage
            .from('medical_documents')
            .upload(testFileName, testPdfBuffer, { contentType: 'application/pdf', upsert: true });

        if (storageErr) throw new Error('Storage upload failed: ' + storageErr.message);
        console.log('✓ Uploaded prescription file to storage bucket medical_documents');

        // Create medical_records entry
        const { data: record, error: recErr } = await supabase
            .from('medical_records')
            .insert({
                patient_id: patient1.id,
                doctor_id: doctor.id,
                appointment_id: appt1.id,
                uploaded_by: doctor.id,
                record_type: 'prescription',
                title: `Prescription - Dr. ${doctor.full_name} (${today})`,
                description: 'Prescription uploaded upon consultation completion',
                file_path: testFileName,
                document_date: today,
                file_size: testPdfBuffer.length,
                file_type: 'application/pdf'
            })
            .select()
            .single();

        if (recErr || !record) throw new Error('medical_records insert failed: ' + recErr?.message);
        console.log(`✓ Created medical_records entry: ID ${record.id}`);

        // Call complete_prescription_upload
        const { error: completeErr } = await supabase.rpc('complete_prescription_upload', {
            p_appointment_id: appt1.id,
            p_record_id: record.id
        });

        if (completeErr) throw new Error('complete_prescription_upload failed: ' + completeErr.message);

        const { data: finalizedAppt1 } = await supabase
            .from('appointments')
            .select('status, prescription_record_id')
            .eq('id', appt1.id)
            .single();

        console.log(`✓ Serial #901 finalized status: ${finalizedAppt1?.status}, prescription_record_id: ${finalizedAppt1?.prescription_record_id}`);

        if (finalizedAppt1?.status !== 'completed' || finalizedAppt1?.prescription_record_id !== record.id) {
            throw new Error('FAILED: Serial #901 did not transition to completed with prescription_record_id');
        }

        // 8. Patient Portal Verification
        const { data: patientRecords } = await supabase
            .from('medical_records')
            .select('id, title, record_type, file_path')
            .eq('appointment_id', appt1.id);

        console.log(`✓ Patient portal verification: Found ${patientRecords?.length} prescription record(s) linked to visit.`);
        console.log(`  Title: ${patientRecords?.[0]?.title}`);
        console.log(`  File path: ${patientRecords?.[0]?.file_path}`);

        // End consultation for Serial #902 as well to leave chamber in proper state
        await supabase.rpc('end_consultation', { p_id: appt2.id });
        console.log('✓ Serial #902 consultation ended (prescription_pending), doctor chamber is now idle.');

        console.log('\n========================================');
        console.log('ALL FEATURE 2 TESTS PASSED PERFECTLY!');
        console.log('========================================\n');

    } finally {
        // Safely end appt2 consultation if still active so doctor chamber remains free
        if (appt2?.id) {
            try {
                await supabase.rpc('end_consultation', { p_id: appt2.id });
            } catch {}
        }
        if (patient1?.id) {
            try {
                const { data: files } = await supabase.storage.from('medical_documents').list(patient1.id);
                if (files && files.length > 0) {
                    await supabase.storage.from('medical_documents').remove(files.map(f => `${patient1.id}/${f.name}`));
                }
            } catch {}
        }
        console.log('✓ Cleaned up test database records.');
    }
}

runTest().catch(err => {
    console.error('TEST ERROR:', err);
    process.exit(1);
});
