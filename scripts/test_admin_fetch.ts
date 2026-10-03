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
    .from('patients')
    .select(`*`);
    
  console.log("Patients error:", error);
  console.log("Patients data:", data);
}
run();
