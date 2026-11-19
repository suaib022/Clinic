import type { SessionInfo } from '../engine/types';
import { MIN } from '../engine/time';

export type ReturnAdvice =
  | { kind: 'same_day'; expectedStartAt: number }
  | { kind: 'book_later'; reason: 'no_session' | 'session_ended' | 'not_enough_time' };

/**
 * After a report is ready: can the patient show it to the ordering doctor today?
 * Same day only if (arrival back at the chamber, or the session start if later) + queue wait
 * ends at least endMarginMin before the session's scheduled end. The patient still decides.
 */
export function adviseReturn(a: {
  reportReadyAt: number;
  doctorSession: SessionInfo | null;
  queueWaitMin: number;
  travelBufferMin?: number;
  endMarginMin?: number;
}): ReturnAdvice {
  const s = a.doctorSession;
  if (!s || s.scheduledEndAt == null) return { kind: 'book_later', reason: 'no_session' };
  if (s.state === 'ended') return { kind: 'book_later', reason: 'session_ended' };
  const arrival = a.reportReadyAt + (a.travelBufferMin ?? 10) * MIN;
  const start = Math.max(arrival, s.state === 'not_started' ? (s.scheduledStartAt ?? arrival) : arrival) + a.queueWaitMin * MIN;
  if (start > s.scheduledEndAt - (a.endMarginMin ?? 10) * MIN) return { kind: 'book_later', reason: 'not_enough_time' };
  return { kind: 'same_day', expectedStartAt: start };
}
