import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@clinic.local',
    password: 'adminpassword123'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  const { data, error } = await supabase
    .from('appointments')
    .select(`
        id, appointment_date, start_time, end_time, status,
        patient:patients(full_name, mobile_no),
        doctor:users!appointments_doctor_id_fkey(full_name)
    `);
    
  console.log("Appointments error:", error);
  console.log("Appointments data:", data);
}
run();
