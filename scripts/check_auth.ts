import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  console.log('Total auth users:', users?.users.length);
  
  const { data: publicUsers } = await supabase.from('users').select('id, role, email');
  console.log('Total public users:', publicUsers?.length);
  
  const missing = publicUsers?.filter(pu => !users?.users.find(u => u.id === pu.id));
  console.log(`Missing from auth.users: ${missing?.length}`);
  if (missing && missing.length > 0) {
      console.log('Sample missing:', missing[0]);
  }
}
check();
