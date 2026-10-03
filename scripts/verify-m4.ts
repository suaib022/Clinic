import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== MODULE 4: VERIFICATION ===\n');

  // 1. Compounder Accounts & Assignments
  const { data: compounders, error: cErr } = await supabase
    .from('compounders')
    .select('id, assigned_doctor_id, users!compounders_id_fkey(email, full_name), doctor:users!compounders_assigned_doctor_id_fkey(full_name)');
  
  if (cErr) {
    console.error('Error fetching compounders:', cErr.message);
  } else {
    console.log('✅ Compounder Accounts & Assignments:');
    compounders.forEach(c => {
      console.log(`  - ${(c.users as any)?.full_name} (${(c.users as any)?.email})`);
      console.log(`    Assigned to: ${(c.doctor as any)?.full_name || 'Unassigned'} (ID: ${c.assigned_doctor_id || 'N/A'})`);
    });
    console.log();
  }

  // 2. Check Database Functions
  const functionsToCheck = [
    'create_walk_in_appointment',
    'lookup_patient_for_walk_in',
    'check_in_appointment',
    'undo_check_in',
    'retract_walk_in'
  ];

  console.log('✅ Required Database Functions:');
  for (const fn of functionsToCheck) {
    // We can just try to run them with null args and check if it complains about missing function vs arguments
    const { error } = await supabase.rpc(fn);
    if (error && error.code === 'PGRST202') { // Could not find the function
      console.log(`  ❌ ${fn} (MISSING)`);
    } else {
      console.log(`  ✓ ${fn} (Exists)`);
    }
  }
  
  console.log('\n✅ Verification Complete.');
}

main().catch(console.error);
