// scripts/test-feedback-workflow.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
    console.log('--- STARTING FEATURE 3 TEST: Patient Visit Feedback with 7-Day Expiration ---');

    // 1. Fetch doctor
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

    // 2. Create isolated test patient
    const now = Date.now();
    const { data: patient, error: patErr } = await supabase.from('patients').insert({
        uhid: `FB-TEST-${now}`,
        full_name: `Feedback Test Patient (${now})`,
        mobile_no: `017${now.toString().slice(-8)}`,
        gender: 'male'
    }).select().single();

    if (patErr || !patient) throw new Error('Failed to create test patient: ' + patErr?.message);
    console.log(`Test Patient: ${patient.full_name} (${patient.id})`);

    const today = new Date().toISOString().split('T')[0];
    
    // Dates for testing
    const d8DaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const d5DaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let apptToday: any = null;
    let apptNonCompleted: any = null;
    let apptExpired: any = null;
    let appt5DaysAgo: any = null;

    try {
        // 3. Create a completed appointment for TODAY
        const t0_1 = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const t0_2 = new Date(Date.now() - 20 * 60 * 1000).toISOString();
        const t0_3 = new Date(Date.now() - 10 * 60 * 1000).toISOString();

        const { data: a1, error: a1Err } = await supabase
            .from('appointments')
            .insert({
                doctor_id: doctor.id,
                patient_id: patient.id,
                appointment_date: today,
                start_time: '09:00:00',
                end_time: '09:15:00',
                serial_no: 801,
                status: 'completed',
                checked_in_at: t0_1,
                consult_started_at: t0_2,
                consult_ended_at: t0_3,
                visit_type: 'new',
                visit_source: 'walk_in'
            })
            .select()
            .single();

        if (a1Err || !a1) throw new Error('Failed to create apptToday: ' + a1Err?.message);
        apptToday = a1;
        console.log(`✓ Created completed appointment for today: ID ${apptToday.id}`);

        // --- TEST 1: Submit Feedback on Completed Visit Within 7 Days ---
        console.log('\n--- Test 1: Submitting Feedback on Completed Visit (Today) ---');
        const { data: fbId, error: fbErr } = await supabase.rpc('submit_appointment_feedback', {
            p_appointment_id: apptToday.id,
            p_doctor_rating: 5,
            p_service_rating: 4,
            p_comment: 'Dr was very thorough and attentive. Short wait time.',
            p_metadata: { source: 'automated_test', client_ip: '127.0.0.1' }
        });

        if (fbErr || !fbId) throw new Error('submit_appointment_feedback failed: ' + fbErr?.message);
        console.log(`✓ Feedback successfully submitted! Feedback ID: ${fbId}`);

        // Verify stored data in DB
        const { data: fbRow, error: getErr } = await supabase
            .from('appointment_feedbacks')
            .select('*')
            .eq('id', fbId)
            .single();

        if (getErr || !fbRow) throw new Error('Failed to retrieve feedback row: ' + getErr?.message);
        console.log(`  Doctor Rating: ${fbRow.doctor_rating}/5`);
        console.log(`  Service Rating: ${fbRow.service_rating}/5`);
        console.log(`  Overall Rating (Generated Column): ${fbRow.overall_rating}/5.00`);
        console.log(`  Comments: "${fbRow.comment}"`);
        console.log(`  Visit Date: ${fbRow.visit_date}`);
        console.log(`  Metadata: ${JSON.stringify(fbRow.metadata)}`);

        if (fbRow.overall_rating !== 4.5 || fbRow.doctor_rating !== 5 || fbRow.service_rating !== 4) {
            throw new Error(`Data mismatch in feedback row: expected overall 4.5, got ${fbRow.overall_rating}`);
        }
        console.log('✓ TEST 1 PASSED: Feedback recorded with correct ratings, average, and metadata.');

        // --- TEST 2: Prevent Duplicate Feedback on Same Appointment ---
        console.log('\n--- Test 2: Preventing Duplicate Feedback on Same Appointment ---');
        let duplicateBlocked = false;
        try {
            await supabase.rpc('submit_appointment_feedback', {
                p_appointment_id: apptToday.id,
                p_doctor_rating: 3,
                p_service_rating: 3,
                p_comment: 'Second feedback attempt'
            });
        } catch (e: any) {
            duplicateBlocked = true;
            console.log(`✓ Correctly rejected duplicate feedback: ${e.message}`);
        }
        const { error: dupErr } = await supabase.rpc('submit_appointment_feedback', {
            p_appointment_id: apptToday.id,
            p_doctor_rating: 3,
            p_service_rating: 3,
            p_comment: 'Second feedback attempt'
        });
        if (dupErr) {
            duplicateBlocked = true;
            console.log(`✓ RPC returned error on duplicate: ${dupErr.message}`);
        }
        if (!duplicateBlocked) throw new Error('FAILED: Duplicate feedback was NOT blocked!');
        console.log('✓ TEST 2 PASSED: Duplicate feedback prevented.');

        // --- TEST 3: Reject Feedback on Non-Completed Appointment ---
        console.log('\n--- Test 3: Rejecting Feedback on Non-Completed Appointment ---');
        const { data: a2, error: a2Err } = await supabase
            .from('appointments')
            .insert({
                doctor_id: doctor.id,
                patient_id: patient.id,
                appointment_date: d5DaysAgo,
                start_time: '11:00:00',
                end_time: '11:15:00',
                serial_no: 802,
                status: 'scheduled', // not completed
                visit_type: 'new',
                visit_source: 'walk_in'
            })
            .select()
            .single();

        if (a2Err || !a2) throw new Error('Failed to create non-completed appt: ' + a2Err?.message);
        apptNonCompleted = a2;

        const { error: nonCompErr } = await supabase.rpc('submit_appointment_feedback', {
            p_appointment_id: apptNonCompleted.id,
            p_doctor_rating: 5,
            p_service_rating: 5,
            p_comment: 'Should not allow'
        });

        if (!nonCompErr) {
            throw new Error('FAILED: Feedback was accepted for non-completed appointment!');
        }
        console.log(`✓ Correctly rejected feedback on scheduled visit: ${nonCompErr.message}`);
        console.log('✓ TEST 3 PASSED: Non-completed appointment cannot receive feedback.');

        // --- TEST 4: 7-Day Expiration Enforcement ---
        console.log('\n--- Test 4: 7-Day Expiration Enforcement ---');
        // Create appointment 8 days ago (expired window)
        const t8_base = Date.now() - 8 * 24 * 3600 * 1000;
        const t8_1 = new Date(t8_base).toISOString();
        const t8_2 = new Date(t8_base + 10 * 60 * 1000).toISOString();
        const t8_3 = new Date(t8_base + 20 * 60 * 1000).toISOString();

        const { data: a3, error: a3Err } = await supabase
            .from('appointments')
            .insert({
                doctor_id: doctor.id,
                patient_id: patient.id,
                appointment_date: d8DaysAgo,
                start_time: '12:00:00',
                end_time: '12:15:00',
                serial_no: 803,
                status: 'completed',
                checked_in_at: t8_1,
                consult_started_at: t8_2,
                consult_ended_at: t8_3,
                visit_type: 'new',
                visit_source: 'walk_in'
            })
            .select()
            .single();

        if (a3Err || !a3) throw new Error('Failed to create 8-day-old appt: ' + a3Err?.message);
        apptExpired = a3;

        const { error: expiredErr } = await supabase.rpc('submit_appointment_feedback', {
            p_appointment_id: apptExpired.id,
            p_doctor_rating: 4,
            p_service_rating: 4,
            p_comment: '8 days old feedback attempt'
        });

        if (!expiredErr) {
            throw new Error('FAILED: Expired feedback (>7 days) was accepted!');
        }
        console.log(`✓ Correctly rejected feedback for 8-day-old visit: ${expiredErr.message}`);

        // Create appointment 5 days ago (valid window <= 7 days)
        const t5_base = Date.now() - 5 * 24 * 3600 * 1000;
        const t5_1 = new Date(t5_base).toISOString();
        const t5_2 = new Date(t5_base + 10 * 60 * 1000).toISOString();
        const t5_3 = new Date(t5_base + 20 * 60 * 1000).toISOString();

        const { data: a4, error: a4Err } = await supabase
            .from('appointments')
            .insert({
                doctor_id: doctor.id,
                patient_id: patient.id,
                appointment_date: d5DaysAgo,
                start_time: '14:00:00',
                end_time: '14:15:00',
                serial_no: 804,
                status: 'completed',
                checked_in_at: t5_1,
                consult_started_at: t5_2,
                consult_ended_at: t5_3,
                visit_type: 'new',
                visit_source: 'walk_in'
            })
            .select()
            .single();

        if (a4Err || !a4) throw new Error('Failed to create 5-day-old appt: ' + a4Err?.message);
        appt5DaysAgo = a4;

        const { data: fb4Id, error: validFbErr } = await supabase.rpc('submit_appointment_feedback', {
            p_appointment_id: appt5DaysAgo.id,
            p_doctor_rating: 4,
            p_service_rating: 5,
            p_comment: '5-day-old visit feedback, within 7-day allowed window'
        });

        if (validFbErr || !fb4Id) {
            throw new Error('FAILED: Valid feedback within 7 days was rejected! ' + validFbErr?.message);
        }
        console.log(`✓ Correctly accepted feedback for 5-day-old visit (ID: ${fb4Id})!`);
        console.log('✓ TEST 4 PASSED: 7-day expiration boundary strictly enforced.');

        // --- TEST 5: Relation & Readback Verification ---
        console.log('\n--- Test 5: Relation Query & Readback Verification ---');
        const { data: readAppt, error: readErr } = await supabase
            .from('appointments')
            .select(`
                id,
                serial_no,
                appointment_date,
                status,
                appointment_feedbacks (
                    id,
                    doctor_rating,
                    service_rating,
                    overall_rating,
                    comment
                )
            `)
            .eq('id', apptToday.id)
            .single();

        if (readErr || !readAppt) throw new Error('Failed to query appointment with joined feedback: ' + readErr?.message);
        console.log('✓ Joined Query Result:', JSON.stringify(readAppt, null, 2));

        console.log('\n========================================');
        console.log('ALL FEATURE 3 TESTS PASSED PERFECTLY!');
        console.log('========================================\n');

    } finally {
        // Clean up test data
        const apptIds = [apptToday?.id, apptNonCompleted?.id, apptExpired?.id, appt5DaysAgo?.id].filter(Boolean);
        if (apptIds.length > 0) {
            await supabase.from('appointment_feedbacks').delete().in('appointment_id', apptIds);
            await supabase.from('consultation_analytics_logs').delete().in('appointment_id', apptIds);
            await supabase.from('appointments').delete().in('id', apptIds);
        }
        if (patient?.id) {
            await supabase.from('patients').delete().eq('id', patient.id);
        }
        console.log('✓ Cleaned up test database records.');
    }
}

runTest().catch((err) => {
    console.error('TEST ERROR:', err);
    process.exit(1);
});
