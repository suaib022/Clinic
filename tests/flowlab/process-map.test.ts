import { describe, it, expect } from 'vitest';
import { buildProcessMap } from '@/lib/flowlab/processMap';
import type { FlowEvent } from '@/packages/flowq/src';

const MIN = 60_000;
const ev = (id: string, activity: FlowEvent['activity'], min: number, appt?: string): FlowEvent => ({
  id, activity, time: Date.UTC(2026, 10, 10, 12, 0) + min * MIN, attrs: {},
  objects: [{ type: 'doctor', id: 'd' }, ...(appt ? [{ type: 'appointment' as const, id: appt }] : [])],
});
const EVENTS: FlowEvent[] = [
  ev('s', 'session_start', 0),
  // a1: book -> check_in (10) -> call (20) -> consult_start (0) -> consult_end (9)
  ev('1', 'book', -60, 'a1'), ev('2', 'check_in', -50, 'a1'), ev('3', 'call', -30, 'a1'), ev('4', 'consult_start', -30, 'a1'), ev('5', 'consult_end', -21, 'a1'),
  // a2: same path, slower waiting (40 min)
  ev('6', 'book', -60, 'a2'), ev('7', 'check_in', -50, 'a2'), ev('8', 'call', -10, 'a2'), ev('9', 'consult_start', -10, 'a2'), ev('10', 'consult_end', 1, 'a2'),
  // a3: no show
  ev('11', 'book', -60, 'a3'), ev('12', 'no_show', -20, 'a3'),
];

describe('process map', () => {
  const m = buildProcessMap(EVENTS);
  it('counts events, cases (appointments) and activities; events without an appointment are not cases', () => {
    expect(m.events).toBe(13);
    expect(m.cases).toBe(3);
    expect(m.activities.find((a) => a.activity === 'book')?.count).toBe(3);
    expect(m.activities.find((a) => a.activity === 'session_start')?.count).toBe(1);
  });
  it('builds directly-follows edges with count, median and mean minutes', () => {
    const w = m.edges.find((e) => e.from === 'check_in' && e.to === 'call')!;
    expect(w).toMatchObject({ count: 2, medianMin: 30, meanMin: 30 }); // waits of 20 and 40 min
    const c = m.edges.find((e) => e.from === 'consult_start' && e.to === 'consult_end')!;
    expect(c).toMatchObject({ count: 2, medianMin: 10 });
    expect(m.edges.find((e) => e.from === 'book' && e.to === 'no_show')?.medianMin).toBe(40);
  });
  it('groups traces into variants, most frequent first', () => {
    expect(m.variants[0]).toEqual({ path: ['book', 'check_in', 'call', 'consult_start', 'consult_end'], count: 2 });
    expect(m.variants[1]).toEqual({ path: ['book', 'no_show'], count: 1 });
  });
  it('handles an empty log and out-of-order input', () => {
    expect(buildProcessMap([])).toMatchObject({ events: 0, cases: 0, edges: [], variants: [] });
    const shuffled = [...EVENTS].reverse();
    expect(buildProcessMap(shuffled).edges).toEqual(m.edges);
  });
  it('limits the number of variants returned', () => {
    expect(buildProcessMap(EVENTS, 1).variants).toHaveLength(1);
  });
});
