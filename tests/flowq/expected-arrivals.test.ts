// Patients who are not in the line yet but will be seen first: booked patients with earlier slots, and walk-ins.
import { describe, it, expect } from 'vitest';
import { computeEstimates, DEFAULT_SETTINGS, MIN, type DssSettings, type EngineInput, type QueueAppointment } from '../../packages/flowq/src';

const T = Date.UTC(2026, 10, 17, 12, 0); // 18:00 Dhaka
const at = (m: number) => T + m * MIN;
const booked = (id: string, serial: number, slotMin: number, extra: Partial<QueueAppointment> = {}): QueueAppointment => ({
  id, serialNo: serial, status: 'scheduled', bookedAt: at(slotMin), slotMinutes: 10, priorityLevel: 0, visitType: 'new', visitSource: 'online', ...extra,
});
const input = (appointments: QueueAppointment[], s: Partial<DssSettings>, nowMin = 15): EngineInput => ({
  now: at(nowMin), settings: { ...DEFAULT_SETTINGS, ...s },
  session: { state: 'active', startedAt: T, scheduledStartAt: T, scheduledEndAt: at(180), pauses: [] },
  appointments, history: { new: [], follow_up: [] }, slotMinutes: 10,
});
// X is with the doctor since 18:10 (expected 10 min, so the doctor is free at 18:20). A arrived early (18:12) for an 18:30
// slot, so A's counted time is 18:30 but A will be called at about 18:20. B (18:20 slot) has not arrived yet. Now 18:15.
const X = booked('X', 1, 10, { status: 'in_consultation', checkedInAt: at(5), consultStartedAt: at(10) });
const A = booked('A', 3, 30, { status: 'checked_in', checkedInAt: at(12) });
const LINE = [X, A, booked('B', 2, 20)];

describe('expected arrivals ahead', () => {
  it('off by default: the DSS rule only counts people already in line', () => {
    expect(DEFAULT_SETTINGS.expectArrivals).toBe(false);
    expect(computeEstimates(input(LINE, {})).estimates.A.expectedStartAt).toBe(at(20));
  });
  it('a booked patient with an earlier slot who may still arrive before A is called adds showP x one visit', () => {
    expect(computeEstimates(input(LINE, { expectArrivals: true, showP: 1 })).estimates.A.expectedStartAt).toBe(at(30));
    expect(computeEstimates(input(LINE, { expectArrivals: true, showP: 0.5 })).estimates.A.expectedStartAt).toBe(at(25));
  });
  it('a booked patient whose slot is after A would be called is not expected', () => {
    // B's slot moved to 18:25: before A's counted time (18:30) but after A's call (18:20).
    const r = computeEstimates(input([X, A, booked('B', 2, 25)], { expectArrivals: true, showP: 1 }));
    expect(r.estimates.A.expectedStartAt).toBe(at(20));
  });
  it('a booked patient already past the grace time is not expected', () => {
    // now 18:35: B's slot 18:20 + grace 10 has passed.
    const r = computeEstimates(input([booked('A', 3, 40, { status: 'checked_in', checkedInAt: at(30) }), booked('B', 2, 20)], { expectArrivals: true, showP: 1 }, 35));
    expect(r.estimates.A.expectedStartAt).toBe(at(35));
  });
  it('only walk-ins arriving before A is called count: 6/hour x 5 min = 0.5 walk-ins x 10 min', () => {
    const r = computeEstimates(input([X, A], { expectArrivals: true, showP: 1, walkInPerHour: 6 }));
    expect(r.estimates.A.expectedStartAt).toBe(at(25));
  });
  it('the next patient with a free doctor expects nobody to come first', () => {
    const r = computeEstimates(input([A, booked('B', 2, 20)], { expectArrivals: true, showP: 1, walkInPerHour: 6 }));
    expect(r.estimates.A.expectedStartAt).toBe(at(15));
  });
  it('the low end of the range assumes nobody else comes', () => {
    const r = computeEstimates(input(LINE, { expectArrivals: true, showP: 1, walkInPerHour: 6 }));
    expect(r.estimates.A.lowAt).toBe(computeEstimates(input(LINE, {})).estimates.A.lowAt);
  });
});

describe('chance that a missing booked patient arrives before a given time', () => {
  it('Bayes on the arrival-time distribution, limited to the window', async () => {
    const { arrivesBeforeP } = await import('../../packages/flowq/src');
    const s = { ...DEFAULT_SETTINGS, showP: 0.77, latenessMeanMin: -10, latenessSdMin: 10 };
    // slot 18:30, now 18:15, until 18:25: 0.77 x (Phi(0.5) - Phi(-0.5)) / (0.23 + 0.77 x (1 - Phi(-0.5))) = 0.387
    expect(arrivesBeforeP(at(30), at(15), at(25), s)).toBeCloseTo(0.387, 2);
    expect(arrivesBeforeP(at(30), at(15), at(15), s)).toBe(0);
  });
});

describe('chance that a missing booked patient still comes', () => {
  it('drops as time passes their slot (Bayes on the arrival-time distribution)', async () => {
    const { stillComesP } = await import('../../packages/flowq/src');
    const s = { ...DEFAULT_SETTINGS, showP: 0.77, latenessMeanMin: -10, latenessSdMin: 10 };
    const slot = at(30);
    // 15 min before the slot: P(arrive later | show) = P(Z > -0.5) = 0.691 -> 0.77*0.691 / (0.23 + 0.77*0.691) = 0.698
    expect(stillComesP(slot, at(15), s)).toBeCloseTo(0.698, 2);
    // At the slot: P(Z > 1) = 0.159 -> 0.122 / 0.352 = 0.348
    expect(stillComesP(slot, at(30), s)).toBeCloseTo(0.348, 2);
    expect(stillComesP(slot, at(10), s)).toBeGreaterThan(stillComesP(slot, at(30), s));
  });
  it('with no lateness model it falls back to showP', async () => {
    const { stillComesP } = await import('../../packages/flowq/src');
    expect(stillComesP(at(30), at(25), { ...DEFAULT_SETTINGS, showP: 0.8, latenessSdMin: 0 })).toBe(0.8);
  });
});
