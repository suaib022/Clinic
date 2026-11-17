// Range shown to patients: the DSS quartile sums, or a normal approximation of the total with a chosen coverage.
import { describe, it, expect } from 'vitest';
import { computeEstimates, computeExpectedDurations, DEFAULT_SETTINGS, MIN, normalQuantile, type DssSettings, type EngineInput, type QueueAppointment } from '../../packages/flowq/src';

const T = Date.UTC(2026, 10, 17, 12, 0);
const at = (m: number) => T + m * MIN;
const waiting = (id: string, serial: number, m: number): QueueAppointment => ({
  id, serialNo: serial, status: 'checked_in', bookedAt: at(m), checkedInAt: at(m), slotMinutes: 10, priorityLevel: 0, visitType: 'new', visitSource: 'walk_in',
});
// History with mean 10 and sample SD 3 (alternating 7 and 13, 20 values).
const HIST = Array.from({ length: 20 }, (_, i) => (i % 2 ? 13 : 7));
const input = (s: Partial<DssSettings>): EngineInput => ({
  now: at(30), settings: { ...DEFAULT_SETTINGS, sumWith: 'mean', ...s },
  session: { state: 'active', startedAt: T, scheduledStartAt: T, scheduledEndAt: at(180), pauses: [] },
  appointments: [waiting('A', 1, 1), waiting('B', 2, 2), waiting('C', 3, 3)], history: { new: HIST, follow_up: [] }, slotMinutes: 10,
});

describe('duration spread', () => {
  it('stats carry the sample SD', () => {
    expect(computeExpectedDurations({ history: { new: HIST, follow_up: [] }, settings: DEFAULT_SETTINGS }).new.sd).toBeCloseTo(3.078, 2);
  });
});

describe('normalQuantile', () => {
  it('matches standard values', () => {
    expect(normalQuantile(0.9)).toBeCloseTo(1.2816, 3);
    expect(normalQuantile(0.975)).toBeCloseTo(1.96, 3);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 6);
  });
});

describe('range method', () => {
  it('default stays the DSS quartile sums', () => {
    expect(DEFAULT_SETTINGS.rangeMethod).toBe('quartile_sum');
    expect(DEFAULT_SETTINGS.rangeCoverage).toBe(0.8);
  });
  it('normal_sum: C has two visits ahead, half-width = z(0.8) x sqrt(2 x sd^2)', () => {
    const r = computeEstimates(input({ rangeMethod: 'normal_sum' }));
    const c = r.estimates.C;
    const sd = computeExpectedDurations({ history: { new: HIST, follow_up: [] }, settings: DEFAULT_SETTINGS }).new.sd;
    const half = 1.2816 * Math.sqrt(2 * sd * sd);
    expect((c.highAt! - c.expectedStartAt!) / MIN).toBeCloseTo(half, 2);
    expect((c.expectedStartAt! - c.lowAt!) / MIN).toBeCloseTo(half, 2);
  });
  it('normal_sum never puts the low end before now', () => {
    const r = computeEstimates(input({ rangeMethod: 'normal_sum', rangeCoverage: 0.99 }));
    for (const e of Object.values(r.estimates)) if (e.lowAt != null) expect(e.lowAt).toBeGreaterThanOrEqual(at(30));
  });
  it('wider coverage gives a wider range', () => {
    const w = (c: number) => { const e = computeEstimates(input({ rangeMethod: 'normal_sum', rangeCoverage: c })).estimates.C; return e.highAt! - e.lowAt!; };
    expect(w(0.9)).toBeGreaterThan(w(0.8));
  });
});
