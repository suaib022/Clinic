import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDhaka } from '@/lib/format';
import { runEngine, type QueueAppointment, type QueueResult, type Suggestion, type StatusLabel, type Confidence, type Stage } from './engine';
import { toEngineInput, type RawSnapshot } from './snapshotInput';

export type Role = 'admin' | 'doctor' | 'compounder' | 'patient';

export class QueueAccessError extends Error {
  constructor(public status: 401 | 403 | 404, message: string) {
    super(message);
  }
}

/** Logged-in user + role for API routes (no redirects). */
export async function getApiUser(): Promise<{ supabase: SupabaseClient; userId: string; role: Role } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!data?.role) return null;
  return { supabase, userId: user.id, role: data.role as Role };
}

function mapRpcError(message: string): never {
  if (message.includes('DSS_UNAUTHENTICATED')) throw new QueueAccessError(401, 'Login required');
  if (message.includes('DSS_FORBIDDEN')) throw new QueueAccessError(403, 'Not allowed for this doctor');
  throw new Error(message);
}

export interface StaffSnapshot {
  doctor: { id: string; name: string | null; speciality: string | null };
  date: string;
  serverNow: number;
  session: QueueResult['session'] & {
    startedAt: number | null; scheduledStartAt: number | null; scheduledEndAt: number | null; delayReason: string | null;
  };
  result: QueueResult;
  suggestions: Suggestion[];
  /** Staff view of today's appointments: serial, name, UHID, times. Never medical data. */
  appointments: QueueAppointment[];
  myUndo: RawSnapshot['my_undo'];
  lastBroadcast: RawSnapshot['last_broadcast'];
  settings: ReturnType<typeof toEngineInput>['settings'];
}

/**
 * DSS-40: everything a staff screen needs for one doctor and day, computed by the engine.
 * Uses the caller's own session, so the database re-checks that they may see this doctor.
 */
export async function getQueueSnapshot(supabase: SupabaseClient, doctorId: string, date?: string): Promise<StaffSnapshot> {
  const { data, error } = await supabase.rpc('dss_snapshot_input', { p_doctor_id: doctorId, p_date: date ?? null });
  if (error) mapRpcError(error.message);
  if (!data) throw new QueueAccessError(404, 'Doctor not found');
  const raw = data as RawSnapshot;
  const input = toEngineInput(raw);
  const { result, suggestions } = runEngine(input);
  return {
    doctor: { id: raw.doctor.id, name: raw.doctor.name, speciality: raw.doctor.speciality },
    date: raw.date,
    serverNow: input.now,
    session: {
      ...result.session,
      startedAt: input.session.startedAt ?? null,
      scheduledStartAt: input.session.scheduledStartAt ?? null,
      scheduledEndAt: input.session.scheduledEndAt ?? null,
      delayReason: raw.session?.delay_reason ?? null,
    },
    result,
    suggestions,
    appointments: input.appointments,
    myUndo: raw.my_undo,
    lastBroadcast: raw.last_broadcast,
    settings: input.settings,
  };
}

/** DSS-42: the only queue data a patient ever receives (their own visit). */
export interface MyQueueStatus {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  date: string;
  status: string;
  stage: Stage | 'upcoming' | 'cancelled';
  serialNo: number;
  nowServingSerial: number | null;
  patientsAhead: number | null;
  bookedAt: number;
  expectedStartAt: number | null;
  waitMinLow: number | null;
  waitMinHigh: number | null;
  label: StatusLabel | null;
  confidence: Confidence | null;
  reason: string;
  sessionState: QueueResult['session']['state'] | null;
  lastUpdated: number;
}

export async function getMyStatus(supabase: SupabaseClient, userId: string, appointmentId: string): Promise<MyQueueStatus> {
  // Ownership through the patient's own session (RLS) *and* an explicit account check (family members share auth_user_id).
  const { data: appt } = await supabase
    .from('appointments')
    .select('id, doctor_id, appointment_date, status, serial_no, start_time, scheduled_start, patient:patients!inner(full_name, auth_user_id), doctor:users!appointments_doctor_id_fkey(full_name)')
    .eq('id', appointmentId)
    .maybeSingle();
  const patient = appt?.patient as unknown as { full_name: string; auth_user_id: string } | null;
  if (!appt || patient?.auth_user_id !== userId) throw new QueueAccessError(404, 'Appointment not found');
  const doctorName = (appt.doctor as unknown as { full_name: string } | null)?.full_name ?? 'Doctor';
  const bookedAt = appt.scheduled_start ? Date.parse(appt.scheduled_start) : Date.parse(`${appt.appointment_date}T${appt.start_time}+06:00`);
  const base = {
    appointmentId: appt.id, patientName: patient.full_name, doctorName, date: appt.appointment_date, status: appt.status,
    serialNo: appt.serial_no, bookedAt, lastUpdated: Date.now(),
  };
  const blank = {
    nowServingSerial: null, patientsAhead: null, expectedStartAt: null, waitMinLow: null, waitMinHigh: null,
    label: null, confidence: null, sessionState: null,
  };
  if (appt.status === 'cancelled' || appt.status === 'hold') {
    return { ...base, ...blank, stage: 'cancelled', reason: 'This appointment is not active.' };
  }
  if (appt.appointment_date !== todayDhaka()) {
    return { ...base, ...blank, stage: appt.appointment_date > todayDhaka() ? 'upcoming' : 'done', reason: '' };
  }

  // The queue maths needs the whole day, so it is read with the service role *after* the ownership check;
  // the RPC omits names/UHIDs for this caller and only this patient's numbers leave the server.
  const { data, error } = await supabaseAdmin.rpc('dss_snapshot_input', { p_doctor_id: appt.doctor_id, p_date: appt.appointment_date });
  if (error || !data) throw new Error(error?.message ?? 'Queue unavailable');
  const input = toEngineInput(data as RawSnapshot);
  const { result } = runEngine(input);
  const e = result.estimates[appt.id];
  return {
    ...base,
    stage: e?.stage ?? 'not_arrived',
    nowServingSerial: result.nowServing?.serialNo ?? null,
    patientsAhead: e?.patientsAhead ?? null,
    expectedStartAt: e?.expectedStartAt ?? null,
    waitMinLow: e?.waitMinLow ?? null,
    waitMinHigh: e?.waitMinHigh ?? null,
    label: e?.label ?? null,
    confidence: e?.confidence ?? null,
    reason: e?.reason ?? '',
    sessionState: result.session.state,
    lastUpdated: input.now,
  };
}

/** Doctors this staff member may run (compounder: assigned doctors; doctor: self; admin: all doctors). */
export async function listManagedDoctors(supabase: SupabaseClient, userId: string, role: Role) {
  if (role === 'doctor') {
    const { data } = await supabase.from('users').select('id, full_name').eq('id', userId);
    return data ?? [];
  }
  if (role === 'compounder') {
    const { data } = await supabase.from('compounder_doctors').select('doctor_id').eq('compounder_id', userId);
    const ids = (data ?? []).map((r) => r.doctor_id);
    if (!ids.length) return [];
    const { data: docs } = await supabase.from('users').select('id, full_name').in('id', ids).order('full_name');
    return docs ?? [];
  }
  if (role === 'admin') {
    const { data } = await supabase.from('users').select('id, full_name').eq('role', 'doctor').order('full_name');
    return data ?? [];
  }
  return [];
}
