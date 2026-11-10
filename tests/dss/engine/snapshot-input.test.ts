import { describe, it, expect } from 'vitest';
import { toEngineInput, dhakaToEpoch, settingsFromRow, type RawSnapshot } from '@/lib/queue/snapshotInput';
import { allow } from '@/lib/queue/rateLimit';
import { DEFAULT_SETTINGS } from '@/lib/queue/engine';

const raw = (over: Partial<RawSnapshot> = {}): RawSnapshot => ({
  server_now: '2026-11-10T12:40:00Z', // 6:40 PM Dhaka
  date: '2026-11-10',
  settings: { on_time_band_min: 5, late_band_min: 15, grace_min: 10, no_show_min: 30, doctor_late_alert_min: 20, near_turn_count: 3,
    undo_window_sec: 120, min_duration_samples: 10, default_slot_min: 10, duration_clamp_min: 3, duration_clamp_max: 60, updated_at: 'x' },
  doctor: { id: 'd1', name: 'Dr. R', speciality: 'MEDICINE', schedules: [
    { start: '09:00:00', end: '12:00:00', slot_min: 15 }, { start: '18:00:00', end: '21:00:00', slot_min: 10 }] },
  session: null,
  appointments: [{ id: 'a1', serial_no: 1, status: 'checked_in', booked_at: '2026-11-10T12:00:00+00:00', slot_minutes: 10,
    checked_in_at: '2026-11-10T11:58:00+00:00', called_at: null, consult_started_at: null, consult_ended_at: null, priority_level: 2,
    visit_type: 'follow_up', visit_source: 'walk_in', skipped_at: null, rejoined_at: null, no_show_marked_at: null }],
  history: { new: [9, 8], follow_up: null },
  benchmark: { speciality: 'MEDICINE', avg: 10, min: 5, max: 20 },
  tracking: [{ appointment_id: 'a1', first_eta: null, checkin_eta: '2026-11-10T12:05:00Z', last_eta: null, last_label: null }],
  last_broadcast: null,
  dismissed: ['skip:x'],
  my_undo: null,
  ...over,
});

describe('snapshot → engine input', () => {
  it('converts Dhaka wall time to UTC instants', () => {
    expect(new Date(dhakaToEpoch('2026-11-10', '18:00:00')).toISOString()).toBe('2026-11-10T12:00:00.000Z');
  });
  it('picks the schedule window running now (evening) for slot length and session start', () => {
    const i = toEngineInput(raw());
    expect(i.slotMinutes).toBe(10);
    expect(i.session).toMatchObject({ state: 'not_started', scheduledStartAt: Date.parse('2026-11-10T12:00:00Z') });
    expect(i.departmentAvgMin).toBe(10);
    expect(i.appointments[0]).toMatchObject({ priorityLevel: 2, visitType: 'follow_up', visitSource: 'walk_in' });
    expect(i.checkinEtaAt?.a1).toBe(Date.parse('2026-11-10T12:05:00Z'));
    expect(i.history.follow_up).toEqual([]);
  });
  it('maps session open → active and keeps pauses', () => {
    const i = toEngineInput(raw({ session: { id: 's', status: 'open', started_at: '2026-11-10T12:05:00Z', ended_at: null,
      scheduled_start: '18:00:00', scheduled_end: '21:00:00', delay_minutes: 5, delay_reason: null,
      pauses: [{ paused_at: '2026-11-10T12:20:00Z', resumed_at: null, reason: 'Tea' }] } }));
    expect(i.session.state).toBe('active');
    expect(i.session.pauses[0]).toMatchObject({ resumedAt: null, reason: 'Tea' });
  });
  it('falls back to default settings', () => {
    expect(settingsFromRow(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('rate limit', () => {
  it('allows up to the limit per window, per key', () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allow('k1', 3, 60_000, t)).toBe(true);
    expect(allow('k1', 3, 60_000, t)).toBe(false);
    expect(allow('k2', 3, 60_000, t)).toBe(true);
    expect(allow('k1', 3, 60_000, t + 61_000)).toBe(true);
  });
});
