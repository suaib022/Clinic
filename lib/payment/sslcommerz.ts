import { supabaseAdmin } from '@/lib/supabase/admin';

export interface InitiatePaymentParams {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    amount: number;
    patientName: string;
    patientEmail?: string;
    patientPhone: string;
    patientAddress?: string;
    patientCity?: string;
    doctorName?: string;
}

export interface InitiatePaymentResult {
    success: boolean;
    gatewayUrl?: string;
    tran_id?: string;
    sessionkey?: string;
    error?: string;
}

const STORE_ID = process.env.SSLCOMMERZ_STORE_ID || 'testbox';
const STORE_PASSWORD = process.env.SSLCOMMERZ_STORE_PASSWORD || 'qwerty';
const IS_SANDBOX = process.env.SSLCOMMERZ_IS_SANDBOX !== 'false';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const SSLCOMMERZ_API_URL = IS_SANDBOX
    ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
    : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

const SSLCOMMERZ_VALIDATOR_URL = IS_SANDBOX
    ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
    : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

/**
 * Initiates an SSLCommerz payment session and saves a pending record in `payments`.
 */
export async function initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    try {
        const tran_id = `CLINIC_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const total_amount = Number(params.amount || 1000).toFixed(2);

        const formData = new URLSearchParams({
            store_id: STORE_ID,
            store_passwd: STORE_PASSWORD,
            total_amount: total_amount,
            currency: 'BDT',
            tran_id: tran_id,
            success_url: `${APP_URL}/api/payment/success`,
            fail_url: `${APP_URL}/api/payment/fail`,
            cancel_url: `${APP_URL}/api/payment/cancel`,
            ipn_url: `${APP_URL}/api/payment/ipn`,
            shipping_method: 'NO',
            product_name: 'Doctor Consultation Fee',
            product_category: 'Healthcare',
            product_profile: 'general',
            cus_name: params.patientName || 'Clinic Patient',
            cus_email: params.patientEmail || 'patient@clinic.local',
            cus_add1: params.patientAddress || 'Dhaka, Bangladesh',
            cus_city: params.patientCity || 'Dhaka',
            cus_postcode: '1205',
            cus_country: 'Bangladesh',
            cus_phone: params.patientPhone || '01700000000',
            value_a: params.appointmentId,
            value_b: params.patientId,
            value_c: params.doctorId,
            value_d: params.doctorName || 'Doctor'
        });

        const response = await fetch(SSLCOMMERZ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (data.status === 'SUCCESS' && data.GatewayPageURL) {
            // Insert pending payment record in Supabase
            const { error: dbError } = await supabaseAdmin.from('payments').insert({
                tran_id: tran_id,
                appointment_id: params.appointmentId,
                patient_id: params.patientId,
                doctor_id: params.doctorId,
                amount: Number(total_amount),
                currency: 'BDT',
                status: 'pending',
                gateway_session_key: data.sessionkey || null,
                gateway_response: data
            });

            if (dbError) {
                console.error('[SSLCommerz] Error creating payments record:', dbError);
            }

            return {
                success: true,
                gatewayUrl: data.GatewayPageURL,
                tran_id: tran_id,
                sessionkey: data.sessionkey
            };
        } else {
            console.error('[SSLCommerz] Initiation failed:', data);
            return {
                success: false,
                error: data.failedreason || 'Failed to initiate payment session with SSLCommerz'
            };
        }
    } catch (err: any) {
        console.error('[SSLCommerz] Initiation exception:', err);
        return {
            success: false,
            error: err?.message || 'Payment initiation error'
        };
    }
}

/**
 * Validates transaction with SSLCommerz validation API.
 */
export async function validatePayment(val_id: string): Promise<{ isValid: boolean; data: any }> {
    try {
        if (!val_id) {
            return { isValid: false, data: null };
        }

        const url = `${SSLCOMMERZ_VALIDATOR_URL}?val_id=${encodeURIComponent(val_id)}&store_id=${encodeURIComponent(STORE_ID)}&store_passwd=${encodeURIComponent(STORE_PASSWORD)}&format=json`;
        const res = await fetch(url);
        const data = await res.json();

        const isValid = data.status === 'VALID' || data.status === 'VALIDATED';
        return { isValid, data };
    } catch (err) {
        console.error('[SSLCommerz] Validator error:', err);
        return { isValid: false, data: null };
    }
}

/**
 * Handles payment success callback from SSLCommerz.
 */
export async function handlePaymentSuccess(payload: Record<string, any>) {
    const tran_id = payload.tran_id;
    const val_id = payload.val_id;
    const appointmentId = payload.value_a;

    if (!tran_id) {
        throw new Error('Missing transaction ID in success payload');
    }

    // Validate with SSLCommerz API
    const validation = await validatePayment(val_id);
    const validData = validation.isValid ? validation.data : payload;

    const amount = Number(validData.amount || payload.amount || 0);
    const card_type = validData.card_type || payload.card_type || null;
    const card_brand = validData.card_brand || payload.card_brand || null;
    const card_issuer = validData.card_issuer || payload.card_issuer || null;
    const card_no = validData.card_no || payload.card_no || null;
    const bank_tran_id = validData.bank_tran_id || payload.bank_tran_id || null;
    const store_amount = validData.store_amount ? Number(validData.store_amount) : null;

    // 1. Update payments table
    const { data: updatedPayment, error: paymentError } = await supabaseAdmin
        .from('payments')
        .update({
            val_id: val_id,
            status: 'completed',
            payment_method: card_brand || card_type || 'SSLCommerz',
            bank_tran_id: bank_tran_id,
            card_type: card_type,
            card_brand: card_brand,
            card_issuer: card_issuer,
            card_no: card_no,
            store_amount: store_amount,
            tran_date: new Date().toISOString(),
            gateway_response: validData,
            updated_at: new Date().toISOString()
        })
        .eq('tran_id', tran_id)
        .select()
        .single();

    if (paymentError) {
        console.error('[SSLCommerz] Error updating payment record:', paymentError);
    }

    const targetApptId = appointmentId || updatedPayment?.appointment_id;

    // 2. Update appointments table
    if (targetApptId) {
        const { error: apptError } = await supabaseAdmin
            .from('appointments')
            .update({
                payment_status: 'paid',
                paid_amount: amount || updatedPayment?.amount || 0
            })
            .eq('id', targetApptId);

        if (apptError) {
            console.error('[SSLCommerz] Error updating appointment payment status:', apptError);
        }

        // 3. Log event into queue_events if doctor_id available
        if (updatedPayment?.doctor_id) {
            await supabaseAdmin.from('queue_events').insert({
                appointment_id: targetApptId,
                doctor_id: updatedPayment.doctor_id,
                event_type: 'payment_completed',
                actor_role: 'system'
            }).select();
        }
    }

    return {
        success: true,
        appointmentId: targetApptId,
        tran_id: tran_id,
        amount: amount
    };
}

/**
 * Handles payment failure callback from SSLCommerz.
 */
export async function handlePaymentFailure(payload: Record<string, any>) {
    const tran_id = payload.tran_id;
    const error_reason = payload.error || payload.failedreason || 'Payment failed or declined';

    if (tran_id) {
        await supabaseAdmin
            .from('payments')
            .update({
                status: 'failed',
                error_reason: error_reason,
                gateway_response: payload,
                updated_at: new Date().toISOString()
            })
            .eq('tran_id', tran_id);
    }

    return {
        success: false,
        appointmentId: payload.value_a,
        tran_id: tran_id,
        error: error_reason
    };
}

/**
 * Handles payment cancellation callback from SSLCommerz.
 */
export async function handlePaymentCancel(payload: Record<string, any>) {
    const tran_id = payload.tran_id;

    if (tran_id) {
        await supabaseAdmin
            .from('payments')
            .update({
                status: 'cancelled',
                error_reason: 'Payment cancelled by user',
                gateway_response: payload,
                updated_at: new Date().toISOString()
            })
            .eq('tran_id', tran_id);
    }

    return {
        cancelled: true,
        appointmentId: payload.value_a,
        tran_id: tran_id
    };
}

export const sslcommerz = {
    initiatePayment,
    validatePayment,
    handlePaymentSuccess,
    handlePaymentFailure,
    handlePaymentCancel
};
