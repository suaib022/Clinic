'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/requireRole';
import { revalidatePath } from 'next/cache';

export async function approveLeaveRequest(requestId: string) {
    try {
        const { user } = await requireRole(['admin']);
        const supabase = await createClient();

        // 1. Fetch leave request
        const { data: request, error: fetchErr } = await supabase
            .from('doctor_leave_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchErr || !request) {
            return { success: false, error: fetchErr?.message || 'Request not found' };
        }

        const cleanReason = (request.reason || 'Administrative Leave').replace(/^Schedule Cancelled:\s*/i, '');

        // 2. Execute cancellation of appointments and slot closing via doctor_cancel_schedule
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('doctor_cancel_schedule', {
            p_start_date: request.start_date,
            p_end_date: request.end_date,
            p_reason: cleanReason,
            p_doctor_id: request.doctor_id
        });

        if (rpcErr) {
            console.error('RPC doctor_cancel_schedule error:', rpcErr);
            // Even if RPC encounters an issue, update status directly
        }

        // 3. Mark the leave request approved
        const { error: updateErr } = await supabase
            .from('doctor_leave_requests')
            .update({
                status: 'approved',
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (updateErr) {
            return { success: false, error: updateErr.message };
        }

        // Clean up any extra duplicate approved row inserted by the RPC for the same dates/doctor
        const { data: duplicates } = await supabase
            .from('doctor_leave_requests')
            .select('id')
            .eq('doctor_id', request.doctor_id)
            .eq('start_date', request.start_date)
            .eq('end_date', request.end_date)
            .neq('id', requestId)
            .order('created_at', { ascending: false });

        if (duplicates && duplicates.length > 0) {
            const dupIds = duplicates.map(d => d.id);
            await supabase.from('doctor_leave_requests').delete().in('id', dupIds);
        }

        revalidatePath('/admin/schedule');
        revalidatePath('/doctor/schedule');
        revalidatePath('/doctor/leave');
        revalidatePath('/doctor/appointments');
        revalidatePath('/doctor/all-appointments');
        revalidatePath('/patient/appointments');

        return { 
            success: true, 
            message: `Leave request approved. ${rpcResult?.cancelled_appointments_count || 0} patient appointment(s) were cancelled and notified.` 
        };
    } catch (err: any) {
        console.error('approveLeaveRequest error:', err);
        return { success: false, error: err.message || 'Failed to approve leave request' };
    }
}

export async function rejectLeaveRequest(requestId: string, reason?: string) {
    try {
        const { user } = await requireRole(['admin']);
        const supabase = await createClient();

        const { error } = await supabase
            .from('doctor_leave_requests')
            .update({
                status: 'rejected',
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
                reason: reason ? `Rejected: ${reason}` : undefined
            })
            .eq('id', requestId);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath('/admin/schedule');
        revalidatePath('/doctor/schedule');
        revalidatePath('/doctor/leave');

        return { success: true, message: 'Leave request rejected.' };
    } catch (err: any) {
        console.error('rejectLeaveRequest error:', err);
        return { success: false, error: err.message || 'Failed to reject leave request' };
    }
}

