import { describe, it, expect } from 'vitest';
import { learnRates, MIN, type QueueAppointment } from '../../packages/flowq/src';

const T = Date.UTC(2026, 10, 17, 12, 0);
const at = (m: number) => T + m * MIN;
const a = (id: string, x: Partial<QueueAppointment>): QueueAppointment => ({ id, serialNo: 1, status: 'scheduled', bookedAt: at(0), priorityLevel: 0, visitType: 'new', visitSource: 'online', ...x });

describe('learnRates', () => {
  const prior = { walkInPerHour: 2, showP: 0.77 };
  it('at the start of the session it returns the prior', () => {
    expect(learnRates({ now: T, sessionStartAt: T, appointments: [], prior, noShowMin: 30 })).toEqual(prior);
  });
  it('no walk-ins for 2 hours pulls the rate down: (2x1 + 0) / (1 + 2)', () => {
    expect(learnRates({ now: at(120), sessionStartAt: T, appointments: [], prior, noShowMin: 30 }).walkInPerHour).toBeCloseTo(2 / 3, 6);
  });
  it('walk-ins count, report reviews do not', () => {
    const appts = [a('w1', { visitSource: 'walk_in', checkedInAt: at(10) }), a('w2', { visitSource: 'walk_in', checkedInAt: at(20) }),
      a('r1', { visitSource: 'walk_in', visitReason: 'report_review', checkedInAt: at(30) })];
    expect(learnRates({ now: at(60), sessionStartAt: T, appointments: appts, prior, noShowMin: 30 }).walkInPerHour).toBeCloseTo((2 + 2) / 2, 6);
  });
  it('show probability uses decided bookings only', () => {
    const appts = [a('b1', { bookedAt: at(0), checkedInAt: at(-5) }), a('b2', { bookedAt: at(10) }), a('b3', { bookedAt: at(50) })];
    // now 18:45: b1 came; b2 slot 18:10 + 30 passed -> no-show; b3 not decided yet.
    expect(learnRates({ now: at(45), sessionStartAt: T, appointments: appts, prior, noShowMin: 30 }).showP).toBeCloseTo((0.77 * 10 + 1) / 12, 6);
  });
});
