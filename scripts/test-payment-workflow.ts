import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '../lib/supabase/admin';
import { initiatePayment, handlePaymentSuccess, handlePaymentFailure, handlePaymentCancel } from '../lib/payment/sslcommerz';

async function testPaymentWorkflow() {
    console.log('--- STARTING PAYMENT WORKFLOW INTEGRATION TEST ---');

    // 1. Pick an appointment from database
    const { data: appt, error: apptError } = await supabaseAdmin
        .from('appointments')
        .select('id, doctor_id, patient_id, appointment_date, start_time, serial_no, payment_status, paid_amount')
        .limit(1)
        .single();

    if (apptError || !appt) {
        console.error('No test appointment found:', apptError);
        process.exit(1);
    }

    console.log(`[Step 1] Using appointment ${appt.id} (Current status: ${appt.payment_status}, paid: ${appt.paid_amount})`);

    // Fetch patient info
    const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('full_name, email, mobile_no')
        .eq('id', appt.patient_id)
        .single();

    // 2. Test initiatePayment
    console.log('[Step 2] Testing initiatePayment against SSLCommerz Sandbox...');
    const initResult = await initiatePayment({
        appointmentId: appt.id,
        patientId: appt.patient_id,
        doctorId: appt.doctor_id,
        amount: 1200,
        patientName: patient?.full_name || 'Test Patient',
        patientEmail: patient?.email || 'patient@test.com',
        patientPhone: patient?.mobile_no || '01711111111'
    });

    console.log('Initiate Result:', {
        success: initResult.success,
        tran_id: initResult.tran_id,
        hasGatewayUrl: !!initResult.gatewayUrl,
        gatewayPreview: initResult.gatewayUrl?.substring(0, 50) + '...'
    });

    if (!initResult.success || !initResult.tran_id) {
        console.error('Failed to initiate payment:', initResult.error);
        process.exit(1);
    }

    // 3. Verify record was created in payments table
    const { data: payRecord, error: payError } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('tran_id', initResult.tran_id)
        .single();

    if (payError || !payRecord) {
        console.error('Payments record not found in Supabase:', payError);
        process.exit(1);
    }

    console.log(`[Step 3] Payment row created: ID=${payRecord.id}, Status=${payRecord.status}, Amount=${payRecord.amount}`);
    if (payRecord.status !== 'pending') {
        console.error(`Expected status 'pending', got '${payRecord.status}'`);
        process.exit(1);
    }

    // 4. Test handlePaymentSuccess
    console.log('[Step 4] Testing handlePaymentSuccess callback processing...');
    const fakeSuccessPayload = {
        tran_id: initResult.tran_id,
        val_id: 'TEST_VAL_' + Date.now(),
        amount: '1200.00',
        card_type: 'VISA-City Bank',
        card_brand: 'VISA',
        card_issuer: 'City Bank',
        card_no: '411111XXXXXX1111',
        bank_tran_id: 'BNK_' + Date.now(),
        value_a: appt.id,
        status: 'VALID'
    };

    const successResult = await handlePaymentSuccess(fakeSuccessPayload);
    console.log('Success Handler Result:', successResult);

    // 5. Verify database updates
    const { data: updatedPay } = await supabaseAdmin
        .from('payments')
        .select('status, val_id, bank_tran_id, card_brand')
        .eq('tran_id', initResult.tran_id)
        .single();

    const { data: updatedAppt } = await supabaseAdmin
        .from('appointments')
        .select('payment_status, paid_amount')
        .eq('id', appt.id)
        .single();

    console.log(`[Step 5] Database state verified:`);
    console.log(`- Payment status in payments table: ${updatedPay?.status} (Card: ${updatedPay?.card_brand})`);
    console.log(`- Appointment payment_status: ${updatedAppt?.payment_status}, paid_amount: ${updatedAppt?.paid_amount}`);

    if (updatedPay?.status !== 'completed') {
        console.error(`Expected payment status 'completed', got '${updatedPay?.status}'`);
        process.exit(1);
    }
    if (updatedAppt?.payment_status !== 'paid' || Number(updatedAppt?.paid_amount) !== 1200) {
        console.error('Appointment payment_status or paid_amount not updated correctly');
        process.exit(1);
    }

    console.log('--- ALL PAYMENT INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
}

testPaymentWorkflow().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
