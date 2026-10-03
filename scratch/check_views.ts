import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  console.log("Checking doctor_has_patient:");
  const res1 = await supabaseAdmin.from('doctor_has_patient').select('*').limit(1);
  console.log(res1.error ? res1.error.message : "Success");

  console.log("Checking compounder_has_patient:");
  const res2 = await supabaseAdmin.from('compounder_has_patient').select('*').limit(1);
  console.log(res2.error ? res2.error.message : "Success");
  
  console.log("Checking staff_patient_basic:");
  const res3 = await supabaseAdmin.from('staff_patient_basic').select('*').limit(1);
  console.log(res3.error ? res3.error.message : "Success");
}
run();
