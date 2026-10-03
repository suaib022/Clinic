import { AppointmentStatus } from './appointmentStatus';

export type UserRole = 'admin' | 'doctor' | 'compounder' | 'patient';

export const CHECKIN_UNDO_MINUTES = 5;
export const WALKIN_UNDO_MINUTES = 5;
export const NOSHOW_GRACE_MINUTES = 15;

export type AppointmentAction = 
  | 'check_in' 
  | 'undo_check_in' 
  | 'mark_no_show' 
  | 'set_priority' 
  | 'start_consultation' 
  | 'complete_consultation' 
  | 'cancel' 
  | 'retract_walk_in';

export interface ActionResult {
  allowed: boolean;
  reason?: string;
}

interface ActionContext {
  isToday: boolean;
  visitSource?: 'online' | 'walk_in';
  checkedInAt?: string | null;
  createdByUserId?: string | null;
  statusChangedBy?: string | null;
  currentUserId: string;
  scheduledStart?: string | null;
  createdAt?: string | null;
}

export function getAvailableActions(
  role: UserRole, 
  status: AppointmentStatus, 
  ctx: ActionContext
): Record<AppointmentAction, ActionResult> {
  const now = new Date();
  
  const results: Record<AppointmentAction, ActionResult> = {
    check_in: { allowed: false, reason: 'Not available' },
    undo_check_in: { allowed: false, reason: 'Not available' },
    mark_no_show: { allowed: false, reason: 'Not available' },
    set_priority: { allowed: false, reason: 'Not available' },
    start_consultation: { allowed: false, reason: 'Not available' },
    complete_consultation: { allowed: false, reason: 'Not available' },
    cancel: { allowed: false, reason: 'Not available' },
    retract_walk_in: { allowed: false, reason: 'Not available' },
  };

  if (role === 'compounder') {
    // Check in: only scheduled + today
    if (status === 'scheduled' && ctx.isToday) {
      results.check_in = { allowed: true };
    } else if (status === 'scheduled' && !ctx.isToday) {
      results.check_in = { allowed: false, reason: 'Can only check in today\'s appointments' };
    }

    // Undo check-in: only checked_in + by same compounder + within window
    if (status === 'checked_in' && ctx.statusChangedBy === ctx.currentUserId) {
      const checkedInAt = ctx.checkedInAt ? new Date(ctx.checkedInAt) : null;
      if (checkedInAt) {
        const minutesElapsed = (now.getTime() - checkedInAt.getTime()) / 60000;
        if (minutesElapsed <= CHECKIN_UNDO_MINUTES) {
          results.undo_check_in = { allowed: true };
        } else {
          results.undo_check_in = { allowed: false, reason: `Undo window (${CHECKIN_UNDO_MINUTES} min) has expired` };
        }
      }
    }

    // Mark no-show: scheduled + today + grace period passed
    if (status === 'scheduled' && ctx.isToday) {
      const scheduledStart = ctx.scheduledStart ? new Date(ctx.scheduledStart) : null;
      if (scheduledStart) {
        const minutesSinceScheduled = (now.getTime() - scheduledStart.getTime()) / 60000;
        if (minutesSinceScheduled >= NOSHOW_GRACE_MINUTES) {
          results.mark_no_show = { allowed: true };
        } else {
          const remaining = Math.ceil(NOSHOW_GRACE_MINUTES - minutesSinceScheduled);
          results.mark_no_show = { allowed: false, reason: `Grace period: ${remaining} min remaining` };
        }
      }
    }

    // Set priority: scheduled or checked_in
    if (['scheduled', 'checked_in'].includes(status)) {
      results.set_priority = { allowed: true };
    }

    // Retract walk-in: walk_in + checked_in + created by this user + within window
    if (status === 'checked_in' && ctx.visitSource === 'walk_in' && ctx.createdByUserId === ctx.currentUserId) {
      const createdAt = ctx.createdAt ? new Date(ctx.createdAt) : null;
      if (createdAt) {
        const minutesElapsed = (now.getTime() - createdAt.getTime()) / 60000;
        if (minutesElapsed <= WALKIN_UNDO_MINUTES) {
          results.retract_walk_in = { allowed: true };
        } else {
          results.retract_walk_in = { allowed: false, reason: `Retract window (${WALKIN_UNDO_MINUTES} min) has expired` };
        }
      }
    }

    // Compounder CANNOT: start, complete, cancel
    results.start_consultation = { allowed: false, reason: 'Only doctors can start consultations' };
    results.complete_consultation = { allowed: false, reason: 'Only doctors can complete consultations' };
    results.cancel = { allowed: false, reason: 'Compounders cannot cancel appointments' };
  }

  if (role === 'doctor') {
    if (status === 'scheduled' && ctx.isToday) results.check_in = { allowed: true };
    if (status === 'checked_in') results.start_consultation = { allowed: true };
    if (status === 'in_consultation') results.complete_consultation = { allowed: true };
    if (['scheduled', 'checked_in'].includes(status)) results.cancel = { allowed: true };
    if (['scheduled', 'checked_in'].includes(status)) results.set_priority = { allowed: true };
    if (status === 'scheduled' && ctx.isToday) results.mark_no_show = { allowed: true };
  }

  if (role === 'admin') {
    if (status === 'scheduled' && ctx.isToday) results.check_in = { allowed: true };
    if (status === 'checked_in') results.start_consultation = { allowed: true };
    if (status === 'in_consultation') results.complete_consultation = { allowed: true };
    if (!['completed', 'cancelled'].includes(status)) results.cancel = { allowed: true };
    if (['scheduled', 'checked_in'].includes(status)) results.set_priority = { allowed: true };
    if (status === 'scheduled') results.mark_no_show = { allowed: true };
    if (status === 'checked_in') results.undo_check_in = { allowed: true };
  }

  return results;
}
