'use server';
import { revalidatePath } from 'next/cache';
import { getApiUser } from './server';
import { SettingsSchema, type SettingsValues } from './settingsSchema';

/** DSS-92: admin-only, validated here and by the database (CHECK constraints); every change is logged. */
export async function updateDssSettings(values: SettingsValues): Promise<{ ok: boolean; message: string }> {
  const u = await getApiUser();
  if (!u || u.role !== 'admin') return { ok: false, message: 'Admins only.' };
  const p = SettingsSchema.safeParse(values);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Invalid values.' };
  const { error } = await u.supabase.rpc('dss_update_settings', { p_values: p.data });
  if (error) return { ok: false, message: 'The database rejected these values.' };
  revalidatePath('/admin/queue-settings');
  return { ok: true, message: 'Settings saved. Screens use them on their next refresh.' };
}
