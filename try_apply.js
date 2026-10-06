const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function main() {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const sql = fs.readFileSync('supabase/migrations/20261003200000_module4_compounder.sql', 'utf8');
    
    // Check if we can use an rpc to run arbitrary SQL
    // Usually people create a 'exec_sql' or 'exec' function for this if they can't connect directly.
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_string: sql });
    console.log(data, error);
}
main();
