import { describe, it, expect, vi } from 'vitest';
import { submitFeedbackCore } from '@/lib/feedback/submit';

const baseInput = { ratingA: 4, ratingB: 5, comment: '', inputMethod: 'typed' as const };

function deps(over: Partial<Parameters<typeof submitFeedbackCore>[0]> = {}) {
  return {
    kind: 'appointment' as const,
    input: baseInput,
    rpc: vi.fn(async () => ({ data: 'fb-1', error: null })),
    classify: vi.fn(async () => ({ categories: ['positive'] as const, sentiment: 'positive' as const, source: 'llm' as const })),
    setClassification: vi.fn(async () => undefined),
    ...over,
  } as Parameters<typeof submitFeedbackCore>[0];
}

describe('submitFeedbackCore', () => {
  it('rejects invalid input before any call', async () => {
    const d = deps({ input: { ...baseInput, ratingA: 9 } as never });
    const r = await submitFeedbackCore(d);
    expect(r.ok).toBe(false);
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it('empty comment: saves, no classifier call, no classification write', async () => {
    const d = deps();
    const r = await submitFeedbackCore(d);
    expect(r).toEqual({ ok: true, id: 'fb-1' });
    expect(d.classify).not.toHaveBeenCalled();
    expect(d.setClassification).not.toHaveBeenCalled();
  });

  it('with comment: classifies and writes categories back', async () => {
    const d = deps({ input: { ...baseInput, comment: 'Doctor great' } });
    const r = await submitFeedbackCore(d);
    expect(r.ok).toBe(true);
    expect(d.classify).toHaveBeenCalledWith('Doctor great');
    expect(d.setClassification).toHaveBeenCalledWith('appointment', 'fb-1', ['positive'], 'positive');
  });

  it('classifier throws: still ok, and no classification written', async () => {
    const d = deps({
      input: { ...baseInput, comment: 'Doctor great' },
      classify: vi.fn(async () => {
        throw new Error('boom');
      }) as never,
    });
    const r = await submitFeedbackCore(d);
    expect(r).toEqual({ ok: true, id: 'fb-1' });
    expect(d.setClassification).not.toHaveBeenCalled();
  });

  it('classification write fails: still ok', async () => {
    const d = deps({
      input: { ...baseInput, comment: 'Doctor great' },
      setClassification: vi.fn(async () => {
        throw new Error('db down');
      }),
    });
    expect((await submitFeedbackCore(d)).ok).toBe(true);
  });

  it('RPC error (e.g. already submitted): returns the message, no classify', async () => {
    const d = deps({
      input: { ...baseInput, comment: 'x' },
      rpc: vi.fn(async () => ({ data: null, error: { message: 'Feedback has already been submitted for this test.' } })),
    });
    const r = await submitFeedbackCore(d);
    expect(r).toEqual({ ok: false, error: 'Feedback has already been submitted for this test.' });
    expect(d.classify).not.toHaveBeenCalled();
  });
});
