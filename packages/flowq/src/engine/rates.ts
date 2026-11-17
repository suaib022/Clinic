import type { QueueAppointment } from './types';
import { MIN } from './time';

const HOUR = 60 * MIN;

/**
 * Today's walk-in rate and show probability for one doctor, learned from the day so far and smoothed towards a prior
 * (the clinic's long-run values), so that one early walk-in does not swing the estimate:
 *   walkInPerHour = (prior rate x priorHours + walk-ins so far) / (priorHours + hours since the session start)
 *   showP         = (prior showP x priorBookings + booked patients who came) / (priorBookings + bookings already decided)
 * A booking is decided once the patient arrived or the slot is more than noShowMin old.
 * Report reviews are not walk-ins. Callers pass the result to the engine as walkInPerHour / showP.
 */
export function learnRates(a: {
  now: number;
  sessionStartAt: number;
  appointments: QueueAppointment[];
  prior: { walkInPerHour: number; showP: number };
  noShowMin: number;
  priorHours?: number;
  priorBookings?: number;
}): { walkInPerHour: number; showP: number } {
  const ph = a.priorHours ?? 1, pb = a.priorBookings ?? 10;
  const hours = Math.max(0, (a.now - a.sessionStartAt) / HOUR);
  const walkIns = a.appointments.filter((x) => x.visitSource === 'walk_in' && x.visitReason !== 'report_review'
    && x.checkedInAt != null && x.checkedInAt <= a.now && x.checkedInAt >= a.sessionStartAt).length;
  let decided = 0, came = 0;
  for (const x of a.appointments) {
    if (x.visitSource !== 'online') continue;
    const arrived = x.checkedInAt != null && x.checkedInAt <= a.now;
    if (arrived || x.bookedAt + a.noShowMin * MIN <= a.now) { decided++; if (arrived) came++; }
  }
  return {
    walkInPerHour: (a.prior.walkInPerHour * ph + walkIns) / (ph + hours),
    showP: (a.prior.showP * pb + came) / (pb + decided),
  };
}
