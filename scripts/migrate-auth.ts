import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function run() {
  console.log('Starting auth migration...');

  // 1. Migrate Doctors
  console.log('\n--- Migrating Doctors ---');
  const { data: doctors, error: dErr } = await supabaseAdmin.from('doctors').select('id, doctor_id');
  if (dErr) {
    console.error('Error fetching doctors:', dErr);
  } else {
    for (const doc of doctors) {
      const email = `${doc.doctor_id}@staff.clinic.local`.toLowerCase();
      const pin = '123456';
      console.log(`Setting up Auth for Doctor: ${doc.doctor_id} | Email: ${email} | DEV PIN: ${pin}`);

      const { data: user, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: pin,
        email_confirm: true,
      });
      if (cErr) {
        console.error(`Failed to create auth user for ${doc.doctor_id}:`, cErr.message);
      } else {
        // Link users table
        await supabaseAdmin.from('users').update({ email: email }).eq('id', doc.id);
        console.log(`Successfully migrated Doctor ${doc.doctor_id}`);
      }
    }
  }

  // 2. Migrate Compounders
  console.log('\n--- Migrating Compounders ---');
  const { data: compounders, error: cErr } = await supabaseAdmin.from('compounders').select('id');
  if (cErr) {
    console.error('Error fetching compounders:', cErr);
  } else {
    for (const comp of compounders) {
      const email = `compounder_${comp.id.substring(0, 8)}@staff.clinic.local`.toLowerCase();
      const pin = '123456';
      console.log(`Setting up Auth for Compounder: ${comp.id} | Email: ${email} | DEV PIN: ${pin}`);

      const { data: user, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: pin,
        email_confirm: true,
      });
      if (createErr) {
        console.error(`Failed to create auth user for ${comp.id}:`, createErr.message);
      } else {
        await supabaseAdmin.from('users').update({ email: email }).eq('id', comp.id);
        console.log(`Successfully migrated Compounder ${comp.id}`);
      }
    }
  }

  // 3. Migrate Patients
  console.log('\n--- Migrating Patients ---');
  const { data: patients, error: pErr } = await supabaseAdmin.from('patients').select('id, uhid, pin');
  if (pErr) {
    console.error('Error fetching patients:', pErr);
  } else {
    for (const pat of patients) {
      const email = `${pat.uhid}@patients.clinic.local`.toLowerCase();
      const pin = pat.pin || '123456'; // Use existing pin if available
      console.log(`Setting up Auth for Patient: ${pat.uhid} | Email: ${email}`);

      const { data: user, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: pin,
        email_confirm: true,
      });
      if (createErr) {
        console.error(`Failed to create auth user for ${pat.uhid}:`, createErr.message);
      } else {
        // Link to patients table
        await supabaseAdmin.from('patients').update({ auth_user_id: user.user.id }).eq('id', pat.id);
        console.log(`Successfully migrated Patient ${pat.uhid}`);
      }
    }
  }

  console.log('\nMigration script complete. Review the outputs and note the DEV PINs (123456 for staff).');
  console.log('Once you are satisfied, run a migration to DROP the old pin columns.');
}

run();
