import { FeedbackInputSchema, type FeedbackInput } from './schema';
import type { Category, Sentiment } from './rules';

export interface SubmitDeps {
  kind: 'appointment' | 'lab';
  /** Raw form values; validated here. */
  input: FeedbackInput;
  /** Calls the submit RPC; returns the new row id. Caller builds the RPC args. */
  rpc: () => Promise<{ data: string | null; error: { message: string } | null }>;
  classify: (text: string) => Promise<{ categories: readonly Category[]; sentiment: Sentiment }>;
  /** Service-role writer for classifier output. */
  setClassification: (kind: 'appointment' | 'lab', id: string, categories: Category[], sentiment: Sentiment) => Promise<void>;
}

export type SubmitResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Save feedback, then classify the comment. Classification is best effort:
 * its failure never turns a saved feedback into an error.
 */
export async function submitFeedbackCore(deps: SubmitDeps): Promise<SubmitResult> {
  const parsed = FeedbackInputSchema.safeParse(deps.input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid feedback.' };
  }

  const { data, error } = await deps.rpc();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Feedback could not be saved.' };

  const comment = parsed.data.comment;
  if (comment) {
    try {
      const c = await deps.classify(comment);
      await deps.setClassification(deps.kind, data, [...c.categories], c.sentiment);
    } catch (e) {
      console.error('[feedback classify]', deps.kind, e instanceof Error ? e.message : 'unknown');
    }
  }
  return { ok: true, id: data };
}
