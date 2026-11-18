'use server';
import { z } from 'zod';
import { getApiUser } from '@/lib/queue/server';
import { getLabSnapshot, LabAccessError, type LabSnapshot } from './server';

/** Every lab change goes through the lab_* database functions (they re-check the caller, lock the line and ignore repeated keys). */
const key = z.string().min(8).max(100);
const id = z.string().uuid();
const Action = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('session'), lineId: id, action: z.enum(['open', 'pause', 'resume', 'close']), reason: z.string().max(120).optional(), requestKey: key }),
  z.object({ kind: z.literal('call_next'), lineId: id, requestKey: key }),
  z.object({ kind: z.literal('collected'), lineId: id, itemId: id, requestKey: key }),
  z.object({ kind: z.literal('skip'), lineId: id, itemId: id, rejoin: z.boolean(), requestKey: key }),
  z.object({ kind: z.literal('undo'), lineId: id, requestKey: key }),
  z.object({ kind: z.literal('report_ready'), orderId: id, lineId: id.optional(), requestKey: key }),
  z.object({ kind: z.literal('enqueue'), orderIds: z.array(id).min(1).max(30), lineId: id.optional(), requestKey: key }),
  z.object({ kind: z.literal('register_outside'), patientId: id, testTypeIds: z.array(id).min(1).max(30), prescriber: z.string().min(2).max(120), requestKey: key }),
  z.object({ kind: z.literal('order_tests'), appointmentId: id, testTypeIds: z.array(id).min(1).max(30), requestKey: key }),
]);
export type LabActionInput = z.infer<typeof Action>;
export interface LabActionResult { ok: boolean; code: string; message: string; data?: Record<string, unknown>; snapshot?: LabSnapshot }

function rpcFor(a: LabActionInput): [string, Record<string, unknown>] {
  switch (a.kind) {
    case 'session': return ['lab_line_session', { p_line_id: a.lineId, p_action: a.action, p_reason: a.reason ?? null, p_request_key: a.requestKey }];
    case 'call_next': return ['lab_call_next', { p_line_id: a.lineId, p_request_key: a.requestKey }];
    case 'collected': return ['lab_mark_collected', { p_item_id: a.itemId, p_request_key: a.requestKey }];
    case 'skip': return ['lab_skip', { p_item_id: a.itemId, p_rejoin: a.rejoin, p_request_key: a.requestKey }];
    case 'undo': return ['lab_undo', { p_line_id: a.lineId, p_request_key: a.requestKey }];
    case 'report_ready': return ['lab_mark_report_ready', { p_order_id: a.orderId, p_request_key: a.requestKey }];
    case 'enqueue': return ['lab_enqueue', { p_order_ids: a.orderIds, p_request_key: a.requestKey }];
    case 'register_outside': return ['lab_register_outside', { p_patient_id: a.patientId, p_test_type_ids: a.testTypeIds, p_prescriber: a.prescriber, p_request_key: a.requestKey }];
    case 'order_tests': return ['lab_order_tests', { p_appointment_id: a.appointmentId, p_test_type_ids: a.testTypeIds, p_request_key: a.requestKey }];
  }
}

function friendly(msg: string): string {
  if (msg.includes('LAB_FORBIDDEN')) return 'You are not allowed to do this.';
  if (msg.includes('LAB_UNAUTHENTICATED')) return 'Please log in again.';
  if (msg.includes('LAB_RATE_LIMIT')) return 'Too many lookups. Please wait a few minutes.';
  if (msg.includes('LAB_BAD_INPUT')) return msg.replace(/^.*LAB_BAD_INPUT: /, '').replace(/^./, (c) => c.toUpperCase()) + '.';
  return 'Something went wrong. The screen has been refreshed.';
}

export async function labAction(input: LabActionInput): Promise<LabActionResult> {
  const parsed = Action.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'bad_input', message: 'Invalid request.' };
  const u = await getApiUser();
  if (!u) return { ok: false, code: 'unauthenticated', message: 'Please log in again.' };
  if (u.role === 'patient') return { ok: false, code: 'forbidden', message: 'Not allowed.' };
  const a = parsed.data;
  const [fn, args] = rpcFor(a);
  const { data, error } = await u.supabase.rpc(fn, args);
  const res = (data ?? {}) as { ok?: boolean; code?: string; message?: string; duplicate?: boolean } & Record<string, unknown>;
  const result: LabActionResult = error
    ? { ok: false, code: 'error', message: friendly(error.message) }
    : { ok: !!res.ok, code: res.duplicate ? 'duplicate' : res.code ?? 'ok', message: res.message ?? 'Done.', data: res };
  // The server's data always wins: line actions return the fresh line.
  const lineId = 'lineId' in a ? a.lineId : undefined;
  if (lineId) {
    try {
      result.snapshot = await getLabSnapshot(u.supabase, lineId);
    } catch (e) {
      if (!(e instanceof LabAccessError)) console.error('[lab] snapshot after action failed', e);
    }
  }
  return result;
}

export interface FoundPatient { id: string; full_name: string; uhid: string; gender: string | null; mobile_tail: string | null }

/** Lab staff: exact UHID / mobile lookup (rate-limited and logged by the database). */
export async function findLabPatient(query: string): Promise<{ ok: boolean; message?: string; patients: FoundPatient[] }> {
  const q = z.string().trim().min(4).max(40).safeParse(query);
  if (!q.success) return { ok: false, message: 'Enter a UHID or mobile number.', patients: [] };
  const u = await getApiUser();
  if (!u || !['technician', 'admin'].includes(u.role)) return { ok: false, message: 'Not allowed.', patients: [] };
  const { data, error } = await u.supabase.rpc('lab_find_patient', { p_query: q.data });
  if (error) return { ok: false, message: friendly(error.message), patients: [] };
  return { ok: true, patients: (data ?? []) as FoundPatient[] };
}

export interface OpenOrder { order_id: string; test: string; line_id: string; status: string; order_date: string; doctor: string | null; external_prescriber: string | null }

export async function labPatientOrders(patientId: string): Promise<{ ok: boolean; orders: OpenOrder[] }> {
  if (!z.string().uuid().safeParse(patientId).success) return { ok: false, orders: [] };
  const u = await getApiUser();
  if (!u || !['technician', 'admin'].includes(u.role)) return { ok: false, orders: [] };
  const { data, error } = await u.supabase.rpc('lab_patient_orders', { p_patient_id: patientId });
  return { ok: !error, orders: (data ?? []) as OpenOrder[] };
}

export interface PendingReport { order_id: string; test: string; line_id: string; patient_name: string; patient_uhid: string; collected_at: string; expected_ready_at: string; doctor: string | null }

export async function labPendingReports(): Promise<{ ok: boolean; reports: PendingReport[] }> {
  const u = await getApiUser();
  if (!u || !['technician', 'admin'].includes(u.role)) return { ok: false, reports: [] };
  const { data, error } = await u.supabase.rpc('lab_pending_reports');
  return { ok: !error, reports: (data ?? []) as PendingReport[] };
}

export interface TestType { id: string; code: string; name: string; line_id: string; must_first: boolean; turnaround_min: number }

/** Active test catalogue (readable by every logged-in user). */
export async function listTestTypes(): Promise<TestType[]> {
  const u = await getApiUser();
  if (!u) return [];
  const { data } = await u.supabase.from('lab_test_types').select('id, code, name, line_id, must_first, turnaround_min').eq('active', true).order('name');
  return (data ?? []) as TestType[];
}
