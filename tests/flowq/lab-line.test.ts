// Lab lines reuse the queue engine: every item is a walk-in counted from the moment it joined the line.
import { describe, it, expect } from 'vitest';
import { computeLineEstimates, expectedWaitMin, DEFAULT_SETTINGS, MIN, type LabItem, type LineInput } from '../../packages/flowq/src';

const T0 = Date.UTC(2026, 10, 17, 4, 0); // 10:00 Dhaka
const item = (id: string, queuedMin: number, extra: Partial<LabItem> = {}): LabItem => ({
  id, lineId: 'blood', patientId: `p-${id}`, queuedAt: T0 + queuedMin * MIN, status: 'queued', priorityLevel: 0, ...extra,
});
const input = (items: LabItem[], state: LineInput['session']['state'] = 'active'): LineInput => ({
  now: T0 + 10 * MIN,
  settings: DEFAULT_SETTINGS,
  session: { state, startedAt: T0, scheduledStartAt: T0, scheduledEndAt: T0 + 480 * MIN, pauses: [] },
  line: { id: 'blood', name: 'Blood', typicalMin: 5 },
  items,
  history: [],
});
const numbersFinite = (o: unknown): boolean =>
  o == null ? true : typeof o === 'number' ? Number.isFinite(o) : typeof o === 'object' ? Object.values(o).every(numbersFinite) : true;

describe('lab line estimates', () => {
  it('three queued items with typical 5 start now, +5, +10', () => {
    const r = computeLineEstimates(input([item('a', 0), item('b', 1), item('c', 2)]));
    const now = T0 + 10 * MIN;
    expect(['a', 'b', 'c'].map((id) => r.estimates[id].expectedStartAt)).toEqual([now, now + 5 * MIN, now + 10 * MIN]);
  });

  it('emergency goes first', () => {
    const r = computeLineEstimates(input([item('a', 0), item('b', 1, { priorityLevel: 2 })]));
    expect(r.line).toEqual(['b', 'a']);
  });

  it('called item counts as in the room', () => {
    const r = computeLineEstimates(input([item('a', 0, { status: 'called', calledAt: T0 + 8 * MIN }), item('b', 1)]));
    expect(r.nowServing?.appointmentId).toBe('a');
    expect(r.estimates.b.expectedStartAt).toBe(T0 + 13 * MIN); // called at 8, typical 5
  });

  it('no NaN for items without a booking', () => {
    const r = computeLineEstimates(input([item('a', 0), item('b', 1, { status: 'collected', calledAt: T0 + 2 * MIN, collectedAt: T0 + 6 * MIN })]));
    expect(numbersFinite(r)).toBe(true);
  });

  it('empty open line has zero wait', () => {
    expect(expectedWaitMin(computeLineEstimates(input([])))).toBe(0);
  });

  it('wait for a newcomer is the sum ahead', () => {
    expect(expectedWaitMin(computeLineEstimates(input([item('a', 0), item('b', 1)])))).toBe(10);
  });

  it('ended or not started line is closed (Infinity)', () => {
    expect(expectedWaitMin(computeLineEstimates(input([], 'ended')))).toBe(Infinity);
    expect(expectedWaitMin(computeLineEstimates(input([], 'not_started')))).toBe(Infinity);
  });
});
