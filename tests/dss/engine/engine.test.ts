// DSS-35: engine unit tests (Part B rules).
import { describe, it, expect } from 'vitest';
import {
  computeEstimates, computeExpectedDurations, computeQueueOrder, statusLabel, runEngine,
  DEFAULT_SETTINGS, MIN,
} from '@/lib/queue/engine';
import { at, appt, arrived, activeSession, input, RAHMAN_HISTORY } from './fixtures';

const s = DEFAULT_SETTINGS;
const hhmm = (t: number | null) => {
  if (t == null) return null;
  const d = new Date(t + 6 * 3600_000);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

describe('B5 worked example (Dr. Rahman, 6:40 PM)', () => {
  const s3 = appt(3, at(18, 20), { status: 'in_consultation', checkedInAt: at(18, 15), consultStartedAt: at(18, 35) });
  const s4 = arrived(4, at(18, 30), at(18, 28));
  const s5 = arrived(5, at(18, 40), at(18, 36));
  const s6 = arrived(6, at(18, 50), at(18, 38));

  it('serial 6 is expected at 7:02 PM, range 6:53 to 7:14, "Running late", wait 15–35 min', () => {
    const r = computeEstimates(input(at(18, 40), [s3, s4, s5, s6]));
    const e = r.estimates[s6.id];
    expect(r.doctorFreeInMin).toBe(4);
    expect(e.expectedStartAt).toBe(at(19, 2));
    expect(e.lowAt).toBe(at(18, 53));
    expect(e.highAt).toBe(at(19, 14));
    expect(e.deltaMin).toBe(12);
    expect(e.label).toBe('running_late');
    expect([e.waitMinLow, e.waitMinHigh]).toEqual([15, 35]);
    expect(e.patientsAhead).toBe(2);
    expect(e.confidence).toBe('high');
    expect(r.nowServing?.serialNo).toBe(3);
  });

  it('if serial 4 has not arrived it is not counted: 6:40 + 4 + 9 = 6:53', () => {
    const s4away = appt(4, at(18, 30));
    const r = computeEstimates(input(at(18, 40), [s3, s4away, s5, s6]));
    expect(hhmm(r.estimates[s6.id].expectedStartAt)).toBe('18:53');
    expect(r.estimates[s6.id].flags).toContain('not_arrived_ahead_may_come');
    expect(r.estimates[s4away.id].label).toBe('not_arrived');
  });

  it('serial 4 arriving later pushes serial 6 back up', () => {
    const late4 = arrived(4, at(18, 30), at(18, 39));
    const r = computeEstimates(input(at(18, 40), [s3, late4, s5, s6]));
    expect(r.estimates[s6.id].expectedStartAt).toBe(at(19, 2));
  });
});

describe('durations (B4)', () => {
  it('uses the middle of the last 30 same-kind visits, with quarter / three-quarter for the range', () => {
    const d = computeExpectedDurations({ history: { new: RAHMAN_HISTORY, follow_up: [] }, slotMinutes: 10, settings: s });
    expect(d.new).toMatchObject({ typical: 9, short: 6, long: 13, source: 'history', samples: 21 });
  });
  it('falls back to the department average, then to the slot length (never a hard-coded 15)', () => {
    const few = [9, 9, 9, 9, 9];
    const dept = computeExpectedDurations({ history: { new: few, follow_up: few }, departmentAvgMin: 12, slotMinutes: 10, settings: s });
    expect(dept.new).toMatchObject({ typical: 12, source: 'department' });
    const slot = computeExpectedDurations({ history: { new: few, follow_up: [] }, departmentAvgMin: null, slotMinutes: 10, settings: s });
    expect(slot.new).toMatchObject({ typical: 10, source: 'slot' });
    const noSlot = computeExpectedDurations({ history: { new: [], follow_up: [] }, slotMinutes: null, settings: s });
    expect(noSlot.new.typical).toBe(s.defaultSlotMin);
  });
  it('clamps to 3–60 minutes and uses only the 30 most recent visits', () => {
    const long = computeExpectedDurations({ history: { new: Array(12).fill(90), follow_up: Array(12).fill(1) }, slotMinutes: 10, settings: s });
    expect(long.new.typical).toBe(60);
    expect(long.follow_up.typical).toBe(3);
    const recentFirst = [...Array(30).fill(5), ...Array(30).fill(50)];
    expect(computeExpectedDurations({ history: { new: recentFirst, follow_up: [] }, slotMinutes: 10, settings: s }).new.typical).toBe(5);
  });
  it('one very long visit does not distort the typical value', () => {
    const d = computeExpectedDurations({ history: { new: [...Array(11).fill(9), 58], follow_up: [] }, slotMinutes: 10, settings: s });
    expect(d.new.typical).toBe(9);
  });
});

describe('queue order (B2, B3)', () => {
  it('late arrival lands between those who were on time (6:10 patient arriving 6:45)', () => {
    const s2 = arrived(2, at(18, 10), at(18, 45));
    const s4 = arrived(4, at(18, 30), at(18, 29));
    const s5 = arrived(5, at(18, 40), at(18, 41));
    const s6 = arrived(6, at(18, 50), at(18, 46));
    const order = computeQueueOrder([s6, s2, s5, s4], s);
    expect(order.line.map((a) => a.serialNo)).toEqual([4, 5, 2, 6]);
  });
  it('arriving within grace keeps the booked time', () => {
    const s1 = arrived(1, at(18), at(18, 9));
    const s2 = arrived(2, at(18, 10), at(18, 5));
    expect(computeQueueOrder([s2, s1], s).line.map((a) => a.serialNo)).toEqual([1, 2]);
  });
  it('emergency goes to the front, then priority, then normal', () => {
    const n1 = arrived(1, at(18), at(18));
    const p2 = arrived(2, at(18, 10), at(18, 10), { priorityLevel: 1 });
    const e9 = arrived(9, at(18, 44), at(18, 44), { priorityLevel: 2, visitSource: 'walk_in' });
    const r = computeEstimates(input(at(18, 45), [n1, p2, e9]));
    expect(r.line).toEqual([e9.id, p2.id, n1.id]);
    expect(r.estimates[n1.id].flags).toContain('emergency_ahead');
  });
  it('only checked-in, not skipped patients are in the line', () => {
    const r = computeQueueOrder([appt(1, at(18)), arrived(2, at(18, 10), at(18, 5), { skippedAt: at(18, 20) }), arrived(3, at(18, 20), at(18, 15))], s);
    expect(r.line.map((a) => a.serialNo)).toEqual([3]);
    expect(r.notArrived.map((a) => a.serialNo)).toEqual([1]);
    expect(r.skipped.map((a) => a.serialNo)).toEqual([2]);
  });
  it('a rejoin counts from the rejoin time', () => {
    const back = arrived(2, at(18, 10), at(18, 5), { rejoinedAt: at(18, 35) });
    const s3 = arrived(3, at(18, 20), at(18, 15));
    const s4 = arrived(4, at(18, 40), at(18, 30));
    expect(computeQueueOrder([back, s3, s4], s).line.map((a) => a.serialNo)).toEqual([3, 2, 4]);
  });
});

describe('a clinic day (B5–B7)', () => {
  it('normal day, 10-minute slots, no history: 6:00, 6:10, 6:20 and on time', () => {
    const list = [arrived(1, at(18), at(17, 55)), arrived(2, at(18, 10), at(17, 58)), arrived(3, at(18, 20), at(17, 59))];
    const r = computeEstimates(input(at(18), list, { history: { new: [], follow_up: [] } }));
    expect(list.map((a) => hhmm(r.estimates[a.id].expectedStartAt))).toEqual(['18:00', '18:10', '18:20']);
    expect(list.every((a) => r.estimates[a.id].label === 'on_time')).toBe(true);
    expect(r.estimates[list[2].id].confidence).toBe('low');
  });

  it('doctor not started 30 minutes after the session start: everyone delayed, reason given', () => {
    const list = [arrived(1, at(18), at(17, 55)), arrived(2, at(18, 10), at(18, 5))];
    const r = computeEstimates(input(at(18, 30), list, { session: { state: 'not_started', scheduledStartAt: at(18), pauses: [] } }));
    expect(r.estimates[list[0].id].expectedStartAt).toBe(at(18, 30));
    expect(r.estimates[list[0].id].label).toBe('delayed');
    expect(r.estimates[list[0].id].reason).toBe("Doctor hasn't started yet");
    expect(r.summary.delayMin).toBe(30);
  });

  it('before the session start, estimates start at the session start', () => {
    const list = [arrived(1, at(18), at(17, 30))];
    const r = computeEstimates(input(at(17, 40), list, { session: { state: 'not_started', scheduledStartAt: at(18), pauses: [] } }));
    expect(r.estimates[list[0].id].expectedStartAt).toBe(at(18));
  });

  it('doctor started 30 minutes late: reason says so', () => {
    const list = [arrived(1, at(18), at(17, 55)), arrived(2, at(18, 10), at(18))];
    const r = computeEstimates(input(at(18, 30), list, { session: activeSession({ startedAt: at(18, 30) }) }));
    expect(r.session.lateStartMin).toBe(30);
    expect(r.estimates[list[1].id].reason).toBe('Doctor started 30 minutes late');
  });

  it('walk-in added: queued by arrival time and adds a visit for those behind', () => {
    const s5 = arrived(5, at(18, 40), at(18, 35));
    const s6 = arrived(6, at(18, 50), at(18, 45));
    const before = computeEstimates(input(at(18, 40), [s5, s6]));
    const walk = arrived(20, at(18, 38), at(18, 38), { visitSource: 'walk_in' });
    const after = computeEstimates(input(at(18, 40), [s5, s6, walk]));
    expect(after.line).toEqual([walk.id, s5.id, s6.id]);
    expect((after.estimates[s6.id].expectedStartAt! - before.estimates[s6.id].expectedStartAt!) / MIN).toBe(9);
  });

  it('pause time is not counted; while paused the screen says why', () => {
    const cur = appt(1, at(18, 30), { status: 'in_consultation', checkedInAt: at(18, 25), consultStartedAt: at(18, 30) });
    const next = arrived(2, at(18, 40), at(18, 35));
    const pauses = [{ pausedAt: at(18, 32), resumedAt: at(18, 42), reason: 'Tea' }];
    const resumed = computeEstimates(input(at(18, 45), [cur, next], { session: activeSession({ pauses }) }));
    expect(resumed.nowServing?.elapsedMin).toBe(5);
    expect(resumed.estimates[next.id].expectedStartAt).toBe(at(18, 49));
    const paused = computeEstimates(input(at(18, 40), [cur, next], {
      session: activeSession({ state: 'paused', pauses: [{ pausedAt: at(18, 32), reason: 'Tea' }] }),
    }));
    expect(paused.estimates[next.id].reason).toBe('Doctor is on a short break');
    expect(paused.session.pauseReason).toBe('Tea');
    expect(paused.nowServing?.elapsedMin).toBe(2);
  });

  it('a visit running over assumes 2 more minutes', () => {
    const cur = appt(1, at(18), { status: 'in_consultation', checkedInAt: at(18), consultStartedAt: at(18) });
    const next = arrived(2, at(18, 10), at(18, 5));
    const r = computeEstimates(input(at(18, 20), [cur, next]));
    expect(r.doctorFreeInMin).toBe(2);
    expect(r.nowServing?.overrun).toBe(true);
    expect(r.estimates[next.id].reason).toBe('The current visit is taking longer than usual');
  });

  it('empty queue: no line, zero summary, walk-in suggestion', () => {
    const { result, suggestions } = runEngine(input(at(18, 30), []));
    expect(result.line).toEqual([]);
    expect(result.summary).toMatchObject({ seen: 0, waiting: 0, notArrived: 0, noShows: 0, delayMin: 0 });
    expect(suggestions.map((x) => x.type)).toEqual(['accept_walk_in']);
  });

  it('expected start times never go backwards along the line', () => {
    const list = [];
    for (let i = 1; i <= 25; i++) {
      list.push(arrived(i, at(18, i * 5), at(18, i * 4), { visitType: i % 3 ? 'new' : 'follow_up', priorityLevel: (i % 7 === 0 ? 1 : 0) as 0 | 1 }));
    }
    const r = computeEstimates(input(at(18, 50), list, { history: { new: RAHMAN_HISTORY, follow_up: [3, 4, 4, 5, 5, 5, 6, 6, 7, 7] } }));
    const times = r.line.map((id) => r.estimates[id]);
    for (let i = 1; i < times.length; i++) {
      expect(times[i].expectedStartAt!).toBeGreaterThanOrEqual(times[i - 1].expectedStartAt!);
      expect(times[i].lowAt!).toBeLessThanOrEqual(times[i].expectedStartAt!);
      expect(times[i].highAt!).toBeGreaterThanOrEqual(times[i].expectedStartAt!);
    }
    expect(times[times.length - 1].confidence).toBe('low'); // more than 8 ahead
  });
});

describe('status label edges (B6)', () => {
  it.each([
    [0, 'on_time'], [5, 'on_time'], [-5, 'on_time'], [5.01, 'running_late'], [-5.01, 'early'],
    [15, 'running_late'], [15.01, 'delayed'], [40, 'delayed'],
  ] as const)('%s min → %s', (delta, label) => {
    expect(statusLabel(delta, s)).toBe(label);
  });
  it('in the room uses the real start time', () => {
    const cur = appt(1, at(18), { status: 'in_consultation', checkedInAt: at(18), consultStartedAt: at(18, 20) });
    const r = computeEstimates(input(at(18, 25), [cur]));
    expect(r.estimates[cur.id]).toMatchObject({ stage: 'in_room', label: 'delayed', deltaMin: 20 });
  });
});

describe('suggestions (B8)', () => {
  const types = (inp: ReturnType<typeof input>) => runEngine(inp).suggestions.map((x) => x.type);

  it('call next when the doctor is free and someone waits', () => {
    const sug = runEngine(input(at(18, 5), [arrived(1, at(18), at(17, 58))])).suggestions;
    expect(sug[0]).toMatchObject({ type: 'call_next', action: { kind: 'call_next', expectedCurrent: null } });
  });
  it('skip after grace, no-show after 30 minutes', () => {
    const a = appt(1, at(18));
    expect(types(input(at(18, 11), [a]))).toContain('skip');
    expect(types(input(at(18, 9), [a]))).not.toContain('skip');
    const late = types(input(at(18, 31), [a]));
    expect(late).toContain('no_show');
    expect(late).not.toContain('skip');
  });
  it('delay notice at 20+ minutes behind, not repeated until it grows by 10', () => {
    const list = [arrived(1, at(18), at(17, 55)), arrived(2, at(18, 10), at(18))];
    const notStarted = { state: 'not_started' as const, scheduledStartAt: at(18), pauses: [] };
    expect(types(input(at(18, 19), list, { session: notStarted }))).not.toContain('notify_delay');
    const sug = runEngine(input(at(18, 25), list, { session: notStarted })).suggestions;
    expect(sug[0]).toMatchObject({ type: 'notify_delay', severity: 'urgent', action: { minutes: 25 } });
    expect(types(input(at(18, 30), list, { session: notStarted, lastBroadcast: { at: at(18, 25), minutes: 25 } }))).not.toContain('notify_delay');
    expect(types(input(at(18, 36), list, { session: notStarted, lastBroadcast: { at: at(18, 25), minutes: 25 } }))).toContain('notify_delay');
  });
  it('wait grew a lot since check-in', () => {
    const cur = appt(1, at(18), { status: 'in_consultation', checkedInAt: at(18), consultStartedAt: at(18, 2) });
    const w = arrived(2, at(18, 10), at(18, 5));
    expect(types(input(at(18, 30), [cur, w], { checkinEtaAt: { [w.id]: at(18, 10) } }))).toContain('check_on');
  });
  it('long pause, and resolve remaining after the session ends', () => {
    const w = arrived(2, at(18, 10), at(18, 5));
    expect(types(input(at(18, 40), [w], { session: activeSession({ state: 'paused', pauses: [{ pausedAt: at(18, 15) }] }) }))).toContain('long_pause');
    const ended = runEngine(input(at(21), [w, appt(3, at(20, 50))], { session: activeSession({ state: 'ended', endedAt: at(21) }) }));
    expect(ended.suggestions.map((x) => x.type)).toEqual(['resolve_remaining']);
    expect(ended.result.estimates[w.id].expectedStartAt).toBeNull();
    expect(ended.result.estimates[w.id].reason).toBe('The session has ended');
  });
  it('dismissed suggestions stay hidden and keys are stable', () => {
    const a = appt(1, at(18));
    const first = runEngine(input(at(18, 12), [a])).suggestions;
    const again = runEngine(input(at(18, 14), [a])).suggestions;
    expect(first.map((x) => x.key)).toEqual(again.map((x) => x.key));
    expect(runEngine(input(at(18, 14), [a], { dismissed: first.map((x) => x.key) })).suggestions).toEqual([]);
  });
  it('urgent first', () => {
    const sug = runEngine(input(at(18, 40), [appt(1, at(18)), arrived(2, at(18, 10), at(18, 5))], {
      session: { state: 'not_started', scheduledStartAt: at(18), pauses: [] },
    })).suggestions;
    expect(sug[0].severity).toBe('urgent');
  });
});
