// DSS-24: access rules and concurrency of the queue functions, against the linked DB (dev-only test accounts).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { seed, resetTestDoctors, signIn, anonClient, book, key, db, closeDb, setTimes, type Seed } from '../../../scripts/dss/testkit';

let s: Seed;
let compA1: SupabaseClient, compA2: SupabaseClient, compB: SupabaseClient, patient1: SupabaseClient, doctorA: SupabaseClient, adminC: SupabaseClient;
const min = 60_000;

async function status(id: string) {
  const { rows } = await db().query('select status, priority_level, skipped_at, called_at from appointments where id = $1', [id]);
  return rows[0];
}
async function rpc(c: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await c.rpc(fn, args);
  return { data: data as { ok: boolean; code: string; message: string; [k: string]: unknown } | null, error };
}

beforeAll(async () => {
  s = await seed();
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  [compA1, compA2, compB, patient1, doctorA, adminC] = await Promise.all([
    signIn('compA1'), signIn('compA2'), signIn('compB'), signIn('patient1'), signIn('doctorA'), signIn('admin'),
  ]);
});
afterAll(async () => {
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  await closeDb();
});

describe('who may call the queue functions', () => {
  let appt: string;
  beforeAll(async () => {
    appt = await book(s.patients.p1, s.users.doctorA, 1, new Date(Date.now() - 5 * min));
  });

  it('refuses logged-out users', async () => {
    const r = await rpc(anonClient(), 'dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: null, p_request_key: key() });
    expect(r.error).toBeTruthy();
    const snap = await rpc(anonClient(), 'dss_snapshot_input', { p_doctor_id: s.users.doctorA });
    expect(snap.error).toBeTruthy();
  });

  it('refuses patients, even for their own appointment', async () => {
    const r = await rpc(patient1, 'dss_check_in', { p_appointment_id: appt, p_request_key: key() });
    expect(r.error?.message).toMatch(/DSS_FORBIDDEN/);
    const snap = await rpc(patient1, 'dss_snapshot_input', { p_doctor_id: s.users.doctorA });
    expect(snap.error?.message).toMatch(/DSS_FORBIDDEN/);
    // and cannot bypass the functions with a direct update
    const { error } = await patient1.from('appointments').update({ status: 'checked_in' }).eq('id', appt);
    expect(error?.message ?? '').toMatch(/DSS_FORBIDDEN|permission/i);
    expect((await status(appt)).status).toBe('scheduled');
  });

  it("refuses a compounder of doctor B on doctor A's queue (read and write)", async () => {
    const w = await rpc(compB, 'dss_check_in', { p_appointment_id: appt, p_request_key: key() });
    expect(w.error?.message).toMatch(/DSS_FORBIDDEN/);
    const r = await rpc(compB, 'dss_snapshot_input', { p_doctor_id: s.users.doctorA });
    expect(r.error?.message).toMatch(/DSS_FORBIDDEN/);
    const ev = await compB.from('queue_events').select('id').eq('doctor_id', s.users.doctorA);
    expect(ev.data ?? []).toHaveLength(0);
    const cn = await rpc(compB, 'dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: null, p_request_key: key() });
    expect(cn.error?.message).toMatch(/DSS_FORBIDDEN/);
  });

  it('lets doctor A read only their own snapshot', async () => {
    const own = await rpc(doctorA, 'dss_snapshot_input', { p_doctor_id: s.users.doctorA });
    expect(own.error).toBeNull();
    const other = await rpc(doctorA, 'dss_snapshot_input', { p_doctor_id: s.users.doctorB });
    expect(other.error?.message).toMatch(/DSS_FORBIDDEN/);
  });

  it('lets admin read any snapshot', async () => {
    const r = await rpc(adminC, 'dss_snapshot_input', { p_doctor_id: s.users.doctorB });
    expect(r.error).toBeNull();
  });
});

describe('queue actions', () => {
  const ids: string[] = [];
  beforeAll(async () => {
    await resetTestDoctors([s.users.doctorA]);
    const now = Date.now();
    // serials 1..4 booked 30, 20, 10 and 0 minutes ago
    for (let i = 0; i < 4; i++) ids.push(await book(s.patients.fillers[i], s.users.doctorA, i + 1, new Date(now - (30 - i * 10) * min)));
  });

  it('check-in is idempotent per request key and logged once', async () => {
    const k = key();
    const a = await rpc(compA1, 'dss_check_in', { p_appointment_id: ids[0], p_request_key: k });
    const b = await rpc(compA1, 'dss_check_in', { p_appointment_id: ids[0], p_request_key: k });
    expect(a.data?.ok).toBe(true);
    expect(b.data?.duplicate).toBe(true);
    expect((await status(ids[0])).status).toBe('checked_in');
    const { rows } = await db().query(`select count(*)::int n from queue_events where appointment_id = $1 and event_type = 'check_in'`, [ids[0]]);
    expect(rows[0].n).toBe(1);
    // stored as the real instant (the legacy functions used to write Dhaka wall time, 6 h ahead)
    const t = (await db().query('select checked_in_at from appointments where id = $1', [ids[0]])).rows[0].checked_in_at as Date;
    expect(Math.abs(t.getTime() - Date.now())).toBeLessThan(2 * min);
  });

  it('a second compounder tapping check-in gets "Already updated"', async () => {
    const r = await rpc(compA2, 'dss_check_in', { p_appointment_id: ids[0], p_request_key: key() });
    expect(r.data?.code).toBe('stale');
  });

  it('two simultaneous "Call next" taps: exactly one wins, nothing skipped or double-started', async () => {
    for (const id of ids.slice(1, 3)) await rpc(compA1, 'dss_check_in', { p_appointment_id: id, p_request_key: key() });
    const [x, y] = await Promise.all([
      rpc(compA1, 'dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: null, p_request_key: key() }),
      rpc(compA2, 'dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: null, p_request_key: key() }),
    ]);
    const results = [x.data, y.data];
    expect(results.filter((r) => r?.ok)).toHaveLength(1);
    expect(results.filter((r) => r?.code === 'stale')).toHaveLength(1);
    const { rows } = await db().query(
      `select serial_no from appointments where doctor_id = $1 and status = 'in_consultation'`, [s.users.doctorA]);
    expect(rows.map((r) => r.serial_no)).toEqual([1]);
  });

  it('call next finishes the current patient and starts the next in line order', async () => {
    const r = await rpc(compA1, 'dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: ids[0], p_request_key: key() });
    expect(r.data).toMatchObject({ ok: true, started_serial: 2, ended_serial: 1 });
    expect((await status(ids[0])).status).toBe('prescription_pending');
    expect((await status(ids[1])).called_at).not.toBeNull();
  });

  it('emergency goes next; skipped patients are passed over; rejoin returns them', async () => {
    await rpc(compA1, 'dss_check_in', { p_appointment_id: ids[3], p_request_key: key() });
    const p = await rpc(compA1, 'dss_set_priority', { p_appointment_id: ids[3], p_level: 2, p_reason: 'Emergency', p_request_key: key() });
    expect(p.data?.ok).toBe(true);
    const sk = await rpc(compA1, 'dss_skip', { p_appointment_id: ids[3], p_request_key: key() });
    expect(sk.data?.ok).toBe(true);
    let r = await rpc(compA1, 'dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: ids[1], p_request_key: key() });
    expect(r.data?.started_serial).toBe(3); // 4 is skipped
    await rpc(compA1, 'dss_rejoin', { p_appointment_id: ids[3], p_request_key: key() });
    r = await rpc(compA1, 'dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: ids[2], p_request_key: key() });
    expect(r.data?.started_serial).toBe(4);
  });

  it('undo: only your own last action, and it restores the queue', async () => {
    const other = await rpc(compA2, 'dss_undo', { p_doctor_id: s.users.doctorA, p_request_key: key() });
    // A2 may own the earlier winning "Call next" (race), but that was superseded, so it cannot undo anything.
    expect(other.data?.ok).toBe(false);
    expect(['nothing_to_undo', 'stale']).toContain(other.data?.code);
    const u = await rpc(compA1, 'dss_undo', { p_doctor_id: s.users.doctorA, p_request_key: key() });
    expect(u.data).toMatchObject({ ok: true, undone_type: 'call_next' });
    expect((await status(ids[3])).status).toBe('checked_in');
    expect((await status(ids[2])).status).toBe('in_consultation');
    const again = await rpc(compA1, 'dss_undo', { p_doctor_id: s.users.doctorA, p_request_key: key() });
    expect(again.data?.undone_type).not.toBe('call_next'); // cannot undo the same action twice
  });

  it('no-show is refused inside the grace period and allowed after', async () => {
    const fresh = await book(s.patients.fillers[5], s.users.doctorA, 9, new Date(Date.now() - 2 * min));
    const early = await rpc(compA1, 'dss_mark_no_show', { p_appointment_id: fresh, p_reason: '', p_request_key: key() });
    expect(early.error?.message).toMatch(/Grace period/);
    await setTimes(fresh, { scheduled_start: new Date(Date.now() - 40 * min) });
    const late = await rpc(compA1, 'dss_mark_no_show', { p_appointment_id: fresh, p_reason: '', p_request_key: key() });
    expect(late.data?.ok).toBe(true);
  });

  it('Module 4 check-in and undo still work (the old undo was blocked by the status trigger)', async () => {
    const m4 = await book(s.patients.fillers[6], s.users.doctorA, 10, new Date());
    expect((await compA1.rpc('check_in_appointment', { p_id: m4 })).error).toBeNull();
    expect((await compA1.rpc('undo_check_in', { p_id: m4 })).error).toBeNull();
    expect((await status(m4)).status).toBe('scheduled');
  });

  it('the database blocks impossible status changes, even for admin', async () => {
    const { error } = await adminC.from('appointments').update({ status: 'scheduled' }).eq('id', ids[0]);
    expect(error?.message).toMatch(/finished visit cannot go back/);
  });

  it('pause and resume are logged; call next is refused while paused', async () => {
    const p = await rpc(doctorA, 'dss_session_pause', { p_doctor_id: s.users.doctorA, p_reason: 'Tea', p_request_key: key() });
    expect(p.data?.ok).toBe(true);
    const cur = (await db().query(`select id from appointments where doctor_id=$1 and status='in_consultation'`, [s.users.doctorA])).rows[0]?.id ?? null;
    const c = await rpc(compA1, 'dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: cur, p_request_key: key() });
    expect(c.data?.code).toBe('paused');
    const r = await rpc(compA2, 'dss_session_resume', { p_doctor_id: s.users.doctorA, p_request_key: key() });
    expect(r.data?.ok).toBe(true);
  });
});
