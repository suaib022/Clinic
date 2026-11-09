// Display helpers shared by the queue screens (pure, client-safe).
import type { QueueResult, StatusLabel, SessionState, QueueAppointment, VisitType } from './engine';

const TZ = 'Asia/Dhaka';
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

export const fmtTime = (ms: number | null | undefined) => (ms == null ? '—' : timeFmt.format(ms));
export const fmtMin = (m: number | null | undefined) => (m == null ? '—' : `${Math.round(m)} min`);

export const LABEL_TEXT: Record<StatusLabel, string> = {
  early: 'Early', on_time: 'On time', running_late: 'Running late', delayed: 'Delayed', not_arrived: 'Not arrived',
};
export const LABEL_CLASS: Record<StatusLabel, string> = {
  early: 'bg-info text-dark', on_time: 'bg-success', running_late: 'bg-warning text-dark', delayed: 'bg-danger', not_arrived: 'bg-secondary',
};
export const SESSION_TEXT: Record<SessionState, string> = {
  not_started: 'Not started', active: 'Active', paused: 'Paused', ended: 'Ended',
};
export const SESSION_CLASS: Record<SessionState, string> = {
  not_started: 'bg-secondary', active: 'bg-success', paused: 'bg-warning text-dark', ended: 'bg-dark',
};
export const PRIORITY_TEXT = ['Normal', 'Priority', 'Emergency'] as const;

/** DSS-65: how much a walk-in pushes back the people who will be behind it. */
export function walkInImpact(
  snap: { result: Pick<QueueResult, 'line' | 'durations'>; appointments: QueueAppointment[]; serverNow: number },
  level: 0 | 1 | 2,
  visitType: VisitType
): { minutes: number; patients: number } {
  const byId = new Map(snap.appointments.map((a) => [a.id, a]));
  // Waiting patients with a lower level are passed by the walk-in; booked patients still to come will queue after it.
  const pushedInLine = snap.result.line.filter((id) => (byId.get(id)?.priorityLevel ?? 0) < level).length;
  const comingLater = snap.appointments.filter((a) => a.status === 'scheduled' && a.skippedAt == null && a.bookedAt > snap.serverNow).length;
  const patients = pushedInLine + comingLater;
  return { minutes: patients ? Math.round(snap.result.durations[visitType].typical) : 0, patients };
}

/** Front-desk search: serial (exact), UHID, mobile digits or name. */
export function matchesSearch(a: QueueAppointment, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  if (/^\d{1,4}$/.test(s) && a.serialNo === Number(s)) return true;
  const digits = s.replace(/\D/g, '');
  return (
    (a.patientUhid ?? '').toLowerCase().includes(s) ||
    (a.patientName ?? '').toLowerCase().includes(s) ||
    (digits.length >= 4 && (a.patientMobile ?? '').replace(/\D/g, '').includes(digits))
  );
}
