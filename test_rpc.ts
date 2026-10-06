import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
    console.log("Fetching all users from public.users...");
    const { data: users, error } = await supabaseAdmin.from('users').select('id, email, role');
    
    if (error) {
        console.error("Error fetching users:", error);
        return;
    }
    
    console.log(`Found ${users.length} users. Setting passwords to '123456'...`);
    
    for (const user of users) {
        if (!user.email) continue;
        
        console.log(`Updating ${user.email} (${user.role})...`);
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: '123456' }
        );
        
        if (updateError) {
            console.error(`Failed to update ${user.email}:`, updateError.message);
        } else {
            console.log(`Success for ${user.email}`);
        }
    }
    console.log("Done!");
}

test();
