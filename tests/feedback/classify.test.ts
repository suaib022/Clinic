import { describe, it, expect, vi, beforeAll } from 'vitest';
import { classifyComment } from '@/lib/feedback/classify';
import { rulesClassify } from '@/lib/feedback/rules';

function llmReply(content: string) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }),
  ) as unknown as typeof fetch;
}

describe('rulesClassify', () => {
  it('returns no categories for empty text', () => {
    expect(rulesClassify('   ')).toEqual({ categories: [], sentiment: 'neutral' });
  });
  it('tags staff behaviour and negative sentiment', () => {
    const r = rulesClassify('The receptionist was rude to me');
    expect(r.categories).toContain('staff');
    expect(r.categories).toContain('negative');
    expect(r.sentiment).toBe('negative');
  });
  it('tags improvement suggestions', () => {
    expect(rulesClassify('Please improve the waiting area').categories).toContain('improvement');
  });
  it('tags positive praise', () => {
    const r = rulesClassify('Excellent doctor, very helpful');
    expect(r.categories).toContain('positive');
    expect(r.sentiment).toBe('positive');
  });
});

describe('classifyComment', () => {
  beforeAll(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
  });
  it('skips the LLM for empty text', async () => {
    const f = llmReply('{}');
    const r = await classifyComment('', { fetch: f });
    expect(r).toEqual({ categories: [], sentiment: 'neutral', source: 'rules' });
    expect(f).not.toHaveBeenCalled();
  });

  it('uses LLM output when valid', async () => {
    const f = llmReply(JSON.stringify({ categories: ['staff', 'positive'], sentiment: 'positive' }));
    const r = await classifyComment('Doctor great, the nurse was kind', { fetch: f });
    expect(r).toEqual({ categories: ['positive', 'staff'], sentiment: 'positive', source: 'llm' });
  });

  it('falls back to rules on invalid JSON', async () => {
    const r = await classifyComment('The receptionist was rude', { fetch: llmReply('not json') });
    expect(r.source).toBe('rules');
    expect(r.categories).toContain('staff');
  });

  it('falls back to rules on an unknown tag', async () => {
    const f = llmReply(JSON.stringify({ categories: ['foo'], sentiment: 'positive' }));
    const r = await classifyComment('Great visit', { fetch: f });
    expect(r.source).toBe('rules');
  });

  it('falls back to rules when the request throws', async () => {
    const f = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const r = await classifyComment('Excellent doctor', { fetch: f });
    expect(r.source).toBe('rules');
    expect(r.categories).toContain('positive');
  });

  it('falls back to rules on a non-200 response', async () => {
    const f = vi.fn(async () => new Response('err', { status: 500 })) as unknown as typeof fetch;
    const r = await classifyComment('Excellent doctor', { fetch: f });
    expect(r.source).toBe('rules');
  });
});
