/**
 * DSS dev/test kit: creates isolated test accounts (two doctors, three compounders,
 * two patient accounts with a family member, one admin) and resets *only their* data.
 *
 * Dev-only: refuses to run unless DSS_DEV_SEED=1. The shared test password comes from
 * DSS_TEST_PASSWORD in .env.local (generated and written there on first run, never committed).
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DSS_TEST_ACCOUNTS } from '../../lib/dev/testAccounts';

dotenv.config({ path: '.env.local', quiet: true });

// Keep DATE columns as plain 'yyyy-mm-dd' strings (the machine TZ would shift them otherwise).
pg.types.setTypeParser(1082, (v: string) => v);

export const TZ = 'Asia/Dhaka';

export function assertDevSeed() {
  if (process.env.DSS_DEV_SEED !== '1') {
    throw new Error('DSS test kit is dev-only. Set DSS_DEV_SEED=1 (e.g. in .env.local) to use it.');
  }
}

export function testPassword(): string {
  if (process.env.DSS_TEST_PASSWORD) return process.env.DSS_TEST_PASSWORD;
  const pw = `Dss-${crypto.randomBytes(9).toString('base64url')}9!`;
  fs.appendFileSync('.env.local', `\n# DSS dev test accounts (generated, local only)\nDSS_TEST_PASSWORD=${pw}\n`);
  process.env.DSS_TEST_PASSWORD = pw;
  return pw;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export function connectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const pooler = fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
  return pooler.replace('@', `:${encodeURIComponent(process.env.db_pass ?? '')}@`);
}

let pool: pg.Pool | null = null;
export function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: connectionString(), ssl: { rejectUnauthorized: false }, max: 4 });
  return pool;
}
export async function closeDb() {
  await pool?.end();
  pool = null;
}

export const ACCOUNTS = DSS_TEST_ACCOUNTS;
export type AccountKey = keyof typeof ACCOUNTS;

export interface Seed {
  users: Record<AccountKey, string>;
  /** patients rows: patient1 owns p1 and family member p1b; patient2 owns p2; extra walk-in/queue fillers */
  patients: { p1: string; p1b: string; p2: string; fillers: string[] };
}

async function ensureAuthUser(email: string, name: string, password: string): Promise<string> {
  const { rows } = await db().query('select id from auth.users where email = $1', [email]);
  if (rows[0]) {
    // Re-setting the password would log out open browser sessions; only do it on request.
    if (process.env.DSS_RESET_PASSWORDS === '1') await admin.auth.admin.updateUserById(rows[0].id, { password, email_confirm: true });
    return rows[0].id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function ensurePatient(authUserId: string, uhid: string, name: string, mobile: string): Promise<string> {
  const { rows } = await db().query('select id from patients where uhid = $1', [uhid]);
  if (rows[0]) return rows[0].id;
  const r = await db().query(
    `insert into patients (uhid, full_name, gender, mobile_no, auth_user_id, title) values ($1,$2,'Male',$3,$4,'Mr.') returning id`,
    [uhid, name, mobile, authUserId]
  );
  return r.rows[0].id;
}

/** Idempotent: creates/updates all test accounts and their links. */
export async function seed(): Promise<Seed> {
  assertDevSeed();
  const pw = testPassword();
  const users = {} as Record<AccountKey, string>;
  for (const [key, acc] of Object.entries(ACCOUNTS) as [AccountKey, (typeof ACCOUNTS)[AccountKey]][]) {
    const id = await ensureAuthUser(acc.email, acc.name, pw);
    await db().query(
      `insert into users (id, full_name, email, role) values ($1,$2,$3,$4::user_role)
       on conflict (id) do update set full_name = excluded.full_name, role = excluded.role`,
      [id, acc.name, acc.email, acc.role]
    );
    users[key] = id;
  }
  for (const [key, code] of [['doctorA', 'DSS-TEST-A'], ['doctorB', 'DSS-TEST-B']] as const) {
    await db().query(
      `insert into doctors (id, doctor_id, consultation_fee) values ($1,$2,0) on conflict (id) do nothing`,
      [users[key], code]
    );
    // Open all day, every day, 10-minute slots, so tests can run at any time.
    for (let dow = 0; dow < 7; dow++) {
      await db().query(
        `insert into doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, is_active)
         select $1, $2, '00:00', '23:59', 10, true
         where not exists (select 1 from doctor_schedules where doctor_id = $1 and day_of_week = $2)`,
        [users[key], dow]
      );
    }
  }
  for (const [comp, doc] of [['compA1', 'doctorA'], ['compA2', 'doctorA'], ['compB', 'doctorB']] as const) {
    await db().query(
      `insert into compounders (id, assigned_doctor_id) values ($1,$2)
       on conflict (id) do update set assigned_doctor_id = excluded.assigned_doctor_id`,
      [users[comp], users[doc]]
    );
  }
  const p1 = await ensurePatient(users.patient1, 'DSS-T-0001', 'DSS Patient One', '+8801700000001');
  const p1b = await ensurePatient(users.patient1, 'DSS-T-0002', 'DSS Family Member', '+8801700000002');
  const p2 = await ensurePatient(users.patient2, 'DSS-T-0003', 'DSS Patient Two', '+8801700000003');
  const fillers: string[] = [];
  for (let i = 0; i < 12; i++) {
    // Queue fillers belong to patient2's account so their notifications are observable too.
    fillers.push(await ensurePatient(users.patient2, `DSS-T-1${String(i).padStart(3, '0')}`, `DSS Filler ${i + 1}`, `+88017100000${String(i).padStart(2, '0')}`));
  }
  return { users, patients: { p1, p1b, p2, fillers } };
}

/** Removes today's (or all) queue data of the test doctors only. queue_events is append-only, so triggers are bypassed here. */
export async function resetTestDoctors(doctorIds: string[], opts: { allDays?: boolean; history?: boolean } = {}) {
  assertDevSeed();
  const c = await db().connect();
  try {
    await c.query('begin');
    await c.query('set local session_replication_role = replica');
    const dayFilter = opts.allDays ? '' : `and appointment_date = (now() at time zone 'Asia/Dhaka')::date`;
    const ids = `(select id from appointments where doctor_id = any($1) ${dayFilter})`;
    const hasNotifications = (await c.query(`select to_regclass('public.notifications') is not null as ok`)).rows[0].ok;
    if (hasNotifications) {
      await c.query(`delete from notifications where appointment_id in ${ids} or doctor_id = any($1)`, [doctorIds]);
    }
    await c.query(`delete from queue_events where appointment_id in ${ids} or (appointment_id is null and doctor_id = any($1))`, [doctorIds]);
    await c.query(`delete from dss_appointment_tracking where appointment_id in ${ids}`, [doctorIds]);
    if (opts.history) await c.query(`delete from consultation_analytics_logs where doctor_id = any($1)`, [doctorIds]);
    else await c.query(`delete from consultation_analytics_logs where appointment_id in ${ids}`, [doctorIds]);
    await c.query(`delete from walk_in_requests where appointment_id in ${ids}`, [doctorIds]);
    await c.query(`delete from dss_suggestion_dismissals where doctor_id = any($1)`, [doctorIds]);
    await c.query(`delete from appointments where id in ${ids}`, [doctorIds]);
    await c.query(
      `delete from doctor_session_pauses where session_id in (select id from doctor_sessions where doctor_id = any($1))`,
      [doctorIds]
    );
    await c.query(`delete from doctor_sessions where doctor_id = any($1)`, [doctorIds]);
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

export async function signIn(key: AccountKey): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: ACCOUNTS[key].email, password: testPassword() });
  if (error) throw new Error(`signIn ${key}: ${error.message}`);
  return client;
}

export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function dhakaDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function dhakaTime(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d);
}

/** Online booking for today (bypasses payment, which is irrelevant to the queue). */
export async function book(patientId: string, doctorId: string, serial: number, bookedAt: Date, visitType: 'new' | 'follow_up' = 'new'): Promise<string> {
  const r = await db().query(
    `insert into appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status, serial_no,
       scheduled_start, slot_minutes, visit_type, visit_source, payment_status)
     values ($1,$2,$3,$4::time,$4::time + interval '10 minutes','scheduled',$5,$6,10,$7,'online','paid') returning id`,
    [patientId, doctorId, dhakaDate(bookedAt), dhakaTime(bookedAt), serial, bookedAt.toISOString(), visitType]
  );
  return r.rows[0].id;
}

export function key(prefix = 't'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Rewrites stored timestamps of one appointment (test-only time travel). */
export async function setTimes(apptId: string, fields: Record<string, Date | null>) {
  const c = await db().connect();
  try {
    await c.query('begin');
    await c.query('set local session_replication_role = replica');
    const cols = Object.keys(fields);
    await c.query(
      `update appointments set ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`,
      [apptId, ...cols.map((k) => fields[k]?.toISOString() ?? null)]
    );
    await c.query('commit');
  } finally {
    c.release();
  }
}

/** Cookie header for a signed-in test account, exactly as @supabase/ssr would set it in a browser. */
export async function authCookie(k: AccountKey): Promise<string> {
  const { createServerClient } = await import('@supabase/ssr');
  const jar = new Map<string, string>();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: ACCOUNTS[k].email, password: testPassword() });
  if (error) throw new Error(`authCookie ${k}: ${error.message}`);
  return [...jar].map(([n, v]) => `${n}=${v}`).join('; ');
}
