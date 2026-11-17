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

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 erf, absolute error < 1.5e-7). */
export function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Inverse of the standard normal CDF (Acklam's rational approximation, relative error < 1.2e-9). */
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) throw new Error('normalQuantile: p must be in (0, 1)');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
