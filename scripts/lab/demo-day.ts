// Lab demo day (LOCAL database only): clears the test patients' lab and queue state, then books 3 test patients
// for doctor A, checks them in and calls one into the room. Run: DSS_DEV_SEED=1 npx tsx scripts/lab/demo-day.ts
// Refuses to run unless DATABASE_URL points to localhost.
import { resetTestDoctors, seed, seedLab, resetLab, signIn, book, key, db, closeDb, assertDevSeed } from '../dss/testkit';
const min = 60_000;
async function main() {
  assertDevSeed();
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? '')) throw new Error('not local');
  const s = await seed(); const lab = await seedLab();
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  const pids = [s.patients.p1, s.patients.p1b, s.patients.p2, ...s.patients.fillers];
  await resetLab(lab, pids);
  // clean lab state of the real lines for today too (local demo only)
  const c = await db().connect();
  try { await c.query('begin'); await c.query('set local session_replication_role = replica');
    await c.query(`delete from lab_events where patient_id = any($1)`, [pids]);
    await c.query(`delete from patient_notifications where patient_id = any($1) and type='lab_report_ready'`, [pids]);
    await c.query(`delete from lab_orders where patient_id = any($1)`, [pids]);
    await c.query(`delete from lab_queue_items where patient_id = any($1)`, [pids]);
    await c.query(`delete from lab_line_pauses where session_id in (select id from lab_line_sessions)`);
    await c.query(`delete from lab_line_sessions`);
    await c.query('commit'); } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
  await db().query(`update lab_test_types set active=false where code like 'dsst\\_%'`); await db().query(`update lab_lines set active=false where code like 'dsst\\_%'`);
  const compA1 = await signIn('compA1');
  const rpc = async (fn: string, a: Record<string, unknown>) => { const { data, error } = await compA1.rpc(fn, a); if (error) throw new Error(fn + ': ' + error.message); return data; };
  const a1 = await book(s.patients.p1, s.users.doctorA, 1, new Date(Date.now() - 20 * min));
  const a2 = await book(s.patients.fillers[0], s.users.doctorA, 2, new Date(Date.now() - 12 * min));
  const a3 = await book(s.patients.fillers[1], s.users.doctorA, 3, new Date(Date.now() - 4 * min));
  for (const a of [a1, a2, a3]) await rpc('dss_check_in', { p_appointment_id: a, p_request_key: key() });
  await rpc('dss_call_next', { p_doctor_id: s.users.doctorA, p_expected_current: null, p_request_key: key() });
  console.log('Demo ready: open /api/dev/login-as?as=compA1&next=/compounder/queue');
}
main().then(() => closeDb()).catch(e => { console.error(e); process.exit(1); });
