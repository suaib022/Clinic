// Which lab line next, and whether a patient can show the report to the doctor today.
import { describe, it, expect } from 'vitest';
import { suggestRoute, adviseReturn, MIN, type SessionInfo } from '../../packages/flowq/src';

describe('suggestRoute', () => {
  it('must-go-first test comes before a shorter line', () => {
    expect(suggestRoute([{ lineId: 'xray', mustFirst: false }, { lineId: 'blood', mustFirst: true }], { blood: 20, xray: 5 }))
      .toEqual(['blood', 'xray']);
  });
  it('shortest wait first', () => {
    expect(suggestRoute([{ lineId: 'urine', mustFirst: false }, { lineId: 'ecg', mustFirst: false }], { urine: 10, ecg: 3 }))
      .toEqual(['ecg', 'urine']);
  });
  it('two tests in one line count once', () => {
    expect(suggestRoute([{ lineId: 'blood', mustFirst: false }, { lineId: 'blood', mustFirst: false }], { blood: 4 }))
      .toEqual(['blood']);
  });
  it('closed line goes last, never dropped', () => {
    expect(suggestRoute([{ lineId: 'xray', mustFirst: false }, { lineId: 'urine', mustFirst: false }], { xray: Infinity, urine: 30 }))
      .toEqual(['urine', 'xray']);
  });
  it('ties by line id', () => {
    expect(suggestRoute([{ lineId: 'b', mustFirst: false }, { lineId: 'a', mustFirst: false }], { a: 5, b: 5 })).toEqual(['a', 'b']);
  });
});

describe('adviseReturn', () => {
  const day = Date.UTC(2026, 10, 17, 0, 0);
  const at = (h: number, m = 0) => day + (h - 6) * 60 * MIN + m * MIN; // Dhaka clock
  const session = (state: SessionInfo['state']): SessionInfo => ({ state, scheduledStartAt: at(18), scheduledEndAt: at(21), startedAt: at(18), pauses: [] });

  it('same day when there is time: ready 19:00, wait 30, travel 10 -> 19:40', () => {
    expect(adviseReturn({ reportReadyAt: at(19), doctorSession: session('active'), queueWaitMin: 30 }))
      .toEqual({ kind: 'same_day', expectedStartAt: at(19, 40) });
  });
  it('book later when the session is nearly over', () => {
    expect(adviseReturn({ reportReadyAt: at(20, 30), doctorSession: session('active'), queueWaitMin: 15 }))
      .toEqual({ kind: 'book_later', reason: 'not_enough_time' });
  });
  it('book later when the session ended', () => {
    expect(adviseReturn({ reportReadyAt: at(19), doctorSession: session('ended'), queueWaitMin: 0 }))
      .toEqual({ kind: 'book_later', reason: 'session_ended' });
  });
  it('book later when the doctor has no session today', () => {
    expect(adviseReturn({ reportReadyAt: at(19), doctorSession: null, queueWaitMin: 0 }))
      .toEqual({ kind: 'book_later', reason: 'no_session' });
  });
  it('report ready before the session starts can still be same day', () => {
    expect(adviseReturn({ reportReadyAt: at(16), doctorSession: { ...session('not_started'), startedAt: null }, queueWaitMin: 20 }))
      .toEqual({ kind: 'same_day', expectedStartAt: at(18, 20) });
  });
});
