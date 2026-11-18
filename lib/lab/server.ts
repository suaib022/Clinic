import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { suggestRoute, type QueueResult } from '@/packages/flowq/src';
import { lineResult, type LabItemView, type RawLabSnapshot } from './snapshotInput';

export class LabAccessError extends Error {
  constructor(public status: 401 | 403 | 404, message: string) {
    super(message);
  }
}
function mapRpcError(message: string): never {
  if (message.includes('LAB_UNAUTHENTICATED')) throw new LabAccessError(401, 'Login required');
  if (message.includes('LAB_FORBIDDEN')) throw new LabAccessError(403, 'Not allowed');
  throw new Error(message);
}

export interface LabLine { id: string; code: string; name: string }

export async function listLabLines(supabase: SupabaseClient): Promise<LabLine[]> {
  const { data } = await supabase.from('lab_lines').select('id, code, name').eq('active', true).order('sort_order').order('name');
  return (data ?? []) as LabLine[];
}

export interface RouteHint { lineId: string; name: string; waitMin: number | null }
export interface LabItemWithEta extends LabItemView {
  position: number | null;
  expectedStartAt: number | null;
  waitMinLow: number | null;
  waitMinHigh: number | null;
  /** Suggested order of this patient's other lines (must-go-first, then shortest expected wait). Staff confirm. */
  route: RouteHint[];
}
export interface LabSnapshot {
  line: LabLine & { typicalMin: number };
  date: string;
  serverNow: number;
  session: { state: QueueResult['session']['state']; status: 'open' | 'paused' | 'closed' | null; pausedSinceAt: number | null };
  waitMin: number | null;
  nowServing: { itemId: string; elapsedMin: number; expectedMin: number; overrun: boolean } | null;
  items: LabItemWithEta[];
  myUndo: RawLabSnapshot['my_undo'];
}

async function rawSnapshot(supabase: SupabaseClient, lineId: string): Promise<RawLabSnapshot> {
  const { data, error } = await supabase.rpc('lab_snapshot_input', { p_line_id: lineId, p_date: null });
  if (error) mapRpcError(error.message);
  if (!data) throw new LabAccessError(404, 'Line not found');
  return data as RawLabSnapshot;
}

/** Expected wait (minutes) if a patient joined each line now; null when the counter is closed. */
export async function lineWaits(supabase: SupabaseClient, lineIds: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  await Promise.all(lineIds.map(async (id) => {
    const w = lineResult(await rawSnapshot(supabase, id)).waitMin;
    out[id] = Number.isFinite(w) ? Math.round(w) : null;
  }));
  return out;
}

/** Everything the lab screen needs for one line: engine estimates, and a suggested next line for patients with more tests. */
export async function getLabSnapshot(supabase: SupabaseClient, lineId: string): Promise<LabSnapshot> {
  const raw = await rawSnapshot(supabase, lineId);
  const { result, waitMin, items } = lineResult(raw);
  const lines = await listLabLines(supabase);
  const names = Object.fromEntries(lines.map((l) => [l.id, l.name]));
  const others = [...new Set(items.flatMap((i) => i.otherLines.map((o) => o.lineId)))];
  const waits = others.length ? await lineWaits(supabase, others) : {};
  const withEta: LabItemWithEta[] = items.map((i) => {
    const e = result.estimates[i.id];
    const order = i.otherLines.length
      ? suggestRoute(i.otherLines, Object.fromEntries(i.otherLines.map((o) => [o.lineId, waits[o.lineId] ?? Infinity])))
      : [];
    return {
      ...i,
      position: e?.position ?? null, expectedStartAt: e?.expectedStartAt ?? null, waitMinLow: e?.waitMinLow ?? null, waitMinHigh: e?.waitMinHigh ?? null,
      route: order.map((id) => ({ lineId: id, name: names[id] ?? 'Another line', waitMin: waits[id] ?? null })),
    };
  });
  return {
    line: { id: raw.line.id, code: raw.line.code, name: raw.line.name, typicalMin: Number(raw.line.typical_min) },
    date: raw.date,
    serverNow: Date.parse(raw.server_now),
    session: { state: result.session.state, status: raw.session?.status ?? null, pausedSinceAt: result.session.pausedSinceAt },
    waitMin: Number.isFinite(waitMin) ? Math.round(waitMin) : null,
    nowServing: result.nowServing ? { itemId: result.nowServing.appointmentId, elapsedMin: result.nowServing.elapsedMin, expectedMin: result.nowServing.expectedMin, overrun: result.nowServing.overrun } : null,
    items: withEta,
    myUndo: raw.my_undo,
  };
}
