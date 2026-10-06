import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data: c } = await supabase.from('users').select('id, email').eq('email', 'compounder_test@staff.clinic.local').single();
    if (!c) {
        console.log("no test compounder");
        return;
    }
    const { data: comp } = await supabase.from('compounders').select('assigned_doctor_id').eq('id', c.id).single();
    const docId = comp?.assigned_doctor_id;
    console.log("Assigned doctor ID:", docId);
    
    if (docId) {
        const { data: doc } = await supabase.from('users').select('id, full_name, email').eq('id', docId).single();
        console.log("Assigned doctor:", doc);
    }
}
check();
