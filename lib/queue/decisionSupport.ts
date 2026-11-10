import 'server-only';
import { toZonedTime } from 'date-fns-tz';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { runEngine } from './engine';
import { toEngineInput, type RawSnapshot } from './snapshotInput';

const TIMEZONE = 'Asia/Dhaka';

export interface BenchmarkData {
    speciality_name: string;
    avg_consult_minutes: number;
    min_consult_minutes: number;
    max_consult_minutes: number;
    safe_buffer_minutes: number;
    transition_buffer_seconds: number;
    description?: string;
}

/** Legacy response shape of /api/queue/estimate. Other patients' names are never filled in any more. */
export interface QueueEstimate {
    success: boolean;
    error?: string;
    appointmentId: string;
    patientId: string;
    patientName: string;
    patientUhid: string;
    serialNo: number;
    status: string;
    doctorId: string;
    doctorName: string;
    specialityName: string;
    appointmentDate: string;
    chamberStatus: 'not_started' | 'open' | 'paused' | 'ended';
    scheduledStartTime: string;
    actualStartTime: string | null;
    delayMinutes: number;
    delayReason: string | null;
    currentlyServingSerial: number | null;
    currentlyServingPatientName: string | null;
    patientsAheadTotal: number;
    patientsAheadPresent: number;
    patientsAheadNotPresent: number;
    patientsCompletedCount: number;
    avgConsultMinutes: number;
    estimatedWaitMinutes: number;
    safetyBufferMinutes: number;
    expectedConsultStartTime: string;
    recommendedArrivalTime: string;
    urgencyLevel: 'immediate' | 'near' | 'comfortable';
    recommendationMessage: string;
    chatbotReply: string;
}

/** Returns current time as a Dhaka wall-clock Date (kept for existing callers). */
export function getDhakaNow(): Date {
    return toZonedTime(new Date(), TIMEZONE);
}

const time12 = (ms: number | null | undefined) =>
    ms == null ? '' : new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: 'numeric', minute: '2-digit' }).format(ms);

/**
 * @deprecated Use the engine (`lib/queue/engine`) through `getQueueSnapshot` / `getMyStatus` in `lib/queue/server`.
 * Thin wrapper kept so older callers keep working. Reads with the service role: call it **only after** the caller
 * has been authorised for this appointment (the /api/queue/estimate route does that).
 */
export async function calculateQueueEstimate(appointmentId: string): Promise<QueueEstimate> {
    const { data: appt, error } = await supabaseAdmin
        .from('appointments')
        .select('id, serial_no, appointment_date, status, doctor_id, patient_id, patient:patients!inner(full_name, uhid), doctor:users!appointments_doctor_id_fkey(full_name)')
        .eq('id', appointmentId)
        .single();
    if (error || !appt) throw new Error(error?.message || 'Appointment not found');

    const { data, error: rpcErr } = await supabaseAdmin.rpc('dss_snapshot_input', { p_doctor_id: appt.doctor_id, p_date: appt.appointment_date });
    if (rpcErr || !data) throw new Error(rpcErr?.message || 'Queue unavailable');
    const raw = data as RawSnapshot;
    const input = toEngineInput(raw);
    const { result } = runEngine(input);
    const e = result.estimates[appt.id];
    const patient = appt.patient as unknown as { full_name: string; uhid: string };
    const doctorName = (appt.doctor as unknown as { full_name: string } | null)?.full_name ?? 'Doctor';
    const waiting = input.appointments.filter((a) => a.status === 'checked_in' || a.status === 'scheduled');
    const ahead = e?.patientsAhead ?? 0;
    const wait = e?.expectedStartAt != null ? Math.max(0, Math.round((e.expectedStartAt - input.now) / 60_000)) : 0;
    const chamberStatus = result.session.state === 'active' ? 'open' : result.session.state;
    const urgencyLevel = ahead <= 1 || wait <= 15 ? 'immediate' : wait <= 35 ? 'near' : 'comfortable';
    const message = e?.reason ?? '';
    return {
        success: true,
        appointmentId: appt.id,
        patientId: appt.patient_id,
        patientName: patient.full_name,
        patientUhid: patient.uhid,
        serialNo: appt.serial_no,
        status: appt.status,
        doctorId: appt.doctor_id,
        doctorName,
        specialityName: raw.doctor.speciality ?? 'DEFAULT',
        appointmentDate: appt.appointment_date,
        chamberStatus,
        scheduledStartTime: time12(input.session.scheduledStartAt),
        actualStartTime: input.session.startedAt ? time12(input.session.startedAt) : null,
        delayMinutes: result.summary.delayMin,
        delayReason: raw.session?.delay_reason ?? null,
        currentlyServingSerial: result.nowServing?.serialNo ?? null,
        currentlyServingPatientName: null,
        patientsAheadTotal: ahead,
        patientsAheadPresent: ahead,
        patientsAheadNotPresent: waiting.filter((a) => a.status === 'scheduled' && a.bookedAt < (input.appointments.find((x) => x.id === appt.id)?.bookedAt ?? 0)).length,
        patientsCompletedCount: result.summary.seen,
        avgConsultMinutes: Math.round(result.durations.new.typical),
        estimatedWaitMinutes: wait,
        safetyBufferMinutes: 0,
        expectedConsultStartTime: e?.expectedStartAt ? time12(e.expectedStartAt) : '',
        recommendedArrivalTime: time12(Math.max(input.now, input.appointments.find((x) => x.id === appt.id)?.bookedAt ?? input.now)),
        urgencyLevel,
        recommendationMessage: message,
        chatbotReply: `Serial #${appt.serial_no}${result.nowServing ? `, now serving #${result.nowServing.serialNo}` : ''}. ` +
            `${ahead} patient(s) ahead. ${e?.waitMinLow != null ? `Estimated wait about ${e.waitMinLow}–${e.waitMinHigh} min. ` : ''}${message}.`,
    };
}
