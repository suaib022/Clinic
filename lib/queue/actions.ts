'use server';
import { z } from 'zod';
import { getApiUser, getQueueSnapshot, syncEstimates, QueueAccessError, type StaffSnapshot } from './server';

/**
 * All queue changes from the staff screens go through here → the dss_* database functions
 * (which re-check the caller, lock the doctor's day and ignore repeated request keys).
 */
const key = z.string().min(8).max(100);
const id = z.string().uuid();
const Action = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('check_in'), appointmentId: id, requestKey: key }),
  z.object({ kind: z.literal('call_next'), doctorId: id, expectedCurrent: id.nullable(), requestKey: key }),
  z.object({ kind: z.literal('end_consult'), appointmentId: id, requestKey: key }),
  z.object({ kind: z.literal('no_show'), appointmentId: id, reason: z.string().max(200).optional(), requestKey: key }),
  z.object({ kind: z.literal('priority'), appointmentId: id, level: z.number().int().min(0).max(2), reason: z.string().max(200).optional(), requestKey: key }),
  z.object({ kind: z.literal('skip'), appointmentId: id, requestKey: key }),
  z.object({ kind: z.literal('rejoin'), appointmentId: id, requestKey: key }),
  z.object({ kind: z.literal('session_start'), doctorId: id, requestKey: key }),
  z.object({ kind: z.literal('session_pause'), doctorId: id, reason: z.string().max(120).optional(), requestKey: key }),
  z.object({ kind: z.literal('session_resume'), doctorId: id, requestKey: key }),
  z.object({ kind: z.literal('session_end'), doctorId: id, requestKey: key }),
  z.object({ kind: z.literal('resolve_remaining'), doctorId: id, requestKey: key }),
  z.object({ kind: z.literal('broadcast_delay'), doctorId: id, minutes: z.number().int().min(1).max(600), requestKey: key }),
  z.object({ kind: z.literal('undo'), doctorId: id, requestKey: key }),
  z.object({ kind: z.literal('dismiss'), doctorId: id, suggestionKey: z.string().min(3).max(200) }),
  z.object({
    kind: z.literal('walk_in'), doctorId: id, patientId: id, visitType: z.enum(['new', 'follow_up']),
    level: z.number().int().min(0).max(2), reason: z.string().max(200).optional(), requestKey: key,
  }),
]);
export type QueueActionInput = z.infer<typeof Action>;

export interface QueueActionResult {
  ok: boolean;
  code: string;
  message: string;
  snapshot?: StaffSnapshot;
}

function rpcFor(a: QueueActionInput): [string, Record<string, unknown>] {
  switch (a.kind) {
    case 'check_in': return ['dss_check_in', { p_appointment_id: a.appointmentId, p_request_key: a.requestKey }];
    case 'call_next': return ['dss_call_next', { p_doctor_id: a.doctorId, p_expected_current: a.expectedCurrent, p_request_key: a.requestKey }];
    case 'end_consult': return ['dss_end_consult', { p_appointment_id: a.appointmentId, p_request_key: a.requestKey }];
    case 'no_show': return ['dss_mark_no_show', { p_appointment_id: a.appointmentId, p_reason: a.reason ?? '', p_request_key: a.requestKey }];
    case 'priority': return ['dss_set_priority', { p_appointment_id: a.appointmentId, p_level: a.level, p_reason: a.reason ?? '', p_request_key: a.requestKey }];
    case 'skip': return ['dss_skip', { p_appointment_id: a.appointmentId, p_request_key: a.requestKey }];
    case 'rejoin': return ['dss_rejoin', { p_appointment_id: a.appointmentId, p_request_key: a.requestKey }];
    case 'session_start': return ['dss_session_start', { p_doctor_id: a.doctorId, p_request_key: a.requestKey }];
    case 'session_pause': return ['dss_session_pause', { p_doctor_id: a.doctorId, p_reason: a.reason ?? '', p_request_key: a.requestKey }];
    case 'session_resume': return ['dss_session_resume', { p_doctor_id: a.doctorId, p_request_key: a.requestKey }];
    case 'session_end': return ['dss_session_end', { p_doctor_id: a.doctorId, p_request_key: a.requestKey }];
    case 'resolve_remaining': return ['dss_resolve_remaining', { p_doctor_id: a.doctorId, p_request_key: a.requestKey }];
    case 'broadcast_delay': return ['dss_broadcast_delay', { p_doctor_id: a.doctorId, p_minutes: a.minutes, p_request_key: a.requestKey }];
    case 'undo': return ['dss_undo', { p_doctor_id: a.doctorId, p_request_key: a.requestKey }];
    case 'dismiss': return ['dss_dismiss_suggestion', { p_doctor_id: a.doctorId, p_key: a.suggestionKey }];
    case 'walk_in': return ['dss_walk_in', {
      p_doctor_id: a.doctorId, p_patient_id: a.patientId, p_visit_type: a.visitType, p_level: a.level,
      p_reason: a.reason ?? '', p_request_key: a.requestKey,
    }];
  }
}

/** Database messages → short, friendly text for the compounder. */
function friendly(msg: string): string {
  if (msg.includes('DSS_FORBIDDEN') || msg.includes('Permission denied')) return 'You are not allowed to change this queue.';
  if (msg.includes('DSS_UNAUTHENTICATED')) return 'Please log in again.';
  if (msg.includes('Grace period')) return msg.replace(/^.*Grace period: /, 'Too early: ');
  if (msg.includes('Can only check in appointments for today')) return 'Only today’s appointments can be checked in.';
  if (msg.includes('Outside doctor working hours')) return 'Walk-ins can only be added during the doctor’s working hours.';
  if (msg.includes('already has an active appointment')) return 'This patient already has a booking today. Check in that booking instead.';
  if (msg.includes('Retract time window')) return 'The undo window for this walk-in has passed.';
  if (msg.includes('DSS_BAD_INPUT')) return 'Invalid request.';
  return 'Something went wrong. The screen has been refreshed.';
}

export async function queueAction(input: QueueActionInput): Promise<QueueActionResult> {
  const parsed = Action.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'bad_input', message: 'Invalid request.' };
  const u = await getApiUser();
  if (!u) return { ok: false, code: 'unauthenticated', message: 'Please log in again.' };
  if (u.role === 'patient') return { ok: false, code: 'forbidden', message: 'Not allowed.' };

  const a = parsed.data;
  const [fn, args] = rpcFor(a);
  const { data, error } = await u.supabase.rpc(fn, args);
  const res = (data ?? {}) as { ok?: boolean; code?: string; message?: string; duplicate?: boolean };
  const result: QueueActionResult = error
    ? { ok: false, code: 'error', message: friendly(error.message) }
    : {
        ok: !!res.ok,
        code: res.duplicate ? 'duplicate' : res.code ?? 'ok',
        message: res.code === 'stale' ? 'Already updated by someone else.' : res.message ?? 'Done.',
      };

  // The server's data always wins: return the fresh queue with every result.
  const doctorId = 'doctorId' in a ? a.doctorId : await doctorOf(u.supabase, a.appointmentId);
  if (doctorId) {
    try {
      result.snapshot = await getQueueSnapshot(u.supabase, doctorId);
      await syncEstimates(u.supabase, result.snapshot);
    } catch (e) {
      if (!(e instanceof QueueAccessError)) console.error('[dss] snapshot after action failed', e);
    }
  }
  return result;
}

async function doctorOf(supabase: NonNullable<Awaited<ReturnType<typeof getApiUser>>>['supabase'], appointmentId: string) {
  const { data } = await supabase.from('appointments').select('doctor_id').eq('id', appointmentId).maybeSingle();
  return data?.doctor_id as string | undefined;
}
