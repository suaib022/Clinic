// Maps the JSON returned by the `dss_snapshot_input` RPC to engine input. Pure (no Supabase / Next), unit-tested.
import {
  DEFAULT_SETTINGS, type DssSettings, type EngineInput, type QueueAppointment, type SessionInfo, type ApptStatus,
  type PriorityLevel, type VisitType, type QueueResult, type Suggestion,
} from './engine';

type Ts = string | null | undefined;
export interface RawSnapshot {
  server_now: string;
  date: string;
  settings: Record<string, number | string> | null;
  doctor: { id: string; name: string | null; speciality: string | null; schedules: { start: string; end: string; slot_min: number | null }[] };
  session: null | {
    id: string; status: 'open' | 'paused' | 'ended'; started_at: Ts; ended_at: Ts; scheduled_start: string | null;
    scheduled_end: string | null; delay_minutes: number | null; delay_reason: string | null;
    pauses: { paused_at: string; resumed_at: Ts; reason: string | null }[];
  };
  appointments: {
    id: string; serial_no: number; status: ApptStatus; booked_at: string; slot_minutes: number | null;
    checked_in_at: Ts; called_at: Ts; consult_started_at: Ts; consult_ended_at: Ts; priority_level: number;
    visit_type: VisitType | null; visit_source: 'online' | 'walk_in' | null; skipped_at: Ts; rejoined_at: Ts;
    no_show_marked_at: Ts; patient_name?: string | null; patient_uhid?: string | null; patient_mobile?: string | null;
  }[];
  history: { new: number[] | null; follow_up: number[] | null };
  benchmark: { speciality: string; avg: number; min: number; max: number } | null;
  tracking: { appointment_id: string; first_eta: Ts; checkin_eta: Ts; last_eta: Ts; last_label: string | null }[];
  last_broadcast: { at: string; minutes: number } | null;
  dismissed: string[];
  my_undo: { event_id: string; type: string; at: string; message: string | null } | null;
}

const ms = (t: Ts) => (t ? Date.parse(t) : null);

/** 'yyyy-mm-dd' + 'HH:MM[:SS]' in Asia/Dhaka (UTC+6, no DST) → epoch ms. */
export function dhakaToEpoch(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss = 0] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh - 6, mm, ss);
}

export function settingsFromRow(row: RawSnapshot['settings']): DssSettings {
  if (!row) return DEFAULT_SETTINGS;
  const n = (k: string, fallback: number) => (row[k] == null ? fallback : Number(row[k]));
  return {
    onTimeBandMin: n('on_time_band_min', DEFAULT_SETTINGS.onTimeBandMin),
    lateBandMin: n('late_band_min', DEFAULT_SETTINGS.lateBandMin),
    graceMin: n('grace_min', DEFAULT_SETTINGS.graceMin),
    noShowMin: n('no_show_min', DEFAULT_SETTINGS.noShowMin),
    doctorLateAlertMin: n('doctor_late_alert_min', DEFAULT_SETTINGS.doctorLateAlertMin),
    nearTurnCount: n('near_turn_count', DEFAULT_SETTINGS.nearTurnCount),
    undoWindowSec: n('undo_window_sec', DEFAULT_SETTINGS.undoWindowSec),
    minDurationSamples: n('min_duration_samples', DEFAULT_SETTINGS.minDurationSamples),
    defaultSlotMin: n('default_slot_min', DEFAULT_SETTINGS.defaultSlotMin),
    durationClampMin: n('duration_clamp_min', DEFAULT_SETTINGS.durationClampMin),
    durationClampMax: n('duration_clamp_max', DEFAULT_SETTINGS.durationClampMax),
  };
}

/** The schedule window running now, else the next one today, else the first. */
function pickSchedule(raw: RawSnapshot, now: number) {
  const windows = raw.doctor.schedules.map((w) => ({
    ...w, startAt: dhakaToEpoch(raw.date, w.start), endAt: dhakaToEpoch(raw.date, w.end),
  }));
  return windows.find((w) => now <= w.endAt) ?? windows[windows.length - 1] ?? null;
}

export function toEngineInput(raw: RawSnapshot, now = Date.parse(raw.server_now)): EngineInput {
  const settings = settingsFromRow(raw.settings);
  const sched = pickSchedule(raw, now);
  const sess = raw.session;
  const session: SessionInfo = {
    state: !sess ? 'not_started' : sess.status === 'open' ? 'active' : sess.status,
    scheduledStartAt: sess?.scheduled_start ? dhakaToEpoch(raw.date, sess.scheduled_start) : sched?.startAt ?? null,
    scheduledEndAt: sess?.scheduled_end ? dhakaToEpoch(raw.date, sess.scheduled_end) : sched?.endAt ?? null,
    startedAt: ms(sess?.started_at),
    endedAt: ms(sess?.ended_at),
    pauses: (sess?.pauses ?? []).map((p) => ({ pausedAt: Date.parse(p.paused_at), resumedAt: ms(p.resumed_at), reason: p.reason })),
  };
  const appointments: QueueAppointment[] = raw.appointments.map((a) => ({
    id: a.id,
    serialNo: a.serial_no,
    status: a.status,
    bookedAt: Date.parse(a.booked_at),
    slotMinutes: a.slot_minutes,
    checkedInAt: ms(a.checked_in_at),
    calledAt: ms(a.called_at),
    consultStartedAt: ms(a.consult_started_at),
    consultEndedAt: ms(a.consult_ended_at),
    priorityLevel: Math.min(2, Math.max(0, a.priority_level ?? 0)) as PriorityLevel,
    visitType: a.visit_type === 'follow_up' ? 'follow_up' : 'new',
    visitSource: a.visit_source === 'walk_in' ? 'walk_in' : 'online',
    skippedAt: ms(a.skipped_at),
    rejoinedAt: ms(a.rejoined_at),
    patientName: a.patient_name ?? null,
    patientUhid: a.patient_uhid ?? null,
    patientMobile: a.patient_mobile ?? null,
  }));
  return {
    now,
    settings,
    session,
    appointments,
    history: { new: (raw.history?.new ?? []).map(Number), follow_up: (raw.history?.follow_up ?? []).map(Number) },
    departmentAvgMin: raw.benchmark ? Number(raw.benchmark.avg) : null,
    slotMinutes: sched?.slot_min ?? null,
    checkinEtaAt: Object.fromEntries(raw.tracking.map((t) => [t.appointment_id, ms(t.checkin_eta)])),
    lastBroadcast: raw.last_broadcast ? { at: Date.parse(raw.last_broadcast.at), minutes: Number(raw.last_broadcast.minutes) } : null,
    dismissed: raw.dismissed ?? [],
  };
}

/** Payload for `dss_sync_estimates`: the engine's numbers per patient still to be seen, plus suggestions. */
export function toSyncPayload(result: QueueResult, suggestions: Suggestion[]) {
  const items = Object.values(result.estimates)
    .filter((e) => e.stage === 'waiting' || e.stage === 'not_arrived' || e.stage === 'in_room')
    .map((e) => ({
      appointment_id: e.appointmentId,
      eta: e.expectedStartAt ? new Date(e.expectedStartAt).toISOString() : null,
      label: e.label,
      ahead: e.patientsAhead,
      stage: e.stage,
    }));
  return { items, suggestions: suggestions.map((x) => ({ key: x.key, severity: x.severity, message: x.message })) };
}
