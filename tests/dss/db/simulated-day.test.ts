// DSS-100: a full clinic day on the linked DB with the dev test accounts, checked after every step:
// line order (DB "Call next" == engine), no serial skipped or repeated, notifications exactly once,
// role isolation, and the final report numbers.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { seed, resetTestDoctors, signIn, book, key, db, closeDb, setTimes, dhakaTime, type Seed } from '../../../scripts/dss/testkit';
import { runEngine } from '@/lib/queue/engine';
import { toEngineInput, toSyncPayload, type RawSnapshot } from '@/lib/queue/snapshotInput';

const MIN = 60_000;
let s: Seed;
let comp: SupabaseClient, comp2: SupabaseClient, compB: SupabaseClient, doctor: SupabaseClient;
const ids: string[] = []; // serial n → ids[n-1]
const started: number[] = [];

async function engine() {
  const { data, error } = await comp.rpc('dss_snapshot_input', { p_doctor_id: s.users.doctorA });
  if (error) throw error;
  const input = toEngineInput(data as RawSnapshot);
  const out = runEngine(input);
  const p = toSyncPayload(out.result, out.suggestions);
  await comp.rpc('dss_sync_estimates', { p_doctor_id: s.users.doctorA, p_items: p.items, p_suggestions: p.suggestions });
  const serial = (id: string) => input.appointments.find((a) => a.id === id)!.serialNo;
  return { ...out, input, lineSerials: out.result.line.map(serial) };
}
const ok = (r: { data: { ok: boolean; message?: string } | null; error: unknown }) => {
  expect(r.error).toBeNull();
  expect(r.data?.ok, r.data?.message).toBe(true);
  return r.data as unknown as Record<string, unknown>;
};
/** One "Call next" exactly like the screen: expected current from the snapshot; must start engine line[0]. */
async function callNext() {
  const e = await engine();
  const expected = e.lineSerials[0];
  const r = ok(await comp.rpc('dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: e.result.nowServing?.appointmentId ?? null, p_request_key: key() }));
  if (expected != null) {
    expect(r.started_serial).toBe(expected);
    started.push(expected);
  }
  return r;
}
const checkIn = async (serial: number) => ok(await comp.rpc('dss_check_in', { p_appointment_id: ids[serial - 1], p_request_key: key() }));
const count = async (sql: string, args: unknown[]) => (await db().query(sql, args)).rows[0].n as number;

beforeAll(async () => {
  s = await seed();
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  await db().query('delete from notifications where user_id = any($1)', [Object.values(s.users)]);
  [comp, comp2, compB, doctor] = await Promise.all([signIn('compA1'), signIn('compA2'), signIn('compB'), signIn('doctorA')]);
  const slot0 = Date.now() - 50 * MIN; // session "started" 50 min ago on paper
  await db().query(`update doctor_schedules set start_time = $2::time, end_time = '23:59'
                    where doctor_id = $1 and day_of_week = extract(dow from (now() at time zone 'Asia/Dhaka'))`, [s.users.doctorA, dhakaTime(new Date(slot0))]);
  const people = [s.patients.p1, s.patients.p1b, ...s.patients.fillers.slice(0, 7)];
  for (let i = 0; i < 9; i++) ids.push(await book(people[i], s.users.doctorA, i + 1, new Date(slot0 + i * 10 * MIN), i % 3 === 2 ? 'follow_up' : 'new'));
});
afterAll(async () => {
  await db().query(`update doctor_schedules set start_time = '00:00' where doctor_id = $1`, [s.users.doctorA]);
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  await closeDb();
});

describe('a full clinic day', () => {
  it('the doctor starts late; the other compounder is told once', async () => {
    const r = ok(await doctor.rpc('dss_session_start', { p_doctor_id: s.users.doctorA, p_request_key: key() }));
    expect(Number(r.delay_minutes)).toBeGreaterThanOrEqual(45);
    expect(await count(`select count(*)::int n from notifications where user_id = $1 and type = 'session_started'`, [s.users.compA2])).toBe(1);
  });

  it('patients arrive (one early, two late); late arrivals do not jump the on-time early bird', async () => {
    await checkIn(1); await checkIn(2); await checkIn(3);
    await setTimes(ids[0], { checked_in_at: new Date(Date.now() - 55 * MIN) }); // serial 1 was on time
    await checkIn(9); // booked 30 min from now: early arrival, counted at its booked time
    const e = await engine();
    expect(e.lineSerials).toEqual([1, 2, 3, 9]);
    expect(e.result.estimates[ids[8]].label).not.toBe('delayed');
  });

  it('call next follows the line; an emergency walk-in goes next', async () => {
    await callNext(); // 1
    const w = ok(await comp.rpc('dss_walk_in', { p_doctor_id: s.users.doctorA, p_patient_id: s.patients.fillers[8], p_visit_type: 'new', p_level: 2, p_reason: 'Emergency', p_request_key: key() }));
    const emergencySerial = Number(w.serial_no);
    expect((await engine()).lineSerials[0]).toBe(emergencySerial);
    await callNext(); // emergency
    expect(started).toEqual([1, emergencySerial]);
  });

  it('a normal walk-in queues by its arrival time', async () => {
    const w = ok(await comp.rpc('dss_walk_in', { p_doctor_id: s.users.doctorA, p_patient_id: s.patients.fillers[9], p_visit_type: 'follow_up', p_level: 0, p_reason: '', p_request_key: key() }));
    const e = await engine();
    expect(e.lineSerials).toEqual([2, 3, Number(w.serial_no), 9]);
  });

  it('two no-shows (suggested, then confirmed); a skipped late patient rejoins', async () => {
    for (const serial of [4, 5]) await setTimes(ids[serial - 1], { scheduled_start: new Date(Date.now() - 40 * MIN) });
    const sug = (await engine()).suggestions;
    for (const serial of [4, 5]) expect(sug.some((x) => x.key === `no_show:${ids[serial - 1]}`)).toBe(true);
    for (const serial of [4, 5]) ok(await comp2.rpc('dss_mark_no_show', { p_appointment_id: ids[serial - 1], p_reason: '', p_request_key: key() }));
    ok(await comp.rpc('dss_skip', { p_appointment_id: ids[5], p_request_key: key() })); // serial 6 not here yet
    await setTimes(ids[5], { scheduled_start: new Date(Date.now() - 25 * MIN) });
    await checkIn(6); // arrives late: check-in clears the skip, counted from arrival
    const e = await engine();
    // B3: the late arrival counts from now, so it lands after everyone already waiting but before serial 9 (booked later)
    expect(e.lineSerials.slice(-2)).toEqual([6, 9]);
  });

  it('pause and resume: call next refused while paused; nothing double-counted', async () => {
    ok(await doctor.rpc('dss_session_pause', { p_doctor_id: s.users.doctorA, p_reason: 'Prayer', p_request_key: key() }));
    const e = await engine();
    expect(e.result.session.state).toBe('paused');
    const r = await comp.rpc('dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: e.result.nowServing?.appointmentId ?? null, p_request_key: key() });
    expect(r.data.code).toBe('paused');
    ok(await doctor.rpc('dss_session_resume', { p_doctor_id: s.users.doctorA, p_request_key: key() }));
  });

  it('delay broadcast reaches every patient still to be seen, once', async () => {
    const todo = await count(`select count(*)::int n from appointments where doctor_id = $1 and appointment_date = (now() at time zone 'Asia/Dhaka')::date and status in ('scheduled','checked_in')`, [s.users.doctorA]);
    const k = key();
    ok(await comp.rpc('dss_broadcast_delay', { p_doctor_id: s.users.doctorA, p_minutes: 25, p_request_key: k }));
    await comp.rpc('dss_broadcast_delay', { p_doctor_id: s.users.doctorA, p_minutes: 25, p_request_key: k });
    expect(await count(`select count(*)::int n from notifications where type = 'doctor_delay' and doctor_id = $1`, [s.users.doctorA])).toBe(todo);
  });

  it('role isolation holds mid-day', async () => {
    const r = await compB.rpc('dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: null, p_request_key: key() });
    expect(r.error?.message).toMatch(/DSS_FORBIDDEN/);
  });

  it('the rest of the line is seen in order; no serial skipped or repeated', async () => {
    for (let i = 0; i < 10; i++) {
      const e = await engine();
      if (!e.result.line.length) break;
      await callNext();
    }
    await callNext(); // finishes the last visit, queue empty
    expect(new Set(started).size).toBe(started.length);
    const seen = await db().query(`select serial_no from appointments where doctor_id = $1 and appointment_date = (now() at time zone 'Asia/Dhaka')::date
      and status in ('prescription_pending','completed') order by serial_no`, [s.users.doctorA]);
    expect(seen.rows.map((r) => r.serial_no).sort((a, b) => a - b)).toEqual([...started].sort((a, b) => a - b));
  });

  it('session ends; the never-arrived patient is flagged and resolved', async () => {
    const end = ok(await comp.rpc('dss_session_end', { p_doctor_id: s.users.doctorA, p_request_key: key() }));
    expect(end.unresolved).toBe(2); // serials 7 and 8 never came
    expect((await engine()).suggestions.map((x) => x.type)).toContain('resolve_remaining');
    ok(await comp.rpc('dss_resolve_remaining', { p_doctor_id: s.users.doctorA, p_request_key: key() }));
  });

  it('each notification was created exactly once per person and event', async () => {
    const dupes = await count(`select count(*)::int n from (select user_id, dedupe_key from notifications group by 1, 2 having count(*) > 1) d`, []);
    expect(dupes).toBe(0);
    for (const serial of started) {
      expect(await count(`select count(*)::int n from notifications where appointment_id = $1 and type = 'called'`, [ids[serial - 1] ?? '00000000-0000-0000-0000-000000000000'])).toBeLessThanOrEqual(1);
    }
    expect(await count(`select count(*)::int n from notifications where appointment_id = $1 and type = 'called'`, [ids[0]])).toBe(1);
    expect(await count(`select count(*)::int n from notifications where appointment_id = $1 and type = 'no_show'`, [ids[3]])).toBe(1);
  });

  it('the report shows the day correctly', async () => {
    const adminC = await signIn('admin');
    const today = (await db().query(`select (now() at time zone 'Asia/Dhaka')::date::text d`)).rows[0].d;
    const r = await adminC.rpc('dss_report', { p_from: today, p_to: today, p_doctor: s.users.doctorA });
    expect(r.error).toBeNull();
    expect(r.data[0]).toMatchObject({ booked: 11, seen: started.length, no_shows: 4, walk_ins: 2 });
  });
});
