import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { todayDhaka } from '@/lib/format';
import { lineResult, type RawLabSnapshot } from './snapshotInput';

/** One place in a lab line, as the patient sees it: only their own numbers, never other patients. */
export interface MyLabPlace {
  itemId: string;
  patientName: string;
  lineName: string;
  status: 'queued' | 'called' | 'collected';
  skipped: boolean;
  tests: string[];
  position: number | null;
  waitMinLow: number | null;
  waitMinHigh: number | null;
  /** False until the lab counter opens today (then no wait is shown). */
  counterOpen: boolean;
}
export interface MyLabReport {
  orderId: string;
  patientName: string;
  test: string;
  status: 'collected' | 'report_ready';
  appointmentId?: string | null;
  doctorName?: string | null;
  /** True once the patient has rated this test (lab_feedbacks row exists). */
  feedbackSubmitted: boolean;
}

export async function getMyLab(supabase: SupabaseClient, userId: string): Promise<{ places: MyLabPlace[]; reports: MyLabReport[] }> {
  // Ownership through the patient's own session (RLS) and an explicit account check (family members share auth_user_id).
  const { data: items } = await supabase
    .from('lab_queue_items')
    .select('id, line_id, status, skipped_at, patient:patients!inner(full_name, auth_user_id), line:lab_lines(name)')
    .eq('queue_date', todayDhaka())
    .in('status', ['queued', 'called', 'collected']);
  const mine = (items ?? []).filter((i) => (i.patient as unknown as { auth_user_id: string }).auth_user_id === userId);
  const { data: orders } = await supabase
    .from('lab_orders')
    .select(`
      id,
      status,
      appointment_id,
      queue_item_id,
      test:lab_test_types(name),
      patient:patients!inner(full_name, auth_user_id),
      appointment:appointments(doctor:users!appointments_doctor_id_fkey(full_name))
    `)
    .in('status', ['queued', 'collected', 'report_ready'])
    .gte('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString());
  const myOrders = (orders ?? []).filter((o) => (o.patient as unknown as { auth_user_id: string }).auth_user_id === userId);

  // The line maths needs the whole line, so it is read with the service role *after* the ownership check;
  // the function omits names for this caller and only this patient's numbers leave the server.
  const lines = [...new Set(mine.filter((i) => i.status !== 'collected').map((i) => i.line_id as string))];
  const results = Object.fromEntries(await Promise.all(lines.map(async (id) => {
    const { data } = await supabaseAdmin.rpc('lab_snapshot_input', { p_line_id: id, p_date: null });
    return [id, data ? lineResult(data as RawLabSnapshot).result : null] as const;
  })));
  const places: MyLabPlace[] = mine.map((i) => {
    const e = results[i.line_id as string]?.estimates[i.id as string];
    return {
      itemId: i.id as string,
      patientName: (i.patient as unknown as { full_name: string }).full_name,
      lineName: (i.line as unknown as { name: string } | null)?.name ?? 'Lab',
      status: i.status as MyLabPlace['status'], skipped: !!i.skipped_at,
      tests: myOrders.filter((o) => o.queue_item_id === i.id).map((o) => (o.test as unknown as { name: string }).name),
      position: e?.position ?? null, waitMinLow: e?.waitMinLow ?? null, waitMinHigh: e?.waitMinHigh ?? null,
      counterOpen: ['active', 'paused'].includes(results[i.line_id as string]?.session.state ?? ''),
    };
  });
  const readyIds = myOrders.filter((o) => o.status === 'report_ready').map((o) => o.id as string);
  const rated = new Set<string>();
  if (readyIds.length) {
    const { data: fb } = await supabase.from('lab_feedbacks').select('lab_order_id').in('lab_order_id', readyIds);
    (fb ?? []).forEach((f) => rated.add(f.lab_order_id as string));
  }
  const reports: MyLabReport[] = myOrders.filter((o) => o.status !== 'queued').map((o) => ({
    feedbackSubmitted: rated.has(o.id as string),
    orderId: o.id as string,
    patientName: (o.patient as unknown as { full_name: string }).full_name,
    test: (o.test as unknown as { name: string }).name,
    status: o.status as MyLabReport['status'],
    appointmentId: (o as any).appointment_id ?? null,
    doctorName: (o as any).appointment?.doctor?.full_name ?? null,
  }));
  return { places, reports };
}
