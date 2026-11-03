// scripts/test-doctor-cancellation-workflow.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
    console.log('--- STARTING FEATURE 1 TEST: Doctor Schedule Cancellation, Notifications, Refund & Rebooking ---');

    // 1. Fetch Doctor
    const { data: doctor, error: docErr } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'doctor')
        .limit(1)
        .single();

    if (docErr || !doctor) throw new Error('No doctor found: ' + docErr?.message);
    console.log(`Doctor: Dr. ${doctor.full_name} (${doctor.id})`);

    // 2. Create Two Isolated Test Patients
    const now = Date.now();
    const { data: p1, error: p1Err } = await supabase.from('patients').insert({
        uhid: `DOC-CANCEL-P1-${now}`,
        full_name: `Cancellation Patient 1 (${now})`,
        mobile_no: `017${now.toString().slice(-8)}`,
        gender: 'male'
    }).select().single();
    if (p1Err || !p1) throw new Error('Failed to create patient 1: ' + p1Err?.message);

    const { data: p2, error: p2Err } = await supabase.from('patients').insert({
        uhid: `DOC-CANCEL-P2-${now}`,
        full_name: `Cancellation Patient 2 (${now + 1})`,
        mobile_no: `018${(now + 1).toString().slice(-8)}`,
        gender: 'female'
    }).select().single();
    if (p2Err || !p2) throw new Error('Failed to create patient 2: ' + p2Err?.message);

    console.log(`Patient 1: ${p1.full_name} (${p1.id})`);
    console.log(`Patient 2: ${p2.full_name} (${p2.id})`);

    // Dates
    const today = new Date().toISOString().split('T')[0];
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const tomorrow = tom.toISOString().split('T')[0];

    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 8);
    const nextWeek = nextWeekDate.toISOString().split('T')[0];

    let apptTodayPaid: any = null;
    let apptTodayUnpaid: any = null;
    let apptTomPaid: any = null;
    let apptNextWeek: any = null;
    let newRebookedApptId: string | null = null;

    try {
        // Remove any existing appointments on these test dates for this doctor
        await supabase.from('appointments').delete().eq('doctor_id', doctor.id).in('appointment_date', [today, tomorrow, nextWeek]).in('serial_no', [701, 702, 703, 704]);
        await supabase.from('doctor_leave_requests').delete().eq('doctor_id', doctor.id).in('start_date', [today, tomorrow]);

        // 3. Create test appointments:
        // Appt 1: Today, Paid (BDT 800)
        const { data: a1, error: a1Err } = await supabase.from('appointments').insert({
            doctor_id: doctor.id,
            patient_id: p1.id,
            appointment_date: today,
            start_time: '10:00:00',
            end_time: '10:15:00',
            serial_no: 701,
            status: 'scheduled',
            payment_status: 'paid',
            paid_amount: 800.00,
            refund_status: 'not_applicable',
            visit_type: 'new',
            visit_source: 'online'
        }).select().single();
        if (a1Err || !a1) throw new Error('Failed to create Appt 1: ' + a1Err?.message);
        apptTodayPaid = a1;

        // Appt 2: Today, Unpaid (BDT 0)
        const { data: a2, error: a2Err } = await supabase.from('appointments').insert({
            doctor_id: doctor.id,
            patient_id: p2.id,
            appointment_date: today,
            start_time: '10:15:00',
            end_time: '10:30:00',
            serial_no: 702,
            status: 'scheduled',
            payment_status: 'unpaid',
            paid_amount: 0.00,
            refund_status: 'not_applicable',
            visit_type: 'new',
            visit_source: 'online'
        }).select().single();
        if (a2Err || !a2) throw new Error('Failed to create Appt 2: ' + a2Err?.message);
        apptTodayUnpaid = a2;

        // Appt 3: Tomorrow, Paid (BDT 1000)
        const { data: a3, error: a3Err } = await supabase.from('appointments').insert({
            doctor_id: doctor.id,
            patient_id: p1.id,
            appointment_date: tomorrow,
            start_time: '11:00:00',
            end_time: '11:15:00',
            serial_no: 703,
            status: 'scheduled',
            payment_status: 'paid',
            paid_amount: 1000.00,
            refund_status: 'not_applicable',
            visit_type: 'new',
            visit_source: 'online'
        }).select().single();
        if (a3Err || !a3) throw new Error('Failed to create Appt 3: ' + a3Err?.message);
        apptTomPaid = a3;

        // Appt 4: Next week (Outside cancellation range)
        const { data: a4, error: a4Err } = await supabase.from('appointments').insert({
            doctor_id: doctor.id,
            patient_id: p2.id,
            appointment_date: nextWeek,
            start_time: '12:00:00',
            end_time: '12:15:00',
            serial_no: 704,
            status: 'scheduled',
            payment_status: 'paid',
            paid_amount: 800.00,
            refund_status: 'not_applicable',
            visit_type: 'new',
            visit_source: 'online'
        }).select().single();
        if (a4Err || !a4) throw new Error('Failed to create Appt 4: ' + a4Err?.message);
        apptNextWeek = a4;

        console.log('✓ Successfully created 4 test appointments (2 today, 1 tomorrow, 1 next week).');

        // --- TEST 1: Execute Schedule Cancellation for Today to Tomorrow ---
        console.log('\n--- Test 1: Executing Schedule Cancellation (Today to Tomorrow) ---');
        const cancelReason = 'Emergency OT / ICU Round at Central Hospital';

        const { data: cancelResult, error: cancelErr } = await supabase.rpc('doctor_cancel_schedule', {
            p_start_date: today,
            p_end_date: tomorrow,
            p_reason: cancelReason,
            p_doctor_id: doctor.id
        });

        if (cancelErr) throw new Error('doctor_cancel_schedule failed: ' + cancelErr.message);
        console.log('✓ Cancellation RPC Result:', JSON.stringify(cancelResult, null, 2));

        if (cancelResult.cancelled_appointments_count < 3) {
            throw new Error(`Expected at least 3 cancelled appointments, got ${cancelResult.cancelled_appointments_count}`);
        }
        if (cancelResult.refund_eligible_count < 2) {
            throw new Error(`Expected at least 2 refund-eligible visits, got ${cancelResult.refund_eligible_count}`);
        }

        // Verify Appt 1 (Paid)
        const { data: checkA1 } = await supabase.from('appointments').select('*').eq('id', apptTodayPaid.id).single();
        console.log(`  Appt 1 Status: ${checkA1.status}, cancelled_by_role: ${checkA1.cancelled_by_role}, refund_status: ${checkA1.refund_status}`);
        if (checkA1.status !== 'cancelled' || checkA1.refund_status !== 'eligible') {
            throw new Error('Appt 1 failed refund_status eligible check!');
        }

        // Verify Appt 2 (Unpaid)
        const { data: checkA2 } = await supabase.from('appointments').select('*').eq('id', apptTodayUnpaid.id).single();
        console.log(`  Appt 2 Status: ${checkA2.status}, refund_status: ${checkA2.refund_status}`);
        if (checkA2.status !== 'cancelled' || checkA2.refund_status !== 'not_applicable') {
            throw new Error('Appt 2 failed refund_status not_applicable check!');
        }

        // Verify Appt 4 (Next week - Unaffected)
        const { data: checkA4 } = await supabase.from('appointments').select('*').eq('id', apptNextWeek.id).single();
        console.log(`  Appt 4 (Next Week) Status: ${checkA4.status}`);
        if (checkA4.status !== 'scheduled') {
            throw new Error('Appt 4 was improperly cancelled!');
        }

        console.log('✓ TEST 1 PASSED: Multi-day schedule cancelled correctly with refund flags.');

        // --- TEST 2: Patient Notifications Verification ---
        console.log('\n--- Test 2: Verifying Patient Notifications ---');
        const { data: notifs, error: notifErr } = await supabase
            .from('patient_notifications')
            .select('*')
            .in('appointment_id', [apptTodayPaid.id, apptTodayUnpaid.id, apptTomPaid.id]);

        if (notifErr || !notifs || notifs.length < 3) {
            throw new Error(`Expected at least 3 notifications, found ${notifs?.length}`);
        }
        console.log(`✓ Found ${notifs.length} patient notifications:`);
        for (const n of notifs) {
            console.log(`  - [${n.type}] ${n.title}: "${n.message.substring(0, 70)}..."`);
        }
        console.log('✓ TEST 2 PASSED: Notifications created for all affected patients.');

        // --- TEST 3: Process Patient Refund ---
        console.log('\n--- Test 3: Processing Patient Refund for Appt 1 ---');
        const { data: refundRes, error: refundErr } = await supabase.rpc('process_patient_refund', {
            p_appointment_id: apptTodayPaid.id,
            p_refund_reason: 'Doctor emergency cancellation'
        });

        if (refundErr) throw new Error('process_patient_refund failed: ' + refundErr.message);
        console.log('✓ Refund RPC Result:', JSON.stringify(refundRes));

        const { data: refundedA1 } = await supabase.from('appointments').select('status, refund_status, payment_status').eq('id', apptTodayPaid.id).single();
        if (!refundedA1) throw new Error('Could not find refunded appointment 1');
        console.log(`  Appt 1 after refund: refund_status = ${refundedA1.refund_status}, payment_status = ${refundedA1.payment_status}`);
        if (refundedA1.refund_status !== 'processed' || refundedA1.payment_status !== 'refunded') {
            throw new Error('Appt 1 refund state incorrect!');
        }

        // Attempt duplicate refund on Appt 1
        let duplicateRefundBlocked = false;
        const { error: dupRefundErr } = await supabase.rpc('process_patient_refund', {
            p_appointment_id: apptTodayPaid.id
        });
        if (dupRefundErr) {
            duplicateRefundBlocked = true;
            console.log(`✓ Correctly blocked duplicate refund: ${dupRefundErr.message}`);
        }
        if (!duplicateRefundBlocked) throw new Error('FAILED: Duplicate refund was NOT blocked!');
        console.log('✓ TEST 3 PASSED: Refund processed and duplicate refund strictly prevented.');

        // --- TEST 4: Rebook Cancelled Appointment with Fee Transfer ---
        console.log('\n--- Test 4: Rebooking Cancelled Appt 3 with Fee Transfer ---');
        const rebookTargetDate = nextWeek; // next week date
        const rebookTargetTime = '14:30:00';

        const { data: rebookRes, error: rebookErr } = await supabase.rpc('rebook_cancelled_appointment', {
            p_old_appointment_id: apptTomPaid.id,
            p_new_doctor_id: doctor.id,
            p_new_date: rebookTargetDate,
            p_new_time: rebookTargetTime
        });

        if (rebookErr) throw new Error('rebook_cancelled_appointment failed: ' + rebookErr.message);
        console.log('✓ Rebooking RPC Result:', JSON.stringify(rebookRes));
        newRebookedApptId = rebookRes.new_appointment_id;

        // Verify new appointment has transferred payment
        const { data: newAppt } = await supabase.from('appointments').select('*').eq('id', newRebookedApptId).single();
        if (!newAppt) throw new Error('Could not find new rebooked appointment');
        console.log(`  New Appt ID: ${newAppt.id}, Serial #${newAppt.serial_no}, Date: ${newAppt.appointment_date}`);
        console.log(`  New Appt Payment: ${newAppt.payment_status}, Amount: BDT ${newAppt.paid_amount}`);

        if (newAppt.payment_status !== 'paid' || Number(newAppt.paid_amount) !== 1000.00) {
            throw new Error(`Failed to transfer BDT 1000 payment fee to new appointment! Got ${newAppt.paid_amount}`);
        }

        // Verify old appointment marked as rebooked
        const { data: oldA3 } = await supabase.from('appointments').select('refund_status').eq('id', apptTomPaid.id).single();
        if (!oldA3) throw new Error('Could not find old appointment 3');
        console.log(`  Old Appt 3 refund_status: ${oldA3.refund_status}`);
        if (oldA3.refund_status !== 'rebooked') {
            throw new Error('Old appointment was not marked refund_status = rebooked!');
        }

        // Attempt refund on old appointment: must be rejected
        let refundAfterRebookBlocked = false;
        const { error: postRebookRefundErr } = await supabase.rpc('process_patient_refund', {
            p_appointment_id: apptTomPaid.id
        });
        if (postRebookRefundErr) {
            refundAfterRebookBlocked = true;
            console.log(`✓ Correctly blocked refund on already-rebooked visit: ${postRebookRefundErr.message}`);
        }
        if (!refundAfterRebookBlocked) throw new Error('FAILED: Refund was allowed after rebooking!');

        console.log('✓ TEST 4 PASSED: Rebooking transferred paid fee and prevented duplicate refund.');

        // --- TEST 5: Slot Blocking Verification ---
        console.log('\n--- Test 5: Slot Blocking Verification (Leave Record Created) ---');
        const { data: leaveRec } = await supabase
            .from('doctor_leave_requests')
            .select('*')
            .eq('doctor_id', doctor.id)
            .eq('start_date', today)
            .single();

        console.log(`✓ Found approved leave record from ${leaveRec?.start_date} to ${leaveRec?.end_date} (Status: ${leaveRec?.status})`);

        // Attempt to rebook into the cancelled/blocked date: should be rejected
        let blockedBookingRejected = false;
        const { error: blockedBookingErr } = await supabase.rpc('rebook_cancelled_appointment', {
            p_old_appointment_id: apptTodayUnpaid.id,
            p_new_doctor_id: doctor.id,
            p_new_date: today, // today is blocked
            p_new_time: '15:00:00'
        });
        if (blockedBookingErr) {
            blockedBookingRejected = true;
            console.log(`✓ Correctly rejected booking on cancelled date: ${blockedBookingErr.message}`);
        }
        if (!blockedBookingRejected) throw new Error('FAILED: Booking on cancelled date was allowed!');
        console.log('✓ TEST 5 PASSED: Unavailable dates strictly blocked from new bookings.');

        console.log('\n========================================');
        console.log('ALL FEATURE 1 TESTS PASSED PERFECTLY!');
        console.log('========================================\n');

    } finally {
        // Cleanup test appointments & notifications
        if (p1?.id && p2?.id) {
            const { data: patientAppts } = await supabase.from('appointments').select('id').in('patient_id', [p1.id, p2.id]);
            const allIds = (patientAppts?.map(a => a.id) || []).concat([newRebookedApptId].filter(Boolean) as string[]);
            if (allIds.length > 0) {
                await supabase.from('patient_notifications').delete().in('appointment_id', allIds);
                await supabase.from('queue_events').delete().in('appointment_id', allIds);
                await supabase.from('appointments').delete().in('id', allIds);
            }
            await supabase.from('patients').delete().in('id', [p1.id, p2.id]);
        }
        await supabase.from('doctor_leave_requests').delete().eq('doctor_id', doctor.id).in('start_date', [today, tomorrow]);
        console.log('✓ Cleaned up test database records.');
    }
}

runTest().catch((err) => {
    console.error('TEST ERROR:', err);
    process.exit(1);
});
