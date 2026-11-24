import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mapQueueEvents, type ApptRow, type QueueEventRow } from '@/lib/flow/dbLog';
import type { FlowEvent } from '@/packages/flowq/src';


async function paged<T>(q: (from: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

/** Queue log of a date range as flowq events. Read-only; uses the caller's session, so RLS decides what they may see. */
export async function loadFlowEvents(supabase: SupabaseClient, from: string, to: string): Promise<{ events: FlowEvent[]; rows: number }> {
  const rows = await paged<QueueEventRow>((i) => supabase.from('queue_events')
    .select('id, appointment_id, doctor_id, event_type, actor_role, occurred_at, session_id, request_key, metadata')
    .gte('occurred_at', `${from}T00:00:00+06:00`).lte('occurred_at', `${to}T23:59:59+06:00`).order('occurred_at').range(i, i + 999));
  const ids = [...new Set(rows.map((e) => e.appointment_id).filter((x): x is string => !!x))];
  const appts: ApptRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('appointments').select('id, patient_id, created_at').in('id', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    appts.push(...(data ?? []).map((a: { id: string; patient_id: string; created_at: string | null }) => ({ id: a.id, patient_id: a.patient_id, booked_at: a.created_at })));
  }
  return { events: mapQueueEvents(rows, appts), rows: rows.length };
}
