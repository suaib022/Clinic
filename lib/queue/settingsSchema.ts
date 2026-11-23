// Validation for the admin queue settings. Pure (no Next / Supabase) so it is unit-tested; mirrors the table CHECK constraints.
import { z } from 'zod';

const n = (lo: number, hi: number) => z.number().int().min(lo).max(hi);
const x = (lo: number, hi: number) => z.number().min(lo).max(hi);
export const SettingsSchema = z.object({
  on_time_band_min: n(0, 60), late_band_min: n(1, 180), grace_min: n(0, 120), no_show_min: n(1, 240),
  doctor_late_alert_min: n(1, 240), near_turn_count: n(1, 20), undo_window_sec: n(10, 900), min_duration_samples: n(1, 30),
  default_slot_min: n(1, 120), duration_clamp_min: n(1, 60), duration_clamp_max: n(5, 240),
  // Full engine (used only when engine_mode is 'full'); ranges match the table CHECK constraints.
  engine_mode: z.enum(['dss', 'full']), report_review_min: n(1, 30), history_window: n(10, 500),
  sum_with: z.enum(['median', 'mean']), expect_arrivals: z.boolean(), show_p: x(0.05, 1), walk_in_per_hour: x(0, 30),
  lateness_mean_min: x(-60, 60), lateness_sd_min: x(0, 60), range_method: z.enum(['quartile_sum', 'normal_sum']),
  range_coverage: x(0.5, 0.99),
}).refine((s) => s.on_time_band_min < s.late_band_min, 'On-time band must be smaller than the late band.')
  .refine((s) => s.grace_min < s.no_show_min, 'Grace must be shorter than the no-show time.')
  .refine((s) => s.duration_clamp_min < s.duration_clamp_max, 'Minimum visit length must be below the maximum.');
export type SettingsValues = z.infer<typeof SettingsSchema>;
