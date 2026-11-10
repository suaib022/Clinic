// DSS-45: queue endpoints over HTTP against a running app (DSS_BASE_URL, started by scripts/verify-dss.ts).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seed, resetTestDoctors, authCookie, book, signIn, key, closeDb, type Seed, type AccountKey } from '../../../scripts/dss/testkit';

const BASE = process.env.DSS_BASE_URL;
const min = 60_000;

describe.skipIf(!BASE)('queue endpoints', () => {
  let s: Seed;
  const cookies = {} as Record<AccountKey, string>;
  let own: string, family: string, other: string;

  const get = async (path: string, who?: AccountKey) => {
    const res = await fetch(`${BASE}${path}`, { headers: who ? { cookie: cookies[who] } : {}, redirect: 'manual' });
    const text = await res.text();
    let body: unknown = null;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body: body as Record<string, unknown>, text };
  };

  beforeAll(async () => {
    s = await seed();
    await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
    for (const k of ['patient1', 'patient2', 'compA1', 'compB', 'doctorA', 'admin'] as AccountKey[]) cookies[k] = await authCookie(k);
    const now = Date.now();
    own = await book(s.patients.p1, s.users.doctorA, 3, new Date(now + 10 * min));
    family = await book(s.patients.p1b, s.users.doctorA, 4, new Date(now + 20 * min));
    other = await book(s.patients.fillers[0], s.users.doctorA, 1, new Date(now - 10 * min));
    await book(s.patients.fillers[1], s.users.doctorA, 2, new Date(now));
    // someone else is in the room and someone else is waiting, so there is other-patient data to leak
    const comp = await signIn('compA1');
    await comp.rpc('dss_check_in', { p_appointment_id: other, p_request_key: key() });
    await comp.rpc('dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: null, p_request_key: key() });
  });
  afterAll(async () => {
    await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
    await closeDb();
  });

  it('logged-out callers get 401 everywhere', async () => {
    expect((await get(`/api/queue/snapshot?doctorId=${s.users.doctorA}`)).status).toBe(401);
    expect((await get(`/api/queue/my-status?appointmentId=${own}`)).status).toBe(401);
    expect((await get(`/api/queue/estimate?appointment_id=${own}`)).status).toBe(401);
    expect((await get(`/api/queue/estimate?uhid=DSS-T-0001&doctor_id=${s.users.doctorA}`)).status).toBe(401);
    const post = await fetch(`${BASE}/api/queue/estimate`, { method: 'POST', body: JSON.stringify({ uhid: 'DSS-T-0001' }) });
    expect(post.status).toBe(401);
  });

  it('a patient gets only their own status, with nothing about other patients', async () => {
    const r = await get(`/api/queue/my-status?appointmentId=${own}`, 'patient1');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual([
      'appointmentId', 'bookedAt', 'confidence', 'date', 'doctorName', 'expectedStartAt', 'label', 'lastUpdated',
      'nowServingSerial', 'patientName', 'patientsAhead', 'reason', 'serialNo', 'sessionState', 'stage', 'status',
      'waitMinHigh', 'waitMinLow',
    ]);
    expect(r.body).toMatchObject({ serialNo: 3, nowServingSerial: 1, patientName: 'DSS Patient One', stage: 'not_arrived' });
    for (const leak of ['DSS Filler', 'DSS-T-1', 'DSS Patient Two', 'DSS-T-0003', other]) expect(r.text).not.toContain(leak);
  });

  it('DSS-85: the patient pages carry nothing about other patients', async () => {
    for (const page of ['/patient/dashboard', '/patient/appointments']) {
      const r = await get(page, 'patient1');
      expect(r.status).toBe(200);
      for (const leak of ['DSS Filler', 'DSS-T-1', 'DSS Patient Two']) expect(r.text).not.toContain(leak);
    }
  });

  it('a family member on the same account is visible to the owner', async () => {
    const r = await get(`/api/queue/my-status?appointmentId=${family}`, 'patient1');
    expect(r.status).toBe(200);
    expect(r.body.patientName).toBe('DSS Family Member');
  });

  it("a patient cannot see another patient's status", async () => {
    expect((await get(`/api/queue/my-status?appointmentId=${other}`, 'patient1')).status).toBe(404);
    expect((await get(`/api/queue/my-status?appointmentId=${own}`, 'patient2')).status).toBe(404);
    expect((await get(`/api/queue/estimate?appointment_id=${other}`, 'patient1')).status).toBe(404);
    expect((await get(`/api/queue/estimate?uhid=DSS-T-1000&doctor_id=${s.users.doctorA}`, 'patient1')).status).toBe(400);
  });

  it('patients cannot read snapshots; compounders only for assigned doctors', async () => {
    expect((await get(`/api/queue/snapshot?doctorId=${s.users.doctorA}`, 'patient1')).status).toBe(403);
    expect((await get(`/api/queue/snapshot?doctorId=${s.users.doctorA}`, 'compB')).status).toBe(403);
    expect((await get(`/api/queue/estimate?uhid=DSS-T-1000&doctor_id=${s.users.doctorA}`, 'compB')).status).toBe(404);
    const ok = await get(`/api/queue/snapshot?doctorId=${s.users.doctorA}`, 'compA1');
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('DSS Filler 1'); // staff do see names
    expect(ok.text).not.toMatch(/diagnos|prescription_record|medical/i);
    expect((await get(`/api/queue/snapshot?doctorId=${s.users.doctorB}`, 'doctorA')).status).toBe(403);
    expect((await get(`/api/queue/snapshot?doctorId=${s.users.doctorB}`, 'admin')).status).toBe(200);
  });

  it('staff can still use the legacy estimate endpoint for their doctor, without other names', async () => {
    const r = await get(`/api/queue/estimate?serial_no=3&doctor_id=${s.users.doctorA}`, 'compA1');
    expect(r.status).toBe(200);
    expect(r.body.currentlyServingPatientName).toBeNull();
    expect(r.body.currentlyServingSerial).toBe(1);
  });

  it('validates input', async () => {
    expect((await get('/api/queue/snapshot?doctorId=not-a-uuid', 'compA1')).status).toBe(400);
    expect((await get('/api/queue/my-status?appointmentId=x', 'patient1')).status).toBe(400);
  });
});
