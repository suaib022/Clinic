import { z } from 'zod';
import { CATEGORIES, rulesClassify, type Category, type Sentiment } from './rules';

export type { Category, Sentiment };

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const LlmOutput = z.object({
  categories: z.array(z.enum(['positive', 'negative', 'improvement', 'staff'])),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
});

export interface ClassifyResult {
  categories: Category[];
  sentiment: Sentiment;
  source: 'llm' | 'rules';
}

const PROMPT = `You classify a patient's feedback comment about a hospital visit or lab test.
Return ONLY JSON: {"categories": [...], "sentiment": "positive"|"neutral"|"negative"}.
categories is a list and can hold several tags. Pick every tag that applies:
- "positive": any praise, thanks or satisfaction (about the doctor, the test, or the hospital)
- "negative": any complaint or bad experience (about the doctor, the test, or the hospital)
- "improvement": a suggestion of something to change or add
- "staff": conduct or activity of support staff (receptionist, nurse, technician, attendant, guard). Do NOT use it for the doctor's care alone.
sentiment is the overall tone of the comment.
Examples:
"Doctor was excellent but the receptionist was rude" -> {"categories":["positive","negative","staff"],"sentiment":"negative"}
"Very helpful doctor, thank you" -> {"categories":["positive"],"sentiment":"positive"}
"Please add parking and faster lab reports" -> {"categories":["improvement"],"sentiment":"neutral"}
Use [] when nothing fits. No other keys, no prose.`;

/**
 * Classify a comment into multi-label categories. Uses a cheap LLM; any failure
 * (network, status, bad JSON, unknown tag) falls back to keyword rules. Never throws.
 */
export async function classifyComment(
  text: string,
  opts: { fetch?: typeof fetch } = {},
): Promise<ClassifyResult> {
  const trimmed = text.trim();
  if (!trimmed) return { categories: [], sentiment: 'neutral', source: 'rules' };

  const fetchFn = opts.fetch ?? fetch;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ...rulesClassify(trimmed), source: 'rules' };

  try {
    const res = await fetchFn(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.FEEDBACK_MODEL || 'google/gemini-2.5-flash-lite',
        temperature: 0,
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: trimmed },
        ],
      }),
    });
    if (!res.ok) throw new Error(`classifier HTTP ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? '';
    const json = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    const parsed = LlmOutput.parse(json);
    const categories = CATEGORIES.filter((c) => parsed.categories.includes(c));
    return { categories, sentiment: parsed.sentiment, source: 'llm' };
  } catch {
    return { ...rulesClassify(trimmed), source: 'rules' };
  }
}
