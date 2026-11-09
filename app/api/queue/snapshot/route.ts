import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { getApiUser, getQueueSnapshot } from '@/lib/queue/server';
import { allow } from '@/lib/queue/rateLimit';
import { json, errorResponse } from '../_http';

const Query = z.object({
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** DSS-41: live queue for staff (doctor: own; compounder: assigned doctors; admin: all). */
export async function GET(req: NextRequest) {
  const u = await getApiUser();
  if (!u) return json({ error: 'Login required' }, 401);
  if (u.role === 'patient') return json({ error: 'Not allowed' }, 403);
  const q = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return json({ error: 'Invalid doctorId or date' }, 400);
  if (!allow(`snapshot:${u.userId}`, 120)) return json({ error: 'Too many requests. Please slow down.' }, 429);
  try {
    return json(await getQueueSnapshot(u.supabase, q.data.doctorId, q.data.date));
  } catch (e) {
    return errorResponse(e);
  }
}
