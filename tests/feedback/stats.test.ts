import { describe, it, expect } from 'vitest';
import { formatRating, summarize } from '@/lib/feedback/stats';

describe('formatRating', () => {
  it('shows one decimal and the review count', () => {
    expect(formatRating(4.25, 12)).toBe('4.3 (12 reviews)');
  });
  it('uses singular for one review', () => {
    expect(formatRating(5, 1)).toBe('5.0 (1 review)');
  });
  it('returns null when there are no reviews', () => {
    expect(formatRating(null, 0)).toBeNull();
  });
});

describe('summarize', () => {
  const rows = [
    { ratingA: 5, ratingB: 4, categories: ['positive', 'staff'] },
    { ratingA: 3, ratingB: 2, categories: ['negative'] },
    { ratingA: 4, ratingB: 4, categories: [] },
  ];
  it('averages both ratings and counts rows', () => {
    const s = summarize(rows);
    expect(s.count).toBe(3);
    expect(s.avgA).toBe(4);
    expect(s.avgB).toBe(3.3);
  });
  it('counts each category once per row', () => {
    const s = summarize(rows);
    expect(s.categoryCounts).toEqual({ positive: 1, negative: 1, improvement: 0, staff: 1 });
  });
  it('handles an empty list', () => {
    const s = summarize([]);
    expect(s).toEqual({ count: 0, avgA: null, avgB: null, categoryCounts: { positive: 0, negative: 0, improvement: 0, staff: 0 } });
  });
});
