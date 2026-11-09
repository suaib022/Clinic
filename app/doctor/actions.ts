'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/requireRole';

export interface CancelScheduleInput {
    startDate: string;
    endDate: string;
    reason: string;
}

export async function cancelDoctorSchedule(input: CancelScheduleInput) {
    try {
        const { user } = await requireRole(['doctor', 'admin']);
        const supabase = await createClient();

        if (!input.startDate || !input.endDate) {
            return { success: false, error: 'Start date and end date are required' };
        }
        if (!input.reason?.trim()) {
            return { success: false, error: 'Cancellation reason is required' };
        }

        const formattedReason = input.reason.trim().startsWith('Schedule Cancelled:')
            ? input.reason.trim()
            : `Schedule Cancelled: ${input.reason.trim()}`;

        // Insert pending cancellation request awaiting admin approval
        const { data, error } = await supabase
            .from('doctor_leave_requests')
            .insert({
                doctor_id: user.id,
                type: 'full_day',
                start_date: input.startDate,
                end_date: input.endDate,
                reason: formattedReason,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            console.error('Error submitting cancellation request:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/doctor/schedule');
        revalidatePath('/doctor/leave');
        revalidatePath('/doctor/appointments');
        revalidatePath('/doctor/all-appointments');
        revalidatePath('/admin/schedule');

        return {
            success: true,
            summary: data,
            message: `Schedule cancellation request submitted successfully. It is now pending administrator approval before appointments are cancelled.`
        };
    } catch (err: any) {
        console.error('cancelDoctorSchedule error:', err);
        return { success: false, error: err.message || 'Failed to submit cancellation request' };
    }
}

export async function getScheduleImpactPreview(startDate: string, endDate: string) {
    try {
        const { user } = await requireRole(['doctor', 'admin']);
        const supabase = await createClient();

        const { data: appts, error } = await supabase
            .from('appointments')
            .select('id, serial_no, payment_status, paid_amount, status, appointment_date, patient:patients(full_name)')
            .eq('doctor_id', user.id)
            .gte('appointment_date', startDate)
            .lte('appointment_date', endDate)
            .in('status', ['scheduled', 'checked_in', 'hold', 'in_consultation']);

        if (error) {
            return { success: false, error: error.message };
        }

        const count = appts?.length || 0;
        const paidCount = appts?.filter(a => a.payment_status === 'paid' && Number(a.paid_amount) > 0).length || 0;

        return {
            success: true,
            totalAppointments: count,
            paidAppointments: paidCount,
            appointments: appts || []
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
