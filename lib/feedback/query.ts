import type { SupabaseClient } from '@supabase/supabase-js';
import { summarize, type Summary } from './stats';

export interface FeedbackRow {
  id: string;
  when: string;
  who: string;
  ratingA: number;
  ratingB: number;
  comment: string | null;
  categories: string[];
  sentiment: string | null;
  inputMethod: string;
}

const LIMIT = 500;

/**
 * Doctor-visit feedback as seen by the caller. RLS decides the rows:
 * admin sees all, doctor sees own consultations only.
 */
export async function loadAppointmentFeedback(supabase: SupabaseClient): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from('appointment_feedbacks')
    .select('id, doctor_id, doctor_rating, service_rating, comment, categories, sentiment, input_method, visit_date, created_at')
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error || !data) return [];

  const ids = [...new Set(data.map((r) => r.doctor_id as string))];
  const { data: docs } = ids.length
    ? await supabase.from('users').select('id, full_name').in('id', ids)
    : { data: [] as { id: string; full_name: string }[] };
  const names = new Map((docs ?? []).map((d) => [d.id as string, d.full_name as string]));

  return data.map((r) => ({
    id: r.id as string,
    when: (r.visit_date as string) ?? (r.created_at as string),
    who: `Dr. ${names.get(r.doctor_id as string) ?? 'Unknown'}`,
    ratingA: r.doctor_rating as number,
    ratingB: r.service_rating as number,
    comment: (r.comment as string | null) ?? null,
    categories: (r.categories as string[] | null) ?? [],
    sentiment: (r.sentiment as string | null) ?? null,
    inputMethod: (r.input_method as string | null) ?? 'typed',
  }));
}

/** Lab-test feedback as seen by the caller. RLS: admin and technician see all. No patient names here. */
export async function loadLabFeedback(supabase: SupabaseClient): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from('lab_feedbacks')
    .select('id, test_rating, service_rating, comment, categories, sentiment, input_method, created_at, order:lab_orders(test:lab_test_types(name))')
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error || !data) return [];

  return data.map((r) => {
    const order = r.order as unknown as { test: { name: string } | null } | null;
    return {
      id: r.id as string,
      when: r.created_at as string,
      who: order?.test?.name ?? 'Lab test',
      ratingA: r.test_rating as number,
      ratingB: r.service_rating as number,
      comment: (r.comment as string | null) ?? null,
      categories: (r.categories as string[] | null) ?? [],
      sentiment: (r.sentiment as string | null) ?? null,
      inputMethod: (r.input_method as string | null) ?? 'typed',
    };
  });
}

export function summaryOf(rows: FeedbackRow[]): Summary {
  return summarize(rows.map((r) => ({ ratingA: r.ratingA, ratingB: r.ratingB, categories: r.categories })));
}
