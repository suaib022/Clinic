import type { DssSettings, DurationStats, Durations, QueueAppointment } from './types';
import { clamp } from './time';

/** The per-visit minutes added up for people ahead: the median (DSS rule) or the mean (settings.sumWith). */
export const perVisitMin = (d: DurationStats, s: Pick<DssSettings, 'sumWith'>): number => (s.sumWith === 'mean' ? d.mean : d.typical);

/** Expected length of one visit: report reviews use the fixed setting, other visits their visit type's stats. */
export function durationOf(a: QueueAppointment, d: Durations, s: DssSettings): DurationStats {
  if (a.visitReason !== 'report_review') return d[a.visitType];
  const c = (v: number) => clamp(v, s.durationClampMin, s.durationClampMax);
  return { typical: c(s.reportReviewMin), mean: c(s.reportReviewMin), sd: (c(s.reportReviewMin * 1.4) - c(s.reportReviewMin * 0.7)) / 1.349, short: c(s.reportReviewMin * 0.7), long: c(s.reportReviewMin * 1.4), source: 'slot', samples: 0 };
}
