// Lab module: access rules, idempotency, queue order, concurrency, undo, report-ready and report-review visits.
// Runs against the database in the environment (dev-only test accounts, test-only lab lines dsst_*).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  seed, seedLab, resetLab, resetTestDoctors, signIn, anonClient, book, key, db, closeDb, admin as serviceRole, type Seed, type LabSeed,
} from '../../../scripts/dss/testkit';

let s: Seed, lab: LabSeed;
let lab1: SupabaseClient, compA1: SupabaseClient, compB: SupabaseClient, doctorA: SupabaseClient, patient1: SupabaseClient, patient2: SupabaseClient;
const min = 60_000;

type R = { ok: boolean; code: string; message: string; duplicate?: boolean; [k: string]: unknown };
async function rpc(c: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await c.rpc(fn, args);
  return { data: data as R | null, error };
}
const one = async (sql: string, args: unknown[] = []) => (await db().query(sql, args)).rows[0];

/** Books a patient for doctor A, checks them in and starts their consultation; returns the appointment id. */
async function inConsultation(patientId: string, serial: number): Promise<string> {
  // Each booking gets its own slot time (the online-booking slot index is unique per doctor, day and start time).
  const appt = await book(patientId, s.users.doctorA, serial, new Date(Date.now() - (2 + serial * 3) * min));
  expect((await rpc(compA1, 'dss_check_in', { p_appointment_id: appt, p_request_key: key() })).data?.ok).toBe(true);
  // Call next until this patient is the one in the room (others, such as a report review, may be ahead).
  for (let i = 0; i < 6; i++) {
    const cur = await one(`select id from appointments where doctor_id = $1 and status = 'in_consultation'`, [s.users.doctorA]);
    if (cur?.id === appt) return appt;
    const r = await rpc(compA1, 'dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: cur?.id ?? null, p_request_key: key() });
    expect(r.data?.ok).toBe(true);
  }
  throw new Error('patient never reached the room');
}

beforeAll(async () => {
  s = await seed();
  lab = await seedLab();
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  await resetLab(lab, [s.patients.p1, s.patients.p1b, s.patients.p2, ...s.patients.fillers]);
  [lab1, compA1, compB, doctorA, patient1, patient2] = await Promise.all([
    signIn('lab1'), signIn('compA1'), signIn('compB'), signIn('doctorA'), signIn('patient1'), signIn('patient2'),
  ]);
});
afterAll(async () => {
  await resetLab(lab, [s.patients.p1, s.patients.p1b, s.patients.p2, ...s.patients.fillers], { deactivate: true });
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  await closeDb();
});

describe('who may use the lab functions', () => {
  it('logged-out users and patients are refused at the counter', async () => {
    expect((await rpc(anonClient(), 'lab_call_next', { p_line_id: lab.lines.blood, p_request_key: key() })).error).not.toBeNull();
    const p = await rpc(patient1, 'lab_call_next', { p_line_id: lab.lines.blood, p_request_key: key() });
    expect(p.error?.message).toMatch(/LAB_FORBIDDEN/);
  });
  it('compounders and doctors cannot run the counter', async () => {
    expect((await rpc(compA1, 'lab_call_next', { p_line_id: lab.lines.blood, p_request_key: key() })).error?.message).toMatch(/LAB_FORBIDDEN/);
    expect((await rpc(doctorA, 'lab_line_session', { p_line_id: lab.lines.blood, p_action: 'open', p_reason: null, p_request_key: key() })).error?.message)
      .toMatch(/LAB_FORBIDDEN/);
  });
  it("a compounder of doctor B cannot order tests on doctor A's patient", async () => {
    const appt = await inConsultation(s.patients.fillers[0], 1);
    const r = await rpc(compB, 'lab_order_tests', { p_appointment_id: appt, p_test_type_ids: [lab.tests.cbc], p_request_key: key() });
    expect(r.error?.message).toMatch(/LAB_FORBIDDEN/);
  });
  it('only lab staff register outside patients', async () => {
    const args = { p_patient_id: s.patients.p2, p_test_type_ids: [lab.tests.cbc], p_prescriber: 'Dr. Outside', p_request_key: key() };
    expect((await rpc(compA1, 'lab_register_outside', args)).error?.message).toMatch(/LAB_FORBIDDEN/);
  });
});

describe('order, queue, collect, report, review', () => {
  let appt: string;
  let orders: string[];
  beforeAll(async () => {
    await resetTestDoctors([s.users.doctorA]);
    await resetLab(lab, [s.patients.p1, s.patients.p2, ...s.patients.fillers]);
    appt = await inConsultation(s.patients.p1, 1);
  });

  it('tests cannot be ordered before the patient is with the doctor', async () => {
    const waiting = await book(s.patients.fillers[1], s.users.doctorA, 2, new Date());
    const r = await rpc(doctorA, 'lab_order_tests', { p_appointment_id: waiting, p_test_type_ids: [lab.tests.cbc], p_request_key: key() });
    expect(r.data?.code).toBe('stale');
  });

  it('the doctor orders tests once per visit; a repeated request key changes nothing', async () => {
    const k = key();
    const args = { p_appointment_id: appt, p_test_type_ids: [lab.tests.cbc, lab.tests.fbs, lab.tests.xray, lab.tests.ecg], p_request_key: k };
    const a = await rpc(doctorA, 'lab_order_tests', args);
    const b = await rpc(doctorA, 'lab_order_tests', args);
    expect(a.data?.ok).toBe(true);
    expect(b.data?.duplicate).toBe(true);
    orders = a.data!.order_ids as string[];
    expect(orders).toHaveLength(4);
    const again = await rpc(doctorA, 'lab_order_tests', { ...args, p_request_key: key() });
    expect(again.data?.message).toBe('These tests were already ordered.');
    expect((await one(`select count(*)::int n from lab_orders where appointment_id = $1`, [appt])).n).toBe(4);
  });

  it('"Lab now": the compounder sends the orders; one place per line (two blood tests share one)', async () => {
    const r = await rpc(compA1, 'lab_enqueue', { p_order_ids: orders, p_request_key: key() });
    expect(r.data?.ok).toBe(true);
    const items = await db().query(`select line_id from lab_queue_items where patient_id = $1 and status = 'queued'`, [s.patients.p1]);
    expect(items.rows.map((x) => x.line_id).sort()).toEqual([lab.lines.blood, lab.lines.ecg, lab.lines.xray].sort());
    expect((await rpc(compA1, 'lab_enqueue', { p_order_ids: orders, p_request_key: key() })).data?.code).toBe('stale');
  });

  it('the patient sees their own orders; another account does not', async () => {
    expect((await patient1.from('lab_orders').select('id').eq('patient_id', s.patients.p1)).data).toHaveLength(4);
    expect((await patient2.from('lab_orders').select('id').eq('patient_id', s.patients.p1)).data).toHaveLength(0);
  });

  it('the line snapshot shows names to lab staff only, and the other lines this patient still has to visit', async () => {
    const staff = (await lab1.rpc('lab_snapshot_input', { p_line_id: lab.lines.blood })).data as { items: { patient_name: string | null; other_lines: { line_id: string }[] }[] };
    const comp = (await compA1.rpc('lab_snapshot_input', { p_line_id: lab.lines.blood })).data as { items: { patient_name: string | null }[] };
    expect(staff.items[0].patient_name).toBe('DSS Patient One');
    expect(comp.items[0].patient_name).toBeNull();
    expect(staff.items[0].other_lines.map((x) => x.line_id).sort()).toEqual([lab.lines.ecg, lab.lines.xray].sort());
  });

  it('the service role (patient endpoint, after its ownership check) reads the line without any names', async () => {
    const r = (await serviceRole.rpc('lab_snapshot_input', { p_line_id: lab.lines.blood })).data as { items: { patient_name: string | null; patient_uhid: string | null }[] };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.patient_name === null && i.patient_uhid === null)).toBe(true);
    expect((await patient1.rpc('lab_snapshot_input', { p_line_id: lab.lines.blood })).error?.message).toMatch(/LAB_FORBIDDEN/);
  });

  it('two lab staff tapping "Call next" at once: exactly one call', async () => {
    const lab1b = await signIn('lab1');
    const [x, y] = await Promise.all([
      rpc(lab1, 'lab_call_next', { p_line_id: lab.lines.blood, p_request_key: key() }),
      rpc(lab1b, 'lab_call_next', { p_line_id: lab.lines.blood, p_request_key: key() }),
    ]);
    expect([x.data, y.data].filter((r) => r?.ok)).toHaveLength(1);
    expect([x.data, y.data].filter((r) => r?.code === 'busy')).toHaveLength(1);
    expect((await one(`select count(*)::int n from lab_queue_items where line_id = $1 and status = 'called'`, [lab.lines.blood])).n).toBe(1);
  });

  it('collected: the orders follow; a no-turnaround test (ECG) is ready at once', async () => {
    const item = await one(`select id from lab_queue_items where line_id = $1 and status = 'called'`, [lab.lines.blood]);
    expect((await rpc(lab1, 'lab_mark_collected', { p_item_id: item.id, p_request_key: key() })).data?.ok).toBe(true);
    expect((await db().query(`select status from lab_orders where queue_item_id = $1`, [item.id])).rows.every((r) => r.status === 'collected')).toBe(true);
    await rpc(lab1, 'lab_call_next', { p_line_id: lab.lines.ecg, p_request_key: key() });
    const ecg = await one(`select id from lab_queue_items where line_id = $1 and status = 'called'`, [lab.lines.ecg]);
    const r = await rpc(lab1, 'lab_mark_collected', { p_item_id: ecg.id, p_request_key: key() });
    expect(r.data?.ready_order_ids as string[]).toHaveLength(1);
  });

  it('undo takes back your own last counter action only', async () => {
    const other = await signIn('admin');
    expect((await rpc(other, 'lab_undo', { p_line_id: lab.lines.ecg, p_request_key: key() })).data?.code).toBe('nothing');
    const r = await rpc(lab1, 'lab_undo', { p_line_id: lab.lines.ecg, p_request_key: key() });
    expect(r.data).toMatchObject({ ok: true, undone_type: 'sample_collected' });
    const ecg = await one(`select status from lab_queue_items where line_id = $1 and patient_id = $2`, [lab.lines.ecg, s.patients.p1]);
    expect(ecg.status).toBe('called');
    expect((await one(`select status from lab_orders o join lab_test_types t on t.id = o.test_type_id where t.code = 'dsst_ecg' and o.appointment_id = $1`, [appt])).status)
      .toBe('queued');
  });

  it('lab staff see collected samples waiting for a report; others do not', async () => {
    const list = (await lab1.rpc('lab_pending_reports')).data as { order_id: string; patient_name: string }[];
    expect(list.map((x) => x.order_id).sort()).toEqual(orders.slice(0, 2).sort()); // CBC + fasting sugar (blood, collected)
    expect(list[0].patient_name).toBe('DSS Patient One');
    expect((await compA1.rpc('lab_pending_reports')).error?.message).toMatch(/LAB_FORBIDDEN/);
  });

  it('report review needs a ready report and an open session', async () => {
    expect((await rpc(compA1, 'dss_return_for_review', { p_appointment_id: appt, p_request_key: key() })).data?.code).toBe('not_ready');
    const cbc = orders[0];
    const r = await rpc(lab1, 'lab_mark_report_ready', { p_order_id: cbc, p_request_key: key() });
    expect(r.error).toBeNull();
    expect(r.data?.ok).toBe(true);
    const n = (await patient1.from('patient_notifications').select('type').eq('patient_id', s.patients.p1).eq('type', 'lab_report_ready')).data;
    expect(n).toHaveLength(1);
    const back = await rpc(compA1, 'dss_return_for_review', { p_appointment_id: appt, p_request_key: key() });
    expect(back.error).toBeNull();
    expect(back.data?.ok).toBe(true);
    const review = await one(`select status, visit_reason, visit_type, visit_source from appointments where id = $1`, [back.data!.appointment_id]);
    expect(review).toMatchObject({ status: 'checked_in', visit_reason: 'report_review', visit_type: 'follow_up', visit_source: 'walk_in' });
    expect((await rpc(compA1, 'dss_return_for_review', { p_appointment_id: appt, p_request_key: key() })).data?.code).toBe('stale');
    const snap = (await compA1.rpc('dss_snapshot_input', { p_doctor_id: s.users.doctorA })).data as { appointments: { id: string; visit_reason: string }[] };
    expect(snap.appointments.find((x) => x.id === back.data!.appointment_id)?.visit_reason).toBe('report_review');
    expect((await one(`select count(*)::int n from queue_events where appointment_id = $1 and event_type = 'return_queue'`, [back.data!.appointment_id])).n).toBe(1);
  });

  it("the doctor's lab status lists today's visits with orders, and the report review once it exists", async () => {
    const st = (await compA1.rpc('lab_doctor_status', { p_doctor_id: s.users.doctorA })).data as
      { appointment_id: string; patient_name: string; tests: { status: string }[]; review_appointment_id: string | null }[];
    const v = st.find((x) => x.appointment_id === appt)!;
    expect(v.patient_name).toBe('DSS Patient One');
    expect(v.tests).toHaveLength(4);
    expect(v.review_appointment_id).not.toBeNull();
    expect((await compB.rpc('lab_doctor_status', { p_doctor_id: s.users.doctorA })).error?.message).toMatch(/DSS_FORBIDDEN/);
  });

  it('skip passes a patient over; rejoin puts them back behind the people already waiting', async () => {
    const reg = async (pid: string) => (await rpc(lab1, 'lab_register_outside', { p_patient_id: pid, p_test_type_ids: [lab.tests.xray], p_prescriber: 'Dr. Outside', p_request_key: key() })).data!;
    const first = await reg(s.patients.fillers[2]);
    await reg(s.patients.fillers[3]);
    const firstItem = (first.items as { item_id: string }[])[0].item_id;
    expect((await rpc(lab1, 'lab_skip', { p_item_id: firstItem, p_rejoin: false, p_request_key: key() })).data?.ok).toBe(true);
    // The X-ray line already has patient One (queued earlier); skip leaves filler 2 out, so One is called next.
    const c1 = await rpc(lab1, 'lab_call_next', { p_line_id: lab.lines.xray, p_request_key: key() });
    expect((await one(`select patient_id from lab_queue_items where id = $1`, [c1.data!.item_id])).patient_id).toBe(s.patients.p1);
    await rpc(lab1, 'lab_mark_collected', { p_item_id: c1.data!.item_id, p_request_key: key() });
    expect((await rpc(lab1, 'lab_skip', { p_item_id: firstItem, p_rejoin: true, p_request_key: key() })).data?.ok).toBe(true);
    const c2 = await rpc(lab1, 'lab_call_next', { p_line_id: lab.lines.xray, p_request_key: key() });
    expect((await one(`select patient_id from lab_queue_items where id = $1`, [c2.data!.item_id])).patient_id).toBe(s.patients.fillers[3]);
  });

  it('a paused counter does not call; a counter with someone at it cannot close', async () => {
    expect((await rpc(lab1, 'lab_line_session', { p_line_id: lab.lines.xray, p_action: 'close', p_reason: null, p_request_key: key() })).data?.code).toBe('busy');
    expect((await rpc(lab1, 'lab_line_session', { p_line_id: lab.lines.blood, p_action: 'pause', p_reason: 'tea', p_request_key: key() })).data?.ok).toBe(true);
    expect((await rpc(lab1, 'lab_call_next', { p_line_id: lab.lines.blood, p_request_key: key() })).data?.code).toBe('paused');
    expect((await rpc(lab1, 'lab_line_session', { p_line_id: lab.lines.blood, p_action: 'resume', p_reason: null, p_request_key: key() })).data?.ok).toBe(true);
  });

  it('a later patient is found by lab staff with their open orders', async () => {
    const appt2 = await inConsultation(s.patients.fillers[4], 3);
    await rpc(doctorA, 'lab_order_tests', { p_appointment_id: appt2, p_test_type_ids: [lab.tests.cbc], p_request_key: key() });
    const open = (await lab1.rpc('lab_patient_orders', { p_patient_id: s.patients.fillers[4] })).data as { order_id: string; status: string }[];
    expect(open.map((o) => o.status)).toEqual(['ordered']);
    expect((await rpc(lab1, 'lab_enqueue', { p_order_ids: [open[0].order_id], p_request_key: key() })).data?.ok).toBe(true);
  });
});

describe('patient lookup at the lab', () => {
  it('lab staff find a patient by exact UHID only; others are refused; the query is not stored', async () => {
    const r = await lab1.rpc('lab_find_patient', { p_query: 'DSS-T-0001' });
    expect((r.data as { full_name: string }[]).map((x) => x.full_name)).toEqual(['DSS Patient One']);
    expect(((await lab1.rpc('lab_find_patient', { p_query: 'DSS Patient' })).data as unknown[])).toHaveLength(0);
    expect((await compA1.rpc('lab_find_patient', { p_query: 'DSS-T-0001' })).error?.message).toMatch(/LAB_FORBIDDEN/);
    const log = await one(`select metadata from lab_events where event_type = 'patient_lookup' order by occurred_at desc limit 1`);
    expect(JSON.stringify(log.metadata)).not.toContain('DSS-T');
  });
});
