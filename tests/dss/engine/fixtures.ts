import { DEFAULT_SETTINGS, type EngineInput, type QueueAppointment, type SessionInfo, type VisitType } from '@/lib/queue/engine';

/** Dhaka is UTC+6 all year. at(18, 40) = 6:40 PM Dhaka on the test day. */
export const at = (h: number, m = 0, s = 0) => Date.UTC(2026, 10, 10, h - 6, m, s);

/** 21 past visits whose middle is 9, quarter-way 6, three-quarter-way 13 (Dr. Rahman). */
export const RAHMAN_HISTORY = [4, 4, 5, 5, 5, 6, 7, 7, 8, 8, 9, 10, 11, 12, 12, 13, 14, 15, 16, 18, 20];

let n = 0;
export function appt(serial: number, booked: number, extra: Partial<QueueAppointment> = {}): QueueAppointment {
  return {
    id: `a${serial}-${++n}`,
    serialNo: serial,
    status: 'scheduled',
    bookedAt: booked,
    slotMinutes: 10,
    priorityLevel: 0,
    visitType: 'new',
    visitSource: 'online',
    ...extra,
  };
}
export const arrived = (serial: number, booked: number, checkedInAt: number, extra: Partial<QueueAppointment> = {}) =>
  appt(serial, booked, { status: 'checked_in', checkedInAt, ...extra });

export function activeSession(extra: Partial<SessionInfo> = {}): SessionInfo {
  return { state: 'active', scheduledStartAt: at(18), scheduledEndAt: at(21), startedAt: at(18), pauses: [], ...extra };
}

export function input(now: number, appointments: QueueAppointment[], extra: Partial<EngineInput> = {}): EngineInput {
  const history: Record<VisitType, number[]> = { new: RAHMAN_HISTORY, follow_up: RAHMAN_HISTORY };
  return {
    now, settings: DEFAULT_SETTINGS, session: activeSession(), appointments, history, slotMinutes: 10, ...extra,
  };
}
