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

        const { data, error } = await supabase.rpc('doctor_cancel_schedule', {
            p_start_date: input.startDate,
            p_end_date: input.endDate,
            p_reason: input.reason.trim(),
            p_doctor_id: user.id
        });

        if (error) {
            console.error('Error in doctor_cancel_schedule:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/doctor/schedule');
        revalidatePath('/doctor/appointments');
        revalidatePath('/doctor/all-appointments');
        revalidatePath('/doctor/dashboard');
        revalidatePath('/patient/appointments');
        revalidatePath('/patient/dashboard');

        return {
            success: true,
            summary: data,
            message: `Schedule cancelled successfully. ${data?.cancelled_appointments_count || 0} patient appointment(s) were cancelled and notified.`
        };
    } catch (err: any) {
        console.error('cancelDoctorSchedule error:', err);
        return { success: false, error: err.message || 'Failed to cancel schedule' };
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
            .in('status', ['scheduled', 'checked_in', 'hold']);

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
