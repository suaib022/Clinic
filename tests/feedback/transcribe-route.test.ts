import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const getApiUser = vi.fn();
vi.mock('@/lib/queue/server', () => ({ getApiUser: (...a: unknown[]) => getApiUser(...a) }));
vi.mock('@/lib/queue/rateLimit', () => ({ allow: () => true }));

import { POST } from '@/app/api/feedback/transcribe/route';

const PATIENT = { userId: 'p1', role: 'patient' };

function audioRequest(bytes: Uint8Array, type: string) {
  const fd = new FormData();
  fd.append('audio', new Blob([bytes as BlobPart], { type }), 'clip');
  return new Request('http://localhost/api/feedback/transcribe', { method: 'POST', body: fd });
}

beforeAll(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
});

describe('POST /api/feedback/transcribe', () => {
  beforeEach(() => {
    getApiUser.mockReset();
    vi.unstubAllGlobals();
  });

  it('401 when not logged in, and no OpenRouter call', async () => {
    getApiUser.mockResolvedValue(null);
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const res = await POST(audioRequest(new Uint8Array([1, 2, 3]), 'audio/webm'));
    expect(res.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it('403 for non-patient roles', async () => {
    getApiUser.mockResolvedValue({ ...PATIENT, role: 'doctor' });
    const res = await POST(audioRequest(new Uint8Array([1]), 'audio/webm'));
    expect(res.status).toBe(403);
  });

  it('400 for unsupported MIME type', async () => {
    getApiUser.mockResolvedValue(PATIENT);
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const res = await POST(audioRequest(new Uint8Array([1]), 'image/png'));
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it('400 when audio is over 2 MB', async () => {
    getApiUser.mockResolvedValue(PATIENT);
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const res = await POST(audioRequest(new Uint8Array(2 * 1024 * 1024 + 1), 'audio/webm'));
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns transcript and sends base64 audio to OpenRouter', async () => {
    getApiUser.mockResolvedValue(PATIENT);
    const f = vi.fn(async () =>
      new Response(JSON.stringify({ text: 'the doctor was kind' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', f);
    const res = await POST(audioRequest(new Uint8Array([9, 9, 9]), 'audio/webm'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'the doctor was kind' });

    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/audio/transcriptions');
    const body = JSON.parse(String(init.body));
    expect(body.input_audio.data).toBe(Buffer.from([9, 9, 9]).toString('base64'));
    expect(body.input_audio.format).toBe('webm');
    expect(body.language).toBe('en');
  });

  it('502 when OpenRouter fails, with no audio or transcript in the response', async () => {
    getApiUser.mockResolvedValue(PATIENT);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const res = await POST(audioRequest(new Uint8Array([1]), 'audio/webm'));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/AQ==/);
  });
});
