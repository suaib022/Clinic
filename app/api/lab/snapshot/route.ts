import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/queue/server';
import { allow } from '@/lib/queue/rateLimit';
import { getLabSnapshot, LabAccessError } from '@/lib/lab/server';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const Query = z.object({ lineId: z.string().uuid() });

/** Live lab line for staff (lab staff and admin see names; doctors and compounders see the queue without names). */
export async function GET(req: NextRequest) {
  const u = await getApiUser();
  if (!u) return json({ error: 'Login required' }, 401);
  if (u.role === 'patient') return json({ error: 'Not allowed' }, 403);
  const q = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return json({ error: 'Invalid lineId' }, 400);
  if (!allow(`lab-snapshot:${u.userId}`, 120)) return json({ error: 'Too many requests. Please slow down.' }, 429);
  try {
    return json(await getLabSnapshot(u.supabase, q.data.lineId));
  } catch (e) {
    if (e instanceof LabAccessError) return json({ error: e.message }, e.status);
    console.error('[lab api]', e);
    return json({ error: 'Lab data is unavailable right now.' }, 500);
  }
}
