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
// A arrived early (18:12) for an 18:30 slot; B (18:20 slot) has not arrived yet; nobody in the room.
const LINE = [booked('A', 3, 30, { status: 'checked_in', checkedInAt: at(12) }), booked('B', 2, 20)];

describe('expected arrivals ahead', () => {
  it('off by default: the DSS rule only counts people already in line', () => {
    expect(DEFAULT_SETTINGS.expectArrivals).toBe(false);
    expect(computeEstimates(input(LINE, {})).estimates.A.expectedStartAt).toBe(at(15));
  });
  it('a booked patient with an earlier slot who may still come adds showP x one visit', () => {
    expect(computeEstimates(input(LINE, { expectArrivals: true, showP: 1 })).estimates.A.expectedStartAt).toBe(at(25));
    expect(computeEstimates(input(LINE, { expectArrivals: true, showP: 0.5 })).estimates.A.expectedStartAt).toBe(at(20));
  });
  it('a booked patient already past the grace time is not expected', () => {
    // now 18:35: B's slot 18:20 + grace 10 has passed.
    const r = computeEstimates(input([booked('A', 3, 40, { status: 'checked_in', checkedInAt: at(30) }), booked('B', 2, 20)], { expectArrivals: true, showP: 1 }, 35));
    expect(r.estimates.A.expectedStartAt).toBe(at(35)); // doctor is free now; B is not counted
  });
  it('walk-ins expected before this patient\'s counted time are added', () => {
    // 6 walk-ins/hour x 15 min until A's counted time (18:30) = 1.5 walk-ins x 10 min = 15 min.
    const r = computeEstimates(input([LINE[0]], { expectArrivals: true, showP: 1, walkInPerHour: 6 }));
    expect(r.estimates.A.expectedStartAt).toBe(at(30));
  });
  it('the low end of the range assumes nobody else comes', () => {
    const r = computeEstimates(input(LINE, { expectArrivals: true, showP: 1, walkInPerHour: 6 }));
    expect(r.estimates.A.lowAt).toBe(computeEstimates(input(LINE, {})).estimates.A.lowAt);
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
