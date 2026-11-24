'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/requireRole';
import { submitFeedbackCore } from '@/lib/feedback/submit';
import { classifyComment } from '@/lib/feedback/classify';
import { writeClassification } from '@/lib/feedback/store';

export interface SubmitLabFeedbackInput {
    labOrderId: string;
    testRating: number;
    serviceRating: number;
    comment?: string;
    inputMethod?: 'typed' | 'voice';
}

/** Patient rates a lab test they had (only after report_ready). Enforced in submit_lab_feedback. */
export async function submitLabFeedback(input: SubmitLabFeedbackInput) {
    try {
        await requireRole(['patient']);
        const supabase = await createClient();

        if (!input.labOrderId) return { success: false, error: 'Lab order ID is required' };

        const result = await submitFeedbackCore({
            kind: 'lab',
            input: {
                ratingA: Number(input.testRating),
                ratingB: Number(input.serviceRating),
                comment: input.comment ?? '',
                inputMethod: input.inputMethod ?? 'typed',
            },
            rpc: async () => {
                const { data, error } = await supabase.rpc('submit_lab_feedback', {
                    p_lab_order_id: input.labOrderId,
                    p_test_rating: Number(input.testRating),
                    p_service_rating: Number(input.serviceRating),
                    p_comment: input.comment?.trim() || null,
                    p_input_method: input.inputMethod ?? 'typed',
                });
                return { data: data as string | null, error };
            },
            classify: (text) => classifyComment(text),
            setClassification: writeClassification,
        });

        if (!result.ok) return { success: false, error: result.error };

        revalidatePath('/patient/dashboard');
        return { success: true, feedbackId: result.id, message: 'Thank you! Your feedback has been recorded.' };
    } catch (err: unknown) {
        console.error('submitLabFeedback error:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Failed to submit feedback' };
    }
}
