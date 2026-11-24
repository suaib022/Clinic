import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Category, Sentiment } from './rules';

/** Service-role write of classifier output. Only server code calls this. */
export async function writeClassification(
  kind: 'appointment' | 'lab',
  id: string,
  categories: Category[],
  sentiment: Sentiment,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc('set_feedback_classification', {
    p_kind: kind,
    p_id: id,
    p_categories: categories,
    p_sentiment: sentiment,
  });
  if (error) throw new Error(error.message);
}
