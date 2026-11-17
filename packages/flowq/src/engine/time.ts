import type { Pause } from './types';

export const MIN = 60_000;

export const minutesBetween = (from: number, to: number) => (to - from) / MIN;

/** Minutes in [from, to] that were not inside a pause (B4: paused time is never counted). */
export function activeMinutes(from: number, to: number, pauses: Pause[], now: number): number {
  if (to <= from) return 0;
  let paused = 0;
  for (const p of pauses) {
    const end = p.resumedAt ?? now;
    const overlap = Math.min(end, to) - Math.max(p.pausedAt, from);
    if (overlap > 0) paused += overlap;
  }
  return Math.max(0, (to - from - paused) / MIN);
}

/** Round to the nearest 5 minutes (wait ranges shown to patients). */
export const round5 = (m: number) => Math.max(0, Math.round(m / 5) * 5);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
