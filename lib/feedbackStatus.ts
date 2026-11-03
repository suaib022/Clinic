// lib/feedbackStatus.ts

export interface FeedbackInfo {
    id: string;
    doctor_rating: number;
    service_rating: number;
    overall_rating: number;
    comment: string | null;
    created_at: string;
}

export interface FeedbackStatusResult {
    status: 'submitted' | 'available' | 'expired' | 'not_eligible';
    feedback: FeedbackInfo | null;
    daysLeft: number;
    diffDays: number;
    canSubmit: boolean;
}

export function getAppointmentFeedbackStatus(appointment: {
    status: string;
    appointment_date: string;
    appointment_feedbacks?: FeedbackInfo | FeedbackInfo[] | null;
}): FeedbackStatusResult {
    if (appointment.status !== 'completed') {
        return {
            status: 'not_eligible',
            feedback: null,
            daysLeft: 0,
            diffDays: 0,
            canSubmit: false,
        };
    }

    const rawFb = appointment.appointment_feedbacks;
    const feedback = Array.isArray(rawFb) ? (rawFb.length > 0 ? rawFb[0] : null) : (rawFb || null);

    if (feedback) {
        return {
            status: 'submitted',
            feedback,
            daysLeft: 0,
            diffDays: 0,
            canSubmit: false,
        };
    }

    // Parse appointment_date (YYYY-MM-DD)
    const [year, month, day] = appointment.appointment_date.split('-').map(Number);
    const visitDate = new Date(year, month - 1, day);
    visitDate.setHours(0, 0, 0, 0);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = today.getTime() - visitDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // The feedback window is 7 days from visit date
    const daysLeft = Math.max(0, 7 - diffDays);
    const isExpired = diffDays > 7;

    return {
        status: isExpired ? 'expired' : 'available',
        feedback: null,
        daysLeft,
        diffDays,
        canSubmit: !isExpired,
    };
}
