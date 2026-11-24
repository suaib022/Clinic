import { z } from 'zod';

const rating = z.number().int().min(1).max(5);

/** Shared by doctor-visit and lab-test feedback. ratingA = doctor or test, ratingB = hospital service. */
export const FeedbackInputSchema = z.object({
  ratingA: rating,
  ratingB: rating,
  comment: z
    .string()
    .max(2000, 'Comment must be 2000 characters or less.')
    .transform((s) => s.trim())
    .default(''),
  inputMethod: z.enum(['typed', 'voice']).default('typed'),
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
