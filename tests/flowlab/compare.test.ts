import { describe, it, expect } from 'vitest';
import { compareModes, FULL_PRESET_ROW } from '@/lib/flowlab/compare';
import type { RawSnapshot } from '@/lib/queue/snapshotInput';

const BASE = { on_time_band_min: 5, late_band_min: 15, grace_min: 10, no_show_min: 30, doctor_late_alert_min: 20, near_turn_count: 3,
  undo_window_sec: 120, min_duration_samples: 10, default_slot_min: 10, duration_clamp_min: 3, duration_clamp_max: 60 };
const appt = (id: string, serial: number, slotUtc: string, over: Partial<RawSnapshot['appointments'][number]> = {}): RawSnapshot['appointments'][number] => ({
  id, serial_no: serial, status: 'scheduled', booked_at: slotUtc, slot_minutes: 10, checked_in_at: null, called_at: null,
  consult_started_at: null, consult_ended_at: null, priority_level: 0, visit_type: 'new', visit_source: 'online',
  skipped_at: null, rejoined_at: null, no_show_marked_at: null, patient_name: `P${serial}`, ...over,
});
// 18:15 Dhaka. X in the room since 18:10, A waiting (arrived 18:12, 18:30 slot), B (18:20 slot) not yet here.
const raw = (settings: RawSnapshot['settings']): RawSnapshot => ({
  server_now: '2026-11-10T12:15:00Z', date: '2026-11-10', settings,
  doctor: { id: 'd1', name: 'Dr. R', speciality: 'MEDICINE', schedules: [{ start: '18:00:00', end: '21:00:00', slot_min: 10 }] },
  session: { id: 's', status: 'open', started_at: '2026-11-10T12:00:00Z', ended_at: null, scheduled_start: '18:00:00', scheduled_end: '21:00:00',
    delay_minutes: 0, delay_reason: null, pauses: [] },
  appointments: [
    appt('X', 1, '2026-11-10T12:10:00Z', { status: 'in_consultation', checked_in_at: '2026-11-10T12:05:00Z', consult_started_at: '2026-11-10T12:10:00Z' }),
    appt('B', 2, '2026-11-10T12:20:00Z'),
    appt('A', 3, '2026-11-10T12:30:00Z', { status: 'checked_in', checked_in_at: '2026-11-10T12:12:00Z' }),
  ],
  history: { new: Array(40).fill(9), follow_up: [] }, benchmark: null, tracking: [], last_broadcast: null, dismissed: [], my_undo: null,
});

describe('flow lab comparison', () => {
  const c = compareModes(raw({ ...BASE, engine_mode: 'dss' }));
  it('reports the live mode from the switch', () => {
    expect(c.liveMode).toBe('dss');
    expect(compareModes(raw({ ...BASE, engine_mode: 'full' })).liveMode).toBe('full');
  });
  it('gives every active patient both estimates, ordered by serial', () => {
    expect(c.rows.map((r) => r.serialNo)).toEqual([1, 2, 3]);
    for (const r of c.rows.filter((x) => x.stage === 'waiting')) {
      expect(r.dss.expectedStartAt).not.toBeNull();
      expect(r.full.expectedStartAt).not.toBeNull();
    }
  });
  it('full mode expects the missing booked patient first, so A waits longer than under the DSS rules', () => {
    const a = c.rows.find((r) => r.appointmentId === 'A')!;
    expect(a.shiftMin).toBeGreaterThan(0);
  });
  it('is independent of the saved mode: the DSS side always uses the rules, the full side the preset', () => {
    const asFull = compareModes(raw({ ...BASE, ...FULL_PRESET_ROW }));
    expect(asFull.dssSettings.expectArrivals).toBe(false);
    expect(asFull.fullSettings).toMatchObject({ expectArrivals: true, sumWith: 'mean', rangeMethod: 'normal_sum', showP: 0.77 });
    expect(asFull.rows.find((r) => r.appointmentId === 'A')!.dss.expectedStartAt).toBe(c.rows.find((r) => r.appointmentId === 'A')!.dss.expectedStartAt);
  });
  it('does not mutate the snapshot', () => {
    const r = raw({ ...BASE, engine_mode: 'dss' });
    const before = JSON.stringify(r);
    compareModes(r);
    expect(JSON.stringify(r)).toBe(before);
  });
});
