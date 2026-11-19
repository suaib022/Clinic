// Creates (or repairs) one lab staff login: a Supabase Auth user plus a public.users row with role 'technician'.
//
//   npx tsx scripts/lab/create-lab-staff.ts
//
// The password is typed into a hidden prompt (twice) and goes straight to Supabase. It is never printed or stored.
// For automation only, LAB_STAFF_PASSWORD may be set instead (used by the local test; do not use it for the real project).
// The script shows which Supabase project it will write to and asks for a typed "yes" first.
import readline from 'node:readline';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).'); process.exit(1); }

const ask = (q: string, hidden = false): Promise<string> => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const w = (rl as unknown as { _writeToOutput: (s: string) => void });
    w._writeToOutput = (s: string) => { if (s.includes(q)) process.stdout.write(s); }; // show the prompt, not the typing
  }
  rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
});

async function main() {
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(url!);
  const project = isLocal ? 'LOCAL test database' : `ONLINE project ${new URL(url!).hostname.split('.')[0]}`;
  console.log(`\nTarget: ${project}`);

  const email = (process.env.LAB_STAFF_EMAIL || await ask('Lab staff email [lab_1@staff.clinic.local]: ') || 'lab_1@staff.clinic.local').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That is not a valid email address.');
  const fullName = process.env.LAB_STAFF_NAME || await ask('Full name [Lab Staff]: ') || 'Lab Staff';

  let password = process.env.LAB_STAFF_PASSWORD ?? '';
  if (!password) {
    password = await ask('Password (min 12 characters, hidden): ', true);
    if (password !== await ask('Repeat password: ', true)) throw new Error('The two passwords do not match.');
  }
  if (password.length < 12) throw new Error('Use at least 12 characters.');

  if (!process.env.LAB_STAFF_PASSWORD) {
    const ok = await ask(`\nCreate lab staff "${fullName}" <${email}> on the ${project}? Type yes to continue: `);
    if (ok.toLowerCase() !== 'yes') { console.log('Cancelled. Nothing was changed.'); return; }
  }

  const admin = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });
  let userId: string | undefined;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (created.error) {
    if (!/already|registered|exists/i.test(created.error.message)) throw new Error(`Could not create the login: ${created.error.message}`);
    // Find the existing login. First the app's users table. If that has no row, ask Supabase for a *recovery* link, which
    // only works for an account that already exists (it creates nothing and sends nothing; the link itself is never used).
    // The admin "list users" call is not used: it fails on projects whose accounts were adjusted by hand-written migrations.
    const known = await admin.from('users').select('id').eq('email', email).maybeSingle();
    userId = known.data?.id;
    if (!userId) {
      const found = await admin.auth.admin.generateLink({ type: 'recovery', email });
      userId = found.data?.user?.id;
    }
    if (!userId) throw new Error('The email already exists but could not be found.');
    console.log('A login with this email already exists: only the role is set. Its password is left unchanged.');
  } else {
    userId = created.data.user.id;
  }

  const { error } = await admin.from('users').upsert({ id: userId, email, full_name: fullName, role: 'technician' }, { onConflict: 'id' });
  if (error) throw new Error(`Login created, but the role could not be set: ${error.message}`);

  // Prove it works: sign in with the password just given (new login only), then check the role.
  if (!created.error) {
    const anon = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? key!, { auth: { autoRefreshToken: false, persistSession: false } });
    const s = await anon.auth.signInWithPassword({ email, password });
    const { data: r } = await admin.from('users').select('role').eq('id', userId).single();
    console.log(s.error ? `Warning: test sign-in failed: ${s.error.message}` : `Test sign-in OK. Role: ${r?.role}.`);
  }
  console.log(`\nDone. Lab staff can sign in on the login page under the "Lab" tab with ${email}.`);
}
main().catch((e) => { console.error(`\nError: ${e instanceof Error ? e.message : e}`); process.exit(1); });
