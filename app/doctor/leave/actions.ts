'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/requireRole';

export async function submitLeaveRequest(formData: FormData) {
    const cookieStore = await cookies();
    const { user: { id: staffSession } } = await requireRole(['admin', 'doctor', 'compounder']);
    
    if (!staffSession) {
        return { error: 'Not authenticated' };
    }

    const type = formData.get('type') as string;
    const startDate = formData.get('start_date') as string;
    const endDate = formData.get('end_date') as string;
    const reason = formData.get('reason') as string;
    const startTime = formData.get('start_time') as string;
    const endTime = formData.get('end_time') as string;

    const supabase = await createClient();

    const { error } = await supabase
        .from('doctor_leave_requests')
        .insert({
            doctor_id: staffSession,
            type: type,
            start_date: startDate,
            end_date: endDate,
            start_time: type === 'partial_day' ? startTime : null,
            end_time: type === 'partial_day' ? endTime : null,
            reason: reason,
            status: 'pending'
        });

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/doctor/leave');
    return { success: true };
}
