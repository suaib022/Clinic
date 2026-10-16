'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/requireRole';
import { headers } from 'next/headers';

export interface SubmitFeedbackInput {
    appointmentId: string;
    doctorRating: number;
    serviceRating: number;
    comment?: string;
}

export async function submitAppointmentFeedback(input: SubmitFeedbackInput) {
    try {
        const { user } = await requireRole(['patient']);
        const supabase = await createClient();

        const doctorRating = Number(input.doctorRating);
        const serviceRating = Number(input.serviceRating);
        const comment = input.comment?.trim() || '';

        if (!input.appointmentId) {
            return { success: false, error: 'Appointment ID is required' };
        }

        if (isNaN(doctorRating) || doctorRating < 1 || doctorRating > 5) {
            return { success: false, error: 'Doctor rating must be between 1 and 5 stars' };
        }

        if (isNaN(serviceRating) || serviceRating < 1 || serviceRating > 5) {
            return { success: false, error: 'Service quality rating must be between 1 and 5 stars' };
        }

        // Gather request metadata (user-agent, ip, timestamp)
        const headerList = await headers();
        const userAgent = headerList.get('user-agent') || 'Unknown';
        const clientIp = headerList.get('x-forwarded-for') || headerList.get('x-real-ip') || '127.0.0.1';

        const metadata = {
            submitted_from: 'patient_portal',
            user_agent: userAgent,
            client_ip: clientIp,
            submitted_at: new Date().toISOString()
        };

        // Call RPC submit_appointment_feedback
        const { data: feedbackId, error } = await supabase.rpc('submit_appointment_feedback', {
            p_appointment_id: input.appointmentId,
            p_doctor_rating: doctorRating,
            p_service_rating: serviceRating,
            p_comment: comment || null,
            p_metadata: metadata
        });

        if (error) {
            console.error('Error submitting feedback:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/patient/appointments');
        revalidatePath('/patient/dashboard');

        return { 
            success: true, 
            feedbackId,
            message: 'Thank you! Your feedback has been recorded successfully.' 
        };
    } catch (err: any) {
        console.error('submitAppointmentFeedback error:', err);
        return { success: false, error: err.message || 'Failed to submit feedback' };
    }
}

export async function requestAppointmentRefund(appointmentId: string, reason?: string) {
    try {
        const { user } = await requireRole(['patient', 'admin']);
        const supabase = await createClient();

        if (!appointmentId) return { success: false, error: 'Appointment ID required' };

        const { data, error } = await supabase.rpc('process_patient_refund', {
            p_appointment_id: appointmentId,
            p_refund_reason: reason || 'Patient requested refund for cancelled schedule'
        });

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath('/patient/appointments');
        revalidatePath('/patient/dashboard');

        return {
            success: true,
            refundedAmount: data?.refunded_amount,
            message: `Refund of BDT ${data?.refunded_amount || 0} processed successfully.`
        };
    } catch (err: any) {
        return { success: false, error: err.message || 'Failed to process refund' };
    }
}

export interface RebookAppointmentInput {
    oldAppointmentId: string;
    newDoctorId: string;
    newDate: string;
    newTime: string;
}

export async function rebookCancelledAppointment(input: RebookAppointmentInput) {
    try {
        const { user } = await requireRole(['patient', 'admin']);
        const supabase = await createClient();

        if (!input.oldAppointmentId || !input.newDoctorId || !input.newDate || !input.newTime) {
            return { success: false, error: 'All rebooking fields are required' };
        }

        const { data, error } = await supabase.rpc('rebook_cancelled_appointment', {
            p_old_appointment_id: input.oldAppointmentId,
            p_new_doctor_id: input.newDoctorId,
            p_new_date: input.newDate,
            p_new_time: input.newTime
        });

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath('/patient/appointments');
        revalidatePath('/patient/dashboard');

        return {
            success: true,
            newAppointmentId: data?.new_appointment_id,
            serialNo: data?.serial_no,
            doctorName: data?.doctor_name,
            feeTransferred: data?.fee_transferred,
            message: `Appointment successfully rebooked with Dr. ${data?.doctor_name} on ${data?.date} (Serial #${data?.serial_no}).`
        };
    } catch (err: any) {
        return { success: false, error: err.message || 'Failed to rebook appointment' };
    }
}

