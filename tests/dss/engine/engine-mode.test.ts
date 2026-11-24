import { describe, it, expect } from 'vitest';
import { settingsFromRow, toEngineInput, type RawSnapshot } from '@/lib/queue/snapshotInput';
import { runEngine, DEFAULT_SETTINGS } from '@/lib/queue/engine';
import { labSettings } from '@/lib/lab/snapshotInput';
import { SettingsSchema } from '@/lib/queue/settingsSchema';

const BASE = { on_time_band_min: 5, late_band_min: 15, grace_min: 10, no_show_min: 30, doctor_late_alert_min: 20, near_turn_count: 3,
  undo_window_sec: 120, min_duration_samples: 10, default_slot_min: 10, duration_clamp_min: 3, duration_clamp_max: 60 };
const FULL_COLS = { report_review_min: 4, history_window: 60, sum_with: 'mean', expect_arrivals: true, show_p: 0.77, walk_in_per_hour: 2,
  lateness_mean_min: -10, lateness_sd_min: 10, range_method: 'normal_sum', range_coverage: 0.85 };

describe('engine_mode switch', () => {
  it('dss mode (and a missing engine_mode) ignores the full-engine columns', () => {
    for (const row of [{ ...BASE, ...FULL_COLS, engine_mode: 'dss' }, { ...BASE, ...FULL_COLS }]) {
      const s = settingsFromRow(row);
      expect(s).toEqual({ ...DEFAULT_SETTINGS });
    }
  });
  it('full mode reads every full-engine column, including the boolean from to_jsonb', () => {
    const s = settingsFromRow({ ...BASE, ...FULL_COLS, engine_mode: 'full' });
    expect(s).toMatchObject({ historyWindow: 60, sumWith: 'mean', expectArrivals: true, showP: 0.77, walkInPerHour: 2,
      latenessMeanMin: -10, latenessSdMin: 10, rangeMethod: 'normal_sum', rangeCoverage: 0.85 });
  });
  it('lab lines never take the doctor arrival model, whatever the mode', () => {
    const s = labSettings({ ...BASE, ...FULL_COLS, engine_mode: 'full' });
    expect(s).toMatchObject({ historyWindow: 200, sumWith: 'mean', rangeMethod: 'normal_sum', expectArrivals: false, walkInPerHour: 0, latenessMeanMin: 0 });
  });
});

// Same line as tests/flowq/expected-arrivals.test.ts, through the snapshot mapper: X is with the doctor since 18:10, A arrived at
// 18:12 for a 18:30 slot, B (18:20 slot) has not arrived yet. Now 18:15 (Dhaka).
const appt = (id: string, serial: number, slotUtc: string, over: Partial<RawSnapshot['appointments'][number]> = {}): RawSnapshot['appointments'][number] => ({
  id, serial_no: serial, status: 'scheduled', booked_at: slotUtc, slot_minutes: 10, checked_in_at: null, called_at: null,
  consult_started_at: null, consult_ended_at: null, priority_level: 0, visit_type: 'new', visit_source: 'online',
  skipped_at: null, rejoined_at: null, no_show_marked_at: null, ...over,
});
const raw = (settings: RawSnapshot['settings']): RawSnapshot => ({
  server_now: '2026-11-10T12:15:00Z',
  date: '2026-11-10',
  settings,
  doctor: { id: 'd1', name: 'Dr. R', speciality: 'MEDICINE', schedules: [{ start: '18:00:00', end: '21:00:00', slot_min: 10 }] },
  session: { id: 's', status: 'open', started_at: '2026-11-10T12:00:00Z', ended_at: null, scheduled_start: '18:00:00', scheduled_end: '21:00:00',
    delay_minutes: 0, delay_reason: null, pauses: [] },
  appointments: [
    appt('X', 1, '2026-11-10T12:10:00Z', { status: 'in_consultation', checked_in_at: '2026-11-10T12:05:00Z', consult_started_at: '2026-11-10T12:10:00Z' }),
    appt('B', 2, '2026-11-10T12:20:00Z'),
    appt('A', 3, '2026-11-10T12:30:00Z', { status: 'checked_in', checked_in_at: '2026-11-10T12:12:00Z' }),
  ],
  history: { new: Array(40).fill(9), follow_up: [] },
  benchmark: null, tracking: [], last_broadcast: null, dismissed: [], my_undo: null,
});

describe('the switch changes the doctor queue estimate', () => {
  const eta = (mode: 'dss' | 'full') => {
    const input = toEngineInput(raw({ ...BASE, ...FULL_COLS, engine_mode: mode }));
    return runEngine(input).result.estimates['A'];
  };
  it('full mode expects the not-yet-arrived booked patients ahead, so the last patient in line waits longer than under the DSS rules', () => {
    const dss = eta('dss'), full = eta('full');
    expect(full.expectedStartAt, JSON.stringify({ dss, full })).not.toBeNull();
    expect(full.expectedStartAt!).toBeGreaterThan(dss.expectedStartAt!);
  });
  it('dss mode is unchanged by the new columns', () => {
    const a = toEngineInput(raw({ ...BASE, engine_mode: 'dss' }));
    const b = toEngineInput(raw({ ...BASE, ...FULL_COLS, engine_mode: 'dss' }));
    expect(b.settings).toEqual(a.settings);
    expect(runEngine(b).result.estimates['A']).toEqual(runEngine(a).result.estimates['A']);
  });
});

describe('admin settings schema', () => {
  const ok = { ...BASE, ...FULL_COLS, engine_mode: 'full' };
  it('accepts a valid full-engine payload', () => expect(SettingsSchema.safeParse(ok).success).toBe(true));
  it('rejects values outside the table CHECK ranges', () => {
    for (const bad of [{ show_p: 0 }, { show_p: 1.2 }, { range_coverage: 0.3 }, { history_window: 5 }, { sum_with: 'mode' },
      { engine_mode: 'auto' }, { range_method: 'x' }, { lateness_sd_min: -1 }, { report_review_min: 0 }]) {
      expect(SettingsSchema.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
