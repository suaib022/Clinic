import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const docId = '46b4184d-de61-4d53-985e-3c760d135311'; // Dr. Ajmery
    const { data: appts } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', docId)
        .order('appointment_date', { ascending: false });

    console.log("Appointments for Dr. Ajmery:", appts?.map(a => ({
        id: a.id,
        date: a.appointment_date,
        status: a.status
    })));
}
check();
