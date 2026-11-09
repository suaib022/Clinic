// DSS-92/93/95: settings are admin-only, validated and logged; reports are admin-only.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { seed, signIn, db, closeDb } from '../../../scripts/dss/testkit';

let adminC: SupabaseClient, compA1: SupabaseClient, doctorA: SupabaseClient;
let original: Record<string, unknown>;

beforeAll(async () => {
  await seed();
  [adminC, compA1, doctorA] = await Promise.all([signIn('admin'), signIn('compA1'), signIn('doctorA')]);
  original = (await db().query('select grace_min, no_show_min from dss_settings where id = 1')).rows[0];
});
afterAll(async () => {
  await adminC.rpc('dss_update_settings', { p_values: original });
  await closeDb();
});

describe('settings', () => {
  it('staff can read but not change them', async () => {
    expect((await compA1.from('dss_settings').select('grace_min').single()).data).toBeTruthy();
    expect((await compA1.rpc('dss_update_settings', { p_values: { grace_min: 5 } })).error?.message).toMatch(/DSS_FORBIDDEN/);
    const direct = await doctorA.from('dss_settings').update({ grace_min: 1 }).eq('id', 1).select('id');
    expect(direct.data ?? []).toEqual([]);
  });
  it('admin changes are validated and logged', async () => {
    const before = (await db().query('select count(*)::int n from dss_settings_log')).rows[0].n;
    expect((await adminC.rpc('dss_update_settings', { p_values: { grace_min: 12 } })).error).toBeNull();
    expect((await db().query('select grace_min from dss_settings where id = 1')).rows[0].grace_min).toBe(12);
    expect((await db().query('select count(*)::int n from dss_settings_log')).rows[0].n).toBe(before + 1);
    expect((await adminC.rpc('dss_update_settings', { p_values: { grace_min: 60, no_show_min: 30 } })).error).toBeTruthy(); // grace < no-show
    expect((await adminC.rpc('dss_update_settings', { p_values: { hacked: 1 } })).error).toBeTruthy();
  });
});

describe('reports', () => {
  it('admin only, and the analytics backfill covers finished visits', async () => {
    expect((await compA1.rpc('dss_report', { p_from: '2026-01-01', p_to: '2026-12-31' })).error?.message).toMatch(/DSS_FORBIDDEN/);
    const r = await adminC.rpc('dss_report', { p_from: '2026-01-01', p_to: '2026-12-31' });
    expect(r.error).toBeNull();
    expect(Array.isArray(r.data)).toBe(true);
    const missing = await db().query(`select count(*)::int n from appointments a where a.status in ('completed','prescription_pending')
      and a.consult_started_at is not null and a.consult_ended_at > a.consult_started_at
      and not exists (select 1 from consultation_analytics_logs l where l.appointment_id = a.id)`);
    expect(missing.rows[0].n).toBe(0);
  });
});
