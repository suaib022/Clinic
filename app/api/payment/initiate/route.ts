import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { initiatePayment } from '@/lib/payment/sslcommerz';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { appointment_id } = body;

        if (!appointment_id) {
            return NextResponse.json(
                { success: false, error: 'appointment_id is required' },
                { status: 400 }
            );
        }

        // Fetch appointment details
        const { data: appt, error: apptError } = await supabaseAdmin
            .from('appointments')
            .select('id, doctor_id, patient_id, appointment_date, start_time, serial_no, payment_status, paid_amount')
            .eq('id', appointment_id)
            .single();

        if (apptError || !appt) {
            return NextResponse.json(
                { success: false, error: 'Appointment not found' },
                { status: 404 }
            );
        }

        if (appt.payment_status === 'paid') {
            return NextResponse.json(
                { success: false, error: 'This appointment has already been paid for' },
                { status: 400 }
            );
        }

        // Fetch patient details
        const { data: patient } = await supabaseAdmin
            .from('patients')
            .select('id, full_name, mobile_no, email, address, city')
            .eq('id', appt.patient_id)
            .single();

        // Fetch doctor details
        const { data: doctorUser } = await supabaseAdmin
            .from('users')
            .select('id, full_name')
            .eq('id', appt.doctor_id)
            .single();

        // Fetch doctor consultation fee
        const { data: doctorFeeRecord } = await supabaseAdmin
            .from('doctors')
            .select('consultation_fee')
            .eq('id', appt.doctor_id)
            .single();

        const amount = Number(doctorFeeRecord?.consultation_fee || 1200);

        const result = await initiatePayment({
            appointmentId: appt.id,
            patientId: appt.patient_id,
            doctorId: appt.doctor_id,
            amount: amount,
            patientName: patient?.full_name || 'Patient',
            patientEmail: patient?.email || undefined,
            patientPhone: patient?.mobile_no || '01700000000',
            patientAddress: patient?.address || 'Dhaka',
            patientCity: patient?.city || 'Dhaka',
            doctorName: doctorUser?.full_name || 'Consulting Doctor'
        });

        if (!result.success || !result.gatewayUrl) {
            return NextResponse.json(
                { success: false, error: result.error || 'Failed to initiate payment gateway' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            gatewayUrl: result.gatewayUrl,
            tran_id: result.tran_id,
            sessionkey: result.sessionkey
        });
    } catch (err: any) {
        console.error('Payment initiation error:', err);
        return NextResponse.json(
            { success: false, error: err?.message || 'Internal server error during payment initiation' },
            { status: 500 }
        );
    }
}
