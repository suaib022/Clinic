/**
 * Dev-only: sets up a realistic clinic day for test doctor A ("Dr. DSS Rahman (Test)") so the live screens have data.
 *   npx tsx scripts/dss/demo-day.ts            → 8 bookings on 10-min slots around now, 3 checked in, 20 past visits of history
 *   npx tsx scripts/dss/demo-day.ts --empty    → only resets the day (for the manual checklist)
 * Requires DSS_DEV_SEED=1. Touches only the DSS test accounts.
 */
import { seed, resetTestDoctors, book, db, signIn, key, closeDb, dhakaDate, dhakaTime } from './testkit';

const MIN = 60_000;

async function history(doctorId: string, patientId: string) {
  const { rows } = await db().query(`select count(*)::int n from consultation_analytics_logs where doctor_id = $1`, [doctorId]);
  if (rows[0].n >= 20) return;
  await resetTestDoctors([doctorId], { allDays: true, history: true });
  const durations = [9, 8, 10, 9, 7, 12, 9, 8, 11, 9, 6, 13, 9, 10, 8, 9, 14, 9, 7, 10];
  const day = new Date(Date.now() - 2 * 24 * 60 * MIN);
  for (let i = 0; i < durations.length; i++) {
    const start = new Date(day.getTime() + i * 12 * MIN);
    const end = new Date(start.getTime() + durations[i] * MIN);
    const a = await db().query(
      `insert into appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status, serial_no, scheduled_start,
         slot_minutes, visit_type, visit_source, payment_status, checked_in_at, consult_started_at, consult_ended_at)
       values ($1,$2,$3,$7::time,$7::time + interval '10 minutes','completed',$4,$5,10,'new','online','paid',$5,$5,$6) returning id`,
      [patientId, doctorId, dhakaDate(day), 100 + i, start.toISOString(), end.toISOString(), dhakaTime(start)]
    );
    await db().query(
      `insert into consultation_analytics_logs (appointment_id, doctor_id, patient_id, visit_type, consult_started_at, consult_ended_at, consult_duration_minutes)
       values ($1,$2,$3,'new',$4,$5,$6)`,
      [a.rows[0].id, doctorId, patientId, start.toISOString(), end.toISOString(), durations[i]]
    );
  }
}

async function main() {
  const s = await seed();
  await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  if (process.argv.includes('--empty')) {
    console.log('Doctor A and B days reset.');
    return closeDb();
  }
  await history(s.users.doctorA, s.patients.fillers[11]);
  const now = Date.now();
  const slot0 = now - 30 * MIN;
  const people = [s.patients.fillers[0], s.patients.fillers[1], s.patients.p1b, s.patients.p1, s.patients.fillers[2],
    s.patients.fillers[3], s.patients.fillers[4], s.patients.fillers[5]];
  const ids: string[] = [];
  for (let i = 0; i < people.length; i++) ids.push(await book(people[i], s.users.doctorA, i + 1, new Date(slot0 + i * 10 * MIN), i % 3 === 2 ? 'follow_up' : 'new'));
  // A realistic session window for today: starts at the first slot, so lateness and delay read naturally.
  await db().query(
    `update doctor_schedules set start_time = $2::time, end_time = '23:59' where doctor_id = $1 and day_of_week = extract(dow from (now() at time zone 'Asia/Dhaka'))`,
    [s.users.doctorA, dhakaTime(new Date(slot0))]
  );
  const comp = await signIn('compA1');
  for (const i of [0, 1, 4]) await comp.rpc('dss_check_in', { p_appointment_id: ids[i], p_request_key: key() });
  console.log(`Demo day ready: 8 bookings for Dr. DSS Rahman (Test) from ${new Date(slot0).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}, serials 1, 2, 5 checked in.`);
  console.log('Patient One (patient1) holds serial 4; their family member holds serial 3.');
  await closeDb();
}
main().catch((e) => { console.error(e); process.exit(1); });
