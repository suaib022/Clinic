import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { toZonedTime } from 'date-fns-tz';
import { format as fnsFormat, parseISO, addMinutes, differenceInMinutes, differenceInSeconds } from 'date-fns';

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

/**
 * Returns current timestamp in Dhaka time
 */
export function getDhakaNow(): Date {
    return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Format time to friendly 12h string (e.g. "10:30 AM")
 */
function formatTime12h(date: Date): string {
    return fnsFormat(date, 'h:mm a');
}

/**
 * Core Decision Support System (DSS) Algorithm:
 * Dynamically computes queue position, actual doctor delay, real-time pace, and safe arrival time.
 */
export async function calculateQueueEstimate(appointmentId: string): Promise<QueueEstimate> {
    const supabase = supabaseAdmin; // Use admin client to reliably read queue state across relations

    // 1. Fetch Target Appointment
    const { data: appt, error: apptError } = await supabase
        .from('appointments')
        .select(`
            id,
            serial_no,
            start_time,
            appointment_date,
            status,
            checked_in_at,
            consult_started_at,
            consult_ended_at,
            doctor_id,
            patient_id,
            patient:patients!inner(id, full_name, uhid),
            doctor:users!appointments_doctor_id_fkey(id, full_name)
        `)
        .eq('id', appointmentId)
        .single();

    if (apptError || !appt) {
        throw new Error(apptError?.message || 'Appointment not found');
    }

    const doctorId = appt.doctor_id;
    const appointmentDate = appt.appointment_date;
    const targetSerial = appt.serial_no || 1;
    const rawDocName = (appt.doctor as any)?.full_name || 'Doctor';
    const cleanDocName = rawDocName.replace(/^(Dr\.|Doctor|Prof\.|Professor|Associate Prof\.|Maj Gen Professor Dr\.)\s+/i, '').trim();
    const doctorName = rawDocName.toLowerCase().startsWith('prof') ? `Prof. ${cleanDocName}` : `Dr. ${cleanDocName}`;
    const patientName = (appt.patient as any)?.full_name || 'Patient';
    const patientUhid = (appt.patient as any)?.uhid || 'UHID';

    const now = getDhakaNow();

    // 2. Fetch Doctor's Primary Speciality
    const { data: docSpecs } = await supabase
        .from('doctor_specialities')
        .select('speciality:specialities!inner(name)')
        .eq('doctor_id', doctorId)
        .limit(1);

    const specialityName = (docSpecs?.[0]?.speciality as any)?.name || 'DEFAULT';

    // 3. Fetch Clinical Benchmark for this Speciality
    let benchmark: BenchmarkData = {
        speciality_name: specialityName,
        avg_consult_minutes: 10,
        min_consult_minutes: 5,
        max_consult_minutes: 25,
        safe_buffer_minutes: 5,
        transition_buffer_seconds: 90
    };

    const { data: benchmarkRow } = await supabase
        .from('department_benchmarks')
        .select('*')
        .eq('speciality_name', specialityName)
        .single();

    if (benchmarkRow) {
        benchmark = benchmarkRow;
    } else {
        const { data: defaultRow } = await supabase
            .from('department_benchmarks')
            .select('*')
            .eq('speciality_name', 'DEFAULT')
            .single();
        if (defaultRow) benchmark = defaultRow;
    }

    // 4. Fetch Doctor Schedule for Today's Day of Week
    const apptDateObj = parseISO(appointmentDate);
    const dayOfWeek = apptDateObj.getDay();

    const { data: schedule } = await supabase
        .from('doctor_schedules')
        .select('start_time, end_time, slot_duration_minutes')
        .eq('doctor_id', doctorId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .limit(1);

    const schedStartTimeStr = schedule?.[0]?.start_time || appt.start_time || '09:00:00';

    // 5. Fetch Doctor's Session Status for Today
    const { data: sessions } = await supabase
        .from('doctor_sessions')
        .select('status, started_at, scheduled_start, delay_minutes, delay_reason')
        .eq('doctor_id', doctorId)
        .eq('session_date', appointmentDate)
        .order('created_at', { ascending: false })
        .limit(1);

    const session = sessions?.[0];
    const chamberStatus = (session?.status as any) || 'not_started';
    const actualStartedAt = session?.started_at ? parseISO(session.started_at) : null;
    let recordedDelayMinutes = Number(session?.delay_minutes || 0);
    const delayReason = session?.delay_reason || null;

    // 6. Fetch All Appointments Today for this Doctor
    const { data: allAppts } = await supabase
        .from('appointments')
        .select(`
            id,
            serial_no,
            status,
            checked_in_at,
            consult_started_at,
            consult_ended_at,
            patient:patients!inner(full_name)
        `)
        .eq('doctor_id', doctorId)
        .eq('appointment_date', appointmentDate)
        .order('serial_no', { ascending: true });

    const todayAppts = allAppts || [];

    // 7. Calculate Empirical Average Consultation Duration from Completed / Consultation Ended Patients Today
    const completedAppts = todayAppts.filter(a => ['completed', 'prescription_pending'].includes(a.status) && a.consult_started_at && a.consult_ended_at);
    let empiricalAvg = benchmark.avg_consult_minutes;

    if (completedAppts.length >= 2) {
        const totalCompletedMins = completedAppts.reduce((acc, curr) => {
            const diff = differenceInSeconds(parseISO(curr.consult_ended_at!), parseISO(curr.consult_started_at!)) / 60;
            return acc + (diff > 0 ? diff : benchmark.avg_consult_minutes);
        }, 0);
        empiricalAvg = totalCompletedMins / completedAppts.length;
    }

    // Adaptive Blended Duration: 60% empirical pace today, 40% clinical benchmark prior
    const effectiveConsultMins = completedAppts.length >= 2
        ? Math.min(benchmark.max_consult_minutes, Math.max(benchmark.min_consult_minutes, 0.6 * empiricalAvg + 0.4 * benchmark.avg_consult_minutes))
        : benchmark.avg_consult_minutes;

    const transitionMins = (benchmark.transition_buffer_seconds || 90) / 60;

    // 8. Analyze Current Patient in Consultation
    const currentInConsult = todayAppts.find(a => a.status === 'in_consultation');
    let currentServingSerial: number | null = null;
    let currentServingPatientName: string | null = null;
    let currentPatientRemainingMins = 0;

    if (currentInConsult) {
        currentServingSerial = currentInConsult.serial_no;
        currentServingPatientName = (currentInConsult.patient as any)?.full_name || null;
        if (currentInConsult.consult_started_at) {
            const startedAt = toZonedTime(parseISO(currentInConsult.consult_started_at), TIMEZONE);
            const elapsedMins = Math.max(0, differenceInSeconds(now, startedAt) / 60);
            currentPatientRemainingMins = Math.max(1, Math.round(effectiveConsultMins - elapsedMins));
        } else {
            currentPatientRemainingMins = Math.round(effectiveConsultMins / 2);
        }
    } else {
        // If nobody in consultation, check the lowest checked_in serial
        const nextWaiting = todayAppts.find(a => a.status === 'checked_in');
        if (nextWaiting) {
            currentServingSerial = nextWaiting.serial_no;
            currentServingPatientName = (nextWaiting.patient as any)?.full_name || null;
        }
    }

    // 9. Categorize Patients Ahead of Target Serial
    const aheadAppts = todayAppts.filter(a =>
        a.serial_no < targetSerial &&
        !['completed', 'cancelled', 'no_show', 'prescription_pending'].includes(a.status)
    );

    const patientsAheadTotal = aheadAppts.length;
    const patientsAheadPresent = aheadAppts.filter(a => ['checked_in', 'in_consultation'].includes(a.status)).length;
    const patientsAheadNotPresent = aheadAppts.filter(a => a.status === 'scheduled').length;
    const patientsCompletedCount = todayAppts.filter(a => ['completed', 'prescription_pending'].includes(a.status) && a.serial_no < targetSerial).length;

    // 10. Handle Special Terminal / In-Progress States for Target Patient
    if (appt.status === 'in_consultation') {
        const estEnd = addMinutes(now, currentPatientRemainingMins);
        return {
            success: true,
            appointmentId,
            patientId: appt.patient_id,
            patientName,
            patientUhid,
            serialNo: targetSerial,
            status: appt.status,
            doctorId,
            doctorName,
            specialityName,
            appointmentDate,
            chamberStatus,
            scheduledStartTime: formatTimeString(schedStartTimeStr),
            actualStartTime: actualStartedAt ? formatTime12h(actualStartedAt) : null,
            delayMinutes: recordedDelayMinutes,
            delayReason,
            currentlyServingSerial: targetSerial,
            currentlyServingPatientName: patientName,
            patientsAheadTotal: 0,
            patientsAheadPresent: 0,
            patientsAheadNotPresent: 0,
            patientsCompletedCount,
            avgConsultMinutes: Math.round(effectiveConsultMins),
            estimatedWaitMinutes: 0,
            safetyBufferMinutes: 0,
            expectedConsultStartTime: formatTime12h(now),
            recommendedArrivalTime: 'Present Now',
            urgencyLevel: 'immediate',
            recommendationMessage: 'You are currently inside the doctor chamber for your consultation.',
            chatbotReply: `You are currently in consultation with Dr. ${doctorName}. Serial #${targetSerial}.`
        };
    }

    if (appt.status === 'completed' || appt.status === 'prescription_pending') {
        const isPrescriptionPending = appt.status === 'prescription_pending';
        return {
            success: true,
            appointmentId,
            patientId: appt.patient_id,
            patientName,
            patientUhid,
            serialNo: targetSerial,
            status: appt.status,
            doctorId,
            doctorName,
            specialityName,
            appointmentDate,
            chamberStatus,
            scheduledStartTime: formatTimeString(schedStartTimeStr),
            actualStartTime: actualStartedAt ? formatTime12h(actualStartedAt) : null,
            delayMinutes: recordedDelayMinutes,
            delayReason,
            currentlyServingSerial: currentServingSerial,
            currentlyServingPatientName: currentServingPatientName,
            patientsAheadTotal: 0,
            patientsAheadPresent: 0,
            patientsAheadNotPresent: 0,
            patientsCompletedCount,
            avgConsultMinutes: Math.round(effectiveConsultMins),
            estimatedWaitMinutes: 0,
            safetyBufferMinutes: 0,
            expectedConsultStartTime: isPrescriptionPending ? 'Prescription Pending' : 'Completed',
            recommendedArrivalTime: isPrescriptionPending ? 'Prescription Pending' : 'Completed',
            urgencyLevel: 'comfortable',
            recommendationMessage: isPrescriptionPending
                ? 'Your doctor consultation is finished. Your prescription is being uploaded by the clinic staff.'
                : 'Your visit has already been completed.',
            chatbotReply: isPrescriptionPending
                ? `Your consultation with Dr. ${doctorName} (Serial #${targetSerial}) is finished. Your prescription is being uploaded by the clinic staff.`
                : `Your appointment with Dr. ${doctorName} (Serial #${targetSerial}) has already been completed today.`
        };
    }

    // 11. Calculate Dynamic Queue Duration Ahead
    // Formula:
    // Raw Time Ahead = (Time left on currently serving patient)
    //                + (Present waiting patients ahead * (effectiveConsultMins + transitionMins))
    //                + (Unpresent scheduled patients ahead * (effectiveConsultMins * 0.8 + transitionMins))
    // The unpresent discount factor (0.8) conservatively anticipates that some unpresent patients may be late or cancelled.
    const presentAheadExcludingCurrent = Math.max(0, currentInConsult && currentInConsult.serial_no < targetSerial
        ? patientsAheadPresent - 1
        : patientsAheadPresent);

    let rawQueueMinsAhead = 0;
    if (currentInConsult && currentInConsult.serial_no < targetSerial) {
        rawQueueMinsAhead += currentPatientRemainingMins;
    }
    rawQueueMinsAhead += presentAheadExcludingCurrent * (effectiveConsultMins + transitionMins);
    rawQueueMinsAhead += patientsAheadNotPresent * (effectiveConsultMins * 0.8 + transitionMins);

    // 12. Factor In Chamber Start Time & Doctor Delay
    // Construct Scheduled Start Date Time Today
    const [schedHour, schedMin] = schedStartTimeStr.split(':').map(Number);
    const schedDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), schedHour, schedMin, 0);

    let baseChamberStartTime = now;
    if (chamberStatus === 'not_started') {
        if (now < schedDateObj) {
            // Chamber hasn't started yet and scheduled time is in the future
            if (recordedDelayMinutes > 0) {
                baseChamberStartTime = addMinutes(schedDateObj, recordedDelayMinutes);
            } else {
                baseChamberStartTime = schedDateObj;
            }
        } else {
            // Scheduled time has already passed, but doctor hasn't started yet (Emergency / Late)
            const pastMinutes = differenceInMinutes(now, schedDateObj);
            if (recordedDelayMinutes < pastMinutes) {
                recordedDelayMinutes = pastMinutes;
            }
            // Estimate chamber will start within 5 minutes or based on announced delay
            baseChamberStartTime = addMinutes(now, 5);
        }
    } else if (actualStartedAt) {
        // Chamber already open: delay is difference between actual start and scheduled start
        if (schedDateObj && actualStartedAt > schedDateObj) {
            const actualDelay = differenceInMinutes(actualStartedAt, schedDateObj);
            if (actualDelay > recordedDelayMinutes) {
                recordedDelayMinutes = actualDelay;
            }
        }
        baseChamberStartTime = now;
    }

    // 13. Compute Expected Consultation Start Time and Safe Arrival Buffer
    // Total wait time from current moment:
    let totalWaitMinsFromNow = differenceInMinutes(baseChamberStartTime, now) + rawQueueMinsAhead;
    if (totalWaitMinsFromNow < 0) totalWaitMinsFromNow = 0;

    const expectedConsultStartTimeDate = addMinutes(now, totalWaitMinsFromNow);

    // Conservative Safety Arrival Buffer:
    // As per user specification: ensure patient arrives before their turn so they never miss their serial.
    // E.g., for 7 patients ahead, avg 10m -> 70m queue -> safe arrival at 60m (10-15 min safety buffer).
    // Minimum 10m safety lead time, plus scaling for large queues, capped reasonably.
    const safetyBufferMinutes = Math.min(20, Math.max(10, Math.round(benchmark.safe_buffer_minutes * 1.5 + (patientsAheadTotal > 5 ? 5 : 0))));

    // Recommended arrival is: Expected Consult Start MINUS Safety Buffer
    let recommendedArrivalDate = addMinutes(expectedConsultStartTimeDate, -safetyBufferMinutes);
    if (recommendedArrivalDate < now) {
        recommendedArrivalDate = now;
    }

    const estimatedWaitMinutes = Math.max(0, Math.round(totalWaitMinsFromNow));

    // 14. Urgency Classification & Friendly Clinical Guidance
    let urgencyLevel: 'immediate' | 'near' | 'comfortable' = 'comfortable';
    let recommendationMessage = '';

    if (patientsAheadTotal <= 1 || estimatedWaitMinutes <= 15) {
        urgencyLevel = 'immediate';
        recommendationMessage = `Your turn is approaching very shortly (${patientsAheadTotal} patient ahead). Please remain present in the clinic waiting room right now.`;
    } else if (estimatedWaitMinutes <= 35) {
        urgencyLevel = 'near';
        recommendationMessage = `Estimated wait is ~${estimatedWaitMinutes} minutes. Please proceed to the clinic lobby and check in with the compounder.`;
    } else {
        urgencyLevel = 'comfortable';
        recommendationMessage = `Doctor chamber is running steadily. You have ample time. Please arrive by ${formatTime12h(recommendedArrivalDate)} to comfortably secure your serial.`;
    }

    // 15. Formulate Natural Language Chatbot Message (Future Bot Readiness)
    let botDelaySentence = '';
    if (recordedDelayMinutes > 0) {
        botDelaySentence = ` (started late by ~${recordedDelayMinutes} mins${delayReason ? `: ${delayReason}` : ''})`;
    }

    let botChamberSentence = '';
    if (chamberStatus === 'open') {
        botChamberSentence = `${doctorName} started chamber at ${actualStartedAt ? formatTime12h(actualStartedAt) : 'today'}${botDelaySentence}.`;
    } else if (chamberStatus === 'not_started') {
        botChamberSentence = `${doctorName}'s chamber is scheduled for ${formatTimeString(schedStartTimeStr)}${recordedDelayMinutes > 0 ? ` (delayed by ~${recordedDelayMinutes} mins)` : ''}.`;
    } else if (chamberStatus === 'paused') {
        botChamberSentence = `${doctorName}'s chamber is currently on a short break.`;
    } else {
        botChamberSentence = `${doctorName}'s chamber has concluded for today.`;
    }

    const chatbotReply = `${botChamberSentence} You are Serial #${targetSerial}${currentServingSerial ? `, currently serving Serial #${currentServingSerial}` : ''}. There are ${patientsAheadTotal} patients ahead of you (${patientsAheadPresent} currently present at the clinic, ${patientsCompletedCount} completed). Your estimated wait time is approximately ${estimatedWaitMinutes} minutes. We recommend arriving at the clinic by ${formatTime12h(recommendedArrivalDate)} so you do not miss your serial.`;

    return {
        success: true,
        appointmentId,
        patientId: appt.patient_id,
        patientName,
        patientUhid,
        serialNo: targetSerial,
        status: appt.status,
        doctorId,
        doctorName,
        specialityName,
        appointmentDate,
        chamberStatus,
        scheduledStartTime: formatTimeString(schedStartTimeStr),
        actualStartTime: actualStartedAt ? formatTime12h(actualStartedAt) : null,
        delayMinutes: recordedDelayMinutes,
        delayReason,
        currentlyServingSerial: currentServingSerial,
        currentlyServingPatientName: currentServingPatientName,
        patientsAheadTotal,
        patientsAheadPresent,
        patientsAheadNotPresent,
        patientsCompletedCount,
        avgConsultMinutes: Math.round(effectiveConsultMins),
        estimatedWaitMinutes,
        safetyBufferMinutes,
        expectedConsultStartTime: formatTime12h(expectedConsultStartTimeDate),
        recommendedArrivalTime: formatTime12h(recommendedArrivalDate),
        urgencyLevel,
        recommendationMessage,
        chatbotReply
    };
}

/**
 * Format "09:30:00" to "9:30 AM"
 */
function formatTimeString(timeStr: string): string {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}
