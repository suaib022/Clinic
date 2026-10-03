import { format as fnsFormat, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'Asia/Dhaka';

export function todayDhaka(): string {
  return fnsFormat(toZonedTime(new Date(), TIMEZONE), 'yyyy-MM-dd');
}

export function nowDhaka(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

export function formatDate(dateStr: string): string {
  return fnsFormat(parseISO(dateStr), 'MMM d, yyyy');
}

export function formatTime(timeStr: string): string {
  // timeStr like "09:30:00" or "09:30"
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatDateTime(dateStr: string): string {
  try {
    const d = toZonedTime(parseISO(dateStr), TIMEZONE);
    return fnsFormat(d, 'MMM d, yyyy h:mm a');
  } catch {
    return dateStr;
  }
}

export function formatTimeOnly(dateStr: string): string {
  try {
    const d = toZonedTime(parseISO(dateStr), TIMEZONE);
    return fnsFormat(d, 'h:mm a');
  } catch {
    return dateStr;
  }
}
