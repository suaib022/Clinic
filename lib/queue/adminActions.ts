'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getApiUser } from './server';

const n = (lo: number, hi: number) => z.number().int().min(lo).max(hi);
const Settings = z.object({
  on_time_band_min: n(0, 60), late_band_min: n(1, 180), grace_min: n(0, 120), no_show_min: n(1, 240),
  doctor_late_alert_min: n(1, 240), near_turn_count: n(1, 20), undo_window_sec: n(10, 900), min_duration_samples: n(1, 30),
  default_slot_min: n(1, 120), duration_clamp_min: n(1, 60), duration_clamp_max: n(5, 240),
}).refine((s) => s.on_time_band_min < s.late_band_min, 'On-time band must be smaller than the late band.')
  .refine((s) => s.grace_min < s.no_show_min, 'Grace must be shorter than the no-show time.')
  .refine((s) => s.duration_clamp_min < s.duration_clamp_max, 'Minimum visit length must be below the maximum.');
export type SettingsValues = z.infer<typeof Settings>;

/** DSS-92: admin-only, validated here and by the database (CHECK constraints); every change is logged. */
export async function updateDssSettings(values: SettingsValues): Promise<{ ok: boolean; message: string }> {
  const u = await getApiUser();
  if (!u || u.role !== 'admin') return { ok: false, message: 'Admins only.' };
  const p = Settings.safeParse(values);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Invalid values.' };
  const { error } = await u.supabase.rpc('dss_update_settings', { p_values: p.data });
  if (error) return { ok: false, message: 'The database rejected these values.' };
  revalidatePath('/admin/queue-settings');
  return { ok: true, message: 'Settings saved. Screens use them on their next refresh.' };
}
