// Maps the JSON from the lab_snapshot_input RPC to flowq engine input. Pure (no Supabase / Next), unit-tested.
import { computeLineEstimates, expectedWaitMin, type DssSettings, type LabItem, type LineInput, type QueueResult, type SessionInfo } from '@/packages/flowq/src';
import { settingsFromRow } from '@/lib/queue/snapshotInput';

type Ts = string | null | undefined;
const ms = (t: Ts) => (t ? Date.parse(t) : null);

export interface RawLabSnapshot {
  server_now: string;
  date: string;
  settings: Record<string, number | string> | null;
  line: { id: string; code: string; name: string; typical_min: number };
  session: null | {
    id: string; status: 'open' | 'paused' | 'closed'; opened_at: string; closed_at: Ts;
    pauses: { paused_at: string; resumed_at: Ts; reason: string | null }[];
  };
  items: {
    id: string; patient_id: string; status: LabItem['status'] | 'cancelled'; priority_level: number;
    queued_at: string; called_at: Ts; collected_at: Ts; skipped_at: Ts; rejoined_at: Ts;
    patient_name: string | null; patient_uhid: string | null;
    tests: { order_id: string; name: string; status: string }[] | null;
    other_lines: { line_id: string; must_first: boolean }[] | null;
  }[];
  history: number[] | null;
  my_undo: { event_id: string; type: string; at: string; message: string | null } | null;
}

/** Long lines add up many visits: lab lines use a longer history and averages (see flowq robustness study). */
export function labSettings(row: RawLabSnapshot['settings']): DssSettings {
  return { ...settingsFromRow(row), historyWindow: 200, sumWith: 'mean', rangeMethod: 'normal_sum', rangeCoverage: 0.8 };
}

export interface LabItemView {
  id: string;
  patientId: string;
  status: LabItem['status'];
  skipped: boolean;
  queuedAt: number;
  calledAt: number | null;
  collectedAt: number | null;
  patientName: string | null;
  patientUhid: string | null;
  tests: { orderId: string; name: string; status: string }[];
  otherLines: { lineId: string; mustFirst: boolean }[];
}

export function toLineInput(raw: RawLabSnapshot): { input: LineInput; items: LabItemView[] } {
  const now = Date.parse(raw.server_now);
  const s = raw.session;
  const session: SessionInfo = {
    state: !s ? 'not_started' : s.status === 'open' ? 'active' : s.status === 'paused' ? 'paused' : 'ended',
    startedAt: ms(s?.opened_at), endedAt: ms(s?.closed_at), scheduledStartAt: ms(s?.opened_at), scheduledEndAt: null,
    pauses: (s?.pauses ?? []).map((p) => ({ pausedAt: Date.parse(p.paused_at), resumedAt: ms(p.resumed_at), reason: p.reason })),
  };
  // A counter that is closed but still has people waiting keeps serving them (same rule as the database).
  const live = raw.items.filter((i) => i.status === 'queued' || i.status === 'called');
  if (session.state === 'ended' && live.length) session.state = 'active';
  const items: LabItem[] = raw.items.filter((i) => i.status !== 'cancelled').map((i) => ({
    id: i.id, lineId: raw.line.id, patientId: i.patient_id, queuedAt: Date.parse(i.rejoined_at ?? i.queued_at),
    status: i.status === 'queued' && i.skipped_at ? 'skipped' : (i.status as LabItem['status']),
    calledAt: ms(i.called_at), collectedAt: ms(i.collected_at), priorityLevel: Math.min(2, Math.max(0, i.priority_level)) as 0 | 1 | 2,
  }));
  return {
    input: {
      now, settings: labSettings(raw.settings), session,
      line: { id: raw.line.id, name: raw.line.name, typicalMin: Number(raw.line.typical_min) },
      items, history: (raw.history ?? []).map(Number),
    },
    items: raw.items.filter((i) => i.status !== 'cancelled').map((i) => ({
      id: i.id, patientId: i.patient_id, status: i.status as LabItem['status'], skipped: !!i.skipped_at,
      queuedAt: Date.parse(i.queued_at), calledAt: ms(i.called_at), collectedAt: ms(i.collected_at),
      patientName: i.patient_name, patientUhid: i.patient_uhid,
      tests: (i.tests ?? []).map((t) => ({ orderId: t.order_id, name: t.name, status: t.status })),
      otherLines: (i.other_lines ?? []).map((o) => ({ lineId: o.line_id, mustFirst: o.must_first })),
    })),
  };
}

/** Engine result for one line plus the wait a newcomer would have now (Infinity when the counter is closed). */
export function lineResult(raw: RawLabSnapshot): { result: QueueResult; waitMin: number; items: LabItemView[]; input: LineInput } {
  const { input, items } = toLineInput(raw);
  const result = computeLineEstimates(input);
  return { result, waitMin: expectedWaitMin(result, input.settings), items, input };
}
