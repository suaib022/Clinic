import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: publicUsers } = await supabase.from('users').select('id, role, email').in('role', ['doctor', 'compounder']).limit(1);
  const user = publicUsers![0];
  console.log('Public user:', user);
  
  const { data: authUser, error } = await supabase.auth.admin.getUserById(user.id);
  console.log('Auth user:', authUser?.user?.id, 'Error:', error?.message);

  // Fetch paginated to see if they are in auth.users
  let allAuthUsers: any[] = [];
  let page = 1;
  while (true) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (!data || !data.users || data.users.length === 0) break;
      allAuthUsers = allAuthUsers.concat(data.users);
      page++;
  }
  
  console.log(`Total auth users found via pagination: ${allAuthUsers.length}`);
  const match = allAuthUsers.find(u => u.id === user.id);
  console.log(`Found in paginated list?`, !!match);
}
check();
