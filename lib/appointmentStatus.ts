export const APPOINTMENT_STATUSES = [
  'hold',
  'scheduled',
  'checked_in',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show'
] as const;

export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  hold: 'On Hold',
  scheduled: 'Scheduled',
  checked_in: 'Checked In',
  in_consultation: 'In Consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show'
};

export const STATUS_BADGE_COLORS: Record<AppointmentStatus, string> = {
  hold: 'bg-warning text-dark',
  scheduled: 'bg-primary',
  checked_in: 'bg-info text-dark',
  in_consultation: 'bg-secondary',
  completed: 'bg-success',
  cancelled: 'bg-danger',
  no_show: 'bg-dark'
};

export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  hold: ['scheduled', 'cancelled'],
  scheduled: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_consultation', 'no_show', 'cancelled'],
  in_consultation: ['completed'],
  completed: [],
  cancelled: [],
  no_show: ['scheduled'] // admin only
};

export function getStatusLabel(status: AppointmentStatus | string): string {
  if (status in STATUS_LABELS) {
    return STATUS_LABELS[status as AppointmentStatus];
  }
  return String(status);
}

export function getStatusBadgeColor(status: AppointmentStatus | string): string {
  if (status in STATUS_BADGE_COLORS) {
    return STATUS_BADGE_COLORS[status as AppointmentStatus];
  }
  return 'bg-secondary';
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  if (!ALLOWED_TRANSITIONS[from]) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}
