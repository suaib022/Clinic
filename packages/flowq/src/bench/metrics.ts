import type { Prediction, SimDay } from '../sim/simulate';
import { percentile } from '../engine/durations';
import { MIN } from '../engine/time';

const meanOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

/** ETA quality over predictions whose real start is known. Errors in minutes; coverage only where a range exists. */
export interface EtaMetrics {
  n: number;
  mae: number | null;
  medianAe: number | null;
  /** 90th percentile of the absolute error (the bad cases patients remember). */
  p90Ae: number | null;
  /** Share of patients whose estimate was within 5 / 10 minutes of the real start. */
  within5: number | null;
  within10: number | null;
  coverage: number | null;
}

export function etaMetrics(preds: Prediction[]): EtaMetrics {
  const done = preds.filter((p) => p.actualStartAt != null);
  const errs = sorted(done.map((p) => Math.abs(p.predictedAt - p.actualStartAt!) / MIN));
  const ranged = done.filter((p) => p.low != null && p.high != null);
  return {
    n: done.length,
    mae: meanOf(errs),
    medianAe: errs.length ? percentile(errs, 0.5) : null,
    p90Ae: errs.length ? percentile(errs, 0.9) : null,
    within5: errs.length ? errs.filter((e) => e <= 5).length / errs.length : null,
    within10: errs.length ? errs.filter((e) => e <= 10).length / errs.length : null,
    coverage: ranged.length ? ranged.filter((p) => p.actualStartAt! >= p.low! && p.actualStartAt! <= p.high!).length / ranged.length : null,
  };
}

/** Waiting time per stage (doctor: check-in to call; lab: queue to call). One entry per visit, read from the engine's predictions. */
export function waitMetrics(day: SimDay): { stage: 'doctor' | 'lab'; meanMin: number | null; p90Min: number | null }[] {
  return (['doctor', 'lab'] as const).map((stage) => {
    const w = sorted(day.predictions
      .filter((p) => p.policy === 'engine' && p.stage === stage && p.actualStartAt != null)
      .map((p) => (p.actualStartAt! - p.madeAt) / MIN));
    return { stage, meanMin: meanOf(w), p90Min: w.length ? percentile(w, 0.9) : null };
  });
}

/** Minutes from a patient's first to last event, for patients who visited the lab. */
export function journeyMinutes(day: SimDay): number[] {
  const span = new Map<string, [number, number, boolean]>();
  for (const e of day.events) {
    const pid = e.objects.find((o) => o.type === 'patient')?.id;
    if (!pid || e.activity === 'book') continue;
    const s = span.get(pid) ?? [e.time, e.time, false];
    span.set(pid, [Math.min(s[0], e.time), Math.max(s[1], e.time), s[2] || e.activity === 'sample_collected']);
  }
  return [...span.values()].filter((s) => s[2]).map(([a, b]) => (b - a) / MIN);
}

export { meanOf, sorted };
