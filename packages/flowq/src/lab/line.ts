import type { ApptStatus, QueueAppointment, QueueResult } from '../engine/types';
import { computeEstimates } from '../engine/estimates';
import type { LabItem, LineInput } from './types';

const STATUS: Record<LabItem['status'], ApptStatus> = {
  queued: 'checked_in', called: 'in_consultation', collected: 'completed', skipped: 'checked_in', cancelled: 'cancelled',
};

/** A lab item seen by the engine: a walk-in counted from the moment it joined the line. */
function toAppointment(x: LabItem, i: number): QueueAppointment {
  return {
    id: x.id,
    serialNo: i + 1,
    status: STATUS[x.status],
    bookedAt: x.queuedAt,
    checkedInAt: x.queuedAt,
    consultStartedAt: x.calledAt ?? null,
    consultEndedAt: x.status === 'collected' ? (x.collectedAt ?? null) : null,
    skippedAt: x.status === 'skipped' ? x.queuedAt : null,
    priorityLevel: x.priorityLevel,
    visitType: 'new',
    visitSource: 'walk_in',
  };
}

/** Expected call times for everyone in one lab line. Same rules as the doctor queue, with the line's own durations. */
export function computeLineEstimates(input: LineInput): QueueResult {
  const ordered = [...input.items].sort((a, b) => a.queuedAt - b.queuedAt || a.id.localeCompare(b.id));
  return computeEstimates({
    now: input.now,
    settings: input.settings,
    session: input.session,
    appointments: ordered.map(toAppointment),
    history: { new: input.history, follow_up: [] },
    slotMinutes: input.line.typicalMin,
  });
}

/** Minutes until a normal-priority patient joining now would be called. Infinity when the line is closed. */
export function expectedWaitMin(result: QueueResult): number {
  const state = result.session.state;
  if (state === 'ended' || state === 'not_started') return Infinity;
  return result.doctorFreeInMin + result.line.length * result.durations.new.typical;
}
