import { describe, it, expect } from 'vitest';
import { FeedbackInputSchema } from '@/lib/feedback/schema';

describe('FeedbackInputSchema', () => {
  it('accepts two ratings and no comment', () => {
    const r = FeedbackInputSchema.parse({ ratingA: 4, ratingB: 5 });
    expect(r.comment).toBe('');
    expect(r.inputMethod).toBe('typed');
  });
  it('trims the comment and turns whitespace-only into empty', () => {
    expect(FeedbackInputSchema.parse({ ratingA: 1, ratingB: 1, comment: '   ' }).comment).toBe('');
    expect(FeedbackInputSchema.parse({ ratingA: 1, ratingB: 1, comment: '  ok  ' }).comment).toBe('ok');
  });
  it('rejects a comment over 2000 characters', () => {
    const r = FeedbackInputSchema.safeParse({ ratingA: 3, ratingB: 3, comment: 'a'.repeat(2001) });
    expect(r.success).toBe(false);
  });
  it('rejects ratings outside 1-5', () => {
    expect(FeedbackInputSchema.safeParse({ ratingA: 0, ratingB: 3 }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ ratingA: 3, ratingB: 6 }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ ratingA: 2.5, ratingB: 3 }).success).toBe(false);
  });
  it('accepts only typed or voice input methods', () => {
    expect(FeedbackInputSchema.parse({ ratingA: 2, ratingB: 2, inputMethod: 'voice' }).inputMethod).toBe('voice');
    expect(FeedbackInputSchema.safeParse({ ratingA: 2, ratingB: 2, inputMethod: 'shout' }).success).toBe(false);
  });
});
