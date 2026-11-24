export type Category = 'positive' | 'negative' | 'improvement' | 'staff';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export const CATEGORIES: readonly Category[] = ['positive', 'negative', 'improvement', 'staff'];

const KEYWORDS: Record<Category, RegExp> = {
  positive: /\b(good|great|excellent|helpful|kind|thank|thanks|satisf\w*|best|friendly|professional|nice|clean)\b/i,
  negative: /\b(bad|poor|rude|slow|worst|terrible|dirty|wait\w*|angry|unhappy|disappoint\w*|horrible|ignored|late)\b/i,
  improvement: /\b(improve\w*|should|could|suggest\w*|recommend\w*|needs? to|better if|please)\b/i,
  staff: /\b(staff|receptionist|nurse|nurses|reception|technician|attendant|guard|employee|worker|desk|behaviou?r|rude)\b/i,
};

const POSITIVE_WORDS = /\b(good|great|excellent|helpful|kind|thank|thanks|satisf\w*|best|friendly|nice|clean)\b/gi;
const NEGATIVE_WORDS = /\b(bad|poor|rude|slow|worst|terrible|dirty|angry|unhappy|disappoint\w*|horrible|ignored|late)\b/gi;

/** Keyword fallback used when the LLM fails. Pure, no I/O. */
export function rulesClassify(text: string): { categories: Category[]; sentiment: Sentiment } {
  const t = text.trim();
  if (!t) return { categories: [], sentiment: 'neutral' };

  const categories = CATEGORIES.filter((c) => KEYWORDS[c].test(t));
  const pos = (t.match(POSITIVE_WORDS) ?? []).length;
  const neg = (t.match(NEGATIVE_WORDS) ?? []).length;
  const sentiment: Sentiment = pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
  return { categories, sentiment };
}
