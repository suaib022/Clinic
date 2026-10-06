import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function resetPasswords() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .in('role', ['doctor', 'compounder']);
    
  if (error) {
    console.error("Error fetching users:", error.message);
    process.exit(1);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const user of users!) {
    // Attempt to update
    let { data, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: '123456' }
    );
    
    if (updateError && updateError.message.includes("error loading user")) {
        // User does not exist in auth.users! Let's try creating them with the exact ID
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            id: user.id, // Try to force the ID
            email: user.email,
            email_confirm: true,
            password: '123456',
            user_metadata: { full_name: user.full_name }
        });
        
        if (createError) {
            console.error(`Failed to create missing auth user ${user.email}:`, createError.message);
            errorCount++;
        } else {
            console.log(`✅ Created missing auth user & set password for: ${user.email}`);
            successCount++;
        }
    } else if (updateError) {
      console.error(`Failed to update ${user.email}:`, updateError.message);
      errorCount++;
    } else {
      console.log(`✅ Updated existing password for: ${user.email}`);
      successCount++;
    }
  }
  
  console.log(`\nFinished! Successfully updated: ${successCount}. Failed: ${errorCount}.`);
}

resetPasswords().catch(console.error);
