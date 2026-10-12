import { NextRequest, NextResponse } from 'next/server';
import { calculateQueueEstimate } from '@/lib/queue/decisionSupport';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDhaka } from '@/lib/format';

/**
 * GET /api/queue/estimate
 * Supports:
 * - ?appointment_id=<UUID>
 * - ?uhid=<UHID>&doctor_id=<UUID>
 * - ?serial_no=<INT>&doctor_id=<UUID>
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const appointmentId = searchParams.get('appointment_id');
        const uhid = searchParams.get('uhid');
        const doctorId = searchParams.get('doctor_id');
        const serialNo = searchParams.get('serial_no');

        let targetAppointmentId = appointmentId;

        if (!targetAppointmentId) {
            const today = todayDhaka();

            if (uhid && doctorId) {
                // Find patient by UHID
                const { data: patient } = await supabaseAdmin
                    .from('patients')
                    .select('id')
                    .eq('uhid', uhid.trim())
                    .single();

                if (!patient) {
                    return NextResponse.json({ success: false, error: 'Patient with this UHID not found' }, { status: 404 });
                }

                const { data: appt } = await supabaseAdmin
                    .from('appointments')
                    .select('id')
                    .eq('patient_id', patient.id)
                    .eq('doctor_id', doctorId)
                    .eq('appointment_date', today)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (!appt) {
                    return NextResponse.json({ success: false, error: 'No appointment found for this patient and doctor today' }, { status: 404 });
                }
                targetAppointmentId = appt.id;
            } else if (serialNo && doctorId) {
                const { data: appt } = await supabaseAdmin
                    .from('appointments')
                    .select('id')
                    .eq('serial_no', parseInt(serialNo, 10))
                    .eq('doctor_id', doctorId)
                    .eq('appointment_date', today)
                    .single();

                if (!appt) {
                    return NextResponse.json({ success: false, error: 'No appointment found for Serial #' + serialNo + ' today' }, { status: 404 });
                }
                targetAppointmentId = appt.id;
            } else {
                return NextResponse.json({
                    success: false,
                    error: 'Please provide either appointment_id, or (uhid + doctor_id), or (serial_no + doctor_id)'
                }, { status: 400 });
            }
        }

        if (!targetAppointmentId) {
            return NextResponse.json({
                success: false,
                error: 'Please provide either appointment_id, or (uhid + doctor_id), or (serial_no + doctor_id)'
            }, { status: 400 });
        }

        const estimate = await calculateQueueEstimate(targetAppointmentId);
        return NextResponse.json(estimate);
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err?.message || 'Failed to calculate queue estimate'
        }, { status: 500 });
    }
}

/**
 * POST /api/queue/estimate
 * Chatbot-friendly endpoint allowing query by JSON payload
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { appointmentId, uhid, doctorId, serialNo, query } = body;

        let targetId = appointmentId;
        const today = todayDhaka();

        if (!targetId && uhid) {
            const { data: patient } = await supabaseAdmin
                .from('patients')
                .select('id')
                .eq('uhid', uhid.trim())
                .single();

            if (patient) {
                let queryBuilder = supabaseAdmin
                    .from('appointments')
                    .select('id')
                    .eq('patient_id', patient.id)
                    .eq('appointment_date', today);

                if (doctorId) {
                    queryBuilder = queryBuilder.eq('doctor_id', doctorId);
                }

                const { data: appt } = await queryBuilder.order('created_at', { ascending: false }).limit(1).single();
                if (appt) targetId = appt.id;
            }
        } else if (!targetId && serialNo && doctorId) {
            const { data: appt } = await supabaseAdmin
                .from('appointments')
                .select('id')
                .eq('serial_no', parseInt(serialNo, 10))
                .eq('doctor_id', doctorId)
                .eq('appointment_date', today)
                .single();

            if (appt) targetId = appt.id;
        }

        if (!targetId) {
            return NextResponse.json({
                success: false,
                error: 'Could not resolve target appointment. Please specify appointmentId, uhid, or (serialNo + doctorId).'
            }, { status: 400 });
        }

        const estimate = await calculateQueueEstimate(targetId);
        return NextResponse.json(estimate);
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err?.message || 'Error processing queue estimation inquiry'
        }, { status: 500 });
    }
}
