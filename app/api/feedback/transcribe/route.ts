import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/queue/server';
import { allow } from '@/lib/queue/rateLimit';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };
const MAX_BYTES = 2 * 1024 * 1024;
const OPENROUTER_STT_URL = 'https://openrouter.ai/api/v1/audio/transcriptions';

/** MIME type from the browser recorder -> format name OpenRouter expects. */
const FORMATS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Patient voice feedback -> text. Audio is sent to OpenRouter and never stored or logged.
 * Only the transcript goes back to the browser.
 */
export async function POST(req: Request) {
  const u = await getApiUser();
  if (!u) return json({ error: 'Login required' }, 401);
  if (u.role !== 'patient') return json({ error: 'Only for patients' }, 403);
  if (!allow(`feedback-stt:${u.userId}`, 20)) return json({ error: 'Too many requests.' }, 429);

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get('audio');
  } catch {
    return json({ error: 'Expected a multipart audio upload.' }, 400);
  }
  if (!(file instanceof Blob)) return json({ error: 'Missing audio file.' }, 400);

  const format = FORMATS[(file.type || '').split(';')[0].trim()];
  if (!format) return json({ error: 'Unsupported audio type.' }, 400);
  if (file.size === 0) return json({ error: 'Empty recording.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'Recording is too long. Keep it under about a minute.' }, 400);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json({ error: 'Voice input is not configured.' }, 502);

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString('base64');
    const res = await fetch(OPENROUTER_STT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.STT_MODEL || 'openai/whisper-1',
        input_audio: { data, format },
        language: 'en',
      }),
    });
    if (!res.ok) {
      console.error('[feedback stt] upstream status', res.status);
      return json({ error: 'Could not transcribe right now. You can type your comment instead.' }, 502);
    }
    const body = (await res.json()) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    return json({ text }, 200);
  } catch (e) {
    console.error('[feedback stt] request failed', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'Could not transcribe right now. You can type your comment instead.' }, 502);
  }
}
