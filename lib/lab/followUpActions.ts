'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/requireRole';
import { todayDhaka } from '@/lib/format';

/**
 * Compounder (or staff) adds a patient back to the queue for a report review follow-up.
 */
export async function compounderEnterFollowUp(appointmentId: string) {
  const { user, role } = await requireRole(['compounder', 'doctor', 'admin']);
  if (!appointmentId) return { ok: false, error: 'Appointment ID is required' };

  const supabase = await createClient();
  const requestKey = `c-rr-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const { data, error } = await supabase.rpc('dss_return_for_review', {
    p_appointment_id: appointmentId,
    p_request_key: requestKey,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const res = data as any;
  if (!res?.ok) {
    return { ok: false, error: res?.message || 'Could not add to queue for report review.' };
  }

  return {
    ok: true,
    message: res.message || `Report review entered as serial ${res.serial_no ?? ''}`,
    serialNo: res.serial_no,
    appointmentId: res.appointment_id,
  };
}

/**
 * Patient requests to enter follow-up consultation with their doctor after lab report is ready.
 */
export async function patientEnterFollowUp(appointmentId: string) {
  const { user } = await requireRole(['patient']);
  if (!appointmentId) return { ok: false, error: 'Appointment ID is required' };

  const today = todayDhaka();

  // 1. Verify appointment ownership and get details
  const { data: appt, error: apptError } = await supabaseAdmin
    .from('appointments')
    .select(`
      id,
      patient_id,
      doctor_id,
      slot_minutes,
      appointment_date,
      patient:patients!inner(id, full_name, auth_user_id),
      doctor:users!appointments_doctor_id_fkey(full_name)
    `)
    .eq('id', appointmentId)
    .single();

  if (apptError || !appt) {
    return { ok: false, error: 'Appointment not found.' };
  }

  if ((appt.patient as any)?.auth_user_id !== user.id) {
    return { ok: false, error: 'Unauthorized: this appointment does not belong to your account.' };
  }

  // 2. Verify that there is at least one ready report
  const { data: readyOrders } = await supabaseAdmin
    .from('lab_orders')
    .select('id, test:lab_test_types(name)')
    .eq('appointment_id', appointmentId)
    .eq('status', 'report_ready');

  if (!readyOrders || readyOrders.length === 0) {
    return { ok: false, error: 'No lab report is marked ready for this visit yet.' };
  }

  // 3. Verify doctor session today is not ended
  const { data: sessions } = await supabaseAdmin
    .from('doctor_sessions')
    .select('status')
    .eq('doctor_id', appt.doctor_id)
    .eq('session_date', today)
    .order('created_at', { ascending: false })
    .limit(1);

  const sessionStatus = sessions?.[0]?.status;
  if (!sessionStatus || sessionStatus === 'ended') {
    return {
      ok: false,
      error: 'Dr. ' + ((appt.doctor as any)?.full_name || 'The doctor') + ' is not seeing patients right now. Please consult staff or book for an upcoming chamber.',
    };
  }

  // 4. Verify patient is not already in line for report review today
  const { data: existingReview } = await supabaseAdmin
    .from('appointments')
    .select('id, serial_no')
    .eq('patient_id', appt.patient_id)
    .eq('doctor_id', appt.doctor_id)
    .eq('appointment_date', today)
    .eq('visit_reason', 'report_review')
    .not('status', 'in', '("cancelled","no_show","completed")')
    .limit(1);

  if (existingReview && existingReview.length > 0) {
    return {
      ok: false,
      error: `You are already in line for report review today (Serial #${existingReview[0].serial_no}).`,
    };
  }

  // 5. Determine next serial number
  const { data: maxSerialRow } = await supabaseAdmin
    .from('appointments')
    .select('serial_no')
    .eq('doctor_id', appt.doctor_id)
    .eq('appointment_date', today)
    .order('serial_no', { ascending: false })
    .limit(1);

  const nextSerial = ((maxSerialRow?.[0]?.serial_no as number) || 0) + 1;
  const slotMin = appt.slot_minutes || 10;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 6. Insert report review appointment
  const { data: newAppt, error: insertError } = await supabaseAdmin
    .from('appointments')
    .insert({
      patient_id: appt.patient_id,
      doctor_id: appt.doctor_id,
      appointment_date: today,
      start_time: timeStr,
      end_time: timeStr,
      status: 'checked_in',
      serial_no: nextSerial,
      scheduled_start: now.toISOString(),
      slot_minutes: slotMin,
      visit_type: 'follow_up',
      visit_reason: 'report_review',
      priority_level: 0,
      visit_source: 'online',
      created_by_user_id: user.id,
      checked_in_at: now.toISOString(),
      status_changed_by: user.id,
      status_changed_at: now.toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !newAppt) {
    return { ok: false, error: `Could not create follow-up visit: ${insertError?.message}` };
  }

  // 7. Log queue event
  const requestKey = `p-rr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await supabaseAdmin.from('queue_events').insert({
    doctor_id: appt.doctor_id,
    appointment_id: newAppt.id,
    event_type: 'return_queue',
    actor_user_id: user.id,
    actor_role: 'patient',
    request_key: requestKey,
    to_status: 'checked_in',
    metadata: {
      serial_no: nextSerial,
      first_visit_id: appointmentId,
      tests: readyOrders.map((o: any) => o.test?.name).filter(Boolean),
    },
  });

  return {
    ok: true,
    message: `Follow-up report review added as Serial #${nextSerial} with Dr. ${(appt.doctor as any)?.full_name || 'your doctor'}!`,
    serialNo: nextSerial,
    appointmentId: newAppt.id,
  };
}
