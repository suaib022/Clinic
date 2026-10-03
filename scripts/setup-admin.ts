import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const email = 'admin@clinic.local';
  const password = 'adminpassword123';
  const fullName = 'System Administrator';

  console.log(`Setting up Admin account: ${email}`);

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
        console.log("Admin account already exists in Auth.");
    } else {
        console.error("Error creating auth user:", authError);
        process.exit(1);
    }
  }

  // Find user by email to ensure we have the ID (if they already existed)
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const user = userList?.users.find(u => u.email === email);

  if (!user) {
    console.error("User not found after creation attempt.");
    process.exit(1);
  }

  // Upsert into users table with role 'admin'
  const { error: dbError } = await supabaseAdmin.from('users').upsert({
    id: user.id,
    email: user.email,
    full_name: fullName,
    role: 'admin'
  });

  if (dbError) {
    console.error("Error setting admin role in users table:", dbError);
    process.exit(1);
  }

  console.log("Admin user successfully created and configured!");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

run();
