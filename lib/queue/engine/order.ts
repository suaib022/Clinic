import type { DssSettings, QueueAppointment } from './types';
import { MIN } from './time';

/**
 * B3 counted time: booked time if the patient checked in within grace_min of it, otherwise the arrival time.
 * A rejoin after a skip counts from the rejoin. Mirrors SQL dss_counted_time().
 */
export function countedTime(a: QueueAppointment, s: Pick<DssSettings, 'graceMin'>): number {
  const base = a.checkedInAt == null || a.checkedInAt <= a.bookedAt + s.graceMin * MIN ? a.bookedAt : a.checkedInAt;
  return Math.max(base, a.rejoinedAt ?? -Infinity);
}

/** Emergency first, then priority, then normal; within a level by counted time; serial breaks ties. */
export function compareLine(a: QueueAppointment, b: QueueAppointment, s: Pick<DssSettings, 'graceMin'>): number {
  return b.priorityLevel - a.priorityLevel || countedTime(a, s) - countedTime(b, s) || a.serialNo - b.serialNo;
}

export interface QueueOrder {
  current: QueueAppointment | null;
  /** B2: only checked-in, not skipped patients are in the line. */
  line: QueueAppointment[];
  notArrived: QueueAppointment[];
  skipped: QueueAppointment[];
  done: QueueAppointment[];
  noShows: QueueAppointment[];
}

export function computeQueueOrder(appointments: QueueAppointment[], s: Pick<DssSettings, 'graceMin'>): QueueOrder {
  const by = (pred: (a: QueueAppointment) => boolean) => appointments.filter(pred);
  const current = by((a) => a.status === 'in_consultation').sort((a, b) => (b.consultStartedAt ?? 0) - (a.consultStartedAt ?? 0))[0] ?? null;
  return {
    current,
    line: by((a) => a.status === 'checked_in' && a.skippedAt == null).sort((a, b) => compareLine(a, b, s)),
    notArrived: by((a) => a.status === 'scheduled' && a.skippedAt == null).sort((a, b) => a.bookedAt - b.bookedAt || a.serialNo - b.serialNo),
    skipped: by((a) => (a.status === 'scheduled' || a.status === 'checked_in') && a.skippedAt != null).sort((a, b) => a.serialNo - b.serialNo),
    done: by((a) => a.status === 'prescription_pending' || a.status === 'completed'),
    noShows: by((a) => a.status === 'no_show'),
  };
}
