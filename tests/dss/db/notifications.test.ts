// DSS-50..54: one event → exactly one notification per person; own-only access; no medical text.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { seed, resetTestDoctors, signIn, book, key, db, closeDb, setTimes, type Seed } from '../../../scripts/dss/testkit';
import { runEngine } from '@/lib/queue/engine';
import { toEngineInput, toSyncPayload, type RawSnapshot } from '@/lib/queue/snapshotInput';

let s: Seed;
let compA1: SupabaseClient, compA2: SupabaseClient, patient1: SupabaseClient, patient2: SupabaseClient, doctorA: SupabaseClient;
const min = 60_000;

async function notes(userId: string, type?: string) {
  const { rows } = await db().query(
    `select type, title, body, dedupe_key, appointment_id from notifications where user_id = $1 ${type ? 'and type = $2' : ''} order by created_at`,
    type ? [userId, type] : [userId]
  );
  return rows as { type: string; title: string; body: string; dedupe_key: string; appointment_id: string }[];
}
async function clearNotes() {
  await db().query('delete from notifications where user_id = any($1)', [Object.values(s.users)]);
}
/** What a staff screen does after each load: engine → dss_sync_estimates. */
async function sync(c: SupabaseClient) {
  const { data, error } = await c.rpc('dss_snapshot_input', { p_doctor_id: s.users.doctorA });
  if (error) throw error;
  const input = toEngineInput(data as RawSnapshot);
  const { result, suggestions } = runEngine(input);
  const p = toSyncPayload(result, suggestions);
  const r = await c.rpc('dss_sync_estimates', { p_doctor_id: s.users.doctorA, p_items: p.items, p_suggestions: p.suggestions });
  if (r.error) throw r.error;
  return { result, suggestions };
}

beforeAll(async () => {
  s = await seed();
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  await clearNotes();
  [compA1, compA2, patient1, patient2, doctorA] = await Promise.all([
    signIn('compA1'), signIn('compA2'), signIn('patient1'), signIn('patient2'), signIn('doctorA'),
  ]);
});
afterAll(async () => {
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  await clearNotes();
  await closeDb();
});

describe('notifications from queue actions', () => {
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    const now = Date.now();
    ids.own = await book(s.patients.p1, s.users.doctorA, 1, new Date(now - 5 * min));
    ids.family = await book(s.patients.p1b, s.users.doctorA, 2, new Date(now));
    for (let i = 0; i < 4; i++) ids[`f${i}`] = await book(s.patients.fillers[i], s.users.doctorA, 3 + i, new Date(now + (i + 1) * 10 * min));
  });

  it('check-in before the session starts: patient told once, doctor told "a patient is waiting" once', async () => {
    const k = key();
    await compA1.rpc('dss_check_in', { p_appointment_id: ids.own, p_request_key: k });
    await compA1.rpc('dss_check_in', { p_appointment_id: ids.own, p_request_key: k }); // double tap
    expect(await notes(s.users.patient1, 'checked_in')).toHaveLength(1);
    await compA1.rpc('dss_check_in', { p_appointment_id: ids.family, p_request_key: key() });
    const doc = await notes(s.users.doctorA, 'patient_waiting');
    expect(doc).toHaveLength(1);
  });

  it("a family member's notification goes to the account owner with the member's name", async () => {
    const n = (await notes(s.users.patient1, 'checked_in')).find((x) => x.appointment_id === ids.family)!;
    expect(n.body).toMatch(/^For DSS Family Member: Serial 2/);
  });

  it('session start tells the other compounder, not the one who tapped', async () => {
    await compA1.rpc('dss_session_start', { p_doctor_id: s.users.doctorA, p_request_key: key() });
    expect(await notes(s.users.compA2, 'session_started')).toHaveLength(1);
    expect(await notes(s.users.compA1, 'session_started')).toHaveLength(0);
  });

  it('engine sync: "you are next" and "turn is near" are sent once, however often screens reload', async () => {
    for (const k of ['f0', 'f1']) await compA1.rpc('dss_check_in', { p_appointment_id: ids[k], p_request_key: key() });
    await sync(compA1);
    await sync(compA2);
    await sync(compA1);
    const p1 = await notes(s.users.patient1);
    expect(p1.filter((n) => n.type === 'next')).toHaveLength(1);           // serial 1 is first in line
    expect(p1.filter((n) => n.type === 'near_turn')).toHaveLength(1);      // family member, 1 ahead
    const p2near = await notes(s.users.patient2, 'near_turn');
    expect(p2near.length).toBe(2);                                         // fillers 0 and 1 (2 and 3 ahead)
  });

  it('call next: the called patient is told once', async () => {
    const r = await compA1.rpc('dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: null, p_request_key: key() });
    expect(r.data.started_serial).toBe(1);
    await compA2.rpc('dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: null, p_request_key: key() }); // stale
    expect(await notes(s.users.patient1, 'called')).toHaveLength(1);
  });

  it('expected time moving by 10+ minutes is announced once per move', async () => {
    // serial 1 has been in the room since 25 minutes ago: everyone waiting moves
    await setTimes(ids.own, { consult_started_at: new Date(Date.now() - 25 * min), checked_in_at: new Date(Date.now() - 30 * min) });
    await db().query(`update dss_appointment_tracking set last_notified_eta = last_eta - interval '12 minutes' where appointment_id = $1`, [ids.f0]);
    await sync(compA1);
    await sync(compA1);
    expect((await notes(s.users.patient2, 'eta_changed')).filter((n) => n.appointment_id === ids.f0)).toHaveLength(1);
  });

  it('delay broadcast reaches each waiting / not-arrived patient exactly once', async () => {
    const k = key();
    await compA1.rpc('dss_broadcast_delay', { p_doctor_id: s.users.doctorA, p_minutes: 25, p_request_key: k });
    await compA1.rpc('dss_broadcast_delay', { p_doctor_id: s.users.doctorA, p_minutes: 25, p_request_key: k });
    const p2 = await notes(s.users.patient2, 'doctor_delay');
    expect(p2).toHaveLength(4); // fillers 0..3 (2 waiting, 2 not arrived)
    // fillers are family members on patient 2's account, so each notice names them
    expect(p2.map((n) => n.body).sort()[0]).toBe('For DSS Filler 1: The doctor is running about 25 min late. Your expected time has moved.');
    expect(await notes(s.users.patient1, 'doctor_delay')).toHaveLength(1); // family member still waiting; serial 1 is in the room
  });

  it('pause / resume tell waiting patients; no-show tells the patient with a rebook link', async () => {
    await doctorA.rpc('dss_session_pause', { p_doctor_id: s.users.doctorA, p_reason: 'Prayer', p_request_key: key() });
    await doctorA.rpc('dss_session_resume', { p_doctor_id: s.users.doctorA, p_request_key: key() });
    expect(await notes(s.users.patient2, 'session_paused')).toHaveLength(4);
    expect(await notes(s.users.patient2, 'session_resumed')).toHaveLength(4);
    expect(await notes(s.users.compA1, 'session_paused')).toHaveLength(1);
    await setTimes(ids.f3, { scheduled_start: new Date(Date.now() - 45 * min) });
    await compA1.rpc('dss_mark_no_show', { p_appointment_id: ids.f3, p_reason: '', p_request_key: key() });
    const ns = await db().query(`select link from notifications where user_id = $1 and type = 'no_show'`, [s.users.patient2]);
    expect(ns.rows).toEqual([{ link: '/patient/book' }]);
  });

  it('warning/urgent suggestions reach compounders once per day', async () => {
    const { suggestions } = await sync(compA1);
    await sync(compA2);
    const warn = suggestions.filter((x) => x.severity !== 'info');
    const got = await notes(s.users.compA2, 'suggestion');
    expect(got.length).toBe(warn.length);
  });

  it('no notification text contains medical words', async () => {
    const { rows } = await db().query(`select title || ' ' || body t from notifications where user_id = any($1)`, [Object.values(s.users)]);
    for (const r of rows) expect(r.t).not.toMatch(/diagnos|prescri|medic|symptom|disease|lab result/i);
  });
});

describe('notification access rules', () => {
  it('users read only their own notifications', async () => {
    const own = await patient1.from('notifications').select('user_id');
    expect(own.error).toBeNull();
    expect(own.data!.length).toBeGreaterThan(0);
    expect(new Set(own.data!.map((r) => r.user_id))).toEqual(new Set([s.users.patient1]));
    const theirs = await patient2.from('notifications').select('id').eq('user_id', s.users.patient1);
    expect(theirs.data).toEqual([]);
  });
  it('users can mark their own as read, and nothing else', async () => {
    const { data } = await patient1.from('notifications').select('id').limit(1);
    const id = data![0].id;
    expect((await patient1.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)).error).toBeNull();
    const edit = await patient1.from('notifications').update({ body: 'hacked' }).eq('id', id);
    expect(edit.error).toBeTruthy();
    const other = await patient2.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).select('id');
    expect(other.data ?? []).toEqual([]);
    const ins = await patient1.from('notifications').insert({ user_id: s.users.patient1, type: 'x', title: 'x', body: 'x', dedupe_key: 'x' });
    expect(ins.error).toBeTruthy();
  });
  it('patients cannot run the estimate sync', async () => {
    const r = await patient1.rpc('dss_sync_estimates', { p_doctor_id: s.users.doctorA, p_items: [], p_suggestions: [] });
    expect(r.error).toBeTruthy();
  });
});
