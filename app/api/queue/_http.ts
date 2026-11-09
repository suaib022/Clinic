import { NextResponse } from 'next/server';
import { QueueAccessError } from '@/lib/queue/server';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export function errorResponse(err: unknown) {
  if (err instanceof QueueAccessError) return json({ error: err.message }, err.status);
  console.error('[queue api]', err);
  return json({ error: 'Queue data is unavailable right now.' }, 500);
}
