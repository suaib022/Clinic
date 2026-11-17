import type { DssSettings, DurationStats, Durations, VisitType } from './types';
import { clamp } from './time';

/** Value p of the way up the sorted list (linear interpolation; p=0.5 is the median). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Mean residual life: among past visits that lasted longer than `elapsedMin`, the average time they still took.
 * Null when fewer than `minSamples` past visits were that long (the caller falls back).
 */
export function residualMin(history: number[], elapsedMin: number, minSamples = 3): number | null {
  const longer = history.filter((v) => Number.isFinite(v) && v > elapsedMin);
  if (longer.length < minSamples) return null;
  return longer.reduce((a, v) => a + (v - elapsedMin), 0) / longer.length;
}

/** Sample standard deviation (n - 1). */
export function sampleSd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

// Without enough history there is no spread to measure; these factors give a plausible range around the typical value.
const SHORT_FACTOR = 0.7;
const LONG_FACTOR = 1.4;

function stats(
  values: number[],
  departmentAvgMin: number | null | undefined,
  slotMin: number,
  s: Pick<DssSettings, 'minDurationSamples' | 'durationClampMin' | 'durationClampMax' | 'historyWindow'>
): DurationStats {
  const c = (v: number) => clamp(v, s.durationClampMin, s.durationClampMax);
  const last30 = values.filter((v) => Number.isFinite(v) && v > 0).slice(0, s.historyWindow ?? 30);
  if (last30.length >= s.minDurationSamples) {
    const sorted = [...last30].sort((a, b) => a - b);
    return {
      typical: c(percentile(sorted, 0.5)),
      mean: c(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      sd: sampleSd(sorted),
      short: c(percentile(sorted, 0.25)),
      long: c(percentile(sorted, 0.75)),
      source: 'history',
      samples: last30.length,
    };
  }
  const base = departmentAvgMin && departmentAvgMin > 0 ? departmentAvgMin : slotMin;
  const source = departmentAvgMin && departmentAvgMin > 0 ? 'department' : 'slot';
  return { typical: c(base), mean: c(base), sd: (c(base * LONG_FACTOR) - c(base * SHORT_FACTOR)) / 1.349, short: c(base * SHORT_FACTOR), long: c(base * LONG_FACTOR), source, samples: last30.length };
}

/**
 * B4: how long one visit takes, per visit type.
 * 1) median of the doctor's last 30 finished visits of that type (needs min_duration_samples),
 * 2) else the department average, 3) else the doctor's slot length. Always clamped to [3, 60].
 */
export function computeExpectedDurations(args: {
  history: Record<VisitType, number[]>;
  departmentAvgMin?: number | null;
  slotMinutes?: number | null;
  settings: DssSettings;
}): Durations {
  const slot = args.slotMinutes && args.slotMinutes > 0 ? args.slotMinutes : args.settings.defaultSlotMin;
  return {
    new: stats(args.history.new ?? [], args.departmentAvgMin, slot, args.settings),
    follow_up: stats(args.history.follow_up ?? [], args.departmentAvgMin, slot, args.settings),
  };
}
