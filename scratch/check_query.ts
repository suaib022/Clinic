import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const docId = '46b4184d-de61-4d53-985e-3c760d135311'; // Dr. Ajmery
    const today = '2026-10-06';
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    console.log("today:", today);
    console.log("thirtyDaysAgo:", thirtyDaysStr);

    const selectFields = `
        id, serial_no, appointment_date, start_time, end_time, status, visit_type,
        visit_source, is_priority, priority_reason, checked_in_at, scheduled_start,
        created_by_user_id, status_changed_by, created_at,
        patient:patients!inner(full_name, uhid, mobile, gender)
    `;

    const { data: previousAppts, error } = await supabase
        .from('appointments')
        .select(selectFields)
        .eq('doctor_id', docId)
        .lt('appointment_date', today)
        .gte('appointment_date', thirtyDaysStr)
        .order('appointment_date', { ascending: false })
        .order('serial_no', { ascending: false })
        .limit(100);

    console.log("Error:", error);
    console.log("Previous Appts length:", previousAppts?.length);
    console.log(previousAppts);
}
check();
